/**
 * @fileoverview Storage utility for conversion history
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';

export interface ConversionResult {
  id: string;
  repoUrl: string;
  repoName: string;
  toolCount: number;
  timestamp: string;
  classification?: {
    type: string;
    confidence: number;
    indicators: string[];
  };
  code?: string;
  tools?: Array<{
    name: string;
    description: string;
  }>;
}

const HISTORY_KEY = 'github-to-mcp.history';

export class StorageService {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get conversion history
   */
  getHistory(): ConversionResult[] {
    return this.context.globalState.get<ConversionResult[]>(HISTORY_KEY) || [];
  }

  /**
   * Add a conversion result to history
   */
  addToHistory(result: ConversionResult): void {
    const history = this.getHistory();
    
    // Add to beginning
    history.unshift(result);

    // Get limit from config
    const config = vscode.workspace.getConfiguration('github-to-mcp');
    const limit = config.get<number>('historyLimit') || 20;

    // Trim to limit
    if (history.length > limit) {
      history.length = limit;
    }

    this.context.globalState.update(HISTORY_KEY, history);
  }

  /**
   * Remove a specific item from history
   */
  removeFromHistory(id: string): void {
    const history = this.getHistory();
    const filtered = history.filter(item => item.id !== id);
    this.context.globalState.update(HISTORY_KEY, filtered);
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.context.globalState.update(HISTORY_KEY, []);
  }

  /**
   * Get a specific conversion by ID
   */
  getConversion(id: string): ConversionResult | undefined {
    const history = this.getHistory();
    return history.find(item => item.id === id);
  }
}
