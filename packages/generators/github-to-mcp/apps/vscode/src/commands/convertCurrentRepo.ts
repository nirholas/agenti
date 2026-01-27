/**
 * @fileoverview Command to convert the currently open workspace repository
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService } from '../utils/storage';
import { HistoryProvider } from '../views/historyProvider';
import { performConversion } from './convertFromUrl';

/**
 * Convert the currently open GitHub repository to MCP server
 */
export async function convertCurrentRepoCommand(
  storage: StorageService,
  historyProvider: HistoryProvider,
  extensionUri: vscode.Uri
): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage('No workspace folder open. Please open a GitHub repository folder.');
    return;
  }

  // Try to get the GitHub URL from git config
  const githubUrl = await getGitHubUrlFromWorkspace(workspaceFolders[0]);

  if (!githubUrl) {
    // Fallback to manual input if we can't detect
    const response = await vscode.window.showWarningMessage(
      'Could not detect GitHub repository. Would you like to enter the URL manually?',
      'Enter URL',
      'Cancel'
    );

    if (response === 'Enter URL') {
      vscode.commands.executeCommand('github-to-mcp.convertFromUrl');
    }
    return;
  }

  // Confirm with user
  const repoPath = githubUrl.replace('https://github.com/', '');
  const confirm = await vscode.window.showInformationMessage(
    `Convert ${repoPath} to an MCP server?`,
    'Yes',
    'No'
  );

  if (confirm !== 'Yes') {
    return;
  }

  await performConversion(githubUrl, storage, historyProvider, extensionUri);
}

/**
 * Extract GitHub URL from workspace git config
 */
async function getGitHubUrlFromWorkspace(folder: vscode.WorkspaceFolder): Promise<string | null> {
  try {
    const gitConfigPath = vscode.Uri.joinPath(folder.uri, '.git', 'config');
    const gitConfig = await vscode.workspace.fs.readFile(gitConfigPath);
    const content = Buffer.from(gitConfig).toString('utf-8');

    // Match HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = content.match(/url\s*=\s*https?:\/\/github\.com\/([\w-]+\/[\w.-]+?)(?:\.git)?$/m);
    if (httpsMatch) {
      return `https://github.com/${httpsMatch[1]}`;
    }

    // Match SSH format: git@github.com:owner/repo.git
    const sshMatch = content.match(/url\s*=\s*git@github\.com:([\w-]+\/[\w.-]+?)(?:\.git)?$/m);
    if (sshMatch) {
      return `https://github.com/${sshMatch[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if the current workspace is a GitHub repository
 */
export async function isCurrentWorkspaceGitHubRepo(): Promise<boolean> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return false;
  }

  const url = await getGitHubUrlFromWorkspace(workspaceFolders[0]);
  return url !== null;
}

/**
 * Get the GitHub URL of the current workspace
 */
export async function getCurrentWorkspaceGitHubUrl(): Promise<string | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  return getGitHubUrlFromWorkspace(workspaceFolders[0]);
}
