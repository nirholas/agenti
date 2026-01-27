/**
 * @fileoverview MCP configuration management for Claude Desktop and other clients
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ClaudeDesktopConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

export interface CursorConfig {
  mcp?: {
    servers?: Record<string, McpServerConfig>;
  };
}

export type McpClientType = 'claude' | 'cursor' | 'custom';

/**
 * Get the config file path for a specific MCP client
 */
export function getMcpConfigPath(client: McpClientType): string | null {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (client) {
    case 'claude':
      switch (platform) {
        case 'darwin':
          return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        case 'win32':
          return path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
        case 'linux':
          return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
        default:
          return null;
      }
    
    case 'cursor':
      switch (platform) {
        case 'darwin':
          return path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');
        case 'win32':
          return path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json');
        case 'linux':
          return path.join(homeDir, '.config', 'Cursor', 'User', 'settings.json');
        default:
          return null;
      }
    
    default:
      return null;
  }
}

/**
 * Read MCP configuration from file
 */
export async function readMcpConfig(client: McpClientType): Promise<ClaudeDesktopConfig | CursorConfig | null> {
  const configPath = getMcpConfigPath(client);
  if (!configPath) {
    return null;
  }

  try {
    const configUri = vscode.Uri.file(configPath);
    const content = await vscode.workspace.fs.readFile(configUri);
    return JSON.parse(Buffer.from(content).toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * Write MCP configuration to file
 */
export async function writeMcpConfig(
  client: McpClientType, 
  config: ClaudeDesktopConfig | CursorConfig
): Promise<void> {
  const configPath = getMcpConfigPath(client);
  if (!configPath) {
    throw new Error(`Unsupported platform for ${client}`);
  }

  const configUri = vscode.Uri.file(configPath);
  const configDir = path.dirname(configPath);

  // Ensure directory exists
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(configDir));
  } catch {
    // Directory may already exist
  }

  // Write config
  await vscode.workspace.fs.writeFile(
    configUri,
    Buffer.from(JSON.stringify(config, null, 2), 'utf-8')
  );
}

/**
 * Add an MCP server to client configuration
 */
export async function addMcpServer(
  client: McpClientType,
  serverName: string,
  serverConfig: McpServerConfig
): Promise<void> {
  let config = await readMcpConfig(client);

  if (client === 'claude') {
    const claudeConfig = (config as ClaudeDesktopConfig) || {};
    claudeConfig.mcpServers = claudeConfig.mcpServers || {};
    claudeConfig.mcpServers[serverName] = serverConfig;
    await writeMcpConfig(client, claudeConfig);
  } else if (client === 'cursor') {
    const cursorConfig = (config as CursorConfig) || {};
    cursorConfig.mcp = cursorConfig.mcp || {};
    cursorConfig.mcp.servers = cursorConfig.mcp.servers || {};
    cursorConfig.mcp.servers[serverName] = serverConfig;
    await writeMcpConfig(client, cursorConfig);
  }
}

/**
 * Remove an MCP server from client configuration
 */
export async function removeMcpServer(
  client: McpClientType,
  serverName: string
): Promise<boolean> {
  const config = await readMcpConfig(client);
  if (!config) {
    return false;
  }

  let removed = false;

  if (client === 'claude') {
    const claudeConfig = config as ClaudeDesktopConfig;
    if (claudeConfig.mcpServers?.[serverName]) {
      delete claudeConfig.mcpServers[serverName];
      await writeMcpConfig(client, claudeConfig);
      removed = true;
    }
  } else if (client === 'cursor') {
    const cursorConfig = config as CursorConfig;
    if (cursorConfig.mcp?.servers?.[serverName]) {
      delete cursorConfig.mcp.servers[serverName];
      await writeMcpConfig(client, cursorConfig);
      removed = true;
    }
  }

  return removed;
}

/**
 * List all configured MCP servers for a client
 */
export async function listMcpServers(client: McpClientType): Promise<Record<string, McpServerConfig>> {
  const config = await readMcpConfig(client);
  if (!config) {
    return {};
  }

  if (client === 'claude') {
    return (config as ClaudeDesktopConfig).mcpServers || {};
  } else if (client === 'cursor') {
    return (config as CursorConfig).mcp?.servers || {};
  }

  return {};
}

/**
 * Generate MCP server configuration object
 */
export function generateServerConfig(
  serverPath: string,
  options?: {
    runtime?: 'node' | 'python' | 'deno';
    env?: Record<string, string>;
    args?: string[];
  }
): McpServerConfig {
  const runtime = options?.runtime || detectRuntime(serverPath);
  
  let command: string;
  let args: string[];

  switch (runtime) {
    case 'node':
      command = 'node';
      args = [serverPath, ...(options?.args || [])];
      break;
    case 'python':
      command = 'python';
      args = [serverPath, ...(options?.args || [])];
      break;
    case 'deno':
      command = 'deno';
      args = ['run', '--allow-all', serverPath, ...(options?.args || [])];
      break;
    default:
      command = serverPath;
      args = options?.args || [];
  }

  const config: McpServerConfig = { command, args };
  
  if (options?.env && Object.keys(options.env).length > 0) {
    config.env = options.env;
  }

  return config;
}

/**
 * Detect runtime from file extension
 */
function detectRuntime(filePath: string): 'node' | 'python' | 'deno' | null {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'node';
    case '.ts':
      // Check if Deno is preferred
      return 'node'; // Default to node with ts-node
    case '.py':
      return 'python';
    default:
      return null;
  }
}

/**
 * Format config for display/clipboard based on client type
 */
export function formatConfigForClient(
  serverName: string,
  serverConfig: McpServerConfig,
  client: McpClientType
): string {
  if (client === 'claude') {
    return JSON.stringify({
      mcpServers: {
        [serverName]: serverConfig
      }
    }, null, 2);
  } else if (client === 'cursor') {
    return JSON.stringify({
      mcp: {
        servers: {
          [serverName]: serverConfig
        }
      }
    }, null, 2);
  }

  return JSON.stringify({
    [serverName]: serverConfig
  }, null, 2);
}

/**
 * Open MCP config file in editor
 */
export async function openMcpConfigInEditor(client: McpClientType): Promise<void> {
  const configPath = getMcpConfigPath(client);
  if (!configPath) {
    vscode.window.showErrorMessage(`Could not determine config path for ${client}`);
    return;
  }

  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
    await vscode.window.showTextDocument(doc);
  } catch {
    // File doesn't exist, create it
    const create = await vscode.window.showInformationMessage(
      `${client} config file does not exist. Create it?`,
      'Create',
      'Cancel'
    );

    if (create === 'Create') {
      const initialConfig = client === 'claude' 
        ? { mcpServers: {} } 
        : { mcp: { servers: {} } };
      
      await writeMcpConfig(client, initialConfig);
      
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
      await vscode.window.showTextDocument(doc);
    }
  }
}

/**
 * Validate MCP server config
 */
export function validateServerConfig(config: McpServerConfig): string[] {
  const errors: string[] = [];

  if (!config.command) {
    errors.push('Command is required');
  }

  if (config.args && !Array.isArray(config.args)) {
    errors.push('Args must be an array');
  }

  if (config.env && typeof config.env !== 'object') {
    errors.push('Env must be an object');
  }

  return errors;
}
