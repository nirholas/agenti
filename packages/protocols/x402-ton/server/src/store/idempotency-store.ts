import type Database from 'better-sqlite3';

export class IdempotencyStore {
  constructor(private readonly db: Database.Database) {
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        payload_hash TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);
  }

  get(key: string): { payloadHash: string; response: string } | null {
    const row = this.db
      .prepare('SELECT payload_hash, response FROM idempotency_keys WHERE key = ?')
      .get(key) as { payload_hash: string; response: string } | undefined;

    if (!row) return null;
    return { payloadHash: row.payload_hash, response: row.response };
  }

  set(key: string, payloadHash: string, response: string): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO idempotency_keys (key, payload_hash, response) VALUES (?, ?, ?)',
      )
      .run(key, payloadHash, response);
  }

  cleanup(maxAgeSeconds: number): void {
    this.db
      .prepare('DELETE FROM idempotency_keys WHERE created_at < unixepoch() - ?')
      .run(maxAgeSeconds);
  }
}
