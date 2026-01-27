/**
 * @fileoverview Registry CLI commands
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { McpRegistry } from './registry';
import { popularEntries } from './popular';
import type { RegistryEntrySummary, InstallOptions } from './types';

// Dynamic import for cli-table3
async function importTable() {
  const Table = await import('cli-table3');
  return Table.default;
}

/**
 * Create the registry subcommand
 */
export function createRegistryCommand(): Command {
  const registry = new Command('registry')
    .description('Manage pre-built MCP servers from the registry');

  // List command
  registry
    .command('list')
    .alias('ls')
    .description('List available MCP servers in the registry')
    .option('-c, --category <category>', 'Filter by category')
    .option('-s, --sort <field>', 'Sort by: popularity, name, quality, toolCount', 'popularity')
    .option('-l, --limit <n>', 'Number of results', '20')
    .option('--verified', 'Show only verified entries')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await listServers(options);
    });

  // Search command
  registry
    .command('search <query>')
    .description('Search for MCP servers')
    .option('-l, --limit <n>', 'Number of results', '20')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      await searchServers(query, options);
    });

  // Info command
  registry
    .command('info <id>')
    .description('Show detailed information about an MCP server')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      await showServerInfo(id, options);
    });

  // Install command
  registry
    .command('install <id>')
    .description('Install an MCP server to your IDE')
    .option('--claude', 'Install to Claude Desktop')
    .option('--cursor', 'Install to Cursor')
    .option('--vscode', 'Install to VS Code')
    .option('-o, --output <dir>', 'Output directory (for file export)')
    .option('--python', 'Use Python version if available')
    .option('--overwrite', 'Overwrite existing installation')
    .action(async (id, options) => {
      await installServer(id, options);
    });

  // Categories command
  registry
    .command('categories')
    .alias('cats')
    .description('List all categories')
    .action(async () => {
      await listCategories();
    });

  // Stats command
  registry
    .command('stats')
    .description('Show registry statistics')
    .action(async () => {
      await showStats();
    });

  // Update command
  registry
    .command('update [id]')
    .description('Check for updates (optionally for a specific server)')
    .action(async (id) => {
      await checkUpdates(id);
    });

  return registry;
}

/**
 * List available servers
 */
