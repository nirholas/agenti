import { Command } from 'commander';
import path from 'path';
import { loadContext, getProvider, getIndexer } from './context.js';
import { config } from '../config.js';
import { createApp } from '../core/server/app.js';
import { AgentMessagingClient } from '../core/messaging/client.js';
import { startPeriodicSync } from '../core/discovery/sync.js';
import { SkillsManager } from '../skills/manager.js';

export function registerServeCommand(program: Command) {
  program
    .command('serve')
    .description('Start agent HTTP server with ERC-8128 auth + X402 payments + discovery')
    .option('--port <n>', 'Port number', parseInt)
    .option('--no-xmtp', 'Disable XMTP messaging')
    .option('--no-sync', 'Disable chain sync')
    .action(async (opts: any) => {
      const ctx = loadContext(true);
      const wallet = ctx.wallet!;
      const port = opts.port || ctx.settings.get('agent.port') || 3000;

      // Load skills
      const skillsManager = new SkillsManager();
      const skills = skillsManager.list();
      const skillSummary = skills.length > 0
        ? skills.map(s => `${s.name}${s.price ? ` (${s.price})` : ' (free)'}`).join(', ')
        : 'none — run: anet skills add <name>';

      console.log(`Starting anet server...\n`);
      console.log(`  Wallet:  ${wallet.address}`);
      console.log(`  Network: ${ctx.settings.get('network')}`);
      console.log(`  Port:    ${port}`);
      console.log(`  Skills:  ${skillSummary}`);

      if (ctx.registration) {
        console.log(`  Agent:   ${ctx.registration.agentId}`);
      }

      // Initialize discovery indexer
      const indexer = getIndexer();

      // Start chain sync
      if (opts.sync !== false) {
        try {
          const provider = getProvider();
          const blockNum = await provider.getBlockNumber();
          console.log(`  Chain:   block ${blockNum}`);
          const interval = (ctx.settings.get('discovery.sync-interval') || 3600) * 1000;
          startPeriodicSync(provider, indexer, interval);
        } catch {
          console.log('  Chain:   sync skipped (RPC unavailable)');
        }
      }

      // Start XMTP
      if (opts.xmtp !== false) {
        try {
          const agentId = ctx.registration?.agentId;
          const messaging = new AgentMessagingClient(wallet.privateKey, {
            env: config.xmtpEnv,
            encryptionKey: config.xmtpEncryptionKey,
            dbPath: path.join(config.home, 'xmtp'),
            skills,
            agentName: ctx.settings.get('agent.name') || 'anet-agent',
            agentId: agentId ? parseInt(agentId) : undefined,
            httpEndpoint: `http://localhost:${port}`,
            textWebhook: ctx.settings.get('messaging.text-webhook') || undefined,
            textScript: ctx.settings.get('messaging.text-script') || undefined,
          });
          await messaging.start();
          console.log(`  XMTP:    live`);
        } catch (e: any) {
          console.log(`  XMTP:    failed (${e.message})`);
        }
      }

      // Start HTTP server (reuse skills loaded at top)
      const agentName = ctx.settings.get('agent.name') || 'anet-agent';
      const app = createApp({
        walletAddress: wallet.address,
        indexer,
        agentId: ctx.registration?.agentId,
        agentName,
        skills,
      });

      app.listen(port, () => {
        console.log(`\n  Server running on http://localhost:${port}`);
        console.log(`  Health:  http://localhost:${port}/health`);
        console.log(`  Info:    http://localhost:${port}/api/info`);
        console.log(`  Agents:  http://localhost:${port}/api/agents`);

        if (skills.some(s => !!s.price)) {
          console.log('');
          console.log('  ⚠ Running locally — XMTP messaging works, but paid HTTP');
          console.log('    services are only reachable on this machine.');
          console.log('    For production, use: anet up --endpoint https://your-domain.com');
        }
      });
    });
}
