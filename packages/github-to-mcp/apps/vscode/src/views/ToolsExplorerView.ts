/**
 * @fileoverview Tree view provider for exploring MCP tools
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService, ConversionResult } from '../utils/storage';

type ToolExplorerItem = CategoryItem | ToolItem | ParameterItem | EmptyItem;

interface ToolWithServer {
  tool: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  };
  server: ConversionResult;
}

/**
 * Tree data provider for tools explorer view
 */
export class ToolsExplorerView implements vscode.TreeDataProvider<ToolExplorerItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ToolExplorerItem | undefined | null | void> = 
    new vscode.EventEmitter<ToolExplorerItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ToolExplorerItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private filterText: string = '';

  constructor(private storage: StorageService) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Set filter text for searching
   */
  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  /**
   * Clear filter
   */
  clearFilter(): void {
    this.filterText = '';
    this.refresh();
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: ToolExplorerItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for tree node
   */
  getChildren(element?: ToolExplorerItem): ToolExplorerItem[] {
    if (!element) {
      // Root level - show tools grouped by category
      return this.getRootChildren();
    }

    if (element instanceof CategoryItem) {
      return element.tools.map(t => new ToolItem(t.tool, t.server));
    }

    if (element instanceof ToolItem) {
      // Show parameters under tool
      const params = element.tool.parameters;
      if (!params || typeof params !== 'object') {
        return [];
      }

      const properties = (params as { properties?: Record<string, unknown> }).properties;
      if (!properties) {
        return [];
      }

      return Object.entries(properties).map(([name, schema]) => 
        new ParameterItem(name, schema as Record<string, unknown>)
      );
    }

    return [];
  }

  /**
   * Get root level children
   */
  private getRootChildren(): ToolExplorerItem[] {
    const history = this.storage.getHistory();
    
    if (history.length === 0) {
      return [new EmptyItem('No tools available', 'Convert a repository to see tools')];
    }

    // Collect all tools with their source server
    const allTools: ToolWithServer[] = [];
    for (const server of history) {
      if (server.tools) {
        for (const tool of server.tools) {
          allTools.push({ tool, server });
        }
      }
    }

    // Apply filter if set
    let filteredTools = allTools;
    if (this.filterText) {
      filteredTools = allTools.filter(t => 
        t.tool.name.toLowerCase().includes(this.filterText) ||
        t.tool.description.toLowerCase().includes(this.filterText)
      );
    }

    if (filteredTools.length === 0) {
      if (this.filterText) {
        return [new EmptyItem(`No tools matching "${this.filterText}"`, 'Try a different search term')];
      }
      return [new EmptyItem('No tools found', 'Converted repositories have no tools')];
    }

    // Group by category based on tool name patterns
    const categories = this.categorizeTools(filteredTools);
    
    // If only one category, show tools directly
    if (categories.size === 1) {
      const tools = [...categories.values()][0];
      return tools.map(t => new ToolItem(t.tool, t.server));
    }

    // Show as categories
    const items: ToolExplorerItem[] = [];
    for (const [category, tools] of categories) {
      items.push(new CategoryItem(category, tools));
    }

    return items.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
  }

  /**
   * Categorize tools by naming patterns
   */
  private categorizeTools(tools: ToolWithServer[]): Map<string, ToolWithServer[]> {
    const categories = new Map<string, ToolWithServer[]>();

    for (const toolWithServer of tools) {
      const name = toolWithServer.tool.name;
      
      // Extract category from naming patterns
      let category = 'General';
      
      if (name.includes('_')) {
        // snake_case: get_user, create_post -> Users, Posts
        const prefix = name.split('_')[0];
        category = this.capitalizeCategory(prefix);
      } else if (name.match(/^[a-z]+[A-Z]/)) {
        // camelCase: getUser, createPost -> Users, Posts
        const prefix = name.match(/^[a-z]+/)?.[0] || 'general';
        category = this.capitalizeCategory(prefix);
      }

      // Group by source repo if no clear category
      if (category === 'General') {
        category = toolWithServer.server.repoName.split('/')[1] || 'General';
      }

      const existing = categories.get(category) || [];
      existing.push(toolWithServer);
      categories.set(category, existing);
    }

    return categories;
  }

  /**
   * Capitalize and pluralize category name
   */
  private capitalizeCategory(name: string): string {
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    
    // Common verb to noun mappings
    const mappings: Record<string, string> = {
      'Get': 'Queries',
      'List': 'Queries',
      'Search': 'Search',
      'Create': 'Mutations',
      'Update': 'Mutations',
      'Delete': 'Mutations',
      'Post': 'Actions',
      'Put': 'Actions',
      'Fetch': 'Data',
      'Send': 'Communication',
      'Auth': 'Authentication'
    };

    return mappings[capitalized] || capitalized;
  }
}

/**
 * Category tree item
 */
class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly categoryName: string,
    public readonly tools: ToolWithServer[]
  ) {
    super(categoryName, vscode.TreeItemCollapsibleState.Expanded);
    
    this.description = `${tools.length} tool${tools.length === 1 ? '' : 's'}`;
    this.iconPath = new vscode.ThemeIcon('symbol-namespace');
    this.contextValue = 'toolCategory';
  }
}

/**
 * Tool tree item
 */
export class ToolItem extends vscode.TreeItem {
  constructor(
    public readonly tool: { name: string; description: string; parameters?: Record<string, unknown> },
    public readonly server: ConversionResult
  ) {
    super(
      tool.name, 
      tool.parameters ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
    
    this.description = server.repoName.split('/')[1];
    
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`### ${tool.name}\n\n`);
    this.tooltip.appendMarkdown(`${tool.description}\n\n`);
    this.tooltip.appendMarkdown(`**Source:** ${server.repoName}\n\n`);
    
    if (tool.parameters) {
      this.tooltip.appendMarkdown('**Parameters:**\n');
      const properties = (tool.parameters as { properties?: Record<string, unknown> }).properties;
      if (properties) {
        for (const [key, value] of Object.entries(properties)) {
          const type = (value as Record<string, unknown>).type || 'any';
          this.tooltip.appendMarkdown(`- \`${key}\`: ${type}\n`);
        }
      }
    }
    
    this.tooltip.isTrusted = true;
    
    this.iconPath = new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('charts.blue'));
    this.contextValue = 'tool';

    // Command to show details
    this.command = {
      command: 'github-to-mcp.showToolDetails',
      title: 'Show Tool Details',
      arguments: [tool, server]
    };
  }
}

/**
 * Parameter tree item
 */
class ParameterItem extends vscode.TreeItem {
  constructor(
    name: string,
    schema: Record<string, unknown>
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    
    const type = (schema.type as string) || 'any';
    const required = schema.required === true;
    
    this.description = type + (required ? ' (required)' : '');
    
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`### ${name}\n\n`);
    this.tooltip.appendMarkdown(`**Type:** ${type}\n\n`);
    if (schema.description) {
      this.tooltip.appendMarkdown(`${schema.description}\n\n`);
    }
    if (schema.enum) {
      this.tooltip.appendMarkdown(`**Allowed values:** ${(schema.enum as string[]).join(', ')}\n`);
    }
    
    this.iconPath = new vscode.ThemeIcon(
      required ? 'symbol-parameter' : 'symbol-variable',
      required ? new vscode.ThemeColor('charts.orange') : undefined
    );
    this.contextValue = 'parameter';
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
