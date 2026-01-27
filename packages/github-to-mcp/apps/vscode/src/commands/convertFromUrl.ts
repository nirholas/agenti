/**
 * @fileoverview Command to convert a GitHub repository from URL input
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService, ConversionResult } from '../utils/storage';
import { HistoryProvider } from '../views/historyProvider';
import { showResultsPanel } from '../views/resultsPanel';

/**
 * Prompt user for GitHub URL and convert to MCP server
 */
export async function convertFromUrlCommand(
  storage: StorageService,
  historyProvider: HistoryProvider,
  extensionUri: vscode.Uri
): Promise<void> {
  // Get URL from user input
  const url = await vscode.window.showInputBox({
    prompt: 'Enter GitHub repository URL',
    placeHolder: 'https://github.com/owner/repo',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value) {
        return 'URL is required';
      }
      if (!value.match(/^https?:\/\/github\.com\/[\w-]+\/[\w.-]+/)) {
        return 'Invalid GitHub URL format. Expected: https://github.com/owner/repo';
      }
      return null;
    }
  });

  if (!url) {
    return;
  }

  await performConversion(url, storage, historyProvider, extensionUri);
}

/**
 * Perform the actual conversion
 */
export async function performConversion(
  url: string,
  storage: StorageService,
  historyProvider: HistoryProvider,
  extensionUri: vscode.Uri
): Promise<ConversionResult | undefined> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Converting GitHub repository...',
      cancellable: true
    },
    async (progress, token) => {
      try {
        // Parse URL to get owner/repo
        const match = url.match(/github\.com\/([\w-]+)\/([\w.-]+)/);
        if (!match) {
          throw new Error('Invalid GitHub URL');
        }

        const [, owner, repo] = match;

        if (token.isCancellationRequested) {
          return undefined;
        }

        progress.report({ message: 'Fetching repository data...', increment: 10 });

        // Import the core library dynamically to avoid bundling issues
        const { generateFromGithub } = await import('@nirholas/github-to-mcp');

        if (token.isCancellationRequested) {
          return undefined;
        }

        progress.report({ message: 'Analyzing repository...', increment: 30 });

        const result = await generateFromGithub(url, {
          sources: ['readme', 'openapi', 'code']
        });

        if (token.isCancellationRequested) {
          return undefined;
        }

        progress.report({ message: 'Generating MCP server code...', increment: 40 });

        const generatedCode = result.generate();

        progress.report({ message: 'Finalizing...', increment: 20 });

        // Create conversion result
        const conversionResult: ConversionResult = {
          id: Date.now().toString(),
          repoUrl: url,
          repoName: `${owner}/${repo}`,
          toolCount: result.tools.length,
          timestamp: new Date().toISOString(),
          classification: result.classification,
          code: generatedCode,
          tools: result.tools.map((t: { name: string; description: string; parameters?: unknown }) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        };

        // Save to history
        storage.addToHistory(conversionResult);
        historyProvider.refresh();

        // Show results panel
        showResultsPanel(conversionResult, extensionUri);

        vscode.window.showInformationMessage(
          `Successfully converted ${owner}/${repo} - ${result.tools.length} tools found!`,
          'View Details',
          'Copy Config'
        ).then((selection) => {
          if (selection === 'Copy Config') {
            vscode.commands.executeCommand('github-to-mcp.copyConfig');
          }
        });

        return conversionResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to convert repository: ${message}`);
        return undefined;
      }
    }
  );
}
