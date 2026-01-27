/**
 * @fileoverview Webview panel for conversion UI
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService, ConversionResult } from '../utils/storage';
import { HistoryProvider } from '../views/historyProvider';
import { performConversion } from '../commands/convertFromUrl';
// Inline style functions to avoid module resolution issues
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
    header { text-align: center; margin-bottom: 30px; }
    h1 { color: var(--vscode-textLink-foreground); font-size: 28px; font-weight: 600; margin-bottom: 8px; }
    h2 { color: var(--vscode-foreground); font-size: 18px; font-weight: 600; margin-bottom: 12px; }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 14px; }
    .input-section { margin-bottom: 30px; }
    .input-group { display: flex; gap: 12px; }
    input[type="url"], input[type="text"] {
      flex: 1; padding: 12px 16px; font-size: 14px;
      background: var(--vscode-input-background); color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border); border-radius: 6px; outline: none;
    }
    input:focus { border-color: var(--vscode-focusBorder); }
    input::placeholder { color: var(--vscode-input-placeholderForeground); }
    .input-help { margin-top: 8px; font-size: 12px; color: var(--vscode-descriptionForeground); }
    .primary-btn {
      padding: 12px 24px; font-size: 14px; font-weight: 600;
      color: var(--vscode-button-foreground); background: var(--vscode-button-background);
      border: none; border-radius: 6px; cursor: pointer;
    }
    .primary-btn:hover { background: var(--vscode-button-hoverBackground); }
    .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .text-btn { padding: 6px 12px; font-size: 12px; color: var(--vscode-textLink-foreground); background: transparent; border: none; cursor: pointer; }
    .text-btn:hover { text-decoration: underline; }
    .icon-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 4px; cursor: pointer; color: var(--vscode-foreground); opacity: 0.7; }
    .icon-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px; }
    .feature { display: flex; align-items: flex-start; gap: 12px; padding: 16px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 8px; }
    .feature-icon { font-size: 24px; color: var(--vscode-textLink-foreground); }
    .feature-text { display: flex; flex-direction: column; gap: 4px; }
    .feature-text strong { color: var(--vscode-foreground); }
    .feature-text span { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .history-list { display: flex; flex-direction: column; gap: 8px; }
    .history-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 8px; cursor: pointer; }
    .history-item:hover { background: var(--vscode-list-hoverBackground); }
    .history-icon { font-size: 20px; color: var(--vscode-foreground); }
    .history-content { flex: 1; }
    .history-name { font-weight: 600; margin-bottom: 2px; }
    .history-meta { display: flex; gap: 12px; font-size: 12px; color: var(--vscode-descriptionForeground); }
    .tool-count { color: var(--vscode-textLink-foreground); }
    .history-actions { display: flex; gap: 4px; opacity: 0; }
    .history-item:hover .history-actions { opacity: 1; }
    .empty-state { text-align: center; padding: 40px 20px; color: var(--vscode-descriptionForeground); }
  `;
}

function getWebviewScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    const urlInput = document.getElementById('url-input');
    const convertBtn = document.getElementById('convert-btn');
    const clearBtn = document.getElementById('clear-btn');
    if (urlInput && convertBtn) {
      convertBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) { vscode.postMessage({ command: 'convert', url }); convertBtn.disabled = true; convertBtn.textContent = 'Converting...'; }
      });
      urlInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') convertBtn.click(); });
      urlInput.addEventListener('input', () => {
        const valid = urlInput.value.match(/^https?:\\/\\/github\\.com\\/[\\w-]+\\/[\\w.-]+/);
        convertBtn.disabled = !valid;
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all conversion history?')) {
          vscode.postMessage({ command: 'clearHistory' });
        }
      });
    }
    document.querySelectorAll('.history-item').forEach(item => {
      const url = item.dataset.url;
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.history-actions')) vscode.postMessage({ command: 'viewDetails', url });
      });
      const viewBtn = item.querySelector('.view-btn');
      if (viewBtn) viewBtn.addEventListener('click', (e) => { e.stopPropagation(); vscode.postMessage({ command: 'viewDetails', url }); });
      const openBtn = item.querySelector('.open-btn');
      if (openBtn) openBtn.addEventListener('click', (e) => { e.stopPropagation(); vscode.postMessage({ command: 'openExternal', url }); });
    });
  `;
}

let currentPanel: vscode.WebviewPanel | undefined;

/**
 * Show the conversion panel
 */
