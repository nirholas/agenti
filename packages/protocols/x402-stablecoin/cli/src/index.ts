#!/usr/bin/env node
/**
 * @fileoverview X402 CLI - Main Entry Point
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * X402 Command-Line Interface
 * 
 * A powerful CLI for interacting with X402 USDs payments from the terminal.
 * 
 * Features:
 * - Initialize wallet configuration
 * - Make payments with USDs (auto-yield stablecoin)
 * - Check balances and yield information
 * - Manage X402 tools
 * - View payment history
 * 
 * @example
 * ```bash
 * # Initialize
 * x402 init
 * 
 * # Make a payment
 * x402 pay 0x... 10.00 --token USDs --gasless
 * 
 * # Check balance
 * x402 balance
 * 
 * # View yield
 * x402 yield
 * ```
 * 
 * @since January 2026
 */

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createPayCommand } from './commands/pay.js';
import { createBalanceCommand } from './commands/balance.js';
import { createYieldCommand } from './commands/yield.js';
import { createToolsCommand } from './commands/tools.js';
import { createHistoryCommand, createTxCommand } from './commands/history.js';
import { createConfigCommand } from './commands/config.js';
import { displayBanner, theme, error } from './lib/display.js';

// Package info
const VERSION = '1.0.0';
const DESCRIPTION = 'X402 Payment Protocol CLI - AI Agent Payments with USDs';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('x402')
    .description(DESCRIPTION)
    .version(VERSION, '-v, --version', 'Display version number')
    .option('-V, --verbose', 'Enable verbose output')
    .hook('preAction', (thisCommand) => {
      // Set verbose mode globally
      if (thisCommand.opts().verbose) {
        process.env.X402_VERBOSE = 'true';
      }
    });

  // Register commands
  program.addCommand(createInitCommand());
  program.addCommand(createPayCommand());
  program.addCommand(createBalanceCommand());
  program.addCommand(createYieldCommand());
  program.addCommand(createToolsCommand());
  program.addCommand(createHistoryCommand());
  program.addCommand(createTxCommand());
  program.addCommand(createConfigCommand());

  // Custom help
  program.addHelpText('before', () => {
    displayBanner();
    return '';
  });

  program.addHelpText('after', `
${theme.muted('Examples:')}
  ${theme.muted('$')} x402 init                              ${theme.muted('# Initialize CLI')}
  ${theme.muted('$')} x402 pay 0x... 10.00                    ${theme.muted('# Pay 10 USDs')}
  ${theme.muted('$')} x402 pay 0x... 5 --token USDC           ${theme.muted('# Pay 5 USDC')}
  ${theme.muted('$')} x402 balance                            ${theme.muted('# Check balances')}
  ${theme.muted('$')} x402 yield                              ${theme.muted('# View USDs yield')}
  ${theme.muted('$')} x402 tools list                         ${theme.muted('# List tools')}
  ${theme.muted('$')} x402 tools call analyze --args '{}'     ${theme.muted('# Call a tool')}
  ${theme.muted('$')} x402 history --limit 5                  ${theme.muted('# Recent transactions')}
  ${theme.muted('$')} x402 config list                        ${theme.muted('# Show configuration')}

${theme.muted('Documentation:')} ${theme.primary('https://github.com/nirholas/x402')}
`);

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const program = createProgram();
    await program.parseAsync(process.argv);
  } catch (err) {
    error(`Unexpected error: ${(err as Error).message}`);
    if (process.env.X402_VERBOSE) {
      console.error(err);
    }
    process.exit(1);
  }
}

// Run CLI
main();
