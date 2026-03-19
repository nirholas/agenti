import { Command } from 'commander';
import { loadContext, getProvider } from './context.js';
import { getAgentReputation } from '../core/registry/reputation.js';

export function registerIdentityCommand(program: Command) {
  const cmd = program
    .command('identity')
    .description('Agent identity (derived from wallet)');

  cmd
    .command('show')
    .description('Display your agent identity')
    .action(async () => {
      const ctx = loadContext(true);

      console.log('Agent Identity\n');
      console.log(`  Wallet:    ${ctx.wallet!.address}`);

      if (ctx.registration) {
        console.log(`  Agent ID:  ${ctx.registration.agentId}`);
        console.log(`  Network:   ${ctx.registration.network}`);
        console.log(`  Registry:  ${ctx.registration.registryAddress}`);
        console.log(`  TX:        ${ctx.registration.txHash}`);
        console.log(`  Block:     ${ctx.registration.blockNumber}`);

        // Query on-chain reputation
        try {
          const provider = getProvider();
          const rep = await getAgentReputation(provider, parseInt(ctx.registration.agentId));
          console.log(`\n  Reputation: ${rep.score} (${rep.count} reviews)`);
        } catch {
          console.log(`\n  Reputation: (not available on ${ctx.settings.get('network')})`);
        }
      } else {
        console.log('  Agent ID:  (not registered)');
        console.log('\n  Run: anet register');
      }

      // Show config summary
      console.log(`\n  Signing:   ${ctx.settings.get('signing.policy')}`);
      console.log(`  Min-rep:   ${ctx.settings.get('social.min-friend-rep')}`);
      console.log(`  Budget:    $${ctx.settings.get('payments.max-per-session')} USDC/session`);
    });
}
