/**
 * In-memory wallet for x402 auto-payment.
 *
 * Amounts are stored internally as integer micro-units (1 unit = $0.000001)
 * to avoid IEEE 754 floating-point drift in budget checks and balance tracking.
 *
 * Public API uses float USD (e.g. 0.05) — conversion happens at the boundary.
 *
 * TODO: SQLite persistent wallet (deferred from TypeScript SDK, 2026-03-11)
 */

/** Public Wallet interface — program to this, not to InMemoryWallet. */
export interface Wallet {
  /** Current balance in USD. */
  getBalance(): number;
  /**
   * Deduct amount (USD) from wallet.
   * Returns a tx id for rollback.
   * Throws if insufficient funds or amount <= 0.
   */
  deduct(amount: number, toAddress: string): string;
  /**
   * Roll back a previous deduction by tx id.
   * Returns true if rolled back, false if not found or already rolled back.
   */
  rollback(txId: string): boolean;
}

export interface WalletTransaction {
  id: string;
  /** Amount in USD (original float, for display only) */
  amount: number;
  toAddress: string;
  timestamp: number;
  rolledBack: boolean;
}

/** Scale factor: 1 USD = 1_000_000 micro-units. Sufficient for 6-decimal precision. */
const MICRO = 1_000_000;

function toMicro(usd: number): number {
  return Math.round(usd * MICRO);
}

function toUsd(micro: number): number {
  return micro / MICRO;
}

export class InMemoryWallet implements Wallet {
  private balanceMicro: number;
  private txCounter = 0;
  private transactions = new Map<string, WalletTransaction & { amountMicro: number }>();

  constructor(initialBalance = 100) {
    if (!isFinite(initialBalance) || initialBalance < 0) throw new Error("Initial balance must be a non-negative finite number");
    this.balanceMicro = toMicro(initialBalance);
  }

  getBalance(): number {
    return toUsd(this.balanceMicro);
  }

  deposit(amount: number): void {
    if (!isFinite(amount) || amount <= 0) throw new Error("Deposit amount must be a positive finite number");
    this.balanceMicro += toMicro(amount);
  }

  deduct(amount: number, toAddress: string): string {
    if (!isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive finite number");
    const amountMicro = toMicro(amount);
    if (this.balanceMicro < amountMicro) {
      throw new Error(
        `Insufficient balance: have $${this.getBalance().toFixed(6)}, need $${amount.toFixed(6)}`
      );
    }
    this.balanceMicro -= amountMicro;
    const id = `tx_${++this.txCounter}_${Date.now()}`;
    this.transactions.set(id, {
      id,
      amount,
      amountMicro,
      toAddress,
      timestamp: Date.now(),
      rolledBack: false,
    });
    return id;
  }

  rollback(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.rolledBack) return false;
    this.balanceMicro += tx.amountMicro;
    tx.rolledBack = true;
    return true;
  }

  getTransactions(): WalletTransaction[] {
    return Array.from(this.transactions.values()).map(({ amountMicro: _, ...rest }) => rest);
  }
}
