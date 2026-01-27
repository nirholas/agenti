/**
 * @fileoverview Webview panel for showing tool details with test capability
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { ConversionResult } from '../utils/storage';
// Inline style function to avoid module resolution issues
function getWebviewStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.5;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .primary-btn {
      padding: 12px 24px; font-size: 14px; font-weight: 600;
      color: var(--vscode-button-foreground); background: var(--vscode-button-background);
      border: none; border-radius: 6px; cursor: pointer;
    }
    .primary-btn:hover { background: var(--vscode-button-hoverBackground); }
    .secondary-btn {
      padding: 10px 20px; font-size: 14px;
      color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground);
      border: none; border-radius: 6px; cursor: pointer;
    }
    .secondary-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
  `;
}

let currentPanel: vscode.WebviewPanel | undefined;

interface Tool {
  name: string;
  description: string;
  parameters?: {
    type?: string;
    properties?: Record<string, {
      type?: string;
      description?: string;
      required?: boolean;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

/**
 * Show tool details panel
 */
export function showToolDetailsPanel(
  tool: Tool,
  server: ConversionResult,
  context: vscode.ExtensionContext
): void {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  // If panel exists, update content
  if (currentPanel) {
    currentPanel.title = `Tool: ${tool.name}`;
    currentPanel.webview.html = getToolDetailsPanelHtml(tool, server, currentPanel.webview);
    currentPanel.reveal(column);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'githubToMcpToolDetails',
    `Tool: ${tool.name}`,
    column || vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  currentPanel.webview.html = getToolDetailsPanelHtml(tool, server, currentPanel.webview);

  // Handle messages from webview
  currentPanel.webview.onDidReceiveMessage(
    async (message: { command: string; params?: Record<string, unknown> }) => {
      switch (message.command) {
        case 'testTool':
          await testTool(tool, message.params || {});
          break;
        
        case 'copyToolDef':
          await copyToolDefinition(tool);
          break;
        
        case 'copyParameters':
          await copyParameters(message.params || {});
          break;
      }
    },
    undefined,
    context.subscriptions
  );

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    null,
    context.subscriptions
  );
}

/**
 * Generate HTML content for tool details panel
 */
