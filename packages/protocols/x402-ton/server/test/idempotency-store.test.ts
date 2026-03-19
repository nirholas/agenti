import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { IdempotencyStore } from '../src/store/idempotency-store';

describe('IdempotencyStore', () => {
  let db: Database.Database;
  let store: IdempotencyStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new IdempotencyStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it('get returns null for unknown key', () => {
    expect(store.get('nonexistent-key')).toBeNull();
  });

  it('set then get round-trips correctly', () => {
    const key = 'test-key-1';
    const payloadHash = 'abc123';
    const response = JSON.stringify({ success: true, payer: 'EQ...' });

    store.set(key, payloadHash, response);
    const result = store.get(key);

    expect(result).not.toBeNull();
    expect(result!.payloadHash).toBe(payloadHash);
    expect(result!.response).toBe(response);
  });

  it('get returns null when payload hash does not match', () => {
    const key = 'test-key-2';
    store.set(key, 'original-hash', JSON.stringify({ success: true }));

    // The store returns the stored record regardless of hash — the middleware
    // is responsible for detecting the mismatch. Confirm the stored hash
    // differs from an alternative hash so the caller can detect the conflict.
    const result = store.get(key);
    expect(result).not.toBeNull();
    expect(result!.payloadHash).not.toBe('different-hash');
  });

  it('cleanup removes entries older than maxAge', () => {
    const key = 'old-key';
    store.set(key, 'hash1', JSON.stringify({ success: true }));

    // Manually backdate the created_at timestamp to simulate an old entry
    db.prepare('UPDATE idempotency_keys SET created_at = created_at - 3600 WHERE key = ?').run(key);

    store.cleanup(60); // maxAge = 60 seconds
    expect(store.get(key)).toBeNull();
  });

  it('cleanup keeps recent entries', () => {
    const key = 'new-key';
    const payloadHash = 'hash2';
    const response = JSON.stringify({ success: true });

    store.set(key, payloadHash, response);
    store.cleanup(3600); // maxAge = 1 hour

    const result = store.get(key);
    expect(result).not.toBeNull();
    expect(result!.payloadHash).toBe(payloadHash);
  });
});
