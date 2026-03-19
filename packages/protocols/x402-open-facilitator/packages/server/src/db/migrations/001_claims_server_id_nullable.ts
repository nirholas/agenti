/**
 * Migration: Make claims.server_id nullable with ON DELETE SET NULL
 *
 * Previously, deleting an API key would cascade delete all associated claims.
 * Now, claims are preserved and server_id is set to null when the key is revoked.
 */
import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  name: '001_claims_server_id_nullable',

  up(db: Database.Database): void {
    // Check if server_id column is NOT NULL (old schema)
    const tableInfo = db.prepare('PRAGMA table_info(claims)').all() as Array<{
      name: string;
      notnull: number;
    }>;
    const serverIdCol = tableInfo.find(col => col.name === 'server_id');

    // Only run if the column exists and is NOT NULL
    if (!serverIdCol || serverIdCol.notnull === 0) {
      console.log('  ↳ claims.server_id already nullable, skipping');
      return;
    }

    // SQLite doesn't support ALTER COLUMN, so we recreate the table
    db.exec(`
      -- Create new table with correct schema
      CREATE TABLE claims_new (
        id TEXT PRIMARY KEY,
        resource_owner_id TEXT NOT NULL REFERENCES resource_owners(id) ON DELETE CASCADE,
        server_id TEXT REFERENCES registered_servers(id) ON DELETE SET NULL,
        original_tx_hash TEXT NOT NULL UNIQUE,
        user_wallet TEXT NOT NULL,
        amount TEXT NOT NULL,
        asset TEXT NOT NULL,
        network TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'expired')),
        payout_tx_hash TEXT,
        reported_at TEXT NOT NULL DEFAULT (datetime('now')),
        paid_at TEXT,
        expires_at TEXT
      );

      -- Copy data
      INSERT INTO claims_new SELECT * FROM claims;

      -- Drop old table and rename
      DROP TABLE claims;
      ALTER TABLE claims_new RENAME TO claims;

      -- Recreate indexes
      CREATE INDEX idx_claims_resource_owner ON claims(resource_owner_id);
      CREATE INDEX idx_claims_user_wallet ON claims(user_wallet);
      CREATE INDEX idx_claims_status ON claims(status);
    `);
  },
};
