export class BudgetManager {
  private maxPerTransaction: number;
  private maxPerSession: number;
  private sessionSpent: number = 0;
  private transactions: Array<{ amount: number; timestamp: number; service: string }> = [];

  constructor(options: { maxPerTransaction?: number; maxPerSession?: number } = {}) {
    this.maxPerTransaction = options.maxPerTransaction ?? 1.0;
    this.maxPerSession = options.maxPerSession ?? 10.0;
  }

  checkBudget(amount: number): { allowed: boolean; reason?: string } {
    if (amount > this.maxPerTransaction) {
      return { allowed: false, reason: `Exceeds per-transaction limit ($${this.maxPerTransaction})` };
    }
    if (this.sessionSpent + amount > this.maxPerSession) {
      return { allowed: false, reason: `Exceeds session budget ($${this.maxPerSession - this.sessionSpent} remaining)` };
    }
    return { allowed: true };
  }

  recordSpend(amount: number, service: string): void {
    this.sessionSpent += amount;
    this.transactions.push({ amount, timestamp: Date.now(), service });
  }

  getSessionSpent(): number {
    return this.sessionSpent;
  }

  getRemaining(): number {
    return this.maxPerSession - this.sessionSpent;
  }

  getTransactions() {
    return [...this.transactions];
  }

  reset(): void {
    this.sessionSpent = 0;
    this.transactions = [];
  }

  static getPaymentLimit(reputation: number): number {
    if (reputation >= 90) return 5.0;
    if (reputation >= 70) return 1.0;
    if (reputation >= 50) return 0.5;
    return 0.1;
  }
}
