/**
 * Database migrations system
 *
 * Migrations are run in order by filename (001_, 002_, etc.)
 * Each migration runs once and is tracked in the `migrations` table.
 */
import type Database from 'better-sqlite3';

export interface Migration {
  name: string;
  up: (db: Database.Database) => void;
}

// Import all migrations in order
import { migration as m001 } from './001_claims_server_id_nullable.js';
import { migration as m002 } from './002_campaign_audit_table.js';
import { migration as m003 } from './003_user_wallets_multi_chain.js';

// Register migrations in order
const migrations: Migration[] = [
  m001,
  m002,
  m003,
];

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get already-run migrations
  const executed = new Set(
    (db.prepare('SELECT name FROM migrations').all() as { name: string }[])
      .map(row => row.name)
  );

  // Run pending migrations
  for (const migration of migrations) {
    if (executed.has(migration.name)) {
      continue;
    }

    console.log(`🔄 Running migration: ${migration.name}`);

    try {
      // Run migration in a transaction
      db.exec('BEGIN TRANSACTION');
      migration.up(db);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      db.exec('COMMIT');
      console.log(`✅ Migration complete: ${migration.name}`);
    } catch (error) {
      db.exec('ROLLBACK');
      console.error(`❌ Migration failed: ${migration.name}`, error);
      throw error;
    }
  }
}
