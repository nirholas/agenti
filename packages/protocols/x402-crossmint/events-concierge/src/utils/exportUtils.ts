import type { ChatMessage, Log, WalletInfo } from "../types";

/**
 * Export chat history as markdown
 */
export function exportChatAsMarkdown(messages: ChatMessage[]): void {
  const markdown = messages.map((msg) => {
    const timestamp = msg.timestamp.toLocaleString();
    const sender = msg.sender === 'user' ? '**You**' : msg.sender === 'agent' ? '**Agent**' : '**System**';
    return `### ${sender} - ${timestamp}\n\n${msg.text}\n`;
  }).join('\n---\n\n');

  const content = `# Secret Vault MCP - Chat History\n\nExported: ${new Date().toLocaleString()}\n\n${markdown}`;

  downloadFile(content, 'chat-history.md', 'text/markdown');
}

/**
 * Export logs as JSON
 */
export function exportLogsAsJSON(logs: Log[]): void {
  const content = JSON.stringify(logs, null, 2);
  downloadFile(content, 'logs.json', 'application/json');
}

/**
 * Export wallet configuration
 */
export function exportWalletConfig(walletInfo: WalletInfo | null): void {
  if (!walletInfo) {
    alert('No wallet information available to export');
    return;
  }

  const config = {
    exportedAt: new Date().toISOString(),
    guestWallet: {
      address: walletInfo.guestAddress,
      deployed: walletInfo.guestWalletDeployed,
      network: walletInfo.network
    },
    hostWallet: {
      address: walletInfo.hostAddress,
      network: walletInfo.network
    },
    network: walletInfo.network,
    explorerUrls: {
      guest: `https://sepolia.basescan.org/address/${walletInfo.guestAddress}`,
      host: `https://sepolia.basescan.org/address/${walletInfo.hostAddress}`
    }
  };

  const content = JSON.stringify(config, null, 2);
  downloadFile(content, 'wallet-config.json', 'application/json');
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/**
 * Download a file
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
