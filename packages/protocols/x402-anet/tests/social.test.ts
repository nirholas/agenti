import fs from 'fs';
import path from 'path';
import os from 'os';
import { FriendsDB } from '../src/social/friends.js';

const TEST_DIR = path.join(os.tmpdir(), `anet-social-test-${Date.now()}`);
const DB_PATH = path.join(TEST_DIR, 'social.db3');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

console.log('Social Layer Tests\n');

fs.mkdirSync(TEST_DIR, { recursive: true });

const db = new FriendsDB(DB_PATH);

// Test 1: Add friend
db.addFriend(100, '0xabc123', 'Alice', 85);
const alice = db.getFriend(100);
assert(alice !== undefined, 'friend added');
assert(alice!.name === 'Alice', 'friend name correct');
assert(alice!.reputation === 85, 'friend reputation correct');
assert(alice!.trust_level === 'acquaintance', 'default trust level');
assert(alice!.status === 'active', 'default status');

// Test 2: Add pending friend
db.addFriend(200, '0xdef456', 'Bob', 72, 'pending-outgoing');
const bob = db.getFriend(200);
assert(bob!.status === 'pending-outgoing', 'pending status set');

// Test 3: List friends
const activeList = db.listFriends('active');
assert(activeList.length === 1, 'one active friend');
assert(activeList[0].name === 'Alice', 'active friend is Alice');

// Test 4: List pending
const pending = db.listPending();
assert(pending.length === 1, 'one pending friend');
assert(pending[0].name === 'Bob', 'pending friend is Bob');

// Test 5: Update trust
db.updateTrust(100, 'friend');
const alice2 = db.getFriend(100);
assert(alice2!.trust_level === 'friend', 'trust updated');

// Test 6: Update status
db.updateStatus(200, 'active');
const bob2 = db.getFriend(200);
assert(bob2!.status === 'active', 'status updated');

// Test 7: Record interaction
db.recordInteraction(200);
const bob3 = db.getFriend(200);
assert(bob3!.last_interaction > 0, 'interaction recorded');
assert(bob3!.trust_level === 'contact', 'auto-upgraded to contact');

// Test 8: Update reputation
db.updateReputation(100, 92);
const alice3 = db.getFriend(100);
assert(alice3!.reputation === 92, 'reputation updated');

// Test 9: Remove friend
db.removeFriend(200);
assert(db.getFriend(200) === undefined, 'friend removed');

// Test 10: List all friends
const all = db.listFriends();
assert(all.length === 1, 'one friend remaining');

// Room tests
console.log('\nRoom Tests\n');

// Test 11: Create room
db.createRoom('r-001', 'defi-research', 70, false);
const room = db.getRoom('r-001');
assert(room !== undefined, 'room created');
assert(room.name === 'defi-research', 'room name correct');
assert(room.min_reputation === 70, 'room min-rep correct');
assert(room.invite_only === 0, 'room not invite-only');

// Test 12: Create invite-only room
db.createRoom('r-002', 'private-chat', 90, true);
const room2 = db.getRoom('r-002');
assert(room2.invite_only === 1, 'invite-only room');

// Test 13: List rooms
const rooms = db.listRooms();
assert(rooms.length === 2, 'two rooms');

// Test 14: Add room members
db.addRoomMember('r-001', 100);
db.addRoomMember('r-001', 300);
const members = db.getRoomMembers('r-001');
assert(members.length === 2, 'two room members');

// Test 15: Room member count
const roomUpdated = db.getRoom('r-001');
assert(roomUpdated.member_count === 2, 'member count updated');

// Test 16: Delete room
db.deleteRoom('r-002');
assert(db.getRoom('r-002') === undefined, 'room deleted');
assert(db.listRooms().length === 1, 'one room remaining');

db.close();

// Cleanup
fs.rmSync(TEST_DIR, { recursive: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
