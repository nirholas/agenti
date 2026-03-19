import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { TxStateStore } from '../src/store/tx-state';

describe('TxStateStore', () => {
  let db: Database.Database;
  let store: TxStateStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new TxStateStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it('create stores a new tx state', () => {
    store.create('boc-hash-1', 'SETTLING', {
      idempotencyKey: 'idem-key-1',
      payer: 'EQ...',
      network: 'tvm:-239',
    });

    const record = store.get('boc-hash-1');
    expect(record).not.toBeNull();
    expect(record!.txHash).toBe('boc-hash-1');
    expect(record!.state).toBe('SETTLING');
    expect(record!.idempotencyKey).toBe('idem-key-1');
    expect(record!.payer).toBe('EQ...');
    expect(record!.network).toBe('tvm:-239');
  });

  it('create throws on duplicate txHash', () => {
    store.create('boc-hash-dup', 'SETTLING', { idempotencyKey: 'idem-1' });
    expect(() => {
      store.create('boc-hash-dup', 'SETTLING', { idempotencyKey: 'idem-2' });
    }).toThrow();
  });

  it('update changes the status', () => {
    store.create('boc-hash-2', 'SETTLING', { idempotencyKey: 'idem-key-2' });
    store.update('boc-hash-2', 'CONFIRMED');

    const record = store.get('boc-hash-2');
    expect(record!.state).toBe('CONFIRMED');
  });

  it('get returns the stored state', () => {
    store.create('boc-hash-3', 'RECEIVED', {
      idempotencyKey: 'idem-key-3',
      payer: 'EQpayer',
      payTo: 'EQpayTo',
      amount: '1000000',
      asset: 'TON',
      network: 'tvm:-239',
    });

    const record = store.get('boc-hash-3');
    expect(record).not.toBeNull();
    expect(record!.state).toBe('RECEIVED');
    expect(record!.payTo).toBe('EQpayTo');
    expect(record!.amount).toBe('1000000');
    expect(record!.asset).toBe('TON');
  });

  it('get returns undefined for unknown txHash', () => {
    expect(store.get('nonexistent-hash')).toBeNull();
  });

  it('getSettling returns only SETTLING records', () => {
    store.create('boc-settling-1', 'SETTLING', { idempotencyKey: 'idem-s1' });
    store.create('boc-settling-2', 'SETTLING', { idempotencyKey: 'idem-s2' });
    store.create('boc-confirmed', 'CONFIRMED', { idempotencyKey: 'idem-c1' });
    store.create('boc-failed', 'FAILED', { idempotencyKey: 'idem-f1' });

    // update() requires the record to already exist; use create with CONFIRMED/FAILED directly
    const settling = store.getSettling();
    expect(settling).toHaveLength(2);
    expect(settling.map((r) => r.txHash)).toContain('boc-settling-1');
    expect(settling.map((r) => r.txHash)).toContain('boc-settling-2');
    expect(settling.map((r) => r.state).every((s) => s === 'SETTLING')).toBe(true);
  });

  it('isSettled returns true for settled transactions', () => {
    store.markSettled('tx-hash-settled', 'idem-key-ms', 'EQpayer', '5000000');
    expect(store.isSettled('tx-hash-settled')).toBe(true);
  });

  it('isSettled returns false for unknown transactions', () => {
    expect(store.isSettled('tx-hash-unknown')).toBe(false);
  });

  it('markSettled stores settlement data', () => {
    const inserted = store.markSettled('tx-hash-mark', 'idem-key-mark', 'EQpayerMark', '9000000');
    expect(inserted).toBe(true);
    expect(store.isSettled('tx-hash-mark')).toBe(true);

    // Second call with same txHash should be idempotent (INSERT OR IGNORE) and return false
    const duplicate = store.markSettled('tx-hash-mark', 'idem-key-mark', 'EQpayerMark', '9000000');
    expect(duplicate).toBe(false);
  });
});
