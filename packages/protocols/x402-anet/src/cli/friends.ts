import { Command } from 'commander';
import { loadContext, getProvider, getIndexer } from './context.js';
import { FriendsDB, TrustLevel } from '../social/friends.js';
import { AgentMessagingClient } from '../core/messaging/client.js';
import { config } from '../config.js';
import path from 'path';

async function getMessagingClient(): Promise<AgentMessagingClient | null> {
  try {
    const client = new AgentMessagingClient(config.privateKey, {
      env: config.xmtpEnv,
      dbPath: path.join(config.home, 'xmtp'),
    });
    await client.start();
    return client;
  } catch (e: any) {
    console.error(`  XMTP unavailable: ${e.message}`);
    return null;
  }
}

export function registerFriendsCommand(program: Command) {
  const cmd = program
    .command('friends')
    .description('Manage your trust network (8004 reputation + XMTP messaging)');

  cmd
    .command('list')
    .description('Show all friends with reputation')
    .action(async () => {
      const friends = new FriendsDB();
      const list = friends.listFriends('active');

      if (list.length === 0) {
        console.log('No friends yet. Find agents: anet search');
        friends.close();
        return;
      }

      console.log(`Friends (${list.length}):\n`);
      for (const f of list) {
        const trustTag = f.trust_level.padEnd(12);
        console.log(`  [${f.agent_id}] ${(f.name || 'Unknown').padEnd(20)} rep:${String(f.reputation).padEnd(4)} trust:${trustTag}`);
      }
      friends.close();
    });

  cmd
    .command('add <agent-id>')
    .description('Add a friend (checks 8004 reputation, sends XMTP request)')
    .action(async (agentIdStr: string) => {
      const ctx = loadContext(true);
      const agentId = parseInt(agentIdStr);
      const friends = new FriendsDB();

      // Check if already friends
      const existing = friends.getFriend(agentId);
      if (existing && existing.status === 'active') {
        console.log(`Already friends with agent ${agentId}`);
        friends.close();
        return;
      }

      // Look up agent in local index
      const indexer = getIndexer();
      const agent = indexer.getAgent(agentId);
      indexer.close();

      if (!agent) {
        console.error(`Agent ${agentId} not found in local index. Try: anet sync`);
        friends.close();
        return;
      }

      // Check reputation against threshold
      const minRep = ctx.settings.get('social.min-friend-rep') || 50;
      if (agent.reputation < minRep) {
        console.error(`Agent ${agentId} reputation (${agent.reputation}) below threshold (${minRep})`);
        console.log('Override with: anet config set social.min-friend-rep <lower-value>');
        friends.close();
        return;
      }

      // Send XMTP friend request
      const targetAddr = agent.xmtp_address || agent.wallet_address;
      let xmtpSent = false;

      if (targetAddr) {
        const messaging = await getMessagingClient();
        if (messaging) {
          const request = {
            type: 'friend-request',
            agentId: ctx.registration?.agentId || 0,
            name: ctx.settings.get('agent.name') || 'unknown',
            reputation: 0,
          };
          const msgId = await messaging.sendMessage(targetAddr, JSON.stringify(request));
          xmtpSent = !!msgId;
          await messaging.stop();
        }
      }

      // Add to local DB
      friends.addFriend(agentId, agent.wallet_address || '', agent.name || '', agent.reputation, 'pending-outgoing');

      console.log(`Friend request sent to agent ${agentId}`);
      console.log(`  Name: ${agent.name || 'Unknown'}`);
      console.log(`  Rep:  ${agent.reputation}`);
      console.log(`  XMTP: ${xmtpSent ? 'delivered' : 'not sent (no address or XMTP unavailable)'}`);
      console.log(`  Status: pending-outgoing`);
      friends.close();
    });

  cmd
    .command('accept <agent-id>')
    .description('Accept a pending friend request')
    .action(async (agentIdStr: string) => {
      const ctx = loadContext(true);
      const agentId = parseInt(agentIdStr);
      const friends = new FriendsDB();

      const friend = friends.getFriend(agentId);
      if (!friend) {
        console.error(`No pending request from agent ${agentId}`);
        friends.close();
        return;
      }

      if (friend.status !== 'pending-incoming') {
        console.error(`Agent ${agentId} status is ${friend.status}, not pending-incoming`);
        friends.close();
        return;
      }

      // Send XMTP acceptance
      let xmtpSent = false;
      if (friend.wallet_address) {
        const messaging = await getMessagingClient();
        if (messaging) {
          const accept = {
            type: 'friend-accept',
            agentId: ctx.registration?.agentId || 0,
            name: ctx.settings.get('agent.name') || 'unknown',
          };
          const msgId = await messaging.sendMessage(friend.wallet_address, JSON.stringify(accept));
          xmtpSent = !!msgId;
          await messaging.stop();
        }
      }

      friends.updateStatus(agentId, 'active');
      friends.updateTrust(agentId, 'friend');
      console.log(`Accepted friend request from agent ${agentId}`);
      console.log(`  XMTP: ${xmtpSent ? 'acceptance sent' : 'not sent'}`);
      friends.close();
    });

  cmd
    .command('remove <agent-id>')
    .description('Remove a friend')
    .action(async (agentIdStr: string) => {
      const agentId = parseInt(agentIdStr);
      const friends = new FriendsDB();
      friends.removeFriend(agentId);
      console.log(`Removed agent ${agentId} from friends`);
      friends.close();
    });

  cmd
    .command('pending')
    .description('Show pending friend requests')
    .action(async () => {
      const friends = new FriendsDB();
      const pending = friends.listPending();

      if (pending.length === 0) {
        console.log('No pending requests.');
        friends.close();
        return;
      }

      console.log(`Pending requests (${pending.length}):\n`);
      for (const f of pending) {
        const direction = f.status === 'pending-incoming' ? 'incoming' : 'outgoing';
        console.log(`  [${f.agent_id}] ${(f.name || 'Unknown').padEnd(20)} rep:${f.reputation}  ${direction}`);
      }
      friends.close();
    });
}
