/**
 * @fileoverview Shared styles and scripts for webview panels
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * Get shared CSS styles for webview panels
 */
export function getWebviewStyles(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.5;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    h1 {
      color: var(--vscode-textLink-foreground);
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    h2 {
      color: var(--vscode-foreground);
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    
    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }
    
    /* Input Section */
    .input-section {
      margin-bottom: 30px;
    }
    
    .input-group {
      display: flex;
      gap: 12px;
    }
    
    input[type="url"],
    input[type="text"] {
      flex: 1;
      padding: 12px 16px;
      font-size: 14px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      outline: none;
      transition: border-color 0.2s;
    }
    
    input:focus {
      border-color: var(--vscode-focusBorder);
    }
    
    input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    
    .input-help {
      margin-top: 8px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    /* Buttons */
    .primary-btn {
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .primary-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    .primary-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .secondary-btn {
      padding: 10px 20px;
      font-size: 14px;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .secondary-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .text-btn {
      padding: 6px 12px;
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      background: transparent;
      border: none;
      cursor: pointer;
    }
    
    .text-btn:hover {
      text-decoration: underline;
    }
    
    .icon-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: var(--vscode-foreground);
      opacity: 0.7;
      transition: opacity 0.2s, background-color 0.2s;
    }
    
    .icon-btn:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground);
    }
    
    /* Features */
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 30px;
    }
    
    .feature {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
    }
    
    .feature-icon {
      font-size: 24px;
      color: var(--vscode-textLink-foreground);
    }
    
    .feature-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .feature-text strong {
      color: var(--vscode-foreground);
    }
    
    .feature-text span {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    /* Section Header */
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    /* History List */
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .history-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .history-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    
    .history-icon {
      font-size: 20px;
      color: var(--vscode-foreground);
    }
    
    .history-content {
      flex: 1;
    }
    
    .history-name {
      font-weight: 600;
      margin-bottom: 2px;
    }
    
    .history-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    
    .tool-count {
      color: var(--vscode-textLink-foreground);
    }
    
    .history-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .history-item:hover .history-actions {
      opacity: 1;
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }
    
    /* Loading */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px;
    }
    
    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--vscode-progressBar-background);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Tabs */
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
      transition: color 0.2s, border-color 0.2s;
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
    
    /* Code Block */
    .code-block {
      background: var(--vscode-textCodeBlock-background);
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
      line-height: 1.6;
    }
    
    pre {
      margin: 0;
      white-space: pre-wrap;
    }
    
    /* Cards */
    .card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .card-title {
      font-weight: 600;
      font-size: 14px;
    }
    
    /* Badge */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    
    .badge-success {
      background: var(--vscode-testing-iconPassed);
      color: var(--vscode-editor-background);
    }
    
    .badge-warning {
      background: var(--vscode-charts-orange);
      color: var(--vscode-editor-background);
    }
    
    /* Responsive */
    @media (max-width: 600px) {
      .input-group {
        flex-direction: column;
      }
      
      .features {
        grid-template-columns: 1fr;
      }
    }
  `;
}

/**
 * Get shared JavaScript for webview panels
 */
export function getWebviewScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    
    // URL Input handling
    const urlInput = document.getElementById('url-input');
    const convertBtn = document.getElementById('convert-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    if (urlInput && convertBtn) {
      // Convert on button click
      convertBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) {
          vscode.postMessage({ command: 'convert', url });
          convertBtn.disabled = true;
          convertBtn.textContent = 'Converting...';
        }
      });
      
      // Convert on Enter key
      urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          convertBtn.click();
        }
      });
      
      // Validate URL as user types
      urlInput.addEventListener('input', () => {
        const valid = urlInput.value.match(/^https?:\\/\\/github\\.com\\/[\\w-]+\\/[\\w.-]+/);
        convertBtn.disabled = !valid;
      });
    }
    
    // Clear history
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all conversion history?')) {
          vscode.postMessage({ command: 'clearHistory' });
        }
      });
    }
    
    // History item interactions
    document.querySelectorAll('.history-item').forEach(item => {
      const url = item.dataset.url;
      
      // View details on click
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.history-actions')) {
          vscode.postMessage({ command: 'viewDetails', url });
        }
      });
      
      // View button
      const viewBtn = item.querySelector('.view-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          vscode.postMessage({ command: 'viewDetails', url });
        });
      }
      
      // Open in browser button
      const openBtn = item.querySelector('.open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          vscode.postMessage({ command: 'openExternal', url });
        });
      }
    });
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active from all tabs and content
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active to clicked tab and corresponding content
        tab.classList.add('active');
        const contentId = tab.dataset.tab;
        const content = document.getElementById(contentId);
        if (content) {
          content.classList.add('active');
        }
      });
    });
  `;
}
