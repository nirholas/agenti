/**
 * @fileoverview Command-line interface
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * GitHub to MCP CLI
 */

import { Command } from 'commander';
import { generateFromGithub, generateFromGithubBatch, GenerationResult, ExtractedTool } from './index';
import ora from 'ora';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

// Dynamic imports for optional dependencies
async function importPrompts() {
  const prompts = await import('prompts');
  return prompts.default;
}

async function importChokidar() {
  const chokidar = await import('chokidar');
  return chokidar.default;
}

async function importTable() {
  const Table = await import('cli-table3');
  return Table.default;
}

const program = new Command();

// Logging utilities
let isQuiet = false;
let isVerbose = false;

function log(message: string): void {
  if (!isQuiet) {
    console.log(message);
  }
}

function debug(message: string): void {
  if (isVerbose && !isQuiet) {
    console.log(chalk.gray(`[debug] ${message}`));
  }
}

function errorLog(message: string): void {
  console.error(chalk.red(message));
}

/**
 * Display a summary box for conversion results
 */
async function displayResultBox(result: GenerationResult): Promise<void> {
  const Table = await importTable();
  
  const table = new Table({
    chars: {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│'
    },
    style: { head: ['cyan'], border: ['gray'] }
  });

  const confidence = result.classification 
    ? Math.round(result.classification.confidence * 100) 
    : 0;

  table.push(
    [{ colSpan: 2, content: chalk.bold.cyan('  GitHub to MCP Converter  '), hAlign: 'center' }],
    [chalk.gray('Repository'), chalk.white(result.name)],
    [chalk.gray('Tools Found'), chalk.green(result.tools.length.toString())],
    [chalk.gray('Confidence'), chalk.yellow(`${confidence}%`)],
    [chalk.gray('Type'), chalk.blue(result.classification?.type || 'unknown')]
  );

  log(table.toString());
}

/**
 * Interactive mode - prompts for all options
 */
