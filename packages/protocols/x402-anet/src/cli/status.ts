import { Command } from 'commander';
import { loadContext, getProvider, getIndexer } from './context.js';
import { config } from '../config.js';
import { getAgentReputation } from '../core/registry/reputation.js';
import { FriendsDB } from '../social/friends.js';
import { SkillsManager } from '../skills/manager.js';
import { ANET_PROTOCOL } from '../core/registry/metadata.js';

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show everything at a glance')
    .action(async () => {
      const ctx = loadContext();

      console.log(`anet v${ANET_PROTOCOL.version}\n`);

      // Wallet
      if (ctx.wallet) {
        console.log(`Wallet:     ${ctx.wallet.address}`);
        try {
          const provider = getProvider();
          const balance = await provider.getBalance(ctx.wallet.address);
          const ethBalance = Number(balance) / 1e18;
          console.log(`Balance:    ${ethBalance.toFixed(6)} ETH (${config.network})`);
        } catch {
          console.log(`Balance:    (RPC unavailable)`);
        }
      } else {
        console.log('Wallet:     (not initialized — run: anet init)');
        return;
      }

      // Identity
      if (ctx.registration) {
        console.log(`Agent ID:   ${ctx.registration.agentId}`);
        console.log(`Network:    ${ctx.registration.network}`);

        try {
          const provider = getProvider();
          const rep = await getAgentReputation(provider, parseInt(ctx.registration.agentId));
          console.log(`Reputation: ${rep.score} (${rep.count} reviews)`);
        } catch {
          console.log(`Reputation: (not available on ${config.network})`);
        }
      } else {
        console.log('Agent ID:   (not registered — run: anet up)');
      }

      // Skills
      try {
        const skillsManager = new SkillsManager();
        const skills = skillsManager.list();
        if (skills.length > 0) {
          console.log(`\nSkills:`);
          for (const skill of skills) {
            const price = skill.price || 'free';
            console.log(`  ${skill.name.padEnd(20)} ${price.padEnd(10)} ${skill.handler}`);
          }
        } else {
          console.log(`\nSkills:     none — run: anet skills add <name>`);
        }
      } catch {
        console.log(`\nSkills:     none`);
      }

      // Social
      try {
        const friends = new FriendsDB();
        const friendList = friends.listFriends('active');
        const pending = friends.listPending();
        const rooms = friends.listRooms();
        console.log(`\nFriends:    ${friendList.length} active, ${pending.length} pending`);
        console.log(`Rooms:      ${rooms.length}`);
        friends.close();
      } catch {
        console.log('\nFriends:    0');
        console.log('Rooms:      0');
      }

      // Discovery index
      try {
        const indexer = getIndexer();
        const count = indexer.getAgentCount();
        const lastBlock = indexer.getSyncState('lastBlock');
        const lastSync = lastBlock ? `block ${lastBlock}` : 'never';
        console.log(`\nIndexed:    ${count} agents`);
        console.log(`Last sync:  ${lastSync}`);
        indexer.close();
      } catch {
        console.log('\nIndexed:    0 agents');
        console.log('Last sync:  never');
      }

      // Budget
      const maxPerTx = ctx.settings.get('payments.max-per-tx');
      const maxPerSession = ctx.settings.get('payments.max-per-session');
      console.log(`\nBudget:     $${maxPerSession}/session, $${maxPerTx}/tx`);

      // Config highlights
      console.log(`Signing:    ${ctx.settings.get('signing.policy')}`);
      console.log(`Min-rep:    ${ctx.settings.get('social.min-friend-rep')} (friend threshold)`);

      // Protocol
      console.log(`\nProtocol:   anet v${ANET_PROTOCOL.version} (${ANET_PROTOCOL.features.join(', ')})`);
    });
}
