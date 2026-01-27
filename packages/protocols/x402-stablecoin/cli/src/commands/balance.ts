/**
 * @fileoverview Balance command - Check token balances
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Command } from 'commander';
import { isAddress } from 'viem';
import {
  isInitialized,
  getConfig,
} from '../lib/config.js';
import {
  error,
  createSpinner,
  displayBalance,
} from '../lib/display.js';
import { createClient } from '../lib/client.js';

/**
 * Create balance command
 */
export function createBalanceCommand(): Command {
  const balanceCommand = new Command('balance')
    .description('Check token balances')
    .argument('[address]', 'Address to check (defaults to configured wallet)')
    .option('-t, --token <token>', 'Specific token to check')
    .action(async (address, options) => {
      // Check initialization if no address provided
      if (!address && !isInitialized()) {
        error('CLI not initialized. Run "x402 init" first or provide an address.');
        process.exit(1);
      }

      const config = getConfig();
      const targetAddress = address || config.walletAddress;

      if (!targetAddress) {
        error('No address specified');
        process.exit(1);
      }

      if (!isAddress(targetAddress)) {
        error('Invalid address format');
        process.exit(1);
      }

      const spinner = createSpinner('Fetching balances...');
      spinner.start();

      try {
        const client = createClient();
        
        if (options.token) {
          const balance = await client.getBalance(options.token, targetAddress);
          spinner.succeed(`${balance.token} Balance`);
          displayBalance([balance], client.getNetworkName());
        } else {
          const balances = await client.getAllBalances(targetAddress);
          spinner.succeed('Balances retrieved');
          displayBalance(balances, client.getNetworkName());
        }
      } catch (balanceError) {
        spinner.fail('Failed to fetch balances');
        error((balanceError as Error).message);
        process.exit(1);
      }
    });

  return balanceCommand;
}
