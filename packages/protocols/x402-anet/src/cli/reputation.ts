import { Command } from 'commander';
import { loadContext, getProvider, getSigner, getIndexer } from './context.js';
import { getAgentReputation, giveFeedback } from '../core/registry/reputation.js';

export function registerReputationCommand(program: Command) {
  const cmd = program
    .command('reputation')
    .description('Query and submit 8004 reputation');

  cmd
    .command('show [agent-id]')
    .description('Show reputation score from 8004 registry')
    .action(async (agentIdStr?: string) => {
      const ctx = loadContext();
      const provider = getProvider();

      let agentId: number;
      if (agentIdStr) {
        agentId = parseInt(agentIdStr);
      } else if (ctx.registration) {
        agentId = parseInt(ctx.registration.agentId);
      } else {
        console.error('No agent ID. Provide one or register first: anet register');
        return;
      }

      try {
        const rep = await getAgentReputation(provider, agentId);
        console.log(`Agent ${agentId} Reputation\n`);
        console.log(`  Score:    ${rep.score}`);
        console.log(`  Reviews:  ${rep.count}`);
      } catch (e: any) {
        console.error(`Failed to query reputation: ${e.message}`);
        console.log('\nNote: Reputation registry is mainnet only.');
      }
    });

  cmd
    .command('give <agent-id> <score>')
    .description('Submit reputation feedback (1-100)')
    .option('--tag <tag>', 'Feedback category tag')
    .action(async (agentIdStr: string, scoreStr: string, opts: any) => {
      const ctx = loadContext(true);
      const agentId = parseInt(agentIdStr);
      const score = parseInt(scoreStr);

      if (score < 1 || score > 100) {
        console.error('Score must be between 1 and 100');
        return;
      }

      const signer = getSigner(ctx.wallet!.privateKey);
      const tag = opts.tag || 'general';

      console.log(`Submitting feedback for agent ${agentId}: score=${score} tag=${tag}`);

      try {
        await giveFeedback(signer, agentId, score, tag, '', '');
        console.log('Feedback submitted on-chain.');
      } catch (e: any) {
        console.error(`Failed: ${e.message}`);
        console.log('\nNote: Reputation registry is mainnet only.');
      }
    });
}
