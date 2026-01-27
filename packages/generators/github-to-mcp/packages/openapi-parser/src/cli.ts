/**
 * @fileoverview Command-line interface
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { OpenApiToMcp } from './index.js';
import type { ConverterConfig } from './index.js';
import { promises as fs } from 'fs';

const program = new Command();

program
  .name('mcp-convert')
  .description('Convert OpenAPI/Swagger specifications to MCP tools')
  .version('1.0.0');

program
  .argument('<spec>', 'OpenAPI spec file path or URL')
  .option('-o, --output <dir>', 'Output directory', './mcp-server')
  .option('-f, --format <format>', 'Output format (typescript|javascript|json)', 'typescript')
  .option('-b, --base-url <url>', 'Base URL for API (overrides spec)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('-p, --paths <patterns>', 'Filter by path patterns (comma-separated)')
  .option('-m, --methods <methods>', 'Filter by HTTP methods (comma-separated)')
  .option('--include <operations>', 'Include specific operations (comma-separated operationIds)')
  .option('--exclude <operations>', 'Exclude specific operations (comma-separated operationIds)')
  .option('--prefix <prefix>', 'Tool name prefix')
  .option('--naming <style>', 'Naming style (snake_case|camelCase)', 'snake_case')
  .option('--auth <type>', 'Authentication type (bearer|basic|apiKey|oauth)')
  .option('--auth-env <var>', 'Environment variable for auth credentials')
  .option('--auth-header <header>', 'Header name for API key authentication')
  .option('--pagination', 'Enable automatic pagination handling', false)
  .option('--retry', 'Enable retry logic with exponential backoff', false)
  .option('--cache', 'Enable smart caching for GET requests', false)
  .option('--validation', 'Enable input validation', false)
  .option('--types', 'Generate TypeScript types', false)
  .option('--docs', 'Generate documentation', false)
  .option('--preview', 'Preview without generating files', false)
  .option('--interactive', 'Interactive mode with prompts', false)
  .action(async (spec, options) => {
    try {
      let config: ConverterConfig;

      if (options.interactive) {
        config = await interactiveMode(spec);
      } else {
        config = buildConfig(spec, options);
      }

      if (options.preview) {
        await previewMode(config);
      } else {
        await convertMode(config);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

/**
 * Build config from CLI options
 */
function buildConfig(spec: string, options: any): ConverterConfig {
  const config: ConverterConfig = {
    spec,
    outputDir: options.output,
    baseUrl: options.baseUrl,
    filters: {},
    transform: {
      naming: {
        prefix: options.prefix,
        style: options.naming,
      },
    },
    generation: {
      format: options.format,
      features: {
        pagination: options.pagination,
        retry: options.retry,
        cache: options.cache,
        validation: options.validation,
        types: options.types,
      },
    },
  };

  // Parse filters
  if (options.tags) {
    config.filters!.tags = options.tags.split(',').map((t: string) => t.trim());
  }
  if (options.paths) {
    config.filters!.paths = options.paths.split(',').map((p: string) => p.trim());
  }
  if (options.methods) {
    config.filters!.methods = options.methods.split(',').map((m: string) => m.trim().toUpperCase());
  }
  if (options.include) {
    config.filters!.include = options.include.split(',').map((i: string) => i.trim());
  }
  if (options.exclude) {
    config.filters!.exclude = options.exclude.split(',').map((e: string) => e.trim());
  }

  // Parse auth
  if (options.auth) {
    config.transform!.auth = {
      type: options.auth,
      envVar: options.authEnv,
      header: options.authHeader,
    };
    config.generation!.auth = config.transform!.auth;
  }

  return config;
}

/**
 * Interactive mode with prompts
 */