async function listServers(options: {
  category?: string;
  sort?: string;
  limit?: string;
  verified?: boolean;
  json?: boolean;
}): Promise<void> {
  const mcpRegistry = new McpRegistry();
  
  const result = await mcpRegistry.list({
    category: options.category,
    sortBy: options.sort as 'popularity' | 'name' | 'quality' | 'toolCount',
    limit: parseInt(options.limit || '20', 10),
    verifiedOnly: options.verified,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.entries.length === 0) {
    console.log(chalk.yellow('No servers found matching your criteria.'));
    return;
  }

  const Table = await importTable();
  const table = new Table({
    head: [
      chalk.cyan('Name'),
      chalk.cyan('ID'),
      chalk.cyan('Tools'),
      chalk.cyan('Quality'),
      chalk.cyan('Downloads'),
      chalk.cyan('Categories'),
    ],
    style: { head: [], border: ['gray'] },
  });

  for (const entry of result.entries) {
    table.push([
      `${entry.verified ? chalk.green('✓') : ' '} ${entry.name}`,
      chalk.gray(entry.id),
      entry.toolCount.toString(),
      getQualityBadge(entry.quality),
      formatNumber(entry.popularity),
      chalk.gray(entry.categories.slice(0, 2).join(', ')),
    ]);
  }

  console.log(chalk.bold.cyan('\n  MCP Server Registry\n'));
  console.log(table.toString());
  console.log(chalk.gray(`\nShowing ${result.entries.length} of ${result.total} servers`));
  console.log(chalk.gray('Use "github-to-mcp registry info <id>" for details'));
}

/**
 * Search for servers
 */
async function searchServers(query: string, options: { limit?: string; json?: boolean }): Promise<void> {
  const mcpRegistry = new McpRegistry();
  const entries = await mcpRegistry.search(query);

  if (options.json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log(chalk.yellow(`No servers found matching "${query}"`));
    return;
  }

  const Table = await importTable();
  const table = new Table({
    head: [chalk.cyan('Name'), chalk.cyan('ID'), chalk.cyan('Description'), chalk.cyan('Tools')],
    style: { head: [], border: ['gray'] },
    colWidths: [15, 15, 40, 8],
    wordWrap: true,
  });

  const limit = parseInt(options.limit || '20', 10);
  for (const entry of entries.slice(0, limit)) {
    table.push([
      `${entry.verified ? chalk.green('✓') : ' '} ${entry.name}`,
      chalk.gray(entry.id),
      entry.description.substring(0, 80),
      entry.toolCount.toString(),
    ]);
  }

  console.log(chalk.bold.cyan(`\n  Search results for "${query}"\n`));
  console.log(table.toString());
}

/**
 * Show server information
 */
async function showServerInfo(id: string, options: { json?: boolean }): Promise<void> {
  const mcpRegistry = new McpRegistry();
  const entry = await mcpRegistry.get(id);

  if (!entry) {
    // Check popular entries
    const popular = popularEntries.find(e => e.id === id);
    if (popular) {
      if (options.json) {
        console.log(JSON.stringify(popular, null, 2));
        return;
      }
      displayEntryInfo(popular);
      return;
    }
    console.log(chalk.red(`Server "${id}" not found`));
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  displayEntryInfo(entry);
}

/**
 * Display entry information in a nice format
 */
function displayEntryInfo(entry: {
  name: string;
  id: string;
  description: string;
  sourceRepo: string;
  version: string;
  toolCount: number;
  quality: { overall: number; schemaCompleteness: number; documentation: number; examples: number; authHandling: number };
  categories: string[];
  tags: string[];
  auth: Array<{ type: string; envVar?: string; instructions?: string }>;
  tools: Array<{ name: string; description: string }>;
  docsUrl?: string;
  apiDocsUrl?: string;
  verified: boolean;
}): void {
  console.log(chalk.bold.cyan(`\n  ${entry.name}`));
  console.log(chalk.gray(`  ${entry.id} v${entry.version}`));
  if (entry.verified) {
    console.log(chalk.green('  ✓ Verified'));
  }
  console.log();
  console.log(chalk.white(`  ${entry.description}`));
  console.log();
  console.log(chalk.gray('  Source:     ') + chalk.blue(`https://github.com/${entry.sourceRepo}`));
  console.log(chalk.gray('  Tools:      ') + chalk.green(entry.toolCount.toString()));
  console.log(chalk.gray('  Quality:    ') + getQualityBadge(entry.quality.overall));
  console.log(chalk.gray('  Categories: ') + entry.categories.join(', '));
  console.log(chalk.gray('  Tags:       ') + chalk.gray(entry.tags.join(', ')));

  // Quality breakdown
  console.log(chalk.bold('\n  Quality Breakdown:'));
  console.log(`    Schema:    ${getProgressBar(entry.quality.schemaCompleteness)}`);
  console.log(`    Docs:      ${getProgressBar(entry.quality.documentation)}`);
  console.log(`    Examples:  ${getProgressBar(entry.quality.examples)}`);
  console.log(`    Auth:      ${getProgressBar(entry.quality.authHandling)}`);

  // Authentication
  if (entry.auth.length > 0) {
    console.log(chalk.bold('\n  Authentication:'));
    for (const auth of entry.auth) {
      console.log(`    Type: ${auth.type}`);
      if (auth.envVar) {
        console.log(`    Env:  ${chalk.yellow(auth.envVar)}`);
      }
      if (auth.instructions) {
        console.log(`    ${chalk.gray(auth.instructions)}`);
      }
    }
  }

  // Tools preview
  console.log(chalk.bold('\n  Tools:'));
  const toolsToShow = entry.tools.slice(0, 8);
  for (const tool of toolsToShow) {
    console.log(`    ${chalk.green('•')} ${chalk.white(tool.name)}`);
    console.log(`      ${chalk.gray(tool.description.substring(0, 60))}${tool.description.length > 60 ? '...' : ''}`);
  }
  if (entry.tools.length > 8) {
    console.log(chalk.gray(`    ... and ${entry.tools.length - 8} more tools`));
  }

  // Links
  console.log(chalk.bold('\n  Links:'));
  if (entry.docsUrl) {
    console.log(`    Docs: ${chalk.blue(entry.docsUrl)}`);
  }
  if (entry.apiDocsUrl) {
    console.log(`    API:  ${chalk.blue(entry.apiDocsUrl)}`);
  }

  // Install hint
  console.log(chalk.bold('\n  Install:'));
  console.log(chalk.gray(`    github-to-mcp registry install ${entry.id} --claude`));
  console.log();
}

/**
 * Install a server
 */
async function installServer(
  id: string,
  options: {
    claude?: boolean;
    cursor?: boolean;
    vscode?: boolean;
    output?: string;
    python?: boolean;
    overwrite?: boolean;
  }
): Promise<void> {
  const spinner = ora(`Installing ${id}...`).start();

  const mcpRegistry = new McpRegistry();

  // Determine target
  let target: InstallOptions['target'] = 'file';
  if (options.claude) target = 'claude';
  else if (options.cursor) target = 'cursor';
  else if (options.vscode) target = 'vscode';

  const installOptions: InstallOptions = {
    target,
    outputDir: options.output,
    language: options.python ? 'python' : 'typescript',
    overwrite: options.overwrite,
  };

  const result = await mcpRegistry.install(id, installOptions);

  if (!result.success) {
    spinner.fail(chalk.red(result.error));
    process.exit(1);
  }

  spinner.succeed(chalk.green(`Installed ${id}`));

  if (result.instructions) {
    console.log(chalk.bold('\n  Next steps:'));
    for (const instruction of result.instructions) {
      console.log(`    ${chalk.gray('•')} ${instruction}`);
    }
  }

  if (result.path) {
    console.log(chalk.gray(`\n  Installed to: ${result.path}`));
  }
}

/**
 * List categories
 */
async function listCategories(): Promise<void> {
  const mcpRegistry = new McpRegistry();
  const categories = await mcpRegistry.getCategories();

  console.log(chalk.bold.cyan('\n  Available Categories\n'));
  for (const cat of categories) {
    console.log(`    ${chalk.green('•')} ${cat}`);
  }
  console.log();
}

/**
 * Show registry stats
 */
async function showStats(): Promise<void> {
  const mcpRegistry = new McpRegistry();
  const stats = await mcpRegistry.getStats();

  console.log(chalk.bold.cyan('\n  Registry Statistics\n'));
  console.log(`    Total Servers:   ${chalk.green(stats.totalEntries.toString())}`);
  console.log(`    Total Tools:     ${chalk.green(stats.totalTools.toString())}`);
  console.log(`    Total Downloads: ${chalk.green(formatNumber(stats.totalDownloads))}`);

  console.log(chalk.bold('\n  Categories:'));
  for (const cat of stats.categories.slice(0, 10)) {
    console.log(`    ${cat.name.padEnd(20)} ${chalk.gray(cat.count.toString())}`);
  }

  console.log(chalk.bold('\n  Top Servers:'));
  for (const entry of stats.topEntries.slice(0, 5)) {
    console.log(`    ${entry.name.padEnd(15)} ${chalk.gray(formatNumber(entry.popularity))} downloads`);
  }
  console.log();
}

/**
 * Check for updates
 */
async function checkUpdates(id?: string): Promise<void> {
  const spinner = ora('Checking for updates...').start();

  const mcpRegistry = new McpRegistry();

  if (id) {
    const update = await mcpRegistry.checkUpdate(id);
    if (!update) {
      spinner.succeed(chalk.green(`${id} is up to date`));
      return;
    }
    spinner.info(chalk.yellow(`Update available for ${id}`));
    console.log(`    Current: ${update.currentVersion}`);
    console.log(`    Latest:  ${update.latestVersion}`);
    if (update.breaking) {
      console.log(chalk.red('    ⚠ Breaking changes'));
    }
  } else {
    const updates = await mcpRegistry.checkUpdates();
    if (updates.length === 0) {
      spinner.succeed(chalk.green('All servers are up to date'));
      return;
    }
    spinner.info(chalk.yellow(`${updates.length} updates available`));
    for (const update of updates) {
      console.log(`    ${update.id}: ${update.currentVersion} → ${update.latestVersion}`);
    }
  }
}

// Helper functions
function getQualityBadge(score: number): string {
  if (score >= 90) return chalk.green(`★★★★★ ${score}`);
  if (score >= 80) return chalk.green(`★★★★☆ ${score}`);
  if (score >= 70) return chalk.yellow(`★★★☆☆ ${score}`);
  if (score >= 50) return chalk.yellow(`★★☆☆☆ ${score}`);
  return chalk.red(`★☆☆☆☆ ${score}`);
}

function getProgressBar(value: number): string {
  const filled = Math.round(value / 10);
  const empty = 10 - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `${bar} ${value}%`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// Export for use in main CLI
export { createRegistryCommand as default };
