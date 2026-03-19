/**
 * Migration: Add campaign_audit table and distributed_amount column
 *
 * Adds audit logging for campaign changes and tracks distributed amounts.
 */
import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  name: '002_campaign_audit_table',

  up(db: Database.Database): void {
    // Check if campaign_audit table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_audit'").get();

    if (!tables) {
      console.log('  -> Creating campaign_audit table');
      db.exec(`
        CREATE TABLE IF NOT EXISTS campaign_audit (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
          admin_user_id TEXT NOT NULL,
          action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'end')),
          changes TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_campaign_audit_campaign ON campaign_audit(campaign_id);
      `);
    }

    // Check if campaigns table has distributed_amount column
    const campaignsColumns = db.prepare("PRAGMA table_info(campaigns)").all() as { name: string }[];
    const hasDistributedAmount = campaignsColumns.some(col => col.name === 'distributed_amount');

    if (!hasDistributedAmount) {
      console.log('  -> Adding distributed_amount column to campaigns');
      db.exec("ALTER TABLE campaigns ADD COLUMN distributed_amount TEXT NOT NULL DEFAULT '0'");
    }

    // Check if campaigns status constraint includes 'published'
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='campaigns'").get() as { sql: string } | undefined;
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes("'published'")) {
      console.log('  -> Updating campaigns status constraint to include published');

      // SQLite doesn't support ALTER CONSTRAINT, so we recreate the table
      db.exec(`
        CREATE TABLE campaigns_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          pool_amount TEXT NOT NULL,
          threshold_amount TEXT NOT NULL,
          multiplier_facilitator REAL NOT NULL DEFAULT 2.0,
          starts_at TEXT NOT NULL,
          ends_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'ended')),
          distributed_amount TEXT NOT NULL DEFAULT '0',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO campaigns_new (id, name, pool_amount, threshold_amount, multiplier_facilitator, starts_at, ends_at, status, created_at, updated_at)
          SELECT id, name, pool_amount, threshold_amount, multiplier_facilitator, starts_at, ends_at, status, created_at, updated_at
          FROM campaigns;

        DROP TABLE campaigns;
        ALTER TABLE campaigns_new RENAME TO campaigns;

        CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(starts_at, ends_at);
      `);
    }
  },
};
