import { describe, it, expect } from "vitest";
import { InMemoryWallet } from "../wallet.ts";

describe("InMemoryWallet", () => {
  it("starts with initial balance", () => {
    const w = new InMemoryWallet(100);
    expect(w.getBalance()).toBe(100);
  });

  it("deducts amount and returns tx id", () => {
    const w = new InMemoryWallet(100);
    const txId = w.deduct(10, "addr");
    expect(w.getBalance()).toBe(90);
    expect(txId).toMatch(/^tx_/);
  });

  it("throws on insufficient funds", () => {
    const w = new InMemoryWallet(5);
    expect(() => w.deduct(10, "addr")).toThrow("Insufficient");
  });

  it("rolls back a deduction", () => {
    const w = new InMemoryWallet(100);
    const txId = w.deduct(20, "addr");
    expect(w.getBalance()).toBe(80);
    const ok = w.rollback(txId);
    expect(ok).toBe(true);
    expect(w.getBalance()).toBe(100);
  });

  it("rollback is idempotent (double rollback returns false, no double-credit)", () => {
    const w = new InMemoryWallet(100);
    const txId = w.deduct(20, "addr");
    w.rollback(txId);
    const ok = w.rollback(txId);
    expect(ok).toBe(false);
    expect(w.getBalance()).toBe(100);
  });

  it("rollback of unknown tx returns false", () => {
    const w = new InMemoryWallet(100);
    expect(w.rollback("nonexistent")).toBe(false);
  });

  it("deposit increases balance", () => {
    const w = new InMemoryWallet(50);
    w.deposit(25);
    expect(w.getBalance()).toBe(75);
  });

  it("deposit throws for non-positive or non-finite", () => {
    const w = new InMemoryWallet(50);
    expect(() => w.deposit(0)).toThrow();
    expect(() => w.deposit(-5)).toThrow();
    expect(() => w.deposit(Infinity)).toThrow();
    expect(() => w.deposit(NaN)).toThrow();
  });

  it("deduct throws for non-positive or non-finite", () => {
    const w = new InMemoryWallet(100);
    expect(() => w.deduct(0, "addr")).toThrow();
    expect(() => w.deduct(-1, "addr")).toThrow();
    expect(() => w.deduct(NaN, "addr")).toThrow();
    expect(() => w.deduct(Infinity, "addr")).toThrow();
  });

  it("tracks transaction history", () => {
    const w = new InMemoryWallet(100);
    w.deduct(5, "addr1");
    w.deduct(3, "addr2");
    const txs = w.getTransactions();
    expect(txs).toHaveLength(2);
    expect(txs[0].amount).toBe(5);
    expect(txs[1].amount).toBe(3);
  });

  it("rejects NaN initial balance", () => {
    expect(() => new InMemoryWallet(NaN)).toThrow();
  });

  it("rejects Infinity initial balance", () => {
    expect(() => new InMemoryWallet(Infinity)).toThrow();
  });



  // Float precision: 0.1 + 0.2 + 0.3 must not drift
  it("handles float precision correctly via micro-unit arithmetic", () => {
    const w = new InMemoryWallet(1);
    w.deduct(0.1, "a");
    w.deduct(0.2, "a");
    w.deduct(0.3, "a");
    // Without micro-units: 1 - 0.1 - 0.2 - 0.3 = 0.39999999999999997
    expect(w.getBalance()).toBe(0.4);
  });

  it("getTransactions does not expose internal amountMicro field", () => {
    const w = new InMemoryWallet(100);
    w.deduct(10, "addr");
    const txs = w.getTransactions();
    expect("amountMicro" in txs[0]).toBe(false);
  });
});
