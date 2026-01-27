/**
 * @fileoverview VS Code extension for GitHub to MCP
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';

// Commands
import { convertCommand } from './commands/convert';
import { validateCommand } from './commands/validate';
import { convertFromUrlCommand, performConversion } from './commands/convertFromUrl';
import { convertCurrentRepoCommand, isCurrentWorkspaceGitHubRepo, getCurrentWorkspaceGitHubUrl } from './commands/convertCurrentRepo';
import { browseRegistryCommand } from './commands/browseRegistry';
import { configureClaudeDesktopCommand, openClaudeDesktopConfig } from './commands/configureClaudeDesktop';

// Views
import { HistoryProvider } from './views/historyProvider';
import { McpServersTreeView } from './views/McpServersTreeView';
import { ToolsExplorerView } from './views/ToolsExplorerView';
import { getOutputChannel } from './views/OutputChannelView';
import { StatusBarItem, createStatusBarItem } from './views/StatusBarItem';
import { showResultsPanel } from './views/resultsPanel';

// Webviews
import { showConversionPanel } from './webviews/ConversionPanel';
import { showToolDetailsPanel } from './webviews/ToolDetailsPanel';

// Utils
import { StorageService, ConversionResult } from './utils/storage';
import { generateMcpServerFiles } from './utils/file-generator';

let statusBarItem: StatusBarItem;
let historyProvider: HistoryProvider;
let serversProvider: McpServersTreeView;
let toolsProvider: ToolsExplorerView;
let storageService: StorageService;
let outputChannel = getOutputChannel();

export function activate(context: vscode.ExtensionContext): void {
  outputChannel.info('GitHub to MCP extension activating...');

  // Initialize storage service
  storageService = new StorageService(context);
  
  // Initialize providers
  historyProvider = new HistoryProvider(storageService);
  serversProvider = new McpServersTreeView(storageService);
  toolsProvider = new ToolsExplorerView(storageService);
  
  // Register tree views
  const historyTreeView = vscode.window.createTreeView('github-to-mcp.history', {
    treeDataProvider: historyProvider,
    showCollapseAll: true
  });
  
  const serversTreeView = vscode.window.createTreeView('github-to-mcp.servers', {
    treeDataProvider: serversProvider,
    showCollapseAll: true
  });
  
  const toolsTreeView = vscode.window.createTreeView('github-to-mcp.tools', {
    treeDataProvider: toolsProvider,
    showCollapseAll: true
  });

  // Initialize status bar
  statusBarItem = createStatusBarItem(context);

  // Register commands
  registerAllCommands(context);

  // Auto-detection
  const config = vscode.workspace.getConfiguration('github-to-mcp');
  if (config.get<boolean>('autoDetect')) {
    checkAndPromptAutoDetection(context);
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('github-to-mcp')) {
        onConfigurationChanged();
      }
    })
  );

  // Add disposables
  context.subscriptions.push(
    historyTreeView,
    serversTreeView,
    toolsTreeView,
    statusBarItem
  );

  outputChannel.info('GitHub to MCP extension activated successfully!');
}

export function deactivate(): void {
  outputChannel.info('GitHub to MCP extension deactivating...');
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  outputChannel.dispose();
}

/**
 * Register all commands
 */
