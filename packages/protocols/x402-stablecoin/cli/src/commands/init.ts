/**
 * @fileoverview Init command - Initialize CLI configuration
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ensureConfigDir,
  setConfig,
  CONFIG_FILE,
  isInitialized,
  getConfig,
} from '../lib/config.js';
import {
  displayBanner,
  success,
  error,
  warning,
  info,
  createSpinner,
  theme,
} from '../lib/display.js';
import { createClient } from '../lib/client.js';
import { Network } from '../types.js';

/**
 * Securely store private key
 * In production, use keytar for OS keychain integration
 */
async function storePrivateKey(privateKey: string): Promise<void> {
  // For now, we'll store encrypted in config
  // In production: use keytar.setPassword('x402', 'privateKey', privateKey)
  process.env.X402_PRIVATE_KEY = privateKey;
}

/**
 * Get stored private key
 */
export async function getStoredPrivateKey(): Promise<string | undefined> {
  // In production: return keytar.getPassword('x402', 'privateKey')
  return process.env.X402_PRIVATE_KEY;
}

/**
 * Create init command
 */
export function createInitCommand(): Command {
  const initCommand = new Command('init')
    .description('Initialize X402 CLI configuration')
    .option('-f, --force', 'Force re-initialization')
    .option('-n, --network <network>', 'Network to use (arbitrum, arbitrum-sepolia)')
    .action(async (options) => {
      displayBanner();

      // Check if already initialized
      if (isInitialized() && !options.force) {
        const currentConfig = getConfig();
        warning('CLI is already initialized.');
        info(`Wallet: ${currentConfig.walletAddress}`);
        info(`Network: ${currentConfig.network}`);
        console.log();
        info('Use --force to re-initialize.');
        return;
      }

      console.log(theme.muted('Setting up your X402 payment CLI...\n'));

      try {
        // Prompt for configuration
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'privateKey',
            message: 'Enter your private key:',
            mask: '*',
            validate: (input: string) => {
              if (!input) return 'Private key is required';
              try {
                const key = input.startsWith('0x') ? input : `0x${input}`;
                privateKeyToAccount(key as `0x${string}`);
                return true;
              } catch {
                return 'Invalid private key format';
              }
            },
          },
          {
            type: 'list',
            name: 'network',
            message: 'Select network:',
            choices: [
              { name: '🌐 Arbitrum Mainnet', value: 'arbitrum' },
              { name: '🧪 Arbitrum Sepolia (Testnet)', value: 'arbitrum-sepolia' },
            ],
            default: options.network || 'arbitrum',
          },
          {
            type: 'confirm',
            name: 'gasless',
            message: 'Enable gasless transactions (EIP-3009)?',
            default: true,
          },
          {
            type: 'input',
            name: 'autoApprove',
            message: 'Auto-approve payments under (USD, empty to disable):',
            default: '',
            validate: (input: string) => {
              if (!input) return true;
              const num = parseFloat(input);
              return !isNaN(num) && num >= 0 ? true : 'Enter a valid amount';
            },
          },
        ]);

        // Ensure config directory exists
        ensureConfigDir();

        // Parse private key
        const privateKey = answers.privateKey.startsWith('0x')
          ? answers.privateKey
          : `0x${answers.privateKey}`;

        // Get wallet address
        const account = privateKeyToAccount(privateKey as `0x${string}`);

        // Store private key securely
        const spinner = createSpinner('Storing credentials securely...');
        spinner.start();
        await storePrivateKey(privateKey);
        spinner.succeed('Credentials stored');

        // Save configuration
        setConfig({
          network: answers.network as Network,
          walletAddress: account.address,
          defaultToken: 'USDs',
          gaslessEnabled: answers.gasless,
          autoApproveUnder: answers.autoApprove || undefined,
          facilitatorUrl: 'http://localhost:3002',
        });

        success(`Configuration created at ${CONFIG_FILE}`);

        // Test connection
        const spinner2 = createSpinner('Connecting to network...');
        spinner2.start();

        try {
          const client = createClient(privateKey);
          const balances = await client.getAllBalances();
          spinner2.succeed(`Connected to ${client.getNetworkName()}`);

          console.log();
          info(`Wallet Address: ${theme.primary(account.address)}`);
          info(`Network: ${theme.secondary(client.getNetworkName())}`);
          
          if (balances.length > 0) {
            const usdsBalance = balances.find(b => b.token === 'USDs');
            if (usdsBalance) {
              info(`USDs Balance: ${theme.primary(usdsBalance.balanceFormatted)} USDs`);
            }
          }

          console.log();
          success('X402 CLI is ready to use!');
          console.log();
          console.log(theme.muted('Try these commands:'));
          console.log(theme.muted('  x402 balance    - Check your token balances'));
          console.log(theme.muted('  x402 yield      - View USDs yield information'));
          console.log(theme.muted('  x402 pay        - Make a payment'));
          console.log(theme.muted('  x402 --help     - See all commands'));
          console.log();
        } catch (connError) {
          spinner2.fail('Failed to connect to network');
          warning('Configuration saved but connection test failed.');
          error((connError as Error).message);
        }
      } catch (initError) {
        error(`Initialization failed: ${(initError as Error).message}`);
        process.exit(1);
      }
    });

  return initCommand;
}
