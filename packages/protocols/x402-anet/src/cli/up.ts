import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { loadContext, getProvider, getSigner, getIndexer } from './context.js';
import { config, ANET_HOME } from '../config.js';
import { SkillsManager } from '../skills/manager.js';
import { createApp } from '../core/server/app.js';
import { AgentMessagingClient } from '../core/messaging/client.js';
import { startPeriodicSync } from '../core/discovery/sync.js';
import { registerAgent, setAgentMetadata } from '../core/registry/register.js';
import { buildMetadataFromSkills, toDataURI, validateMetadata, saveMetadata } from '../core/registry/metadata.js';

export function registerUpCommand(program: Command) {
  program
    .command('up')
    .description('Go live — register + serve + XMTP + sync in one command')
    .option('--port <n>', 'Port number', parseInt)
    .option('--endpoint <url>', 'Public URL (for on-chain metadata)')
    .option('--no-xmtp', 'Disable XMTP messaging')
    .option('--no-sync', 'Disable chain sync')
    .option('--no-register', 'Skip on-chain registration/update')
    .action(async (opts: any) => {
      const ctx = loadContext(true);
      const wallet = ctx.wallet!;
      const port = opts.port || ctx.settings.get('agent.port') || 3000;
      const agentName = ctx.settings.get('agent.name') || 'anet-agent';

      // 1. Load skills
      const skillsManager = new SkillsManager();
      const skills = skillsManager.list();

      console.log(`\nanet up\n`);

      // 2. Register or update on-chain (if needed)
      let agentId = ctx.registration?.agentId;

      if (opts.register !== false) {
        const endpoint = opts.endpoint || `http://localhost:${port}`;
        const metadata = buildMetadataFromSkills({
          name: agentName,
          description: `${agentName} — an autonomous agent on the anet network`,
          walletAddress: wallet.address,
          skills: skills.map(s => ({ name: s.name, description: s.description, price: s.price, tags: s.tags })),
          agentId: agentId ? parseInt(agentId) : undefined,
          chainId: config.chainId,
          httpEndpoint: endpoint,
          xmtpEnv: config.xmtpEnv,
        });

        const validation = validateMetadata(metadata);
        if (!validation.valid) {
          console.log(`  Metadata: invalid (${validation.errors.join(', ')})`);
        }

        if (!ctx.registration) {
          // First time — register
          try {
            const signer = getSigner(wallet.privateKey);
            const balance = await signer.provider!.getBalance(wallet.address);
            if (balance === 0n) {
              console.log(`  Register: skipped (no ETH for gas)`);
            } else {
              const agentURI = toDataURI(metadata);
              console.log(`  Registering on ERC-8004...`);
              const result = await registerAgent(signer, agentURI);
              agentId = result.agentId;

              // Save registration
              const regData = {
                agentId: result.agentId,
                txHash: result.txHash,
                agentURI,
                registryAddress: config.identityRegistryAddress,
                network: config.network === 'mainnet' ? 'base-mainnet' : 'base-sepolia',
                chainId: config.chainId,
                walletAddress: wallet.address,
              };
              fs.writeFileSync(path.join(ANET_HOME, 'registration.json'), JSON.stringify(regData, null, 2));
              saveMetadata(metadata, path.join(ANET_HOME, 'agent-metadata.json'));

              console.log(`  Registered: Agent #${result.agentId}`);
            }
          } catch (e: any) {
            console.log(`  Register: failed (${e.message})`);
          }
        } else {
          // Already registered — check if skills changed
          const hashPath = path.join(ANET_HOME, 'skills-hash');
          const currentHash = skillsManager.hash();
          const storedHash = fs.existsSync(hashPath) ? fs.readFileSync(hashPath, 'utf8').trim() : '';

          if (currentHash !== storedHash) {
            try {
              const signer = getSigner(wallet.privateKey);
              const agentURI = toDataURI(metadata);
              console.log(`  Updating on-chain metadata...`);
              const txHash = await setAgentMetadata(signer, agentId!, 'agentURI', agentURI);
              fs.writeFileSync(hashPath, currentHash);
              saveMetadata(metadata, path.join(ANET_HOME, 'agent-metadata.json'));
              console.log(`  Updated: tx ${txHash.slice(0, 18)}...`);
            } catch (e: any) {
              console.log(`  Update: failed (${e.message})`);
            }
          } else {
            console.log(`  On-chain: up to date`);
          }
        }
      }

      // 3. Start server with skills-driven routes
      const indexer = getIndexer();
      const app = createApp({
        walletAddress: wallet.address,
        indexer,
        agentId,
        agentName,
        skills,
      });

      // 4. Start chain sync
      if (opts.sync !== false) {
        try {
          const provider = getProvider();
          const interval = (ctx.settings.get('discovery.sync-interval') || 3600) * 1000;
          startPeriodicSync(provider, indexer, interval);
        } catch {
          // sync optional
        }
      }

      // 5. Start XMTP
      let xmtpStatus = 'disabled';
      let xmtpAddress = '';
      if (opts.xmtp !== false) {
        try {
          const endpoint = opts.endpoint || `http://localhost:${port}`;
          const messaging = new AgentMessagingClient(wallet.privateKey, {
            env: config.xmtpEnv,
            encryptionKey: config.xmtpEncryptionKey,
            dbPath: path.join(config.home, 'xmtp'),
            skills,
            agentName,
            agentId: agentId ? parseInt(agentId) : undefined,
            httpEndpoint: endpoint,
            textWebhook: ctx.settings.get('messaging.text-webhook') || undefined,
            textScript: ctx.settings.get('messaging.text-script') || undefined,
          });
          await messaging.start();
          xmtpStatus = 'live';
          xmtpAddress = messaging.getAddress?.() || wallet.address;
        } catch (e: any) {
          xmtpStatus = `failed (${e.message})`;
        }
      }

      // 6. Start server and print dashboard
      app.listen(port, () => {
        const skillSummary = skills.length > 0
          ? skills.map(s => `${s.name}${s.price ? ` (${s.price})` : ' (free)'}`).join(', ')
          : 'none — run: anet skills add <name>';

        console.log(`\n  Agent:   ${agentName}${agentId ? ` (#${agentId})` : ''}`);
        console.log(`  Wallet:  ${wallet.address}`);
        console.log(`  Skills:  ${skillSummary}`);
        console.log(`  Server:  http://localhost:${port}`);
        console.log(`  XMTP:    ${xmtpStatus}${xmtpAddress ? ` (${xmtpAddress})` : ''}`);
        console.log(`  Sync:    ${opts.sync !== false ? 'active' : 'disabled'}`);

        const endpoint = opts.endpoint || `http://localhost:${port}`;
        const hasPaidSkills = skills.some(s => !!s.price);
        if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
          console.log('');
          console.log('  ⚠ HTTP endpoint is local-only. XMTP messaging works, but other');
          console.log('    agents cannot call your paid services over HTTP.');
          if (hasPaidSkills) {
            console.log('    To accept paid calls, use a public URL:');
            console.log('      anet up --endpoint https://your-domain.com');
          }
        }
        console.log('');
      });
    });
}
