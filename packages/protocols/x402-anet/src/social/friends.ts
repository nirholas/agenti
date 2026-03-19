import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ANET_HOME } from '../config.js';

export type TrustLevel = 'unknown' | 'acquaintance' | 'contact' | 'friend' | 'trusted';

export interface Friend {
  agent_id: number;
  wallet_address: string;
  name: string;
  trust_level: TrustLevel;
  reputation: number;
  added_at: number;
  last_interaction: number;
  status: 'active' | 'pending-outgoing' | 'pending-incoming';
  notes: string;
}

export class FriendsDB {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const p = dbPath || path.join(ANET_HOME, 'social.db3');
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(p);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS friends (
        agent_id INTEGER PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        name TEXT DEFAULT '',
        trust_level TEXT DEFAULT 'unknown',
        reputation REAL DEFAULT 0,
        added_at INTEGER NOT NULL,
        last_interaction INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        notes TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS rooms (
        room_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        min_reputation REAL DEFAULT 0,
        invite_only INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        xmtp_group_id TEXT DEFAULT '',
        member_count INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS room_members (
        room_id TEXT NOT NULL,
        agent_id INTEGER NOT NULL,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (room_id, agent_id)
      );
    `);
  }

  addFriend(agentId: number, walletAddress: string, name: string, reputation: number, status: Friend['status'] = 'active'): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO friends (agent_id, wallet_address, name, trust_level, reputation, added_at, status)
      VALUES (?, ?, ?, 'acquaintance', ?, ?, ?)
    `).run(agentId, walletAddress, name, reputation, Date.now(), status);
  }

  removeFriend(agentId: number): void {
    this.db.prepare('DELETE FROM friends WHERE agent_id = ?').run(agentId);
  }

  getFriend(agentId: number): Friend | undefined {
    return this.db.prepare('SELECT * FROM friends WHERE agent_id = ?').get(agentId) as Friend | undefined;
  }

  listFriends(status?: Friend['status']): Friend[] {
    if (status) {
      return this.db.prepare('SELECT * FROM friends WHERE status = ? ORDER BY reputation DESC').all(status) as Friend[];
    }
    return this.db.prepare('SELECT * FROM friends ORDER BY reputation DESC').all() as Friend[];
  }

  listPending(): Friend[] {
    return this.db.prepare(
      "SELECT * FROM friends WHERE status IN ('pending-incoming', 'pending-outgoing') ORDER BY added_at DESC"
    ).all() as Friend[];
  }

  updateTrust(agentId: number, trustLevel: TrustLevel): void {
    this.db.prepare('UPDATE friends SET trust_level = ? WHERE agent_id = ?').run(trustLevel, agentId);
  }

  updateStatus(agentId: number, status: Friend['status']): void {
    this.db.prepare('UPDATE friends SET status = ? WHERE agent_id = ?').run(status, agentId);
  }

  updateReputation(agentId: number, reputation: number): void {
    this.db.prepare('UPDATE friends SET reputation = ? WHERE agent_id = ?').run(reputation, agentId);
  }

  recordInteraction(agentId: number): void {
    this.db.prepare('UPDATE friends SET last_interaction = ? WHERE agent_id = ?').run(Date.now(), agentId);

    // Auto-upgrade trust based on interaction count
    const friend = this.getFriend(agentId);
    if (friend && friend.trust_level === 'acquaintance') {
      this.updateTrust(agentId, 'contact');
    }
  }

  // Room management
  createRoom(roomId: string, name: string, minReputation: number, inviteOnly: boolean, xmtpGroupId: string = ''): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO rooms (room_id, name, min_reputation, invite_only, created_at, xmtp_group_id, member_count)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(roomId, name, minReputation, inviteOnly ? 1 : 0, Date.now(), xmtpGroupId);
  }

  getRoom(roomId: string): any {
    return this.db.prepare('SELECT * FROM rooms WHERE room_id = ?').get(roomId);
  }

  listRooms(): any[] {
    return this.db.prepare('SELECT * FROM rooms ORDER BY created_at DESC').all();
  }

  deleteRoom(roomId: string): void {
    this.db.prepare('DELETE FROM rooms WHERE room_id = ?').run(roomId);
    this.db.prepare('DELETE FROM room_members WHERE room_id = ?').run(roomId);
  }

  addRoomMember(roomId: string, agentId: number): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO room_members (room_id, agent_id, joined_at) VALUES (?, ?, ?)
    `).run(roomId, agentId, Date.now());
    this.db.prepare('UPDATE rooms SET member_count = member_count + 1 WHERE room_id = ?').run(roomId);
  }

  getRoomMembers(roomId: string): any[] {
    return this.db.prepare('SELECT * FROM room_members WHERE room_id = ?').all(roomId);
  }

  close(): void {
    this.db.close();
  }
}
