/**
 * @fileoverview Main MCP Registry class
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  RegistryEntry,
  RegistryEntrySummary,
  ListOptions,
  ListResult,
  InstallOptions,
  InstallResult,
  UpdateInfo,
  StorageAdapter,
  RegistryStats,
} from './types';
import { FileStorage } from './storage';
import { RegistryUpdater } from './updater';

/**
 * Options for the MCP Registry
 */
export interface McpRegistryOptions {
  /** Custom storage adapter */
  storage?: StorageAdapter;
  /** GitHub token for updates */
  githubToken?: string;
  /** Custom data directory */
  dataDir?: string;
}

/**
 * MCP Registry - manage pre-converted MCP servers
 */
export class McpRegistry {
  private storage: StorageAdapter;
  private updater: RegistryUpdater;
  private options: McpRegistryOptions;

  constructor(options: McpRegistryOptions = {}) {
    this.options = options;
    this.storage = options.storage || new FileStorage(options.dataDir);
    this.updater = new RegistryUpdater(this.storage, {
      githubToken: options.githubToken,
    });
  }

  /**
   * List all available MCP servers
   */
  async list(options?: ListOptions): Promise<ListResult> {
    return this.storage.list(options);
  }

  /**
   * Get a specific registry entry by ID
   */
  async get(id: string): Promise<RegistryEntry | null> {
    return this.storage.get(id);
  }

