/**
 * @fileoverview Config command - Configuration management
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Command } from 'commander';
import {
  isInitialized,
  getConfig,
  getConfigValue,
  setConfigValue,
  listConfigKeys,
  resetConfig,
} from '../lib/config.js';
import {
  success,
  error,
  warning,
  info,
  displayConfig,
  theme,
} from '../lib/display.js';
import { CLIConfig } from '../types.js';

/**
 * Valid config keys that can be modified
 */
const MODIFIABLE_KEYS: (keyof CLIConfig)[] = [
  'network',
  'defaultToken',
  'rpcUrl',
  'facilitatorUrl',
  'autoApproveUnder',
  'gaslessEnabled',
];

/**
 * Create config command
 */
export function createConfigCommand(): Command {
  const configCommand = new Command('config')
    .description('Manage CLI configuration');

  /**
   * Set config value
   */
  configCommand
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .action(async (key, value) => {
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      // Validate key
      if (!MODIFIABLE_KEYS.includes(key as keyof CLIConfig)) {
        error(`Invalid or protected key: ${key}`);
        console.log();
        info('Modifiable keys:');
        MODIFIABLE_KEYS.forEach(k => console.log(`  - ${k}`));
        console.log();
        process.exit(1);
      }

      // Parse and validate value based on key
      let parsedValue: any = value;

      switch (key) {
        case 'network':
          if (!['arbitrum', 'arbitrum-sepolia'].includes(value)) {
            error('Invalid network. Use: arbitrum, arbitrum-sepolia');
            process.exit(1);
          }
          break;

        case 'defaultToken':
          if (!['USDs', 'USDC', 'USDT', 'DAI'].includes(value)) {
            error('Invalid token. Use: USDs, USDC, USDT, DAI');
            process.exit(1);
          }
          break;

        case 'gaslessEnabled':
          parsedValue = value === 'true' || value === '1';
          break;

        case 'autoApproveUnder':
          const num = parseFloat(value);
          if (value && (isNaN(num) || num < 0)) {
            error('Invalid amount. Use a positive number or empty to disable.');
            process.exit(1);
          }
          parsedValue = value || undefined;
          break;

        case 'rpcUrl':
        case 'facilitatorUrl':
          // Basic URL validation
          try {
            new URL(value);
          } catch {
            error('Invalid URL format');
            process.exit(1);
          }
          break;
      }

      try {
        setConfigValue(key as keyof CLIConfig, parsedValue);
        success(`Set ${key} = ${parsedValue}`);
      } catch (setError) {
        error(`Failed to set config: ${(setError as Error).message}`);
        process.exit(1);
      }
    });

  /**
   * Get config value
   */
  configCommand
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key')
    .action(async (key) => {
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      const config = getConfig();
      
      if (!(key in config)) {
        error(`Unknown key: ${key}`);
        console.log();
        info('Available keys:');
        listConfigKeys().forEach(k => console.log(`  - ${k}`));
        console.log();
        process.exit(1);
      }

      const value = getConfigValue(key as keyof CLIConfig);
      
      if (key === 'lastUsed' && value) {
        console.log(new Date(value as number).toLocaleString());
      } else {
        console.log(value ?? theme.muted('(not set)'));
      }
    });

  /**
   * List all config values
   */
  configCommand
    .command('list')
    .description('List all configuration values')
    .action(async () => {
      if (!isInitialized()) {
        error('CLI not initialized. Run "x402 init" first.');
        process.exit(1);
      }

      const config = getConfig();
      
      console.log();
      console.log(theme.highlight('X402 Configuration'));
      displayConfig(config);
    });

  /**
   * Reset configuration
   */
  configCommand
    .command('reset')
    .description('Reset configuration to defaults')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options) => {
      if (!options.yes) {
        const inquirer = await import('inquirer');
        const confirm = await inquirer.default.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'This will reset all configuration. Continue?',
            default: false,
          },
        ]);

        if (!confirm.proceed) {
          info('Reset cancelled');
          return;
        }
      }

      try {
        resetConfig();
        success('Configuration reset to defaults');
        warning('You will need to run "x402 init" to reconfigure.');
      } catch (resetError) {
        error(`Failed to reset config: ${(resetError as Error).message}`);
        process.exit(1);
      }
    });

  return configCommand;
}