async function interactiveMode(spec: string): Promise<ConverterConfig> {
  console.log(chalk.blue.bold('\n🚀 OpenAPI to MCP Converter - Interactive Mode\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: './mcp-server',
    },
    {
      type: 'list',
      name: 'format',
      message: 'Output format:',
      choices: ['typescript', 'javascript', 'json'],
      default: 'typescript',
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'API base URL (leave empty to use from spec):',
    },
    {
      type: 'input',
      name: 'prefix',
      message: 'Tool name prefix (optional):',
    },
    {
      type: 'list',
      name: 'naming',
      message: 'Naming style:',
      choices: ['snake_case', 'camelCase'],
      default: 'snake_case',
    },
    {
      type: 'list',
      name: 'auth',
      message: 'Authentication type:',
      choices: ['none', 'bearer', 'basic', 'apiKey', 'oauth'],
      default: 'none',
    },
    {
      type: 'input',
      name: 'authEnv',
      message: 'Auth environment variable:',
      when: (answers) => answers.auth !== 'none',
      default: 'API_KEY',
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Enable features:',
      choices: [
        { name: 'Automatic pagination', value: 'pagination' },
        { name: 'Retry with backoff', value: 'retry' },
        { name: 'Smart caching', value: 'cache' },
        { name: 'Input validation', value: 'validation' },
        { name: 'TypeScript types', value: 'types' },
      ],
      default: ['pagination', 'retry', 'cache'],
    },
  ]);

  const config: ConverterConfig = {
    spec,
    outputDir: answers.outputDir,
    baseUrl: answers.baseUrl || undefined,
    transform: {
      naming: {
        prefix: answers.prefix || undefined,
        style: answers.naming,
      },
      auth: answers.auth !== 'none' ? {
        type: answers.auth,
        envVar: answers.authEnv,
      } : undefined,
    },
    generation: {
      format: answers.format,
      features: {
        pagination: answers.features.includes('pagination'),
        retry: answers.features.includes('retry'),
        cache: answers.features.includes('cache'),
        validation: answers.features.includes('validation'),
        types: answers.features.includes('types'),
      },
      auth: answers.auth !== 'none' ? {
        type: answers.auth,
        envVar: answers.authEnv,
      } : undefined,
    },
  };

  return config;
}

/**
 * Preview mode - show what would be generated
 */
async function previewMode(config: ConverterConfig) {
  console.log(chalk.blue.bold('\n👀 Preview Mode\n'));

  const spinner = ora('Analyzing OpenAPI spec...').start();

  try {
    const converter = new OpenApiToMcp(config);
    const preview = await converter.preview();

    spinner.succeed('Analysis complete');

    console.log(chalk.green('\n📊 Statistics:'));
    console.log(`  Tools to generate: ${chalk.bold(preview.tools.length)}`);
    console.log(`  By method:`);
    for (const [method, count] of Object.entries(preview.stats.byMethod)) {
      console.log(`    ${method}: ${count}`);
    }
    console.log(`  By tag:`);
    for (const [tag, count] of Object.entries(preview.stats.byTag)) {
      console.log(`    ${tag}: ${count}`);
    }

    console.log(chalk.green('\n🔧 Sample Tools:'));
    preview.tools.slice(0, 5).forEach(tool => {
      console.log(`  ${chalk.bold(tool.name)}`);
      console.log(`    ${chalk.gray(tool.description)}`);
      console.log(`    ${chalk.gray(`${tool.metadata.endpoint.method} ${tool.metadata.endpoint.path}`)}`);
    });

    if (preview.tools.length > 5) {
      console.log(`  ... and ${preview.tools.length - 5} more`);
    }

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with generation?',
        default: true,
      },
    ]);

    if (proceed) {
      await convertMode(config);
    }
  } catch (error) {
    spinner.fail('Failed to analyze');
    throw error;
  }
}

/**
 * Convert mode - full conversion
 */
async function convertMode(config: ConverterConfig) {
  console.log(chalk.blue.bold('\n🔄 Converting OpenAPI to MCP\n'));

  const converter = new OpenApiToMcp(config);
  const stats = await converter.convert();

  console.log(chalk.green.bold('\n✨ Success!\n'));
  console.log(chalk.green('📊 Summary:'));
  console.log(`  Spec: ${chalk.bold(stats.spec.title)} v${stats.spec.version}`);
  console.log(`  Tools generated: ${chalk.bold(stats.conversion.toolsGenerated)}`);
  console.log(`  Files created: ${chalk.bold(stats.conversion.filesCreated)}`);
  console.log(`  Duration: ${chalk.bold((stats.conversion.duration / 1000).toFixed(2))}s`);
  
  console.log(chalk.green('\n📁 Output:'));
  console.log(`  ${config.outputDir}`);

  console.log(chalk.green('\n🚀 Next Steps:'));
  console.log(`  cd ${config.outputDir}`);
  console.log(`  npm install`);
  console.log(`  npm run build`);
  console.log(`  npm start`);
}

program.parse();
