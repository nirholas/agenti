/**
 * @fileoverview Tree view provider for conversion history
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService, ConversionResult } from '../utils/storage';

type HistoryTreeItem = HistoryItem | EmptyHistoryItem;

export class HistoryProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<HistoryTreeItem | undefined | null | void> = new vscode.EventEmitter<HistoryTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<HistoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private storage: StorageService) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item for display
   */
  getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children (history items)
   */
  getChildren(): HistoryTreeItem[] {
    const history = this.storage.getHistory();
    
    if (history.length === 0) {
      return [new EmptyHistoryItem()];
    }

    return history.map(item => new HistoryItem(item));
  }
}

export class HistoryItem extends vscode.TreeItem {
  constructor(public readonly result: ConversionResult) {
    super(result.repoName, vscode.TreeItemCollapsibleState.None);
    
    const date = new Date(result.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
    this.description = `${result.toolCount} tools`;
    this.tooltip = `${result.repoName}\n${result.toolCount} tools\nConverted: ${formattedDate}`;
    this.iconPath = new vscode.ThemeIcon('github');
    
    // Command to view details on click
    this.command = {
      command: 'github-to-mcp.viewDetails',
      title: 'View Details',
      arguments: [result]
    };

    // Context value for right-click menu
    this.contextValue = 'historyItem';
  }
}

class EmptyHistoryItem extends vscode.TreeItem {
  constructor() {
    super('No conversions yet', vscode.TreeItemCollapsibleState.None);
    this.description = 'Use the convert command to get started';
    this.iconPath = new vscode.ThemeIcon('info');
  }
}