async function runInteractive(): Promise<void> {
  const prompts = await importPrompts();

  log(chalk.bold.cyan('\n  GitHub to MCP - Interactive Mode\n'));

  const response = await prompts([
    {
      type: 'text',
      name: 'url',
      message: 'GitHub repository URL:',
      validate: (value: string) => {
        if (!value) return 'URL is required';
        if (!value.match(/^https?:\/\/github\.com\/[\w-]+\/[\w.-]+/)) {
          return 'Invalid GitHub URL format';
        }
        return true;
      }
    },
    {
      type: 'select',
      name: 'output',
      message: 'Output format:',
      choices: [
        { title: 'TypeScript', value: 'typescript' },
        { title: 'Python', value: 'python' },
        { title: 'JSON', value: 'json' }
      ],
      initial: 0
    },
    {
      type: 'select',
      name: 'platform',
      message: 'Target platform:',
      choices: [
        { title: 'Claude Desktop', value: 'claude' },
        { title: 'Cursor', value: 'cursor' },
        { title: 'None (just generate)', value: 'none' }
      ],
      initial: 0
    },
    {
      type: 'multiselect',
      name: 'sources',
      message: 'Sources to extract from:',
      choices: [
        { title: 'README', value: 'readme', selected: true },
        { title: 'OpenAPI specs', value: 'openapi', selected: true },
        { title: 'Code analysis', value: 'code', selected: true }
      ],
      min: 1
    },
    {
      type: 'text',
      name: 'outputDir',
      message: 'Output directory:',
      initial: './mcp-tools'
    },
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with conversion?',
      initial: true
    }
  ]);

  if (!response.proceed || !response.url) {
    log(chalk.yellow('Cancelled.'));
    return;
  }

  const spinner = ora('Converting repository...').start();

  try {
    const result = await generateFromGithub(response.url, {
      sources: response.sources,
      outputLanguage: response.output === 'python' ? 'python' : 'typescript'
    });

    spinner.succeed(chalk.green('Conversion complete!'));

    await displayResultBox(result);

    // Save based on output format
    const outputDir = `${response.outputDir}/${result.name}`;
    
    if (response.output === 'json') {
      await fs.mkdir(outputDir, { recursive: true });
      const jsonOutput = {
        name: result.name,
        tools: result.tools.map((t: ExtractedTool) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        })),
        classification: result.classification
      };
      await fs.writeFile(
        path.join(outputDir, 'tools.json'),
        JSON.stringify(jsonOutput, null, 2)
      );
      log(chalk.green(`\n✓ Saved JSON to ${outputDir}/tools.json`));
    } else {
      await result.save(outputDir);
      log(chalk.green(`\n✓ Saved to ${outputDir}`));
    }

    // Show platform config if requested
    if (response.platform !== 'none') {
      log(chalk.cyan('\nMCP Configuration:'));
      const config = generatePlatformConfig(result.name, response.platform);
      log(chalk.gray(config));
    }
  } catch (error) {
    spinner.fail(chalk.red('Conversion failed'));
    errorLog(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Watch mode - monitor local directory for changes
 */
async function runWatchMode(localPath: string, options: Record<string, unknown>): Promise<void> {
  const chokidar = await importChokidar();
  
  log(chalk.cyan(`\n  Watching ${localPath} for changes...\n`));
  log(chalk.gray('  Press Ctrl+C to stop\n'));

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = 500;

  async function processChange(): Promise<void> {
    console.clear();
    log(chalk.cyan(`\n  File change detected - Re-analyzing...\n`));

    try {
      // For local paths, we'd need to implement local analysis
      // For now, show a message about this feature
      log(chalk.yellow('  Watch mode analyzes local directories for tool definitions.'));
      log(chalk.gray(`  Watching: ${path.resolve(localPath)}`));
      log(chalk.gray(`  Last update: ${new Date().toLocaleTimeString()}`));
      
      // In a full implementation, this would:
      // 1. Scan the local directory for OpenAPI specs, code files, etc.
      // 2. Extract tool definitions
      // 3. Regenerate the MCP server
      
      const generateOptions = {
        sources: (options.sources as string || 'readme,openapi,code').split(','),
        outputLanguage: options.output === 'python' ? 'python' as const : 'typescript' as const
      };

      debug(`Options: ${JSON.stringify(generateOptions)}`);
      
    } catch (error) {
      errorLog(`Error processing changes: ${(error as Error).message}`);
    }
  }

  const watcher = chokidar.watch(localPath, {
    ignored: /(^|[/\\])\..|(node_modules|dist|\.git)/,
    persistent: true,
    ignoreInitial: false
  });

  watcher.on('all', (event, filePath) => {
    debug(`${event}: ${filePath}`);
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      processChange();
    }, debounceMs);
  });

  watcher.on('error', (error) => {
    errorLog(`Watcher error: ${error.message}`);
  });

  // Keep the process running
  process.on('SIGINT', () => {
    log(chalk.yellow('\n  Stopping watch mode...'));
    watcher.close();
    process.exit(0);
  });
}

/**
 * Validate command - check generated MCP server
 */
