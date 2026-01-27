/**
 * @fileoverview Webview panel for displaying conversion results
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { ConversionResult } from '../utils/storage';

let currentPanel: vscode.WebviewPanel | undefined;

/**
 * Show results in a webview panel
 */
export function showResultsPanel(result: ConversionResult, _extensionUri: vscode.Uri): void {
  const columnToShowIn = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  if (currentPanel) {
    currentPanel.reveal(columnToShowIn);
    currentPanel.webview.html = getWebviewContent(result);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'githubToMcpResults',
    `MCP: ${result.repoName}`,
    columnToShowIn || vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  currentPanel.webview.html = getWebviewContent(result);

  // Handle messages from webview
  currentPanel.webview.onDidReceiveMessage(
    async (message: { command: string; text?: string }) => {
      switch (message.command) {
        case 'copy':
          if (message.text) {
            await vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage('Copied to clipboard!');
          }
          break;
        case 'openRepo':
          vscode.env.openExternal(vscode.Uri.parse(result.repoUrl));
          break;
      }
    }
  );

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });
}

/**
 * Generate HTML content for the webview
 */
function getWebviewContent(result: ConversionResult): string {
  const toolsList = result.tools
    ?.map(t => `
      <div class="tool">
        <div class="tool-name">${escapeHtml(t.name)}</div>
        <div class="tool-desc">${escapeHtml(t.description)}</div>
      </div>
    `)
    .join('') || '<p>No tools found</p>';

  const confidencePercent = result.classification
    ? Math.round(result.classification.confidence * 100)
    : 0;

  const code = result.code || '// No code generated';
  
  // Extract server name once to avoid duplication
  const serverName = result.repoName.split('/')[1] || result.repoName;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Results: ${escapeHtml(result.repoName)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      margin: 0;
    }
    h1 {
      color: var(--vscode-textLink-foreground);
      margin-bottom: 5px;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--vscode-panel-border);
      margin-bottom: 20px;
    }
    .tab {
      padding: 10px 20px;
      cursor: pointer;
      border: none;
      background: none;
      color: var(--vscode-foreground);
      border-bottom: 2px solid transparent;
    }
    .tab:hover {
      color: var(--vscode-textLink-foreground);
    }
    .tab.active {
      color: var(--vscode-textLink-foreground);
      border-bottom-color: var(--vscode-textLink-foreground);
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .stat-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .stat-label {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      text-transform: uppercase;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .tool {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .tool-name {
      font-weight: bold;
      color: var(--vscode-symbolIcon-functionForeground);
      font-family: var(--vscode-editor-font-family);
    }
    .tool-desc {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      margin-top: 4px;
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      line-height: 1.5;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .indicators {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .indicator {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <h1>📦 ${escapeHtml(result.repoName)}</h1>
  <p class="subtitle">Converted ${new Date(result.timestamp).toLocaleString()}</p>
  
  <div class="actions">
    <button onclick="copyCode()">📋 Copy Code</button>
    <button onclick="openRepo()">🔗 Open in GitHub</button>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('overview', event)">Overview</button>
    <button class="tab" onclick="switchTab('tools', event)">Tools (${result.toolCount})</button>
    <button class="tab" onclick="switchTab('code', event)">Code</button>
    <button class="tab" onclick="switchTab('config', event)">Config</button>
  </div>

  <div id="overview" class="tab-content active">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Tools Found</div>
        <div class="stat-value">${result.toolCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Repo Type</div>
        <div class="stat-value">${escapeHtml(result.classification?.type || 'unknown')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Confidence</div>
        <div class="stat-value">${confidencePercent}%</div>
      </div>
    </div>
    
    ${result.classification?.indicators.length ? `
      <h3>Detection Indicators</h3>
      <div class="indicators">
        ${result.classification.indicators.map(i => `<span class="indicator">${escapeHtml(i)}</span>`).join('')}
      </div>
    ` : ''}
  </div>

  <div id="tools" class="tab-content">
    <h3>Available Tools</h3>
    ${toolsList}
  </div>

  <div id="code" class="tab-content">
    <h3>Generated MCP Server Code</h3>
    <button onclick="copyCode()" style="margin-bottom: 10px;">📋 Copy Code</button>
    <pre><code id="codeBlock">${escapeHtml(code)}</code></pre>
  </div>

  <div id="config" class="tab-content">
    <h3>MCP Configuration</h3>
    <p>Add this to your Claude or Cursor config:</p>
    
    <h4>Claude Desktop</h4>
    <pre><code>${escapeHtml(JSON.stringify({
      mcpServers: {
        [serverName]: {
          command: 'node',
          args: [`${serverName}-mcp/index.js`]
        }
      }
    }, null, 2))}</code></pre>
    
    <h4>Cursor</h4>
    <pre><code>${escapeHtml(JSON.stringify({
      mcp: {
        servers: {
          [serverName]: {
            command: 'node',
            args: [`${serverName}-mcp/index.js`]
          }
        }
      }
    }, null, 2))}</code></pre>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    function switchTab(tabId, evt) {
      // Update tabs
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      if (evt && evt.target) {
        evt.target.classList.add('active');
      }
      
      // Update content
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
    }
    
    function copyCode() {
      const code = document.getElementById('codeBlock').textContent;
      vscode.postMessage({ command: 'copy', text: code });
    }
    
    function openRepo() {
      vscode.postMessage({ command: 'openRepo' });
    }
  </script>
</body>
</html>`;
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
