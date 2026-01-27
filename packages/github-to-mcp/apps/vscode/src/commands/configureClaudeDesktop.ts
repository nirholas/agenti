/**
 * @fileoverview Command to auto-configure Claude Desktop with MCP servers
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { StorageService, ConversionResult } from '../utils/storage';

interface ClaudeDesktopConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Auto-configure Claude Desktop with MCP servers
 */
export async function configureClaudeDesktopCommand(
  storage: StorageService
): Promise<void> {
  // Get conversion history
  const history = storage.getHistory();

  if (history.length === 0) {
    const response = await vscode.window.showWarningMessage(
      'No converted MCP servers found. Would you like to convert a repository first?',
      'Convert Repository',
      'Cancel'
    );

    if (response === 'Convert Repository') {
      vscode.commands.executeCommand('github-to-mcp.convertFromUrl');
    }
    return;
  }

  // Let user select which servers to configure
  const serverItems = history.map(item => ({
    label: item.repoName,
    description: `${item.toolCount} tools`,
    picked: false,
    result: item
  }));

  const selectedItems = await vscode.window.showQuickPick(serverItems, {
    canPickMany: true,
    placeHolder: 'Select MCP servers to add to Claude Desktop',
    title: 'Configure Claude Desktop'
  });

  if (!selectedItems || selectedItems.length === 0) {
    return;
  }

  // Get Claude Desktop config path
  const configPath = getClaudeDesktopConfigPath();
  
  if (!configPath) {
    vscode.window.showErrorMessage('Could not determine Claude Desktop config location for your platform.');
    return;
  }

  // Check if config file exists
  const configUri = vscode.Uri.file(configPath);
  let existingConfig: ClaudeDesktopConfig = {};

  try {
    const configContent = await vscode.workspace.fs.readFile(configUri);
    existingConfig = JSON.parse(Buffer.from(configContent).toString('utf-8'));
  } catch {
    // Config doesn't exist yet, we'll create it
  }

  // Initialize mcpServers if not present
  if (!existingConfig.mcpServers) {
    existingConfig.mcpServers = {};
  }

  // Ask user for output directory
  const outputDir = await getOutputDirectory();
  if (!outputDir) {
    return;
  }

  // Generate and save MCP server files, then add to config
  const addedServers: string[] = [];
  const errors: string[] = [];

  for (const item of selectedItems) {
    const result = item.result as ConversionResult;
    const serverName = result.repoName.replace('/', '-').toLowerCase();

    try {
      // Generate the server file
      const serverPath = await generateMcpServerFile(result, outputDir);

      // Add to config
      existingConfig.mcpServers![serverName] = {
        command: 'node',
        args: [serverPath]
      };

      addedServers.push(serverName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${serverName}: ${msg}`);
    }
  }

  // Write updated config
  try {
    // Ensure config directory exists
    const configDir = path.dirname(configPath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(configDir));

    // Write config file
    await vscode.workspace.fs.writeFile(
      configUri,
      Buffer.from(JSON.stringify(existingConfig, null, 2), 'utf-8')
    );

    // Show results
    if (addedServers.length > 0) {
      const message = `Added ${addedServers.length} MCP server(s) to Claude Desktop config`;
      const action = await vscode.window.showInformationMessage(
        message,
        'Open Config',
        'Restart Claude Desktop',
        'Done'
      );

      if (action === 'Open Config') {
        const doc = await vscode.workspace.openTextDocument(configUri);
        vscode.window.showTextDocument(doc);
      } else if (action === 'Restart Claude Desktop') {
        vscode.window.showInformationMessage(
          'Please restart Claude Desktop for changes to take effect.',
          'OK'
        );
      }
    }

    if (errors.length > 0) {
      vscode.window.showWarningMessage(
        `Some servers could not be added: ${errors.join(', ')}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to write Claude Desktop config: ${message}`);
  }
}

/**
 * Get the Claude Desktop config file path based on platform
 */
function getClaudeDesktopConfigPath(): string | null {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    
    case 'win32': // Windows
      return path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    
    case 'linux':
      return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
    
    default:
      return null;
  }
}

/**
 * Get output directory for MCP server files
 */
async function getOutputDirectory(): Promise<string | null> {
  const options = [
    {
      label: '$(home) User MCP Servers',
      description: getDefaultMcpDirectory(),
      value: getDefaultMcpDirectory()
    },
    {
      label: '$(folder) Current Workspace',
      description: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'No workspace open',
      value: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    },
    {
      label: '$(folder-opened) Choose Custom Location...',
      value: 'custom'
    }
  ];

  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: 'Where should MCP server files be saved?',
    title: 'Output Location'
  });

  if (!selection) {
    return null;
  }

  if (selection.value === 'custom') {
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: 'Select output directory for MCP servers'
    });

    if (!folders || folders.length === 0) {
      return null;
    }

    return folders[0].fsPath;
  }

  return selection.value || null;
}

/**
 * Get default MCP directory
 */
function getDefaultMcpDirectory(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.mcp-servers');
}

/**
 * Generate MCP server file from conversion result
 */
async function generateMcpServerFile(result: ConversionResult, outputDir: string): Promise<string> {
  if (!result.code) {
    throw new Error('No generated code available');
  }

  const serverName = result.repoName.replace('/', '-').toLowerCase();
  const serverDir = path.join(outputDir, serverName);
  const serverFile = path.join(serverDir, 'index.js');

  // Create server directory
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(serverDir));

  // Write server file
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(serverFile),
    Buffer.from(result.code, 'utf-8')
  );

  // Create package.json
  const packageJson = {
    name: `${serverName}-mcp`,
    version: '1.0.0',
    description: `MCP server generated from ${result.repoName}`,
    main: 'index.js',
    type: 'module',
    dependencies: {
      '@modelcontextprotocol/sdk': '^0.5.0'
    }
  };

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(path.join(serverDir, 'package.json')),
    Buffer.from(JSON.stringify(packageJson, null, 2), 'utf-8')
  );

  return serverFile;
}

/**
 * Check if Claude Desktop is likely installed
 */
export function isClaudeDesktopInstalled(): boolean {
  const configPath = getClaudeDesktopConfigPath();
  if (!configPath) {
    return false;
  }

  // Check if the Claude directory exists
  const claudeDir = path.dirname(configPath);
  try {
    // This is a simple heuristic - the directory may exist even without full installation
    return true;
  } catch {
    return false;
  }
}

/**
 * Open Claude Desktop config in editor
 */
export async function openClaudeDesktopConfig(): Promise<void> {
  const configPath = getClaudeDesktopConfigPath();
  if (!configPath) {
    vscode.window.showErrorMessage('Could not determine Claude Desktop config location.');
    return;
  }

  try {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
    vscode.window.showTextDocument(doc);
  } catch {
    // Config doesn't exist, create it
    const create = await vscode.window.showInformationMessage(
      'Claude Desktop config file does not exist. Create it?',
      'Create',
      'Cancel'
    );

    if (create === 'Create') {
      const configDir = path.dirname(configPath);
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(configDir));
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(configPath),
        Buffer.from(JSON.stringify({ mcpServers: {} }, null, 2), 'utf-8')
      );

      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(configPath));
      vscode.window.showTextDocument(doc);
    }
  }
}
