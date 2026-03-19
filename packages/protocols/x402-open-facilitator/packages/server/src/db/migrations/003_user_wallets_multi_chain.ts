/**
 * Migration: Support multiple wallets per user (one per chain)
 *
 * Changes UNIQUE constraint from user_id to (user_id, network).
 * This allows a user to have both a Solana and Base wallet.
 * Also changes default network from 'base' to 'solana'.
 */
import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  name: '003_user_wallets_multi_chain',

  up(db: Database.Database): void {
    // Check if the table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_wallets'").all() as { name: string }[];
    if (tables.length === 0) {
      console.log('  user_wallets table not found, skipping migration');
      return;
    }

    // Check if we already have the correct constraint (user_id, network)
    // SQLite stores table creation SQL in sqlite_master
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_wallets'").get() as { sql: string } | undefined;
    if (tableInfo && tableInfo.sql && tableInfo.sql.includes('UNIQUE(user_id, network)')) {
      console.log('  user_wallets already has UNIQUE(user_id, network), skipping');
      return;
    }

    // SQLite doesn't support ALTER CONSTRAINT, so we recreate the table
    db.exec(`
      -- Create new table with (user_id, network) unique constraint
      CREATE TABLE user_wallets_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        network TEXT NOT NULL DEFAULT 'solana',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, network)
      );

      -- Copy existing data
      INSERT INTO user_wallets_new (id, user_id, wallet_address, encrypted_private_key, network, created_at)
        SELECT id, user_id, wallet_address, encrypted_private_key, network, created_at
        FROM user_wallets;

      -- Drop old table and rename
      DROP TABLE user_wallets;
      ALTER TABLE user_wallets_new RENAME TO user_wallets;

      -- Recreate indexes
      CREATE INDEX idx_user_wallets_user ON user_wallets(user_id);
      CREATE INDEX idx_user_wallets_address ON user_wallets(wallet_address);
      CREATE INDEX idx_user_wallets_network ON user_wallets(user_id, network);
    `);

    console.log('  user_wallets table migrated to support multiple wallets per user');
  },
};
