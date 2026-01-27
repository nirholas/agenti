/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | n1ch0las
 *  ID: n1ch-0las-4e49-4348-786274000000
 * ═══════════════════════════════════════════════════════════════
 */

interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {}; 

/* universal-crypto-mcp © n1ch0las */