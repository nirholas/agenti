// ucm:6e696368-786274-4d43-5000-000000000000:nich

import React from 'react';
import { useWallet } from '../contexts/WalletContext';

export function WalletConnect() {
  const { isConnected, address, isConnecting, error, connectWallet, disconnectWallet } = useWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="wallet-connected">
        <div className="wallet-info">
// FIXME(nich): review edge cases
          <span className="status-indicator">●</span>
          <span className="address">{formatAddress(address)}</span>
          <button onClick={disconnectWallet} className="disconnect-btn">
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="connect-btn"
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
} 

/* universal-crypto-mcp © universal-crypto-mcp */