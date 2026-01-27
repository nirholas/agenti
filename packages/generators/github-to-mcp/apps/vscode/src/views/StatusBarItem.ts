/**
 * @fileoverview Status bar item for showing conversion progress
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { isCurrentWorkspaceGitHubRepo } from '../commands/convertCurrentRepo';

type StatusBarState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Status bar item manager for the extension
 */
export class StatusBarItem {
  private item: vscode.StatusBarItem;
  private state: StatusBarState = 'idle';
  private progressInterval: NodeJS.Timeout | null = null;
  private progressDots = 0;

  constructor(private context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    
    this.item.command = 'github-to-mcp.showQuickActions';
    this.setIdle();
    
    // Register the quick actions command
    context.subscriptions.push(
      vscode.commands.registerCommand('github-to-mcp.showQuickActions', () => {
        this.showQuickActions();
      })
    );

    // Check if current workspace is a GitHub repo
    this.updateVisibility();
    
    // Watch for workspace changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.updateVisibility();
      })
    );
  }

  /**
   * Update visibility based on workspace
   */
  private async updateVisibility(): Promise<void> {
    const isGitHubRepo = await isCurrentWorkspaceGitHubRepo();
    const config = vscode.workspace.getConfiguration('github-to-mcp');
    const alwaysShow = config.get<boolean>('alwaysShowStatusBar', false);
    
    if (isGitHubRepo || alwaysShow) {
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  /**
   * Show quick actions menu
   */
  private async showQuickActions(): Promise<void> {
    const items: vscode.QuickPickItem[] = [
      {
        label: '$(github) Convert from URL',
        description: 'Enter a GitHub repository URL',
        detail: 'Convert any public GitHub repository to MCP server'
      },
      {
        label: '$(folder) Convert Current Repo',
        description: 'Convert the open workspace',
        detail: 'Convert the currently open GitHub repository'
      },
      {
        label: '$(list-flat) Browse Registry',
        description: 'Browse popular MCP servers',
        detail: 'Choose from a curated list of repositories'
      },
      {
        label: '$(gear) Configure Claude Desktop',
        description: 'Auto-configure your MCP servers',
        detail: 'Add converted servers to Claude Desktop config'
      },
      {
        label: '',
        kind: vscode.QuickPickItemKind.Separator
      },
      {
        label: '$(history) View History',
        description: 'See conversion history',
        detail: 'View all previously converted repositories'
      },
      {
        label: '$(output) Show Logs',
        description: 'Open output channel',
        detail: 'View extension logs and debug information'
      }
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an action',
      title: 'GitHub to MCP'
    });

    if (!selected) {
      return;
    }

    switch (selected.label) {
      case '$(github) Convert from URL':
        vscode.commands.executeCommand('github-to-mcp.convertFromUrl');
        break;
      case '$(folder) Convert Current Repo':
        vscode.commands.executeCommand('github-to-mcp.convertCurrentRepo');
        break;
      case '$(list-flat) Browse Registry':
        vscode.commands.executeCommand('github-to-mcp.browseRegistry');
        break;
      case '$(gear) Configure Claude Desktop':
        vscode.commands.executeCommand('github-to-mcp.configureClaudeDesktop');
        break;
      case '$(history) View History':
        vscode.commands.executeCommand('github-to-mcp.history.focus');
        break;
      case '$(output) Show Logs':
        vscode.commands.executeCommand('github-to-mcp.showOutput');
        break;
    }
  }

  /**
   * Set status to idle
   */
  setIdle(): void {
    this.stopProgress();
    this.state = 'idle';
    this.item.text = '$(github) MCP';
    this.item.tooltip = 'GitHub to MCP: Click for actions';
    this.item.backgroundColor = undefined;
  }

  /**
   * Set status to loading with optional message
   */
  setLoading(message?: string): void {
    this.state = 'loading';
    this.item.tooltip = message || 'Converting repository...';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.startProgress();
  }

  /**
   * Set status to success
   */
  setSuccess(message?: string): void {
    this.stopProgress();
    this.state = 'success';
    this.item.text = '$(check) MCP';
    this.item.tooltip = message || 'Conversion successful!';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    
    // Reset to idle after 3 seconds
    setTimeout(() => {
      if (this.state === 'success') {
        this.setIdle();
      }
    }, 3000);
  }

  /**
   * Set status to error
   */
  setError(message?: string): void {
    this.stopProgress();
    this.state = 'error';
    this.item.text = '$(error) MCP';
    this.item.tooltip = message || 'Conversion failed';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    
    // Reset to idle after 5 seconds
    setTimeout(() => {
      if (this.state === 'error') {
        this.setIdle();
      }
    }, 5000);
  }

  /**
   * Start progress animation
   */
  private startProgress(): void {
    this.stopProgress();
    this.progressDots = 0;
    
    this.progressInterval = setInterval(() => {
      this.progressDots = (this.progressDots + 1) % 4;
      const dots = '.'.repeat(this.progressDots);
      this.item.text = `$(sync~spin) MCP${dots}`;
    }, 300);
  }

  /**
   * Stop progress animation
   */
  private stopProgress(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Show the status bar item
   */
  show(): void {
    this.item.show();
  }

  /**
   * Hide the status bar item
   */
  hide(): void {
    this.item.hide();
  }

  /**
   * Get current state
   */
  getState(): StatusBarState {
    return this.state;
  }

  /**
   * Dispose the status bar item
   */
  dispose(): void {
    this.stopProgress();
    this.item.dispose();
  }
}

/**
 * Create and initialize the status bar item
 */
export function createStatusBarItem(context: vscode.ExtensionContext): StatusBarItem {
  return new StatusBarItem(context);
}
