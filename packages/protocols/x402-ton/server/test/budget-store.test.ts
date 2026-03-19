import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { BudgetStore } from '../src/store/budget-store';

describe('BudgetStore', () => {
  let db: Database.Database;
  let store: BudgetStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new BudgetStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it('load returns null when no state exists', () => {
    expect(store.load()).toBeNull();
  });

  it('save then load round-trips correctly', () => {
    store.save(BigInt('500000000'), 1700000000000);
    const loaded = store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.spent).toBe(BigInt('500000000'));
    expect(loaded!.resetAt).toBe(1700000000000);
  });

  it('save overwrites previous state (single row)', () => {
    store.save(BigInt('100'), 1000);
    store.save(BigInt('200'), 2000);
    const loaded = store.load();
    expect(loaded!.spent).toBe(BigInt('200'));
    expect(loaded!.resetAt).toBe(2000);
  });

  it('handles large BigInt values (MAX_DAILY_SELF_RELAY_TON = 1_000_000_000)', () => {
    const largeAmount = BigInt('999999999999');
    store.save(largeAmount, Date.now());
    const loaded = store.load();
    expect(loaded!.spent).toBe(largeAmount);
  });

  it('handles zero spent', () => {
    store.save(BigInt(0), Date.now());
    const loaded = store.load();
    expect(loaded!.spent).toBe(BigInt(0));
  });
});
