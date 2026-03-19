import path from 'path';
import { BudgetManager } from '../src/core/payments/budget.js';
import { PaymentTracker } from '../src/core/payments/tracker.js';
import { assert, summary, tmpDir, cleanup } from './utils.js';

const TEST_DIR = tmpDir('budget-test');

console.log('Budget & Payments Tests\n');

// --- BudgetManager ---

// Default limits
const budget = new BudgetManager();
assert(budget.getRemaining() === 10, 'default session budget is $10');
assert(budget.getSessionSpent() === 0, 'initial spend is 0');

// Check within budget
let check = budget.checkBudget(0.5);
assert(check.allowed === true, '$0.50 within per-tx limit');

// Check exceeds per-tx limit
check = budget.checkBudget(1.5);
assert(check.allowed === false, '$1.50 exceeds per-tx limit ($1)');
assert(check.reason!.includes('per-transaction'), 'reason mentions per-transaction');

// Record spend
budget.recordSpend(0.5, 'code-review');
assert(budget.getSessionSpent() === 0.5, 'session spent updated');
assert(budget.getRemaining() === 9.5, 'remaining updated');

// Record more, approach session limit
budget.recordSpend(0.8, 'analysis');
budget.recordSpend(0.7, 'code-review');
assert(budget.getSessionSpent() === 2.0, 'cumulative spend correct');

// Check session limit
const fullBudget = new BudgetManager({ maxPerSession: 2.0, maxPerTransaction: 5.0 });
fullBudget.recordSpend(1.8, 'test');
check = fullBudget.checkBudget(0.5);
assert(check.allowed === false, 'exceeds session budget');
assert(check.reason!.includes('session budget'), 'reason mentions session');

// Custom limits
const custom = new BudgetManager({ maxPerTransaction: 5.0, maxPerSession: 50.0 });
check = custom.checkBudget(4.99);
assert(check.allowed === true, 'custom per-tx limit works');
check = custom.checkBudget(5.01);
assert(check.allowed === false, 'custom per-tx limit enforced');

// Transaction history
assert(budget.getTransactions().length === 3, '3 transactions recorded');
assert(budget.getTransactions()[0].service === 'code-review', 'first tx service correct');

// Reset
budget.reset();
assert(budget.getSessionSpent() === 0, 'reset clears spend');
assert(budget.getTransactions().length === 0, 'reset clears transactions');
assert(budget.getRemaining() === 10, 'reset restores budget');

// --- Payment limits by reputation ---

assert(BudgetManager.getPaymentLimit(95) === 5.0, 'rep 95 → $5 limit');
assert(BudgetManager.getPaymentLimit(70) === 1.0, 'rep 70 → $1 limit');
assert(BudgetManager.getPaymentLimit(50) === 0.5, 'rep 50 → $0.50 limit');
assert(BudgetManager.getPaymentLimit(30) === 0.1, 'rep 30 → $0.10 limit');

// --- PaymentTracker ---

const tracker = new PaymentTracker(path.join(TEST_DIR, 'payments.jsonl'));

// Empty history
assert(tracker.getHistory().length === 0, 'empty history');

// Track payments
tracker.track({ timestamp: '2026-01-01T00:00:00Z', service: 'code-review', amount: '0.50', currency: 'USDC', direction: 'sent' });
tracker.track({ timestamp: '2026-01-02T00:00:00Z', service: 'analysis', amount: '1.00', currency: 'USDC', direction: 'sent' });
tracker.track({ timestamp: '2026-01-03T00:00:00Z', service: 'code-review', amount: '0.25', currency: 'USDC', direction: 'received' });

assert(tracker.getHistory().length === 3, 'history has 3 records');

// Filter by direction
assert(tracker.getHistory({ direction: 'sent' }).length === 2, 'filter sent: 2');
assert(tracker.getHistory({ direction: 'received' }).length === 1, 'filter received: 1');

// Filter by service
assert(tracker.getHistory({ service: 'code-review' }).length === 2, 'filter service: 2');

// Filter by date
assert(tracker.getHistory({ since: '2026-01-02' }).length === 2, 'filter since: 2');

// Summary
const sum = tracker.getSummary();
assert(sum.totalSent === 1.5, 'total sent: $1.50');
assert(sum.totalReceived === 0.25, 'total received: $0.25');
assert(sum.byService['code-review'] === 0.75, 'by service: code-review $0.75');
assert(sum.byService['analysis'] === 1.0, 'by service: analysis $1.00');

cleanup(TEST_DIR);

summary();
