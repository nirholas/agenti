/**
 * @fileoverview Yield command - Check USDs yield information
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
  info,
  createSpinner,
  displayYield,
  theme,
} from '../lib/display.js';
import { createClient } from '../lib/client.js';

/**
 * Create yield command
 */
export function createYieldCommand(): Command {
  const yieldCommand = new Command('yield')
    .description('Check USDs auto-yield information')
    .argument('[address]', 'Address to check (defaults to configured wallet)')
    .action(async (address) => {
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

      const spinner = createSpinner('Fetching yield information...');
      spinner.start();

      try {
        const client = createClient();
        
        // Get balance first
        const balance = await client.getBalance('USDs', targetAddress);
        
        // Get yield info
        const yieldInfo = await client.getYieldInfo(targetAddress);
        
        spinner.succeed('Yield information retrieved');
        
        displayYield(yieldInfo, balance.balanceFormatted);

        // Additional info
        console.log(theme.muted('ℹ️  USDs is an auto-rebasing stablecoin. Your balance increases'));
        console.log(theme.muted('   automatically as yield is earned - no claiming required!'));
        console.log();
        console.log(theme.muted(`   Learn more: ${theme.primary('https://docs.sperax.io/')}`));
        console.log();

      } catch (yieldError) {
        spinner.fail('Failed to fetch yield information');
        error((yieldError as Error).message);
        process.exit(1);
      }
    });

  return yieldCommand;
}
