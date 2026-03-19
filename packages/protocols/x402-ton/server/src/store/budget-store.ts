import type Database from 'better-sqlite3';
import type { BudgetPersistence } from 'x402ton';

export class BudgetStore implements BudgetPersistence {
  constructor(private readonly db: Database.Database) {
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS self_relay_budget (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        spent_nanoton TEXT NOT NULL DEFAULT '0',
        reset_at INTEGER NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);
  }

  load(): { spent: bigint; resetAt: number } | null {
    const row = this.db.prepare('SELECT spent_nanoton, reset_at FROM self_relay_budget WHERE id = 1').get() as
      | { spent_nanoton: string; reset_at: number }
      | undefined;
    if (!row) return null;
    return { spent: BigInt(row.spent_nanoton), resetAt: row.reset_at };
  }

  save(spent: bigint, resetAt: number): void {
    this.db.prepare(
      `INSERT INTO self_relay_budget (id, spent_nanoton, reset_at, updated_at)
       VALUES (1, ?, ?, unixepoch())
       ON CONFLICT(id) DO UPDATE SET
         spent_nanoton = excluded.spent_nanoton,
         reset_at = excluded.reset_at,
         updated_at = excluded.updated_at`,
    ).run(spent.toString(), resetAt);
  }
}