  /**
   * Search registry entries
   */
  async search(query: string): Promise<RegistryEntrySummary[]> {
    return this.storage.search(query);
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<string[]> {
    return this.storage.getCategories();
  }

  /**
   * Install an MCP server to a target IDE/tool
   */
  async install(id: string, options: InstallOptions): Promise<InstallResult> {
    const entry = await this.storage.get(id);
    
    if (!entry) {
      return {
        success: false,
        error: `Registry entry '${id}' not found`,
      };
    }

    try {
      switch (options.target) {
        case 'claude':
          return await this.installToClaude(entry, options);
        case 'cursor':
          return await this.installToCursor(entry, options);
        case 'vscode':
          return await this.installToVSCode(entry, options);
        case 'file':
          return await this.installToFile(entry, options);
        default:
          return {
            success: false,
            error: `Unknown target: ${options.target}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Installation failed',
      };
    }
  }

  /**
   * Install to Claude Desktop
   */
  private async installToClaude(entry: RegistryEntry, options: InstallOptions): Promise<InstallResult> {
    const configPath = this.getClaudeConfigPath();
    
    if (!configPath) {
      return {
        success: false,
        error: 'Could not determine Claude Desktop config path',
      };
    }

    // Read existing config
    let config: { mcpServers?: Record<string, unknown> } = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // Config doesn't exist yet
    }

    // Check if already installed
    if (config.mcpServers?.[entry.id] && !options.overwrite) {
      return {
        success: false,
        error: `${entry.name} is already installed. Use --overwrite to replace.`,
      };
    }

    // Create server directory
    const serverDir = path.join(path.dirname(configPath), 'mcp-servers', entry.id);
    await fs.mkdir(serverDir, { recursive: true });

    // Write server code
    const language = options.language || 'typescript';
    const code = language === 'python' && entry.generatedCode.python
      ? entry.generatedCode.python
      : entry.generatedCode.typescript;
    
    const ext = language === 'python' ? 'py' : 'ts';
    const serverFile = path.join(serverDir, `index.${ext}`);
    await fs.writeFile(serverFile, code, 'utf-8');

    // Update config
    config.mcpServers = config.mcpServers || {};
    config.mcpServers[entry.id] = {
      ...entry.configs.claude.mcpServers[Object.keys(entry.configs.claude.mcpServers)[0]],
      ...(options.env && { env: { ...entry.configs.claude.mcpServers[Object.keys(entry.configs.claude.mcpServers)[0]]?.env, ...options.env } }),
    };

    // Write updated config
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Increment popularity
    await this.incrementPopularity(entry.id);

    return {
      success: true,
      path: serverDir,
      instructions: [
        `Installed ${entry.name} MCP server to ${serverDir}`,
        'Restart Claude Desktop to activate the new server',
        entry.auth.length > 0 
          ? `Set environment variable: ${entry.auth[0].envVar || 'API_KEY'}`
          : '',
      ].filter(Boolean),
    };
  }

  /**
   * Install to Cursor
   */
  private async installToCursor(entry: RegistryEntry, options: InstallOptions): Promise<InstallResult> {
    const configPath = this.getCursorConfigPath();
    
    if (!configPath) {
      return {
        success: false,
        error: 'Could not determine Cursor config path',
      };
    }

    // Similar to Claude installation
    let config: { mcpServers?: Record<string, unknown> } = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // Config doesn't exist yet
    }

    if (config.mcpServers?.[entry.id] && !options.overwrite) {
      return {
        success: false,
        error: `${entry.name} is already installed. Use --overwrite to replace.`,
      };
    }

    const serverDir = path.join(path.dirname(configPath), 'mcp-servers', entry.id);
    await fs.mkdir(serverDir, { recursive: true });

    const language = options.language || 'typescript';
    const code = language === 'python' && entry.generatedCode.python
      ? entry.generatedCode.python
      : entry.generatedCode.typescript;
    
    const ext = language === 'python' ? 'py' : 'ts';
    const serverFile = path.join(serverDir, `index.${ext}`);
    await fs.writeFile(serverFile, code, 'utf-8');

    config.mcpServers = config.mcpServers || {};
    config.mcpServers[entry.id] = {
      ...entry.configs.cursor.mcpServers[Object.keys(entry.configs.cursor.mcpServers)[0]],
      ...(options.env && { env: { ...entry.configs.cursor.mcpServers[Object.keys(entry.configs.cursor.mcpServers)[0]]?.env, ...options.env } }),
    };

    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    await this.incrementPopularity(entry.id);

    return {
      success: true,
      path: serverDir,
      instructions: [
        `Installed ${entry.name} MCP server to ${serverDir}`,
        'Restart Cursor to activate the new server',
      ],
    };
  }

  /**
   * Install to VS Code
   */
  private async installToVSCode(entry: RegistryEntry, options: InstallOptions): Promise<InstallResult> {
    // VS Code uses workspace-level .vscode/mcp.json
    const workspaceDir = process.cwd();
    const configPath = path.join(workspaceDir, '.vscode', 'mcp.json');

    let config: { servers?: Record<string, unknown> } = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // Config doesn't exist yet
    }

    if (config.servers?.[entry.id] && !options.overwrite) {
      return {
        success: false,
        error: `${entry.name} is already installed. Use --overwrite to replace.`,
      };
    }

    const serverDir = path.join(workspaceDir, '.mcp-servers', entry.id);
    await fs.mkdir(serverDir, { recursive: true });

    const language = options.language || 'typescript';
    const code = language === 'python' && entry.generatedCode.python
      ? entry.generatedCode.python
      : entry.generatedCode.typescript;
    
    const ext = language === 'python' ? 'py' : 'ts';
    const serverFile = path.join(serverDir, `index.${ext}`);
    await fs.writeFile(serverFile, code, 'utf-8');

    config.servers = config.servers || {};
    config.servers[entry.id] = entry.configs.vscode.mcpServers[Object.keys(entry.configs.vscode.mcpServers)[0]];

    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    await this.incrementPopularity(entry.id);

    return {
      success: true,
      path: serverDir,
      instructions: [
        `Installed ${entry.name} MCP server to ${serverDir}`,
        'Reload VS Code window to activate',
      ],
    };
  }

  /**
   * Install to a file (for manual setup)
   */
  private async installToFile(entry: RegistryEntry, options: InstallOptions): Promise<InstallResult> {
    const outputDir = options.outputDir || path.join(process.cwd(), entry.id);
    await fs.mkdir(outputDir, { recursive: true });

    const language = options.language || 'typescript';
    const code = language === 'python' && entry.generatedCode.python
      ? entry.generatedCode.python
      : entry.generatedCode.typescript;
    
    const ext = language === 'python' ? 'py' : 'ts';
    const serverFile = path.join(outputDir, `index.${ext}`);
    await fs.writeFile(serverFile, code, 'utf-8');

    // Write package.json for TypeScript
    if (language === 'typescript') {
      const packageJson = {
        name: entry.id,
        version: '1.0.0',
        description: `MCP server for ${entry.name}`,
        type: 'module',
        main: 'index.ts',
        scripts: {
          start: 'npx tsx index.ts',
          build: 'npx tsc',
        },
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          tsx: '^4.0.0',
        },
      };
      await fs.writeFile(
        path.join(outputDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
        'utf-8'
      );
    }

    // Write config examples
    await fs.writeFile(
      path.join(outputDir, 'claude-config.json'),
      JSON.stringify(entry.configs.claude, null, 2),
      'utf-8'
    );

    await this.incrementPopularity(entry.id);

    return {
      success: true,
      path: outputDir,
      instructions: [
        `Generated ${entry.name} MCP server at ${outputDir}`,
        language === 'typescript' ? 'Run: npm install && npm start' : `Run: python ${serverFile}`,
        'Copy config from claude-config.json to your IDE config',
      ],
    };
  }

  /**
   * Check for updates
   */
  async checkUpdates(): Promise<UpdateInfo[]> {
    return this.updater.checkAllForUpdates();
  }

  /**
   * Check if a specific entry has updates
   */
  async checkUpdate(id: string): Promise<UpdateInfo | null> {
    return this.updater.checkForUpdates(id);
  }

  /**
   * Publish a new entry to the registry
   */
  async publish(entry: RegistryEntry): Promise<void> {
    // Validate entry
    this.validateEntry(entry);
    
    // Set timestamps
    const now = new Date().toISOString();
    entry.createdAt = entry.createdAt || now;
    entry.lastUpdated = now;
    
    await this.storage.save(entry);
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<RegistryStats> {
    const result = await this.storage.list({ limit: 1000 });
    const categories = await this.storage.getCategories();
    
    const categoryCount = new Map<string, number>();
    let totalTools = 0;
    let totalDownloads = 0;

    for (const entry of result.entries) {
      totalTools += entry.toolCount;
      totalDownloads += entry.popularity;
      for (const cat of entry.categories) {
        categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
      }
    }

    const sorted = [...result.entries].sort((a, b) => b.popularity - a.popularity);
    const recent = [...result.entries].sort(
      (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );

    return {
      totalEntries: result.total,
      totalTools,
      totalDownloads,
      categories: categories.map(name => ({
        name,
        count: categoryCount.get(name) || 0,
      })),
      topEntries: sorted.slice(0, 10),
      recentlyUpdated: recent.slice(0, 10),
    };
  }

  /**
   * Validate a registry entry
   */
  private validateEntry(entry: RegistryEntry): void {
    if (!entry.id || !/^[a-z0-9-]+$/.test(entry.id)) {
      throw new Error('Invalid entry ID (must be lowercase alphanumeric with dashes)');
    }
    if (!entry.name) throw new Error('Entry name is required');
    if (!entry.sourceRepo) throw new Error('Source repo is required');
    if (!entry.generatedCode?.typescript) throw new Error('TypeScript code is required');
  }

  /**
   * Increment popularity counter
   */
  private async incrementPopularity(id: string): Promise<void> {
    const entry = await this.storage.get(id);
    if (entry) {
      entry.popularity += 1;
      await this.storage.save(entry);
    }
  }

  /**
   * Get Claude Desktop config path
   */
  private getClaudeConfigPath(): string | null {
    const platform = os.platform();
    const home = os.homedir();

    switch (platform) {
      case 'darwin':
        return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      case 'win32':
        return path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
      case 'linux':
        return path.join(home, '.config', 'claude', 'claude_desktop_config.json');
      default:
        return null;
    }
  }

  /**
   * Get Cursor config path
   */
  private getCursorConfigPath(): string | null {
    const platform = os.platform();
    const home = os.homedir();

    switch (platform) {
      case 'darwin':
        return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'mcp.json');
      case 'win32':
        return path.join(home, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'mcp.json');
      case 'linux':
        return path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'mcp.json');
      default:
        return null;
    }
  }
}