function registerAllCommands(context: vscode.ExtensionContext): void {
  const extensionUri = context.extensionUri;

  // Convert command (legacy, uses input box)
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.convert', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'Enter GitHub repository URL',
        placeHolder: 'https://github.com/owner/repo',
        validateInput: (value) => {
          if (!value) {
            return 'URL is required';
          }
          if (!value.match(/^https?:\/\/github\.com\/[\w-]+\/[\w.-]+/)) {
            return 'Invalid GitHub URL format';
          }
          return null;
        }
      });

      if (url) {
        statusBarItem.setLoading('Converting repository...');
        outputChannel.logConversionStart(url);
        
        try {
          await convertCommand(url, storageService, historyProvider);
          serversProvider.refresh();
          toolsProvider.refresh();
          statusBarItem.setSuccess('Conversion complete!');
        } catch (error) {
          statusBarItem.setError('Conversion failed');
          outputChannel.error('Conversion failed', error as Error);
        }
      }
    })
  );

  // Convert from URL command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.convertFromUrl', async () => {
      statusBarItem.setLoading('Converting repository...');
      try {
        await convertFromUrlCommand(storageService, historyProvider, extensionUri);
        serversProvider.refresh();
        toolsProvider.refresh();
        statusBarItem.setSuccess('Conversion complete!');
      } catch (error) {
        statusBarItem.setError('Conversion failed');
      }
    })
  );

  // Convert current repo command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.convertCurrentRepo', async () => {
      statusBarItem.setLoading('Converting current repository...');
      try {
        await convertCurrentRepoCommand(storageService, historyProvider, extensionUri);
        serversProvider.refresh();
        toolsProvider.refresh();
        statusBarItem.setSuccess('Conversion complete!');
      } catch (error) {
        statusBarItem.setError('Conversion failed');
      }
    })
  );

  // Convert from clipboard command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.convertFromClipboard', async () => {
      const clipboard = await vscode.env.clipboard.readText();
      if (clipboard.match(/^https?:\/\/github\.com\/[\w-]+\/[\w.-]+/)) {
        statusBarItem.setLoading('Converting from clipboard...');
        try {
          await performConversion(clipboard, storageService, historyProvider, extensionUri);
          serversProvider.refresh();
          toolsProvider.refresh();
          statusBarItem.setSuccess('Conversion complete!');
        } catch (error) {
          statusBarItem.setError('Conversion failed');
        }
      } else {
        vscode.window.showErrorMessage('Clipboard does not contain a valid GitHub URL');
      }
    })
  );

  // Browse registry command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.browseRegistry', async () => {
      await browseRegistryCommand(storageService, historyProvider, extensionUri);
      serversProvider.refresh();
      toolsProvider.refresh();
    })
  );

  // Configure Claude Desktop command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.configureClaudeDesktop', async () => {
      await configureClaudeDesktopCommand(storageService);
    })
  );

  // Open Claude config command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.openClaudeConfig', async () => {
      await openClaudeDesktopConfig();
    })
  );

  // Copy config command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.copyConfig', async (item?: ConversionResult) => {
      const history = storageService.getHistory();
      const result = item || history[0];
      
      if (!result) {
        vscode.window.showWarningMessage('No conversions in history. Convert a repository first.');
        return;
      }

      const platform = await vscode.window.showQuickPick(
        ['Claude', 'Cursor', 'Raw JSON'],
        { placeHolder: 'Select platform for MCP config' }
      );

      if (platform) {
        const config = generateConfig(result, platform);
        await vscode.env.clipboard.writeText(config);
        vscode.window.showInformationMessage(`MCP config for ${platform} copied to clipboard!`);
      }
    })
  );

  // View details command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.viewDetails', (item: ConversionResult) => {
      showResultsPanel(item, extensionUri);
    })
  );

  // Show tool details command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.showToolDetails', (tool, server) => {
      showToolDetailsPanel(tool, server, context);
    })
  );

  // Remove history item command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.removeHistoryItem', (item: ConversionResult) => {
      storageService.removeFromHistory(item.id);
      historyProvider.refresh();
      serversProvider.refresh();
      toolsProvider.refresh();
      vscode.window.showInformationMessage(`Removed ${item.repoName} from history`);
    })
  );

  // Clear history command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.clearHistory', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to clear all conversion history?',
        { modal: true },
        'Clear',
        'Cancel'
      );

      if (confirm === 'Clear') {
        storageService.clearHistory();
        historyProvider.refresh();
        serversProvider.refresh();
        toolsProvider.refresh();
        vscode.window.showInformationMessage('Conversion history cleared.');
      }
    })
  );

  // Refresh history command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.refreshHistory', () => {
      historyProvider.refresh();
      serversProvider.refresh();
      toolsProvider.refresh();
    })
  );

  // Open in browser command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.openInBrowser', (item: ConversionResult) => {
      vscode.env.openExternal(vscode.Uri.parse(item.repoUrl));
    })
  );

  // Export server command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.exportServer', async (item: ConversionResult) => {
      if (!item) {
        const history = storageService.getHistory();
        if (history.length === 0) {
          vscode.window.showWarningMessage('No servers to export.');
          return;
        }
        item = history[0];
      }

      try {
        const files = await generateMcpServerFiles(item);
        vscode.window.showInformationMessage(
          `Server files generated at ${files.serverFile}`,
          'Copy Config'
        ).then(selection => {
          if (selection === 'Copy Config') {
            vscode.env.clipboard.writeText(files.configSnippet);
          }
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to export server: ${msg}`);
      }
    })
  );

  // Validate command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.validate', async () => {
      await validateCommand();
    })
  );

  // Show output command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.showOutput', () => {
      outputChannel.show();
    })
  );

  // Show conversion panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.showConversionPanel', () => {
      showConversionPanel(context, storageService, historyProvider);
    })
  );

  // Filter tools command
  context.subscriptions.push(
    vscode.commands.registerCommand('github-to-mcp.filterTools', async () => {
      const filter = await vscode.window.showInputBox({
        prompt: 'Filter tools by name or description',
        placeHolder: 'Enter search term...'
      });

      if (filter !== undefined) {
        if (filter) {
          toolsProvider.setFilter(filter);
        } else {
          toolsProvider.clearFilter();
        }
      }
    })
  );
}

/**
 * Check for auto-detection and prompt user
 */
async function checkAndPromptAutoDetection(context: vscode.ExtensionContext): Promise<void> {
  const dontAskKey = 'github-to-mcp.dontAskAutoDetect';
  if (context.globalState.get<boolean>(dontAskKey)) {
    return;
  }

  const isGitHubRepo = await isCurrentWorkspaceGitHubRepo();
  if (!isGitHubRepo) {
    return;
  }

  const githubUrl = await getCurrentWorkspaceGitHubUrl();
  if (!githubUrl) {
    return;
  }

  const repoPath = githubUrl.replace('https://github.com/', '');

  const response = await vscode.window.showInformationMessage(
    `Convert this GitHub repo (${repoPath}) to an MCP server?`,
    'Yes',
    'No',
    "Don't ask again"
  );

  if (response === 'Yes') {
    statusBarItem.setLoading('Converting repository...');
    try {
      await performConversion(githubUrl, storageService, historyProvider, context.extensionUri);
      serversProvider.refresh();
      toolsProvider.refresh();
      statusBarItem.setSuccess('Conversion complete!');
    } catch (error) {
      statusBarItem.setError('Conversion failed');
    }
  } else if (response === "Don't ask again") {
    await context.globalState.update(dontAskKey, true);
  }
}

/**
 * Handle configuration changes
 */
function onConfigurationChanged(): void {
  const config = vscode.workspace.getConfiguration('github-to-mcp');
  
  // Update log level
  const logLevel = config.get<'debug' | 'info' | 'warn' | 'error'>('logLevel', 'info');
  outputChannel.setLogLevel(logLevel);
  outputChannel.logConfigChange('logLevel', logLevel);
}

/**
 * Generate MCP config for different platforms
 */
function generateConfig(result: ConversionResult, platform: string): string {
  const serverName = result.repoName.replace('/', '-').toLowerCase();
  const serverConfig = {
    command: 'node',
    args: [`~/.mcp-servers/${serverName}-mcp/index.js`]
  };

  switch (platform.toLowerCase()) {
    case 'claude':
      return JSON.stringify({
        mcpServers: {
          [serverName]: serverConfig
        }
      }, null, 2);

    case 'cursor':
      return JSON.stringify({
        mcp: {
          servers: {
            [serverName]: serverConfig
          }
        }
      }, null, 2);

    case 'raw json':
    default:
      return JSON.stringify({
        name: serverName,
        tools: result.toolCount,
        ...serverConfig
      }, null, 2);
  }
}
