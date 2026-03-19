import type Database from 'better-sqlite3';

export type TxState =
  | 'RECEIVED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'SETTLING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'FAILED';

export interface TxData {
  idempotencyKey?: string;
  payer?: string;
  payTo?: string;
  amount?: string;
  asset?: string;
  network?: string;
}

export interface TxRecord {
  txHash: string;
  state: TxState;
  idempotencyKey: string | null;
  payer: string | null;
  payTo: string | null;
  amount: string | null;
  asset: string | null;
  network: string | null;
  createdAt: number;
  updatedAt: number;
}

export class TxStateStore {
  constructor(private readonly db: Database.Database) {
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tx_states (
        tx_hash TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        idempotency_key TEXT,
        payer TEXT,
        pay_to TEXT,
        amount TEXT,
        asset TEXT,
        network TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settled_transactions (
        tx_hash TEXT PRIMARY KEY,
        idempotency_key TEXT,
        payer TEXT,
        amount TEXT,
        settled_at INTEGER DEFAULT (unixepoch())
      )
    `);
  }

  create(txHash: string, state: TxState, data: TxData): void {
    this.db
      .prepare(
        `INSERT INTO tx_states (tx_hash, state, idempotency_key, payer, pay_to, amount, asset, network)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        txHash,
        state,
        data.idempotencyKey ?? null,
        data.payer ?? null,
        data.payTo ?? null,
        data.amount ?? null,
        data.asset ?? null,
        data.network ?? null,
      );
  }

  update(txHash: string, state: TxState): void {
    this.db
      .prepare('UPDATE tx_states SET state = ?, updated_at = unixepoch() WHERE tx_hash = ?')
      .run(state, txHash);
  }

  get(txHash: string): TxRecord | null {
    const row = this.db.prepare('SELECT * FROM tx_states WHERE tx_hash = ?').get(txHash) as
      | Record<string, unknown>
      | undefined;

    if (!row) return null;
    return {
      txHash: row.tx_hash as string,
      state: row.state as TxState,
      idempotencyKey: row.idempotency_key as string | null,
      payer: row.payer as string | null,
      payTo: row.pay_to as string | null,
      amount: row.amount as string | null,
      asset: row.asset as string | null,
      network: row.network as string | null,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  getSettling(): TxRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM tx_states WHERE state = 'SETTLING'")
      .all() as Record<string, unknown>[];

    return rows.map((row) => ({
      txHash: row.tx_hash as string,
      state: row.state as TxState,
      idempotencyKey: row.idempotency_key as string | null,
      payer: row.payer as string | null,
      payTo: row.pay_to as string | null,
      amount: row.amount as string | null,
      asset: row.asset as string | null,
      network: row.network as string | null,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    }));
  }

  isSettled(txHash: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM settled_transactions WHERE tx_hash = ?').get(txHash);
    return !!row;
  }

  markSettled(txHash: string, idempotencyKey: string, payer: string, amount: string): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO settled_transactions (tx_hash, idempotency_key, payer, amount)
       VALUES (?, ?, ?, ?)`,
      )
      .run(txHash, idempotencyKey, payer, amount);

    return result.changes > 0;
  }
}
