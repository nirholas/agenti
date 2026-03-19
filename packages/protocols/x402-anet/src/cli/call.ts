import { Command } from 'commander';
import { loadContext, getSigner, getProvider, getIndexer } from './context.js';
import { signRequest } from '../core/auth/signer.js';
import { X402Client } from '../core/payments/client.js';
import { BudgetManager } from '../core/payments/budget.js';
import { PaymentTracker } from '../core/payments/tracker.js';
import { giveFeedback } from '../core/registry/reputation.js';
import { FriendsDB } from '../social/friends.js';
import { HookEngine } from '../hooks/engine.js';
import { SettingsManager } from '../settings/manager.js';
import { config, ANET_HOME } from '../config.js';
import { ethers } from 'ethers';
import path from 'path';

export function registerCallCommand(program: Command) {
  program
    .command('call <agent-id> <service>')
    .description('Call a service (auto-resolve from 8004, auto-sign with 8128, auto-pay with X402, auto-reputation)')
    .option('--payload <json>', 'JSON payload')
    .option('--no-feedback', 'Skip auto-reputation feedback')
    .action(async (agentIdStr: string, service: string, opts: any) => {
      const ctx = loadContext(true);
      const wallet = ctx.wallet!;
      const agentId = parseInt(agentIdStr);

      if (isNaN(agentId)) {
        console.error(`Invalid agent ID: "${agentIdStr}" — must be a numeric ERC-8004 agent ID.`);
        return;
      }

      // Validate payload BEFORE any network calls (sync can take 30s+)
      let payload: any = {};
      if (opts.payload) {
        try {
          payload = JSON.parse(opts.payload);
        } catch (e: any) {
          const snippet = opts.payload.length > 80
            ? opts.payload.slice(0, 80) + '...'
            : opts.payload;
          console.error(`Invalid JSON payload: ${e.message}`);
          console.error(`  Received: ${snippet}`);
          console.error(`  Tip: Ensure the payload is valid JSON, e.g. --payload '{"key":"value"}'`);
          return;
        }
      }

      // Auto-resolve agent endpoint from 8004 registry
      const indexer = getIndexer();
      let agent = indexer.getAgent(agentId);

      if (!agent) {
        // Try single-agent lookup first (fast), then fall back to sync
        console.log(`Agent ${agentId} not in local index, looking up...`);
        try {
          const { lookupAgentById } = await import('../core/discovery/sync.js');
          const lookupResult = await Promise.race([
            lookupAgentById(indexer, agentId),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
          ]);
          if (lookupResult) {
            agent = indexer.getAgent(agentId);
          }
        } catch {
          // Lookup timed out or failed — try local sync
        }

        if (!agent) {
          try {
            const { smartSync } = await import('../core/discovery/sync.js');
            await Promise.race([
              smartSync(indexer, 'mainnet', { quiet: true }),
              new Promise<number>((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
            ]);
            agent = indexer.getAgent(agentId);
          } catch (e: any) {
            console.error(`Sync failed: ${e.message}`);
          }
        }
      }

      indexer.close();

      if (!agent || !agent.http_endpoint) {
        console.error(`Agent ${agentId} not found or has no HTTP endpoint.`);
        return;
      }

      const url = `${agent.http_endpoint}/api/${service}`;

      console.log(`Calling [${agentId}] ${agent.name || 'Unknown'}`);
      console.log(`  Service:  ${service}`);
      console.log(`  URL:      ${url}`);

      // Fire pre-call hook
      const settings = new SettingsManager();
      const hooks = new HookEngine(settings);
      const preResult = await hooks.fire('pre-call', {
        agentId, service, url, payload,
      });
      if (!preResult.allow) {
        console.error(`  Blocked by hook: ${preResult.reason}`);
        return;
      }

      // Sign request with ERC-8128
      const signer = getSigner(wallet.privateKey);
      const signed = await signRequest('POST', url, JSON.stringify(payload), signer);
      console.log(`  Auth:     ERC-8128 (${wallet.address})`);

      // X402 auto-payment
      const budget = new BudgetManager({
        maxPerTransaction: ctx.settings.get('payments.max-per-tx') || 1.00,
        maxPerSession: ctx.settings.get('payments.max-per-session') || 10.00,
      });
      const tracker = new PaymentTracker(path.join(ANET_HOME, 'payments.jsonl'));
      const x402 = new X402Client(signer, { budgetManager: budget, tracker });

      // Track metrics for auto-reputation
      const startTime = Date.now();
      let success = false;
      let responseStatus = 0;

      try {
        const response = await x402.fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Signature': signed.signatureHeader,
          },
          body: JSON.stringify(payload),
        });

        responseStatus = response.status;
        const data = await response.json();
        success = response.status >= 200 && response.status < 300;

        console.log(`\n  Status: ${response.status}`);
        console.log(JSON.stringify(data, null, 2));
      } catch (e: any) {
        console.error(`\n  Call failed: ${e.message}`);
      }

      const responseTime = Date.now() - startTime;

      // Per-call feedback score (0-100)
      // Only submitted on success, so this reflects quality of a successful interaction.
      // Response time penalty: lose up to 20 points for slow responses (>10s)
      const timePenalty = Math.min(20, Math.round((responseTime / 10000) * 20));
      const feedbackScore = success ? 100 - timePenalty : 0;

      console.log(`\n  Metrics: ${responseTime}ms, ${success ? 'success' : 'failed'}, score: ${feedbackScore}`);

      // Submit on-chain feedback via ERC-8004 reputation registry
      const autoFeedback = ctx.settings.get('reputation.auto-feedback') ?? true;
      if (success && autoFeedback && opts.feedback !== false && config.network === 'mainnet') {
        try {
          // Create a mainnet signer for the reputation registry
          const mainnetProvider = new ethers.JsonRpcProvider(config.baseRpcUrl);
          const mainnetSigner = new ethers.Wallet(wallet.privateKey, mainnetProvider);

          const txHash = await giveFeedback(
            mainnetSigner,
            agentId,
            feedbackScore,     // value: per-call score (0-100)
            service,           // tag1: service name
            'anet',            // tag2: caller stack identifier
            url,               // ref: the endpoint called
          );
          console.log(`  Feedback: score ${feedbackScore} submitted on-chain (tx: ${txHash.slice(0, 18)}...)`);
        } catch (e: any) {
          // Non-blocking — don't fail the call over reputation
          console.log(`  Feedback: skipped (${e.message})`);
        }
      } else if (success && autoFeedback && config.network !== 'mainnet') {
        console.log(`  Feedback: skipped (reputation registry is mainnet-only)`);
      }

      // Fire post-call hook with metrics
      await hooks.fire('post-call', {
        agentId, service, responseTime, success, responseStatus,
        reputationScore: feedbackScore,
      });

      // Fire post-interaction hook
      await hooks.fire('post-interaction', {
        type: 'service-call',
        agentId,
        service,
        outcome: success ? 'success' : 'failure',
        responseTime,
        reputationScore: feedbackScore,
      });

      // Auto-upgrade trust for existing friends based on interaction
      try {
        const friends = new FriendsDB();
        const friend = friends.getFriend(agentId);
        if (friend) {
          friends.recordInteraction(agentId);
          // Upgrade trust on repeated successful paid interactions
          if (success && friend.trust_level === 'friend' && friend.reputation >= 80) {
            friends.updateTrust(agentId, 'trusted');
            console.log(`  Trust upgraded: ${friend.name} -> trusted`);
          }
        }
        friends.close();
      } catch { /* no friends db yet */ }
    });
}
