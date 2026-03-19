import { Command } from 'commander';
import path from 'path';
import { ANET_HOME } from '../config.js';
import { PaymentTracker } from '../core/payments/tracker.js';
import { BudgetManager } from '../core/payments/budget.js';
import { loadContext } from './context.js';

export function registerPaymentsCommand(program: Command) {
  const cmd = program
    .command('payments')
    .description('X402 payment history and budget');

  cmd
    .command('history')
    .description('Show payment history')
    .option('--direction <dir>', 'Filter: sent or received')
    .option('--service <name>', 'Filter by service name')
    .option('--since <date>', 'Filter by date (ISO format)')
    .action(async (opts: any) => {
      const tracker = new PaymentTracker(path.join(ANET_HOME, 'payments.jsonl'));

      const filters: any = {};
      if (opts.direction) filters.direction = opts.direction;
      if (opts.service) filters.service = opts.service;
      if (opts.since) filters.since = new Date(opts.since).getTime();

      const history = tracker.getHistory(filters);

      if (history.length === 0) {
        console.log('No payment history.');
        return;
      }

      console.log(`Payments (${history.length}):\n`);
      for (const p of history) {
        const date = new Date(p.timestamp).toISOString().substring(0, 19);
        const dir = p.direction === 'sent' ? '->' : '<-';
        console.log(`  ${date}  ${dir}  $${p.amount} ${p.currency}  ${p.service || ''}`);
      }

      const summary = tracker.getSummary();
      console.log(`\nSummary:`);
      console.log(`  Sent:     $${summary.totalSent || 0}`);
      console.log(`  Received: $${summary.totalReceived || 0}`);
    });

  cmd
    .command('budget')
    .description('Show current budget status')
    .action(async () => {
      const ctx = loadContext();
      const budget = new BudgetManager({
        maxPerTransaction: ctx.settings.get('payments.max-per-tx') || 1.00,
        maxPerSession: ctx.settings.get('payments.max-per-session') || 10.00,
      });

      console.log('Budget Status\n');
      console.log(`  Max per tx:      $${ctx.settings.get('payments.max-per-tx')}`);
      console.log(`  Max per session: $${ctx.settings.get('payments.max-per-session')}`);
      console.log(`  Session spent:   $${budget.getSessionSpent()}`);
      console.log(`  Remaining:       $${budget.getRemaining()}`);
    });
}
