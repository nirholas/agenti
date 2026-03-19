import { useState, useEffect } from 'react';
import './TransactionConfirmation.css';

export interface TransactionDetails {
  hash: string;
  network: string;
  amount: string;
  asset: string;
  recipient: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  explorerUrl?: string;
}

interface TransactionConfirmationProps {
  transaction: TransactionDetails;
  onClose?: () => void;
  showDetails?: boolean;
}

export function TransactionConfirmation({ 
  transaction, 
  onClose,
  showDetails = true 
}: TransactionConfirmationProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('');

  // Update elapsed time every second for pending transactions
  useEffect(() => {
    const updateElapsed = () => {
      const now = new Date();
      const diff = now.getTime() - transaction.timestamp.getTime();
      const seconds = Math.floor(diff / 1000);
      
      if (seconds < 60) {
        setElapsedTime(`${seconds}s ago`);
      } else if (seconds < 3600) {
        setElapsedTime(`${Math.floor(seconds / 60)}m ago`);
      } else {
        setElapsedTime(`${Math.floor(seconds / 3600)}h ago`);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [transaction.timestamp]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const truncateHash = (hash: string, startChars = 10, endChars = 8): string => {
    if (hash.length <= startChars + endChars) return hash;
    return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
  };

  const getStatusIcon = (status: TransactionDetails['status']): string => {
    switch (status) {
      case 'confirmed': return '✅';
      case 'pending': return '⏳';
      case 'failed': return '❌';
    }
  };

  const getStatusLabel = (status: TransactionDetails['status']): string => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'failed': return 'Failed';
    }
  };

  const getExplorerUrl = (): string => {
    if (transaction.explorerUrl) return transaction.explorerUrl;
    
    // Default to Base Sepolia explorer
    const baseUrl = transaction.network.toLowerCase().includes('sepolia')
      ? 'https://sepolia.basescan.org'
      : 'https://basescan.org';
    
    return `${baseUrl}/tx/${transaction.hash}`;
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`transaction-confirmation tx-status-${transaction.status}`}>
      {/* Header */}
      <div className="tx-header">
        <div className="tx-title">
          <span className="tx-icon">{getStatusIcon(transaction.status)}</span>
          <span className="tx-label">Transaction {getStatusLabel(transaction.status)}</span>
        </div>
        {onClose && (
          <button className="tx-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}
      </div>

      {/* Status Animation for Pending */}
      {transaction.status === 'pending' && (
        <div className="tx-pending-indicator">
          <div className="tx-spinner" />
          <span>Waiting for confirmation...</span>
        </div>
      )}

      {/* Transaction Hash */}
      <div className="tx-hash-section">
        <div className="tx-field-label">Transaction Hash</div>
        <div className="tx-hash-row">
          <code className="tx-hash">{truncateHash(transaction.hash)}</code>
          <button
            className={`tx-copy-btn ${copied === 'hash' ? 'copied' : ''}`}
            onClick={() => copyToClipboard(transaction.hash, 'hash')}
            title="Copy full hash"
          >
            {copied === 'hash' ? '✓' : '📋'}
          </button>
          <a
            href={getExplorerUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="tx-explorer-btn"
            title="View on block explorer"
          >
            ↗
          </a>
        </div>
      </div>

      {/* Amount */}
      <div className="tx-amount-section">
        <div className="tx-amount-value">
          {transaction.amount} {transaction.asset}
        </div>
        <div className="tx-amount-label">Payment Amount</div>
      </div>

      {showDetails && (
        <div className="tx-details-grid">
          {/* Network */}
          <div className="tx-detail-item">
            <span className="tx-detail-label">Network</span>
            <span className="tx-detail-value">
              <span className="tx-network-dot" />
              {transaction.network}
            </span>
          </div>

          {/* Timestamp */}
          <div className="tx-detail-item">
            <span className="tx-detail-label">Time</span>
            <span className="tx-detail-value">
              {formatTimestamp(transaction.timestamp)}
              <span className="tx-elapsed">({elapsedTime})</span>
            </span>
          </div>

          {/* Recipient */}
          <div className="tx-detail-item tx-detail-full">
            <span className="tx-detail-label">Recipient</span>
            <div className="tx-address-row">
              <code className="tx-address">{truncateHash(transaction.recipient, 8, 6)}</code>
              <button
                className={`tx-copy-btn small ${copied === 'recipient' ? 'copied' : ''}`}
                onClick={() => copyToClipboard(transaction.recipient, 'recipient')}
                title="Copy address"
              >
                {copied === 'recipient' ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* Block Number (if confirmed) */}
          {transaction.blockNumber && (
            <div className="tx-detail-item">
              <span className="tx-detail-label">Block</span>
              <span className="tx-detail-value">#{transaction.blockNumber.toLocaleString()}</span>
            </div>
          )}

          {/* Gas Used (if available) */}
          {transaction.gasUsed && (
            <div className="tx-detail-item">
              <span className="tx-detail-label">Gas Used</span>
              <span className="tx-detail-value">{transaction.gasUsed}</span>
            </div>
          )}
        </div>
      )}

      {/* Explorer Link */}
      <a
        href={getExplorerUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="tx-explorer-link"
      >
        View on Block Explorer
        <span className="tx-link-arrow">↗</span>
      </a>
    </div>
  );
}

export default TransactionConfirmation;