export function showConversionPanel(
  context: vscode.ExtensionContext,
  storage: StorageService,
  historyProvider: HistoryProvider
): void {
  const column = vscode.window.activeTextEditor
    ? vscode.window.activeTextEditor.viewColumn
    : undefined;

  if (currentPanel) {
    currentPanel.reveal(column);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'githubToMcpConversion',
    'Convert to MCP Server',
    column || vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'resources')
      ]
    }
  );

  currentPanel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'icon.png');
  currentPanel.webview.html = getConversionPanelHtml(currentPanel.webview, storage);

  // Handle messages from webview
  currentPanel.webview.onDidReceiveMessage(
    async (message: { command: string; url?: string }) => {
      switch (message.command) {
        case 'convert':
          if (message.url) {
            await performConversion(message.url, storage, historyProvider, context.extensionUri);
            // Update panel with latest history
            if (currentPanel) {
              currentPanel.webview.html = getConversionPanelHtml(currentPanel.webview, storage);
            }
          }
          break;
        
        case 'viewDetails':
          if (message.url) {
            const history = storage.getHistory();
            const item = history.find(h => h.repoUrl === message.url);
            if (item) {
              vscode.commands.executeCommand('github-to-mcp.viewDetails', item);
            }
          }
          break;
        
        case 'clearHistory':
          storage.clearHistory();
          historyProvider.refresh();
          if (currentPanel) {
            currentPanel.webview.html = getConversionPanelHtml(currentPanel.webview, storage);
          }
          break;
        
        case 'openExternal':
          if (message.url) {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
          }
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
 * Generate HTML content for conversion panel
 */
function getConversionPanelHtml(webview: vscode.Webview, storage: StorageService): string {
  const nonce = getNonce();
  const history = storage.getHistory();

  const historyHtml = history.length === 0
    ? '<p class="empty-state">No conversions yet. Enter a GitHub URL above to get started!</p>'
    : history.map(item => `
      <div class="history-item" data-url="${escapeHtml(item.repoUrl)}">
        <div class="history-icon">$(github)</div>
        <div class="history-content">
          <div class="history-name">${escapeHtml(item.repoName)}</div>
          <div class="history-meta">
            <span class="tool-count">${item.toolCount} tools</span>
            <span class="date">${formatDate(item.timestamp)}</span>
          </div>
        </div>
        <div class="history-actions">
          <button class="icon-btn view-btn" title="View Details">$(eye)</button>
          <button class="icon-btn open-btn" title="Open in Browser">$(link-external)</button>
        </div>
      </div>
    `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Convert to MCP Server</title>
  <style>${getWebviewStyles()}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>GitHub to MCP</h1>
      <p class="subtitle">Convert any GitHub repository to an MCP server</p>
    </header>

    <section class="input-section">
      <div class="input-group">
        <input 
          type="url" 
          id="url-input" 
          placeholder="https://github.com/owner/repo"
          pattern="https?://github\\.com/[\\w-]+/[\\w.-]+"
        >
        <button id="convert-btn" class="primary-btn">
          Convert
        </button>
      </div>
      <p class="input-help">Enter a GitHub repository URL to analyze and generate an MCP server</p>
    </section>

    <section class="features">
      <div class="feature">
        <div class="feature-icon">$(search)</div>
        <div class="feature-text">
          <strong>Auto-detect APIs</strong>
          <span>Finds OpenAPI specs, GraphQL schemas, and REST endpoints</span>
        </div>
      </div>
      <div class="feature">
        <div class="feature-icon">$(tools)</div>
        <div class="feature-text">
          <strong>Generate Tools</strong>
          <span>Creates MCP-compatible tool definitions</span>
        </div>
      </div>
      <div class="feature">
        <div class="feature-icon">$(zap)</div>
        <div class="feature-text">
          <strong>Ready to Use</strong>
          <span>Output works directly with Claude Desktop</span>
        </div>
      </div>
    </section>

    <section class="history-section">
      <div class="section-header">
        <h2>Recent Conversions</h2>
        ${history.length > 0 ? '<button id="clear-btn" class="text-btn">Clear All</button>' : ''}
      </div>
      <div class="history-list">
        ${historyHtml}
      </div>
    </section>
  </div>

  <script nonce="${nonce}">${getWebviewScript()}</script>
</body>
</html>`;
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
 * Format date for display
 */
function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Dispose the panel
 */
export function disposeConversionPanel(): void {
  if (currentPanel) {
    currentPanel.dispose();
    currentPanel = undefined;
  }
}
