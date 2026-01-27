/**
 * @fileoverview Tools command - Tool operations
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import {
  isInitialized,
  getConfig,
} from '../lib/config.js';
import {
  success,
  error,
  info,
  createSpinner,
  displayTools,
  theme,
} from '../lib/display.js';
import { createClient } from '../lib/client.js';
import { getStoredPrivateKey } from './init.js';

/**
 * Create tools command
 */
export function createToolsCommand(): Command {
  const toolsCommand = new Command('tools')
    .description('Manage X402 tools');

  /**
   * List tools subcommand
   */
  toolsCommand
    .command('list')
    .description('List registered tools')
    .option('-a, --all', 'Show all tools (not just yours)')
    .action(async (options) => {
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      const spinner = createSpinner('Fetching tools...');
      spinner.start();

      try {
        const client = createClient();
        const tools = await client.listTools();
        
        spinner.succeed(`Found ${tools.length} tools`);
        displayTools(tools);

        // Summary stats
        const totalCalls = tools.reduce((sum, t) => sum + t.calls, 0);
        const totalRevenue = tools.reduce((sum, t) => sum + parseFloat(t.revenue), 0);
        
        console.log(theme.muted(`Total calls: ${totalCalls}`));
        console.log(theme.muted(`Total revenue: ${totalRevenue.toFixed(2)} USDs`));
        console.log();

      } catch (listError) {
        spinner.fail('Failed to fetch tools');
        error((listError as Error).message);
        process.exit(1);
      }
    });

  /**
   * Call tool subcommand
   */
  toolsCommand
    .command('call')
    .description('Call a registered tool')
    .argument('<tool-name>', 'Name of the tool to call')
    .option('-a, --args <json>', 'Tool arguments as JSON')
    .option('-y, --yes', 'Skip payment confirmation')
    .action(async (toolName, options) => {
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      const privateKey = await getStoredPrivateKey();
      if (!privateKey) {
        error('Private key not found. Run "x402 init" to reconfigure.');
        process.exit(1);
      }

      // Parse arguments
      let args: Record<string, any> = {};
      if (options.args) {
        try {
          args = JSON.parse(options.args);
        } catch {
          error('Invalid JSON in --args');
          process.exit(1);
        }
      }

      // Interactive arg input if not provided
      if (!options.args) {
        const argAnswers = await inquirer.prompt([
          {
            type: 'editor',
            name: 'args',
            message: 'Enter tool arguments (JSON):',
            default: '{}',
            validate: (input: string) => {
              try {
                JSON.parse(input);
                return true;
              } catch {
                return 'Invalid JSON format';
              }
            },
          },
        ]);
        args = JSON.parse(argAnswers.args);
      }

      // Confirm payment
      if (!options.yes) {
        const confirm = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: `This tool may require payment. Continue?`,
            default: true,
          },
        ]);

        if (!confirm.proceed) {
          info('Tool call cancelled');
          return;
        }
      }

      const spinner = createSpinner(`Calling ${toolName}...`);
      spinner.start();

      try {
        const client = createClient(privateKey);
        const result = await client.callTool(toolName, args);
        
        spinner.succeed(`Tool ${toolName} executed`);
        
        console.log();
        console.log(theme.highlight('Result:'));
        console.log(JSON.stringify(result.result, null, 2));
        
        if (result.txHash) {
          console.log();
          info(`Payment TX: ${result.txHash}`);
        }
        console.log();

      } catch (callError) {
        spinner.fail('Tool call failed');
        error((callError as Error).message);
        process.exit(1);
      }
    });

  /**
   * Register tool subcommand
   */
  toolsCommand
    .command('register')
    .description('Register a new tool')
    .argument('<name>', 'Tool name')
    .argument('<price>', 'Price per call in USDs')
    .option('-d, --description <desc>', 'Tool description')
    .action(async (name, price, options) => {
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      const privateKey = await getStoredPrivateKey();
      if (!privateKey) {
        error('Private key not found. Run "x402 init" to reconfigure.');
        process.exit(1);
      }

      // Validate price
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        error('Invalid price');
        process.exit(1);
      }

      // Interactive description if not provided
      let description = options.description;
      if (!description) {
        const descAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Tool description:',
            validate: (input: string) => input.length > 0 || 'Description is required',
          },
        ]);
        description = descAnswer.description;
      }

      const spinner = createSpinner(`Registering tool ${name}...`);
      spinner.start();

      try {
        const client = createClient(privateKey);
        const tool = await client.registerTool(name, price);
        
        spinner.succeed(`Tool ${name} registered`);
        
        console.log();
        info(`Name: ${theme.primary(tool.name)}`);
        info(`Price: ${tool.price} ${tool.token}`);
        info(`Owner: ${tool.owner}`);
        console.log();
        success('Tool is now available for X402 payments!');
        console.log();

      } catch (registerError) {
        spinner.fail('Tool registration failed');
        error((registerError as Error).message);
        process.exit(1);
      }
    });

  return toolsCommand;
}
