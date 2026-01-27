/**
 * @fileoverview Command registration and exports
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService } from '../utils/storage';
import { HistoryProvider } from '../views/historyProvider';

// Re-export individual commands
export { convertCommand } from './convert';
export { validateCommand } from './validate';
export { convertFromUrlCommand, performConversion } from './convertFromUrl';
export { convertCurrentRepoCommand, isCurrentWorkspaceGitHubRepo, getCurrentWorkspaceGitHubUrl } from './convertCurrentRepo';
export { browseRegistryCommand, fetchRemoteRegistry } from './browseRegistry';
export { configureClaudeDesktopCommand, isClaudeDesktopInstalled, openClaudeDesktopConfig } from './configureClaudeDesktop';

/**
 * Register all commands with VS Code
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  storage: StorageService,
  historyProvider: HistoryProvider
): vscode.Disposable[] {
  const { convertFromUrlCommand } = require('./convertFromUrl');
  const { convertCurrentRepoCommand } = require('./convertCurrentRepo');
  const { browseRegistryCommand } = require('./browseRegistry');
  const { configureClaudeDesktopCommand, openClaudeDesktopConfig } = require('./configureClaudeDesktop');

  const extensionUri = context.extensionUri;

  const disposables: vscode.Disposable[] = [];

  // Convert from URL command
  disposables.push(
    vscode.commands.registerCommand('github-to-mcp.convertFromUrl', () =>
      convertFromUrlCommand(storage, historyProvider, extensionUri)
    )
  );

  // Convert current repo command
  disposables.push(
    vscode.commands.registerCommand('github-to-mcp.convertCurrentRepo', () =>
      convertCurrentRepoCommand(storage, historyProvider, extensionUri)
    )
  );

  // Browse registry command
  disposables.push(
    vscode.commands.registerCommand('github-to-mcp.browseRegistry', () =>
      browseRegistryCommand(storage, historyProvider, extensionUri)
    )
  );

  // Configure Claude Desktop command
  disposables.push(
    vscode.commands.registerCommand('github-to-mcp.configureClaudeDesktop', () =>
      configureClaudeDesktopCommand(storage)
    )
  );

  // Open Claude Desktop config command
  disposables.push(
    vscode.commands.registerCommand('github-to-mcp.openClaudeConfig', () =>
      openClaudeDesktopConfig()
    )
  );

  // Clear history command
  disposables.push(
    vscode.commands.registerCommand('github-to-mcp.clearHistory', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to clear all conversion history?',
        { modal: true },
        'Clear',
        'Cancel'
      );

      if (confirm === 'Clear') {
        storage.clearHistory();
        historyProvider.refresh();
        vscode.window.showInformationMessage('Conversion history cleared.');
      }
    })
  );

  // Refresh history command
  disposables.push(
    vscode.commands.registerCommand('github-to-mcp.refreshHistory', () => {
      historyProvider.refresh();
    })
  );

  // Export server command
  disposables.push(
    vscode.commands.registerCommand('github-to-mcp.exportServer', async (item) => {
      if (!item?.code) {
        vscode.window.showWarningMessage('No server code to export.');
        return;
      }

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${item.repoName.replace('/', '-')}-mcp.js`),
        filters: {
          'JavaScript': ['js'],
          'TypeScript': ['ts']
        },
        title: 'Export MCP Server'
      });

      if (saveUri) {
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(item.code, 'utf-8'));
        vscode.window.showInformationMessage(`Server exported to ${saveUri.fsPath}`);
      }
    })
  );

  return disposables;
}