async function runValidate(filePath: string, options: Record<string, unknown>): Promise<void> {
  const Table = await importTable();
  
  log(chalk.cyan('\n  Validating MCP Server\n'));

  try {
    let content: string;
    
    if (options.url) {
      // Validate from URL - not supported yet
      errorLog('URL validation not yet supported. Please provide a local file path.');
      process.exit(1);
    }

    content = await fs.readFile(filePath, 'utf-8');
    
    const issues: Array<{ severity: 'error' | 'warning'; message: string; line?: number }> = [];
    const lines = content.split('\n');

    // Detect file type
    const isPython = filePath.endsWith('.py');
    const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.js');

    if (isTypeScript) {
      // Check for MCP SDK import
      if (!content.includes('@modelcontextprotocol/sdk')) {
        issues.push({ severity: 'error', message: 'Missing @modelcontextprotocol/sdk import' });
      }

      // Check for Server instantiation
      if (!content.includes('new Server(')) {
        issues.push({ severity: 'error', message: 'Missing Server instantiation' });
      }

      // Check for ListToolsRequestSchema
      if (!content.includes('ListToolsRequestSchema')) {
        issues.push({ severity: 'warning', message: 'Missing ListToolsRequestSchema handler' });
      }

      // Check for CallToolRequestSchema
      if (!content.includes('CallToolRequestSchema')) {
        issues.push({ severity: 'warning', message: 'Missing CallToolRequestSchema handler' });
      }

      // Check for transport
      if (!content.includes('StdioServerTransport') && !content.includes('transport')) {
        issues.push({ severity: 'warning', message: 'Missing transport configuration' });
      }

      // Check for tool definitions
      const toolMatches = content.match(/name:\s*['"`][\w_-]+['"`]/g);
      if (toolMatches) {
        debug(`Found ${toolMatches.length} tool definitions`);
      }

      // Check for syntax issues
      lines.forEach((line, index) => {
        if (line.includes('async function') && line.includes('{') && !line.includes('}')) {
          // Check if next line has the closing brace or more code
          const nextLine = lines[index + 1];
          if (nextLine && nextLine.trim() === '') {
            issues.push({ severity: 'warning', message: 'Possible incomplete function', line: index + 1 });
          }
        }
      });
    } else if (isPython) {
      // Check for mcp import
      if (!content.includes('from mcp') && !content.includes('import mcp')) {
        issues.push({ severity: 'error', message: 'Missing mcp module import' });
      }

      // Check for Server
      if (!content.includes('Server(')) {
        issues.push({ severity: 'error', message: 'Missing Server instantiation' });
      }

      // Check for handlers
      if (!content.includes('list_tools')) {
        issues.push({ severity: 'warning', message: 'Missing list_tools handler' });
      }

      if (!content.includes('call_tool')) {
        issues.push({ severity: 'warning', message: 'Missing call_tool handler' });
      }
    } else {
      issues.push({ severity: 'warning', message: 'Unknown file type - limited validation' });
    }

    // Display results
    if (issues.length === 0) {
      log(chalk.green('  ✓ Validation passed! No issues found.\n'));
    } else {
      const table = new Table({
        head: [chalk.white('Severity'), chalk.white('Line'), chalk.white('Message')],
        style: { head: ['cyan'] }
      });

      for (const issue of issues) {
        const icon = issue.severity === 'error' ? chalk.red('✗ ERROR') : chalk.yellow('⚠ WARN');
        table.push([icon, issue.line?.toString() || '-', issue.message]);
      }

      log(table.toString());
      log('');

      const errorCount = issues.filter(i => i.severity === 'error').length;
      const warnCount = issues.filter(i => i.severity === 'warning').length;

      if (errorCount > 0) {
        log(chalk.red(`  ${errorCount} error(s), ${warnCount} warning(s)\n`));
        process.exit(1);
      } else {
        log(chalk.yellow(`  ${warnCount} warning(s)\n`));
      }
    }
  } catch (error) {
    errorLog(`Validation failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Generate platform-specific config
 */
function generatePlatformConfig(repoName: string, platform: string): string {
  const serverName = repoName.includes('/') ? repoName.split('/')[1] : repoName;
  
  switch (platform) {
    case 'claude':
      return JSON.stringify({
        mcpServers: {
          [serverName]: {
            command: 'node',
            args: [`${serverName}-mcp/index.js`]
          }
        }
      }, null, 2);
    
    case 'cursor':
      return JSON.stringify({
        mcp: {
          servers: {
            [serverName]: {
              command: 'node',
              args: [`${serverName}-mcp/index.js`]
            }
          }
        }
      }, null, 2);
    
    default:
      return JSON.stringify({
        name: serverName,
        command: 'node',
        args: [`${serverName}-mcp/index.js`]
      }, null, 2);
  }
}

/**
 * Get config file path for each platform
 */
function getConfigPath(platform: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  
  switch (platform) {
    case 'claude':
      if (isMac) {
        return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else if (isWindows) {
        return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
      } else {
        return path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json');
      }
    
    case 'cursor':
      return path.join(homeDir, '.cursor', 'mcp.json');
    
    case 'vscode':
      if (isMac) {
        return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json');
      } else if (isWindows) {
        return path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json');
      } else {
        return path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'mcp_settings.json');
      }
    
    default:
      return '';
  }
}

/**
 * Install command - One-click install MCP server to platforms
 */
async function runInstall(url: string, options: Record<string, unknown>): Promise<void> {
  const Table = await importTable();
  
  log(chalk.bold.cyan('\n  GitHub to MCP - One-Click Install\n'));

  // Determine which platforms to install to
  const platforms: string[] = [];
  if (options.all) {
    platforms.push('claude', 'cursor', 'vscode');
  } else {
    if (options.claude) platforms.push('claude');
    if (options.cursor) platforms.push('cursor');
    if (options.vscode) platforms.push('vscode');
  }

  // Default to Claude if no platform specified
  if (platforms.length === 0) {
    platforms.push('claude');
  }

  const spinner = ora('Converting repository...').start();

  try {
    // Generate MCP server
    const result = await generateFromGithub(url, {
      sources: ['readme', 'openapi', 'code'],
      outputLanguage: 'typescript'
    });

    spinner.succeed(chalk.green(`Generated ${result.tools.length} tools from ${result.name}`));

    // Expand home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    const installDir = (options.dir as string).replace('~', homeDir);
    const serverDir = path.join(installDir, `${result.name}-mcp`);

    if (options.dryRun) {
      log(chalk.yellow('\n  Dry run - no changes will be made\n'));
    }

    // Save the server code
    if (!options.dryRun) {
      await fs.mkdir(serverDir, { recursive: true });
      const code = result.generate();
      await fs.writeFile(path.join(serverDir, 'index.ts'), code);
      
      // Create package.json
      const packageJson = {
        name: `${result.name}-mcp`,
        version: '1.0.0',
        type: 'module',
        scripts: {
          start: 'tsx index.ts'
        },
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.0.0',
          'tsx': '^4.0.0'
        }
      };
      await fs.writeFile(
        path.join(serverDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      log(chalk.green(`  ✓ Saved server to ${serverDir}`));
    } else {
      log(chalk.gray(`  Would save server to ${serverDir}`));
    }

    // Install to each platform
    log(chalk.cyan('\n  Installing to platforms:\n'));

    for (const platform of platforms) {
      const configPath = getConfigPath(platform);
      const platformName = platform === 'claude' ? 'Claude Desktop' : 
                          platform === 'cursor' ? 'Cursor' : 'VS Code';

      try {
        // Read existing config or create new
        let config: Record<string, unknown> = {};
        try {
          const existingConfig = await fs.readFile(configPath, 'utf-8');
          config = JSON.parse(existingConfig);
        } catch {
          // Config doesn't exist, will create new
        }

        // Add our server to the config
        const serverName = result.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        
        if (platform === 'cursor') {
          if (!config.mcp) config.mcp = { servers: {} };
          if (!(config.mcp as Record<string, unknown>).servers) {
            (config.mcp as Record<string, unknown>).servers = {};
          }
          ((config.mcp as Record<string, unknown>).servers as Record<string, unknown>)[serverName] = {
            command: 'npx',
            args: ['tsx', path.join(serverDir, 'index.ts')]
          };
        } else {
          if (!config.mcpServers) config.mcpServers = {};
          (config.mcpServers as Record<string, unknown>)[serverName] = {
            command: 'npx',
            args: ['tsx', path.join(serverDir, 'index.ts')]
          };
        }

        if (!options.dryRun) {
          // Ensure config directory exists
          await fs.mkdir(path.dirname(configPath), { recursive: true });
          await fs.writeFile(configPath, JSON.stringify(config, null, 2));
          log(chalk.green(`  ✓ ${platformName}: Added to ${configPath}`));
        } else {
          log(chalk.gray(`  Would add to ${platformName}: ${configPath}`));
        }

      } catch (error) {
        log(chalk.yellow(`  ⚠ ${platformName}: ${(error as Error).message}`));
      }
    }

    // Summary
    log(chalk.cyan('\n  Installation Summary:\n'));

    const table = new Table({
      head: [chalk.white('Item'), chalk.white('Value')],
      style: { head: ['cyan'] }
    });

    table.push(
      ['Server Name', result.name],
      ['Tools', result.tools.length.toString()],
      ['Location', serverDir],
      ['Platforms', platforms.join(', ')]
    );

    log(table.toString());

    // Next steps
    log(chalk.cyan('\n  Next Steps:\n'));
    log(chalk.white('  1. Restart your MCP client (Claude Desktop, Cursor, etc.)'));
    log(chalk.white('  2. The new tools will be available automatically'));
    log(chalk.white(`  3. Run ${chalk.yellow(`cd ${serverDir} && npm install`)} to install dependencies`));
    log('');

    if (!options.dryRun) {
      log(chalk.green.bold('  ✓ Installation complete!\n'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Installation failed'));
    errorLog(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Main program setup
program
  .name('github-to-mcp')
  .description('Convert GitHub repositories to MCP tools')
  .version('1.0.0');

// Global options
program
  .option('-q, --quiet', 'Minimal output')
  .option('-v, --verbose', 'Debug logging')
  .option('--no-cache', 'Skip cache');

// Default convert command
program
  .argument('[urls...]', 'GitHub repository URLs')
  .option('-o, --output <format>', 'Output format (typescript, json, python)', 'typescript')
  .option('-d, --dir <path>', 'Output directory', './mcp-tools')
  .option('-f, --file <path>', 'File containing list of GitHub URLs')
  .option('-i, --interactive', 'Interactive mode')
  .option('-w, --watch', 'Watch mode for local directory')
  .option('--follow-docs', 'Follow documentation links', false)
  .option('--depth <number>', 'Documentation scraping depth', '2')
  .option('--sources <types>', 'Sources to extract from (comma-separated)', 'readme,openapi,code')
  .option('--format <format>', 'Output format (deprecated, use -o)', 'typescript')
  .option('--token <token>', 'GitHub token for private repos')
  .option('--config <file>', 'Use config file')
  .action(async (urls, options) => {
    // Set logging modes
    isQuiet = options.quiet || false;
    isVerbose = options.verbose || false;

    debug(`Options: ${JSON.stringify(options)}`);

    // Interactive mode
    if (options.interactive) {
      await runInteractive();
      return;
    }

    // Watch mode
    if (options.watch && urls.length > 0) {
      await runWatchMode(urls[0], options);
      return;
    }

    try {
      let repoUrls = urls;

      // Load URLs from file if specified
      if (options.file) {
        const content = await fs.readFile(options.file, 'utf-8');
        const fileUrls = content.split('\n').filter((line: string) => line.trim());
        repoUrls = [...repoUrls, ...fileUrls];
      }

      // Load config file if specified
      if (options.config) {
        try {
          const configContent = await fs.readFile(options.config, 'utf-8');
          const config = JSON.parse(configContent);
          debug(`Loaded config: ${JSON.stringify(config)}`);
          // Merge config with options (command line takes precedence)
          Object.assign(options, { ...config, ...options });
        } catch (e) {
          errorLog(`Failed to load config file: ${(e as Error).message}`);
          process.exit(1);
        }
      }

      if (repoUrls.length === 0) {
        errorLog('No GitHub URLs provided. Use -i for interactive mode or provide URLs.');
        program.help();
        return;
      }

      const spinner = ora('Generating MCP tools...').start();

      const outputFormat = options.output || options.format || 'typescript';
      const generateOptions = {
        sources: options.sources.split(','),
        followDocs: options.followDocs,
        depth: parseInt(options.depth),
        outputLanguage: outputFormat === 'python' ? 'python' as const : 'typescript' as const,
        githubToken: options.token,
        cache: options.cache !== false
      };

      debug(`Generate options: ${JSON.stringify(generateOptions)}`);

      if (repoUrls.length === 1) {
        // Single repo
        const result = await generateFromGithub(repoUrls[0], generateOptions);
        
        spinner.succeed(chalk.green(`Generated ${result.tools.length} tools from ${result.name}`));

        if (!isQuiet) {
          await displayResultBox(result);

          // Show breakdown
          log('\nSources:');
          result.sources.forEach(source => {
            log(chalk.blue(`  ${source.type}: ${source.count} tools`));
          });
        }

        // Save based on output format
        const outputDir = `${options.dir}/${result.name}`;
        
        if (outputFormat === 'json') {
          await fs.mkdir(outputDir, { recursive: true });
          const jsonOutput = {
            name: result.name,
            tools: result.tools.map((t: ExtractedTool) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema
            })),
            classification: result.classification,
            sources: result.sources
          };
          await fs.writeFile(
            path.join(outputDir, 'tools.json'),
            JSON.stringify(jsonOutput, null, 2)
          );
          log(chalk.green(`\n✓ Saved JSON to ${outputDir}/tools.json`));
        } else if (outputFormat === 'python') {
          await fs.mkdir(outputDir, { recursive: true });
          const pythonCode = result.generatePython?.() ?? result.generate();
          await fs.writeFile(path.join(outputDir, 'server.py'), pythonCode);
          log(chalk.green(`\n✓ Saved Python to ${outputDir}/server.py`));
        } else {
          await result.save(outputDir);
          log(chalk.green(`\n✓ Saved to ${outputDir}`));
        }
      } else {
        // Batch
        const results = await generateFromGithubBatch(repoUrls, generateOptions);
        
        spinner.succeed(chalk.green(`Generated tools from ${results.length} repositories`));

        if (!isQuiet) {
          log('\nResults:');
          for (const result of results) {
            const typeLabel = result.classification ? ` [${result.classification.type}]` : '';
            log(chalk.blue(`  ${result.name}${typeLabel}: ${result.tools.length} tools`));
            
            const outputDir = `${options.dir}/${result.name}`;
            await result.save(outputDir);
          }
        }

        log(chalk.green(`\n✓ Saved all to ${options.dir}/`));
      }
    } catch (error) {
      errorLog(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Validate subcommand
program
  .command('validate <file>')
  .description('Validate a generated MCP server file')
  .option('--url <url>', 'Validate from URL instead of file')
  .action(async (file, options) => {
    isQuiet = program.opts().quiet || false;
    isVerbose = program.opts().verbose || false;
    await runValidate(file, options);
  });

// Install subcommand - One-click install to MCP clients
program
  .command('install <url>')
  .description('Install MCP server directly to Claude Desktop, Cursor, or other MCP clients')
  .option('--claude', 'Install to Claude Desktop')
  .option('--cursor', 'Install to Cursor')
  .option('--vscode', 'Install to VS Code (Cline/Roo)')
  .option('--all', 'Install to all supported platforms')
  .option('-d, --dir <path>', 'Installation directory', '~/.mcp-servers')
  .option('--dry-run', 'Show what would be installed without making changes')
  .action(async (url, options) => {
    isQuiet = program.opts().quiet || false;
    isVerbose = program.opts().verbose || false;
    await runInstall(url, options);
  });

program.parse();

