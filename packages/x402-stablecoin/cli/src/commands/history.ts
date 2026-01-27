/**
 * @fileoverview History command - Payment history and transactions
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Command } from 'commander';
import {
  isInitialized,
  getHistory,
  getTransaction,
  updateTransactionStatus,
  getConfig,
} from '../lib/config.js';
import {
  error,
  info,
  createSpinner,
  displayHistory,
  displayTransaction,
  theme,
} from '../lib/display.js';
import { createClient } from '../lib/client.js';

/**
 * Create history command
 */
export function createHistoryCommand(): Command {
  const historyCommand = new Command('history')
    .description('View payment history')
    .option('-l, --limit <number>', 'Number of transactions to show', '10')
    .option('-t, --type <type>', 'Filter by type (payment, tool_call, transfer)')
    .option('-s, --status <status>', 'Filter by status (pending, confirmed, failed)')
    .action(async (options) => {
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      const spinner = createSpinner('Loading history...');
      spinner.start();

      try {
        let history = getHistory();
        
        // Apply filters
        if (options.type) {
          history = history.filter(tx => tx.type === options.type);
        }
        
        if (options.status) {
          history = history.filter(tx => tx.status === options.status);
        }
        
        // Apply limit
        const limit = parseInt(options.limit, 10);
        history = history.slice(0, limit);

        spinner.succeed(`Found ${history.length} transactions`);
        
        if (history.length === 0) {
          console.log();
          info('No transactions found');
          console.log(theme.muted('Make a payment with: x402 pay <recipient> <amount>'));
          console.log();
        } else {
          displayHistory(history);
          
          // Show summary
          const confirmed = history.filter(tx => tx.status === 'confirmed').length;
          const pending = history.filter(tx => tx.status === 'pending').length;
          const failed = history.filter(tx => tx.status === 'failed').length;
          
          console.log(theme.muted(`Confirmed: ${confirmed} | Pending: ${pending} | Failed: ${failed}`));
          console.log();
        }

      } catch (historyError) {
        spinner.fail('Failed to load history');
        error((historyError as Error).message);
        process.exit(1);
      }
    });

  return historyCommand;
}

/**
 * Create tx command for viewing single transaction
 */
export function createTxCommand(): Command {
  const txCommand = new Command('tx')
    .description('View transaction details')
    .argument('<hash>', 'Transaction hash')
    .option('-r, --refresh', 'Refresh transaction status from chain')
    .action(async (hash, options) => {
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      const spinner = createSpinner('Loading transaction...');
      spinner.start();

      try {
        // First check local history
        let tx = getTransaction(hash);
        
        if (!tx) {
          spinner.fail('Transaction not found in local history');
          
          // Try to look up on chain
          info('Looking up on chain...');
          
          const config = getConfig();
          const explorerBase = config.network === 'arbitrum'
            ? 'https://arbiscan.io/tx/'
            : 'https://sepolia.arbiscan.io/tx/';
          
          console.log();
          console.log(theme.muted(`Check on explorer: ${explorerBase}${hash}`));
          console.log();
          return;
        }

        // Refresh status if requested
        if (options.refresh && tx.status === 'pending') {
          spinner.text = 'Refreshing status from chain...';
          
          const client = createClient();
          const status = await client.getTransactionStatus(hash);
          
          if (status !== tx.status) {
            updateTransactionStatus(hash, status);
            tx = { ...tx, status };
            info(`Status updated: ${status}`);
          }
        }

        spinner.succeed('Transaction loaded');
        displayTransaction(tx);

        // Show explorer link
        const config = getConfig();
        const explorerBase = config.network === 'arbitrum'
          ? 'https://arbiscan.io/tx/'
          : 'https://sepolia.arbiscan.io/tx/';
        
        console.log(theme.muted(`Explorer: ${explorerBase}${tx.hash}`));
        console.log();

      } catch (txError) {
        spinner.fail('Failed to load transaction');
        error((txError as Error).message);
        process.exit(1);
      }
    });

  return txCommand;
}
