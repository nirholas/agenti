import { Command } from 'commander';
import crypto from 'crypto';
import { loadContext } from './context.js';
import { FriendsDB } from '../social/friends.js';

export function registerRoomCommand(program: Command) {
  const cmd = program
    .command('room')
    .description('Reputation-gated rooms (XMTP groups + 8004 rep gate)');

  cmd
    .command('create <name>')
    .description('Create a reputation-gated room')
    .option('--min-rep <n>', 'Minimum reputation to join', parseInt)
    .option('--invite-only', 'Require explicit invitation')
    .action(async (name: string, opts: any) => {
      const ctx = loadContext(true);
      const minRep = opts.minRep ?? ctx.settings.get('social.default-room-min-rep') ?? 30;
      const inviteOnly = opts.inviteOnly || false;
      const roomId = `r-${crypto.randomBytes(4).toString('hex')}`;

      const friends = new FriendsDB();
      friends.createRoom(roomId, name, minRep, inviteOnly);

      console.log(`Room created:\n`);
      console.log(`  ID:          ${roomId}`);
      console.log(`  Name:        ${name}`);
      console.log(`  Min-rep:     ${minRep}`);
      console.log(`  Invite-only: ${inviteOnly}`);

      // TODO: Create XMTP group conversation
      console.log('\nInvite friends: anet room invite <room-id> <agent-id>');
      friends.close();
    });

  cmd
    .command('list')
    .description('List your rooms')
    .action(async () => {
      const friends = new FriendsDB();
      const rooms = friends.listRooms();

      if (rooms.length === 0) {
        console.log('No rooms. Create one: anet room create <name>');
        friends.close();
        return;
      }

      console.log(`Rooms (${rooms.length}):\n`);
      for (const r of rooms) {
        console.log(`  [${r.room_id}] ${r.name.padEnd(20)} min-rep:${r.min_reputation}  members:${r.member_count}  ${r.invite_only ? 'invite-only' : 'open'}`);
      }
      friends.close();
    });

  cmd
    .command('join <room-id>')
    .description('Join a room (checks your 8004 reputation)')
    .action(async (roomId: string) => {
      const ctx = loadContext(true);
      const friends = new FriendsDB();
      const room = friends.getRoom(roomId);

      if (!room) {
        console.error(`Room ${roomId} not found`);
        friends.close();
        return;
      }

      // TODO: Check own reputation against room.min_reputation via 8004
      // TODO: Join XMTP group conversation

      if (ctx.registration) {
        friends.addRoomMember(roomId, parseInt(ctx.registration.agentId));
        console.log(`Joined room ${roomId} (${room.name})`);
      } else {
        console.error('Register first: anet register');
      }
      friends.close();
    });

  cmd
    .command('leave <room-id>')
    .description('Leave a room')
    .action(async (roomId: string) => {
      const friends = new FriendsDB();
      const room = friends.getRoom(roomId);
      if (!room) {
        console.error(`Room ${roomId} not found`);
        friends.close();
        return;
      }
      // TODO: Leave XMTP group
      console.log(`Left room ${roomId} (${room.name})`);
      friends.close();
    });

  cmd
    .command('watch <room-id>')
    .description('Stream room messages in real-time')
    .action(async (roomId: string) => {
      const friends = new FriendsDB();
      const room = friends.getRoom(roomId);
      if (!room) {
        console.error(`Room ${roomId} not found`);
        friends.close();
        return;
      }

      console.log(`Watching room: ${room.name} (${roomId})`);
      console.log('Press Ctrl+C to stop\n');

      // TODO: Stream XMTP group messages
      // For now, keep process alive
      await new Promise(() => {});
    });

  cmd
    .command('invite <room-id> <agent-id>')
    .description('Invite an agent to a room')
    .action(async (roomId: string, agentIdStr: string) => {
      const agentId = parseInt(agentIdStr);
      const friends = new FriendsDB();
      const room = friends.getRoom(roomId);

      if (!room) {
        console.error(`Room ${roomId} not found`);
        friends.close();
        return;
      }

      // TODO: Check agent reputation against room min-rep
      // TODO: Send XMTP invitation
      friends.addRoomMember(roomId, agentId);
      console.log(`Invited agent ${agentId} to room ${room.name}`);
      friends.close();
    });
}
