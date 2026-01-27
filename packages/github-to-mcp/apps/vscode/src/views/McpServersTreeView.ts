/**
 * @fileoverview Tree view provider for MCP servers
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService, ConversionResult } from '../utils/storage';

type McpServerTreeItem = McpServerItem | McpToolItem | EmptyItem;

/**
 * Tree data provider for MCP servers view
 */
export class McpServersTreeView implements vscode.TreeDataProvider<McpServerTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<McpServerTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<McpServerTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<McpServerTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  constructor(private storage: StorageService) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: McpServerTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for tree node
   */
  getChildren(element?: McpServerTreeItem): McpServerTreeItem[] {
    if (!element) {
      // Root level - show all servers
      const history = this.storage.getHistory();
      
      if (history.length === 0) {
        return [new EmptyItem('No MCP servers yet', 'Convert a repository to get started')];
      }

      return history.map(item => new McpServerItem(item));
    }

    if (element instanceof McpServerItem) {
      // Show tools under each server
      const tools = element.result.tools || [];
      
      if (tools.length === 0) {
        return [new EmptyItem('No tools', 'This server has no tools')];
      }

      return tools.map(tool => new McpToolItem(tool, element.result));
    }

    return [];
  }

  /**
   * Get parent of element (for reveal)
   */
  getParent(element: McpServerTreeItem): McpServerTreeItem | undefined {
    if (element instanceof McpToolItem) {
      const history = this.storage.getHistory();
      const server = history.find(h => h.id === element.serverId);
      if (server) {
        return new McpServerItem(server);
      }
    }
    return undefined;
  }
}

/**
 * Tree item for an MCP server
 */
export class McpServerItem extends vscode.TreeItem {
  public readonly result: ConversionResult;

  constructor(result: ConversionResult) {
    super(result.repoName, vscode.TreeItemCollapsibleState.Collapsed);
    
    this.result = result;
    this.description = `${result.toolCount} tools`;
    
    const date = new Date(result.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`### ${result.repoName}\n\n`);
    this.tooltip.appendMarkdown(`**Tools:** ${result.toolCount}\n\n`);
    if (result.classification) {
      this.tooltip.appendMarkdown(`**Type:** ${result.classification.type}\n\n`);
      this.tooltip.appendMarkdown(`**Confidence:** ${Math.round(result.classification.confidence * 100)}%\n\n`);
    }
    this.tooltip.appendMarkdown(`**Converted:** ${formattedDate}\n\n`);
    this.tooltip.appendMarkdown(`[Open Repository](${result.repoUrl})`);
    this.tooltip.isTrusted = true;
    
    this.iconPath = new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.green'));
    this.contextValue = 'mcpServer';

    // Command on click
    this.command = {
      command: 'github-to-mcp.viewDetails',
      title: 'View Details',
      arguments: [result]
    };
  }
}

/**
 * Tree item for an MCP tool
 */
export class McpToolItem extends vscode.TreeItem {
  public readonly serverId: string;

  constructor(
    tool: { name: string; description: string },
    server: ConversionResult
  ) {
    super(tool.name, vscode.TreeItemCollapsibleState.None);
    
    this.serverId = server.id;
    this.description = tool.description.substring(0, 50) + (tool.description.length > 50 ? '...' : '');
    
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`### ${tool.name}\n\n`);
    this.tooltip.appendMarkdown(tool.description);
    this.tooltip.isTrusted = true;
    
    this.iconPath = new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('charts.blue'));
    this.contextValue = 'mcpTool';

    // Command to show tool details
    this.command = {
      command: 'github-to-mcp.showToolDetails',
      title: 'Show Tool Details',
      arguments: [tool, server]
    };
  }
}

/**
 * Empty placeholder item
 */
class EmptyItem extends vscode.TreeItem {
  constructor(label: string, description?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon('info');
  }
}
