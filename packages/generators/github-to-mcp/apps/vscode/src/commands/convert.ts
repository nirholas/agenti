/**
 * @fileoverview Convert command implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService, ConversionResult } from '../utils/storage';
import { HistoryProvider } from '../views/historyProvider';
import { showResultsPanel } from '../views/resultsPanel';

/**
 * Convert a GitHub repository to MCP tools
 */
export async function convertCommand(
  url: string,
  storage: StorageService,
  historyProvider: HistoryProvider
): Promise<void> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Converting GitHub repository...',
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: 'Fetching repository data...' });

        // Parse URL to get owner/repo
        const match = url.match(/github\.com\/([\w-]+)\/([\w.-]+)/);
        if (!match) {
          throw new Error('Invalid GitHub URL');
        }

        const [, owner, repo] = match;

        progress.report({ message: 'Analyzing repository...' });

        // Import the core library dynamically to avoid bundling issues
        const { generateFromGithub } = await import('@nirholas/github-to-mcp');
        
        const result = await generateFromGithub(url, {
          sources: ['readme', 'openapi', 'code']
        });

        progress.report({ message: 'Generating MCP server code...' });

        const generatedCode = result.generate();

        // Create conversion result
        const conversionResult: ConversionResult = {
          id: Date.now().toString(),
          repoUrl: url,
          repoName: `${owner}/${repo}`,
          toolCount: result.tools.length,
          timestamp: new Date().toISOString(),
          classification: result.classification,
          code: generatedCode,
          tools: result.tools.map((t: { name: string; description: string }) => ({
            name: t.name,
            description: t.description
          }))
        };

        // Save to history
        storage.addToHistory(conversionResult);
        historyProvider.refresh();

        // Show results panel
        showResultsPanel(conversionResult, vscode.Uri.file(''));

        vscode.window.showInformationMessage(
          `Successfully converted ${owner}/${repo} - ${result.tools.length} tools found!`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to convert repository: ${message}`);
      }
    }
  );
}
