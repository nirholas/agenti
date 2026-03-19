import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { loadContext, getSigner } from './context.js';
import { ANET_HOME, config } from '../config.js';
import { registerAgent, setAgentMetadata } from '../core/registry/register.js';
import { buildAgentMetadata, toDataURI, saveMetadata, validateMetadata, ANET_PROTOCOL } from '../core/registry/metadata.js';

export function registerRegisterCommand(program: Command) {
  program
    .command('register')
    .description('Register agent on ERC-8004 identity registry')
    .option('--name <name>', 'Agent display name')
    .option('--description <desc>', 'Agent description')
    .option('--endpoint <url>', 'HTTP service endpoint')
    .option('--mcp <url>', 'MCP server endpoint')
    .option('--a2a <url>', 'A2A protocol endpoint')
    .option('--xmtp-env <env>', 'XMTP network: production or dev', 'production')
    .option('--x402', 'Enable x402 payment support')
    .option('--image <url>', 'Agent image URL')
    .option('--no-anet', 'Skip anet protocol tagging')
    .action(async (opts) => {
      const ctx = loadContext(true);
      const wallet = ctx.wallet!;

      if (ctx.registration) {
        console.log(`Already registered as Agent ID ${ctx.registration.agentId}`);
        console.log(`Network: ${ctx.registration.network}`);
        console.log(`TX: ${ctx.registration.txHash}`);
        return;
      }

      const name = opts.name || ctx.settings.get('agent.name') || 'anet-agent';
      const description = opts.description || `${name} — an autonomous agent on the anet network`;

      const metadata = buildAgentMetadata({
        name,
        description,
        walletAddress: wallet.address,
        httpEndpoint: opts.endpoint,
        mcpEndpoint: opts.mcp,
        a2aEndpoint: opts.a2a,
        xmtpEnv: opts.xmtpEnv,
        x402Support: opts.x402 || false,
        image: opts.image,
        anetCompatible: opts.anet,
      });

      const validation = validateMetadata(metadata);
      if (!validation.valid) {
        console.error('Metadata invalid:', validation.errors.join(', '));
        return;
      }

      // Show what we're registering
      console.log('Registering on ERC-8004...\n');
      console.log(`  Name:        ${name}`);
      console.log(`  Description: ${description}`);
      console.log(`  Wallet:      ${wallet.address}`);
      console.log(`  Network:     ${config.network}`);
      console.log(`  Services:`);
      for (const s of metadata.services) {
        console.log(`    ${s.name}: ${s.endpoint}${s.version ? ` (v${s.version})` : ''}`);
      }
      if (metadata.x402Support) console.log(`  x402:        enabled`);
      if (metadata.ext) console.log(`  Stack:       ${metadata.ext.stack} v${metadata.ext.version}`);

      const signer = getSigner(wallet.privateKey);

      const balance = await signer.provider!.getBalance(wallet.address);
      if (balance === 0n) {
        console.error('\nWallet has no ETH for gas. Fund it first!');
        return;
      }

      // Save metadata locally
      const metadataPath = path.join(ANET_HOME, 'agent-metadata.json');
      saveMetadata(metadata, metadataPath);

      // Register with data: URI — fully on-chain, no external hosting needed
      const agentURI = toDataURI(metadata);
      console.log(`\n  Metadata: ${agentURI.length} bytes (data: URI, on-chain)`);
      console.log('  Sending transaction...');

      try {
        const result = await registerAgent(signer, agentURI);

        // Update metadata with registration cross-reference
        metadata.registrations = [{
          agentId: parseInt(result.agentId),
          agentRegistry: `eip155:${config.chainId}:${config.identityRegistryAddress}`,
        }];
        saveMetadata(metadata, metadataPath);

        const regData = {
          agentId: result.agentId,
          txHash: result.txHash,
          agentURI,
          registryAddress: config.identityRegistryAddress,
          network: config.network === 'mainnet' ? 'base-mainnet' : 'base-sepolia',
          chainId: config.chainId,
          walletAddress: wallet.address,
        };

        const regPath = path.join(ANET_HOME, 'registration.json');
        fs.writeFileSync(regPath, JSON.stringify(regData, null, 2));

        console.log(`\n  Registered!`);
        console.log(`  Agent ID: ${result.agentId}`);
        console.log(`  TX: ${result.txHash}`);
        console.log(`\n  Discoverable via:`);
        console.log(`    8004scan: https://www.8004scan.io/agents/${result.agentId}`);
        console.log(`    anet:     anet search --name ${name}`);
      } catch (e: any) {
        console.error(`\n  Registration failed: ${e.message}`);
      }
    });
}