function getToolDetailsPanelHtml(tool: Tool, server: ConversionResult, webview: vscode.Webview): string {
  const nonce = getNonce();
  const parameters = tool.parameters?.properties || {};
  const requiredParams = tool.parameters?.required || [];

  const parametersHtml = Object.keys(parameters).length === 0
    ? '<p class="empty-state">This tool has no parameters</p>'
    : Object.entries(parameters).map(([name, schema]) => {
        const isRequired = requiredParams.includes(name);
        const type = schema.type || 'any';
        const hasEnum = schema.enum && schema.enum.length > 0;

        return `
          <div class="param-item ${isRequired ? 'required' : ''}">
            <div class="param-header">
              <span class="param-name">${escapeHtml(name)}</span>
              <span class="param-type">${escapeHtml(type)}</span>
              ${isRequired ? '<span class="required-badge">Required</span>' : ''}
            </div>
            <div class="param-description">${escapeHtml(schema.description || 'No description')}</div>
            <div class="param-input">
              ${hasEnum 
                ? `<select name="${escapeHtml(name)}" class="param-select">
                    <option value="">Select value...</option>
                    ${schema.enum!.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
                   </select>`
                : type === 'boolean'
                  ? `<select name="${escapeHtml(name)}" class="param-select">
                      <option value="">Select value...</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                     </select>`
                  : type === 'number' || type === 'integer'
                    ? `<input type="number" name="${escapeHtml(name)}" class="param-input-field" placeholder="Enter ${type}..." ${schema.default !== undefined ? `value="${schema.default}"` : ''}>`
                    : `<input type="text" name="${escapeHtml(name)}" class="param-input-field" placeholder="Enter ${type}..." ${schema.default !== undefined ? `value="${schema.default}"` : ''}>`
              }
            </div>
          </div>
        `;
      }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Tool: ${escapeHtml(tool.name)}</title>
  <style>
    ${getWebviewStyles()}
    
    .tool-header {
      margin-bottom: 20px;
    }
    
    .tool-name {
      font-size: 24px;
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }
    
    .tool-source {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      margin-top: 4px;
    }
    
    .tool-description {
      margin: 16px 0;
      padding: 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 6px;
      line-height: 1.5;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }
    
    .param-item {
      padding: 12px;
      margin-bottom: 12px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
    }
    
    .param-item.required {
      border-left: 3px solid var(--vscode-charts-orange);
    }
    
    .param-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    
    .param-name {
      font-weight: 600;
      font-family: var(--vscode-editor-font-family);
    }
    
    .param-type {
      font-size: 12px;
      padding: 2px 6px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 4px;
    }
    
    .required-badge {
      font-size: 11px;
      padding: 2px 6px;
      background: var(--vscode-charts-orange);
      color: var(--vscode-editor-background);
      border-radius: 4px;
    }
    
    .param-description {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    
    .param-input-field, .param-select {
      width: 100%;
      padding: 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family);
    }
    
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    
    .output-section {
      margin-top: 20px;
    }
    
    .output-box {
      padding: 12px;
      background: var(--vscode-terminal-background);
      border-radius: 6px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-x: auto;
      max-height: 200px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="tool-header">
      <div class="tool-name">${escapeHtml(tool.name)}</div>
      <div class="tool-source">From ${escapeHtml(server.repoName)}</div>
    </div>
    
    <div class="tool-description">${escapeHtml(tool.description)}</div>
    
    <div class="parameters-section">
      <div class="section-title">Parameters</div>
      <div id="parameters-form">
        ${parametersHtml}
      </div>
    </div>
    
    <div class="actions">
      <button id="test-btn" class="primary-btn">
        Test Tool
      </button>
      <button id="copy-def-btn" class="secondary-btn">
        Copy Definition
      </button>
      <button id="copy-params-btn" class="secondary-btn">
        Copy Parameters
      </button>
    </div>
    
    <div class="output-section" id="output-section" style="display: none;">
      <div class="section-title">Test Output</div>
      <div class="output-box" id="output-box"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    
    function getParameters() {
      const params = {};
      const inputs = document.querySelectorAll('.param-input-field, .param-select');
      inputs.forEach(input => {
        const value = input.value.trim();
        if (value) {
          // Try to parse JSON for complex values
          try {
            if (value.startsWith('{') || value.startsWith('[')) {
              params[input.name] = JSON.parse(value);
            } else if (value === 'true') {
              params[input.name] = true;
            } else if (value === 'false') {
              params[input.name] = false;
            } else if (!isNaN(value) && value !== '') {
              params[input.name] = Number(value);
            } else {
              params[input.name] = value;
            }
          } catch {
            params[input.name] = value;
          }
        }
      });
      return params;
    }
    
    document.getElementById('test-btn').addEventListener('click', () => {
      const params = getParameters();
      vscode.postMessage({ command: 'testTool', params });
      
      // Show output section
      document.getElementById('output-section').style.display = 'block';
      document.getElementById('output-box').textContent = 'Testing tool...';
    });
    
    document.getElementById('copy-def-btn').addEventListener('click', () => {
      vscode.postMessage({ command: 'copyToolDef' });
    });
    
    document.getElementById('copy-params-btn').addEventListener('click', () => {
      const params = getParameters();
      vscode.postMessage({ command: 'copyParameters', params });
    });
  </script>
</body>
</html>`;
}

/**
 * Test a tool with given parameters
 */
async function testTool(tool: Tool, params: Record<string, unknown>): Promise<void> {
  // This is a placeholder - in a real implementation, this would
  // actually run the tool against a live MCP server
  vscode.window.showInformationMessage(
    `Testing tool "${tool.name}" with parameters: ${JSON.stringify(params)}`,
    'OK'
  );
  
  // Show a notification about the test feature
  vscode.window.showInformationMessage(
    'Tool testing requires a running MCP server. Configure Claude Desktop first.',
    'Configure'
  ).then(selection => {
    if (selection === 'Configure') {
      vscode.commands.executeCommand('github-to-mcp.configureClaudeDesktop');
    }
  });
}

/**
 * Copy tool definition to clipboard
 */
async function copyToolDefinition(tool: Tool): Promise<void> {
  const definition = {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters || { type: 'object', properties: {} }
  };
  
  await vscode.env.clipboard.writeText(JSON.stringify(definition, null, 2));
  vscode.window.showInformationMessage('Tool definition copied to clipboard!');
}

/**
 * Copy parameters to clipboard
 */
async function copyParameters(params: Record<string, unknown>): Promise<void> {
  await vscode.env.clipboard.writeText(JSON.stringify(params, null, 2));
  vscode.window.showInformationMessage('Parameters copied to clipboard!');
}

/**
 * Generate a nonce for script security
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Dispose the panel
 */
export function disposeToolDetailsPanel(): void {
  if (currentPanel) {
    currentPanel.dispose();
    currentPanel = undefined;
  }
}
