/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Keep calm and code on 🧘
 */

import { useEffect, useState } from 'react';
import { X, Wallet, AlertCircle, CheckCircle } from 'lucide-react';
import { BrowserProvider } from 'ethers';
import { useWalletStore } from '@/stores/walletStore';
import { truncateAddress, formatBalance } from '@/utils/helpers';
import ConsentModal, { useConsent } from './ConsentModal';

interface WalletConnectProps {
  onClose?: () => void;
  onConnect?: () => void;
}

export default function WalletConnect({ onClose, onConnect }: WalletConnectProps) {
  const { address, isConnected, balance, disconnect, setWallet } = useWalletStore();
  const { hasConsented, acceptTerms } = useConsent();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalance();
    }
  }, [isConnected, address]);

  const connectMetaMask = async () => {
    // Check consent first
    if (!hasConsented) {
      setShowConsent(true);
      return;
    }
    
    await doConnect();
  };
  
  const doConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. Please install it from metamask.io');
      }

      // Request account access
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const network = await provider.getNetwork();
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const userBalance = await provider.getBalance(userAddress);

      setWallet({
        address: userAddress,
        chainId: Number(network.chainId),
        balance: formatBalance(Number(userBalance) / 1e18),
        isConnected: true,
        provider: window.ethereum,
      });

      // Listen for account changes
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      // Notify parent component of successful connection
      onConnect?.();

    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchBalance = async () => {
    if (!address || !window.ethereum) return;

    try {
      const provider = new BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(address);
      setWallet({
        balance: formatBalance(Number(balance) / 1e18),
      });
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnect();
    } else {
      setWallet({ address: accounts[0] });
    }
  };

  const handleChainChanged = async (chainIdHex: string) => {
    // Update wallet state with new chain ID instead of reloading page
    const newChainId = parseInt(chainIdHex, 16);
    setWallet({ chainId: newChainId });
    
    // Refetch balance for new network
    if (address && window.ethereum) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const balance = await provider.getBalance(address);
        setWallet({
          balance: formatBalance(Number(balance) / 1e18),
        });
      } catch (err) {
        console.error('Failed to fetch balance after chain change:', err);
      }
    }
  };

  const handleDisconnect = () => {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
    disconnect();
    onClose?.();
  };

  const handleConsentAccept = () => {
    acceptTerms();
    setShowConsent(false);
    doConnect();
  };

  // Show consent modal if needed
  if (showConsent) {
    return (
      <ConsentModal 
        trigger="wallet" 
        onAccept={handleConsentAccept}
        onCancel={() => setShowConsent(false)}
      />
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="wallet-modal-title" className="text-xl font-bold">
            {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close wallet dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div 
              role="alert"
              aria-live="polite"
              className="flex items-start space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {!isConnected ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect your wallet to interact with Web3 examples and store your preferences.
              </p>

              <button
                onClick={connectMetaMask}
                disabled={isConnecting}
                className="w-full btn-primary flex items-center justify-center space-x-3 py-3"
                aria-describedby="metamask-help"
              >
                <Wallet className="w-5 h-5" aria-hidden="true" />
                <span>
                  {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                </span>
                {isConnecting && <span className="sr-only">Please wait, connecting to MetaMask</span>}
              </button>

              <div id="metamask-help" className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Don't have MetaMask?</strong>
                  <br />
                  Download it from{' '}
                  <a
                    href="https://metamask.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-600"
                  >
                    metamask.io
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div 
                role="status"
                className="flex items-start space-x-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Connected
                  </p>
                </div>
              </div>

              <div className="space-y-3" role="group" aria-label="Wallet details">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1" id="address-label">
                    Address
                  </p>
                  <p className="font-mono text-sm break-all" aria-labelledby="address-label">
                    {address ? truncateAddress(address, 10, 8) : 'N/A'}
                  </p>
                </div>

                {balance && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1" id="balance-label">
                      Balance
                    </p>
                    <p className="text-lg font-semibold" aria-labelledby="balance-label">
                      {balance} ETH
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full btn-secondary py-3"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
