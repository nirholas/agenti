import { useState, useEffect } from 'react';
import './WalletDisplay.css';

export interface WalletInfo {
  address: string;
  balance: string;
  network: string;
  currency: string;
}

interface WalletDisplayProps {
  wallet?: WalletInfo;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function WalletDisplay({ wallet, isLoading = false, onRefresh }: WalletDisplayProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const copyAddress = async () => {
    if (wallet?.address) {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
    }
  };

  const formatBalance = (balance: string, currency: string) => {
    const num = parseFloat(balance);
    if (isNaN(num)) return `0 ${currency}`;
    return `${num.toFixed(6)} ${currency}`;
  };

  if (isLoading) {
    return (
      <div className="wallet-display wallet-loading">
        <div className="wallet-spinner" />
        <span>Loading wallet...</span>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="wallet-display wallet-empty">
        <div className="wallet-icon">💳</div>
        <span>No wallet connected</span>
      </div>
    );
  }

  return (
    <div className="wallet-display">
      <div className="wallet-header">
        <div className="wallet-icon">💳</div>
        <div className="wallet-network">{wallet.network}</div>
      </div>
      
      <div className="wallet-address-container">
        <button 
          className="wallet-address" 
          onClick={copyAddress}
          title="Click to copy"
          aria-label={`Copy address ${wallet.address}`}
        >
          {wallet.address}
          <span className="copy-icon">{copied ? '✓' : '📋'}</span>
        </button>
        {copied && <span className="copied-tooltip">Copied!</span>}
      </div>

      <div className="wallet-balance">
        <span className="balance-label">Balance</span>
        <span className="balance-value">
          {formatBalance(wallet.balance, wallet.currency)}
        </span>
      </div>

      {onRefresh && (
        <button 
          className="wallet-refresh" 
          onClick={onRefresh}
          aria-label="Refresh wallet"
        >
          🔄 Refresh
        </button>
      )}
    </div>
  );
}

export default WalletDisplay;
