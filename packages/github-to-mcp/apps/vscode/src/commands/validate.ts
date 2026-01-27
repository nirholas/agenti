/**
 * @fileoverview Validate command implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';

/**
 * Validate a generated MCP server file
 */
export async function validateCommand(): Promise<void> {
  const fileUri = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      'TypeScript': ['ts'],
      'JavaScript': ['js'],
      'Python': ['py']
    },
    title: 'Select MCP server file to validate'
  });

  if (!fileUri || fileUri.length === 0) {
    return;
  }

  const filePath = fileUri[0].fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Validating MCP server...',
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: 'Reading file...' });
        
        const document = await vscode.workspace.openTextDocument(fileUri[0]);
        const content = document.getText();

        progress.report({ message: 'Analyzing structure...' });

        const issues: ValidationIssue[] = [];

        // Check for basic MCP server structure
        if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
          issues.push(...validateTypeScriptMcp(content));
        } else if (filePath.endsWith('.py')) {
          issues.push(...validatePythonMcp(content));
        }

        // Display results
        if (issues.length === 0) {
          vscode.window.showInformationMessage('✓ MCP server validation passed!');
        } else {
          const channel = vscode.window.createOutputChannel('MCP Validation');
          channel.clear();
          channel.appendLine('MCP Server Validation Results');
          channel.appendLine('=' .repeat(40));
          channel.appendLine('');
          
          for (const issue of issues) {
            const icon = issue.severity === 'error' ? '✗' : '⚠';
            channel.appendLine(`${icon} Line ${issue.line || '?'}: ${issue.message}`);
          }
          
          channel.show();
          vscode.window.showWarningMessage(
            `Validation found ${issues.length} issue(s). See output for details.`
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Validation failed: ${message}`);
      }
    }
  );
}

interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  line?: number;
}

/**
 * Validate TypeScript/JavaScript MCP server
 */
function validateTypeScriptMcp(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split('\n');

  // Check for MCP SDK import
  if (!content.includes('@modelcontextprotocol/sdk')) {
    issues.push({
      severity: 'error',
      message: 'Missing @modelcontextprotocol/sdk import'
    });
  }

  // Check for Server instantiation
  if (!content.includes('new Server(')) {
    issues.push({
      severity: 'error',
      message: 'Missing Server instantiation'
    });
  }

  // Check for ListToolsRequestSchema handler
  if (!content.includes('ListToolsRequestSchema')) {
    issues.push({
      severity: 'warning',
      message: 'Missing ListToolsRequestSchema handler - tools may not be listed'
    });
  }

  // Check for CallToolRequestSchema handler
  if (!content.includes('CallToolRequestSchema')) {
    issues.push({
      severity: 'warning',
      message: 'Missing CallToolRequestSchema handler - tools may not be callable'
    });
  }

  // Check for transport
  if (!content.includes('StdioServerTransport') && !content.includes('transport')) {
    issues.push({
      severity: 'warning',
      message: 'Missing transport configuration'
    });
  }

  // Check for async function syntax errors (basic)
  lines.forEach((line, index) => {
    if (line.includes('async function') && !line.includes('{') && !lines[index + 1]?.includes('{')) {
      issues.push({
        severity: 'warning',
        message: 'Async function may be missing body',
        line: index + 1
      });
    }
  });

  return issues;
}

/**
 * Validate Python MCP server
 */
function validatePythonMcp(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for mcp import
  if (!content.includes('from mcp') && !content.includes('import mcp')) {
    issues.push({
      severity: 'error',
      message: 'Missing mcp module import'
    });
  }

  // Check for Server instantiation
  if (!content.includes('Server(')) {
    issues.push({
      severity: 'error',
      message: 'Missing Server instantiation'
    });
  }

  // Check for list_tools decorator
  if (!content.includes('@server.list_tools') && !content.includes('list_tools')) {
    issues.push({
      severity: 'warning',
      message: 'Missing list_tools handler'
    });
  }

  // Check for call_tool decorator
  if (!content.includes('@server.call_tool') && !content.includes('call_tool')) {
    issues.push({
      severity: 'warning',
      message: 'Missing call_tool handler'
    });
  }

  // Check for async main
  if (!content.includes('async def main') && !content.includes('asyncio.run')) {
    issues.push({
      severity: 'warning',
      message: 'Missing async main function or asyncio.run'
    });
  }

  return issues;
}
