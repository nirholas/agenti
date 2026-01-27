/**
 * @fileoverview Pay command - Make payments
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { isAddress } from 'viem';
import {
  isInitialized,
  getConfig,
} from '../lib/config.js';
import {
  success,
  error,
  warning,
  createSpinner,
  displayPaymentConfirmation,
  displayTransaction,
  theme,
} from '../lib/display.js';
import { createClient } from '../lib/client.js';
import { getStoredPrivateKey } from './init.js';
import { Token } from '../types.js';

/**
 * Create pay command
 */
export function createPayCommand(): Command {
  const payCommand = new Command('pay')
    .description('Make a payment to a recipient')
    .argument('[recipient]', 'Recipient address')
    .argument('[amount]', 'Amount to send')
    .option('-t, --token <token>', 'Token to send (USDs, USDC, USDT, DAI)', 'USDs')
    .option('-g, --gasless', 'Use gasless transfer (EIP-3009)')
    .option('-m, --memo <memo>', 'Payment memo/note')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (recipient, amount, options) => {
      // Check initialization
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      const config = getConfig();
      const privateKey = await getStoredPrivateKey();

      if (!privateKey) {
        error('Private key not found. Run "x402 init" to reconfigure.');
        process.exit(1);
      }

      try {
        // Interactive prompts if arguments not provided
        let finalRecipient = recipient;
        let finalAmount = amount;
        let finalToken = options.token as Token;
        let gasless = options.gasless ?? config.gaslessEnabled;

        if (!finalRecipient || !finalAmount) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'recipient',
              message: 'Recipient address:',
              default: finalRecipient,
              when: !finalRecipient,
              validate: (input: string) => {
                if (!input) return 'Recipient is required';
                if (!isAddress(input)) return 'Invalid Ethereum address';
                return true;
              },
            },
            {
              type: 'input',
              name: 'amount',
              message: 'Amount to send:',
              default: finalAmount,
              when: !finalAmount,
              validate: (input: string) => {
                if (!input) return 'Amount is required';
                const num = parseFloat(input);
                if (isNaN(num) || num <= 0) return 'Enter a valid positive amount';
                return true;
              },
            },
            {
              type: 'list',
              name: 'token',
              message: 'Select token:',
              choices: [
                { name: '💰 USDs (Sperax USD - Auto-yield)', value: 'USDs' },
                { name: '🔵 USDC', value: 'USDC' },
                { name: '🟢 USDT', value: 'USDT' },
                { name: '🟡 DAI', value: 'DAI' },
              ],
              default: finalToken,
            },
            {
              type: 'confirm',
              name: 'gasless',
              message: 'Use gasless transfer?',
              default: gasless,
              when: (answers: any) => answers.token === 'USDs' || finalToken === 'USDs',
            },
          ]);

          finalRecipient = answers.recipient || finalRecipient;
          finalAmount = answers.amount || finalAmount;
          finalToken = answers.token || finalToken;
          gasless = answers.gasless ?? gasless;
        }

        // Validate inputs
        if (!isAddress(finalRecipient)) {
          error('Invalid recipient address');
          process.exit(1);
        }

        const amountNum = parseFloat(finalAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
          error('Invalid amount');
          process.exit(1);
        }

        // Create client
        const client = createClient(privateKey);
        const networkName = client.getNetworkName();

        // Check balance
        const spinner = createSpinner('Checking balance...');
        spinner.start();

        const balance = await client.getBalance(finalToken);
        const balanceNum = parseFloat(balance.balance) / (finalToken === 'USDs' || finalToken === 'DAI' ? 1e18 : 1e6);

        if (balanceNum < amountNum) {
          spinner.fail('Insufficient balance');
          error(`You have ${balance.balanceFormatted} ${finalToken}, but trying to send ${finalAmount} ${finalToken}`);
          process.exit(1);
        }

        spinner.succeed(`Balance: ${balance.balanceFormatted} ${finalToken}`);

        // Show confirmation
        displayPaymentConfirmation(
          finalRecipient,
          finalAmount,
          finalToken,
          networkName,
          gasless && finalToken === 'USDs'
        );

        // Check auto-approve
        const autoApprove = config.autoApproveUnder ? parseFloat(config.autoApproveUnder) : 0;
        const shouldAutoApprove = options.yes || (autoApprove > 0 && amountNum <= autoApprove);

        if (!shouldAutoApprove) {
          const confirm = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: 'Confirm payment?',
              default: false,
            },
          ]);

          if (!confirm.proceed) {
            warning('Payment cancelled');
            return;
          }
        }

        // Execute payment
        const paySpinner = createSpinner('Sending payment...');
        paySpinner.start();

        const tx = await client.pay({
          recipient: finalRecipient,
          amount: finalAmount,
          token: finalToken,
          gasless: gasless && finalToken === 'USDs',
          memo: options.memo,
        });

        if (tx.status === 'confirmed') {
          paySpinner.succeed('Payment confirmed!');
        } else if (tx.status === 'failed') {
          paySpinner.fail('Payment failed');
        } else {
          paySpinner.info('Payment submitted (pending confirmation)');
        }

        displayTransaction(tx);

        // Show explorer link
        const explorerBase = config.network === 'arbitrum'
          ? 'https://arbiscan.io/tx/'
          : 'https://sepolia.arbiscan.io/tx/';
        console.log(theme.muted(`Explorer: ${explorerBase}${tx.hash}`));
        console.log();

      } catch (payError) {
        error(`Payment failed: ${(payError as Error).message}`);
        process.exit(1);
      }
    });

  return payCommand;
}
