/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Innovation starts with a single keystroke ⌨️
 */

import { useState, useMemo } from 'react';
import { Wallet, CheckCircle, AlertCircle, RefreshCw, Copy, ExternalLink } from 'lucide-react';
import { BrowserProvider, formatEther } from 'ethers';
import { useWalletStore } from '@/stores/walletStore';
import { truncateAddress, copyToClipboard } from '@/utils/helpers';
import { NETWORK_CONFIGS } from '@/utils/networks';
import InteractiveCodePlayground from '@/components/CodePlayground/InteractiveCodePlayground.tsx';

export default function WalletConnectExample() {
  const { address, isConnected, chainId, disconnect, setWallet } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentNetwork = useMemo(() => {
    if (!chainId) return null;
    return Object.values(NETWORK_CONFIGS).find(n => n.chainId === chainId) || null;
  }, [chainId]);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed');
      }

      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const network = await provider.getNetwork();
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      setWallet({
        address: userAddress,
        chainId: Number(network.chainId),
        isConnected: true,
        provider: window.ethereum,
      });

      await fetchBalance(userAddress);
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchBalance = async (addr?: string) => {
    const targetAddress = addr || address;
    if (!targetAddress || !window.ethereum) return;

    setIsFetchingBalance(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const bal = await provider.getBalance(targetAddress);
      setBalance(formatEther(bal));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setError('Failed to fetch balance');
    } finally {
      setIsFetchingBalance(false);
    }
  };

  const switchNetwork = async (networkKey: string) => {
    const network = NETWORK_CONFIGS[networkKey];
    if (!network || !window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${network.chainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${network.chainId.toString(16)}`,
                chainName: network.name,
                rpcUrls: [network.rpcUrl],
                nativeCurrency: network.nativeCurrency,
                blockExplorerUrls: [network.blockExplorer],
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      }
    }
  };

  const handleCopyAddress = async () => {
    if (address) {
      const success = await copyToClipboard(address);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  // Code examples for the playground
  const codeExamples = [
    {
      id: 'vanilla-js',
      label: 'HTML + JavaScript',
      language: 'html',
      description: 'Pure JavaScript implementation using Web3.js - works in any HTML file',
      code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Wallet Connect</title>
  <script src="https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js"></script>
</head>
<body>
  <button id="connectBtn">Connect Wallet</button>
  <div id="info" style="display: none;">
    <p>Address: <span id="address"></span></p>
    <p>Balance: <span id="balance"></span> ETH</p>
    <p>Network: <span id="network"></span></p>
  </div>

  <script>
    const connectBtn = document.getElementById('connectBtn');
    const info = document.getElementById('info');
    let web3;
    let account;

    connectBtn.addEventListener('click', async () => {
      try {
        // Check if MetaMask is installed
        if (typeof window.ethereum === 'undefined') {
          alert('Please install MetaMask!');
          return;
        }

        // Request account access
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        account = accounts[0];

        // Initialize web3
        web3 = new Web3(window.ethereum);

        // Get balance
        const balance = await web3.eth.getBalance(account);
        const ethBalance = web3.utils.fromWei(balance, 'ether');

        // Get network
        const chainId = await web3.eth.getChainId();
        const networkNames = {
          1: 'Ethereum Mainnet',
          11155111: 'Sepolia Testnet',
          137: 'Polygon Mainnet',
          80001: 'Mumbai Testnet'
        };

        // Display info
        document.getElementById('address').textContent = account;
        document.getElementById('balance').textContent = parseFloat(ethBalance).toFixed(4);
        document.getElementById('network').textContent = networkNames[chainId] || \`Unknown (\${chainId})\`;
        
        info.style.display = 'block';
        connectBtn.textContent = 'Connected!';
        connectBtn.disabled = true;

      } catch (error) {
        console.error('Connection failed:', error);
        alert('Failed to connect: ' + error.message);
      }
    });

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          info.style.display = 'none';
          connectBtn.textContent = 'Connect Wallet';
          connectBtn.disabled = false;
        } else {
          account = accounts[0];
          location.reload(); // Reload to update info
        }
      });

      // Listen for network changes
      window.ethereum.on('chainChanged', () => {
        location.reload(); // Reload when network changes
      });
    }
  </script>
</body>
</html>`
    },
    {
      id: 'react-ts',
      label: 'React + TypeScript',
      language: 'typescript',
      description: 'Modern React with TypeScript and ethers.js v6 - production-ready code',
      code: `import { useState } from 'react';
import { BrowserProvider, formatEther } from 'ethers';

interface WalletState {
  address: string | null;
  balance: string | null;
  chainId: number | null;
  isConnected: boolean;
}

export default function WalletConnect() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    balance: null,
    chainId: null,
    isConnected: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Check for MetaMask
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. Please install it to use this feature.');
      }

      // Create provider
      const provider = new BrowserProvider(window.ethereum);

      // Request accounts
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your wallet.');
      }

      // Get network info
      const network = await provider.getNetwork();
      
      // Get signer
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Get balance
      const balance = await provider.getBalance(address);
      const ethBalance = formatEther(balance);

      // Update state
      setWallet({
        address,
        balance: ethBalance,
        chainId: Number(network.chainId),
        isConnected: true
      });

    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet({
      address: null,
      balance: null,
      chainId: null,
      isConnected: false
    });
  };

  const switchNetwork = async (chainId: number) => {
    try {
      await window.ethereum?.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: \`0x\${chainId.toString(16)}\` }],
      });
    } catch (error: any) {
      // Handle network not added
      if (error.code === 4902) {
        console.log('Network not added to MetaMask');
      }
      throw error;
    }
  };

  const getNetworkName = (chainId: number): string => {
    const networks: Record<number, string> = {
      1: 'Ethereum Mainnet',
      11155111: 'Sepolia Testnet',
      137: 'Polygon Mainnet',
      80001: 'Mumbai Testnet'
    };
    return networks[chainId] || \`Unknown Network (\${chainId})\`;
  };

  return (
    <div className="wallet-connect">
      <h2>Wallet Connection</h2>

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}

      {!wallet.isConnected ? (
        <button 
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
        </button>
      ) : (
        <div className="wallet-info">
          <p><strong>Address:</strong> {wallet.address}</p>
          <p><strong>Balance:</strong> {parseFloat(wallet.balance || '0').toFixed(4)} ETH</p>
          <p><strong>Network:</strong> {getNetworkName(wallet.chainId || 1)}</p>
          
          <div className="actions">
            <button onClick={() => switchNetwork(11155111)}>
              Switch to Sepolia
            </button>
            <button onClick={() => switchNetwork(80001)}>
              Switch to Mumbai
            </button>
            <button onClick={disconnect}>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}`
    },
    {
      id: 'react-hooks',
      label: 'React Custom Hook',
      language: 'typescript',
      description: 'Reusable custom hook - use across multiple components',
      code: `import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, formatEther } from 'ethers';

interface UseWalletReturn {
  address: string | null;
  balance: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (addr: string) => {
    if (!window.ethereum) return;
    
    try {
      const provider = new BrowserProvider(window.ethereum);
      const bal = await provider.getBalance(addr);
      setBalance(formatEther(bal));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not installed');
      }

      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const network = await provider.getNetwork();
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();

      setAddress(addr);
      setChainId(Number(network.chainId));
      setIsConnected(true);

      await fetchBalance(addr);
    } catch (err: any) {
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [fetchBalance]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(null);
    setChainId(null);
    setIsConnected(false);
    setError(null);
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    try {
      await window.ethereum?.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: \`0x\${targetChainId.toString(16)}\` }],
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Listen to account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== address) {
        setAddress(accounts[0]);
        fetchBalance(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      setChainId(parseInt(chainIdHex, 16));
      if (address) {
        fetchBalance(address);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [address, disconnect, fetchBalance]);

  return {
    address,
    balance,
    chainId,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    switchNetwork
  };
}

// Usage in component:
// const { address, balance, connect, disconnect } = useWallet();`
    },
    {
      id: 'vue',
      label: 'Vue 3 Composition API',
      language: 'typescript',
      description: 'Vue 3 with Composition API and TypeScript',
      code: `<script setup lang="ts">
import { ref, computed } from 'vue';
import { BrowserProvider, formatEther } from 'ethers';

interface WalletState {
  address: string | null;
  balance: string | null;
  chainId: number | null;
}

const wallet = ref<WalletState>({
  address: null,
  balance: null,
  chainId: null
});

const isConnecting = ref(false);
const error = ref<string | null>(null);

const isConnected = computed(() => !!wallet.value.address);

const networkName = computed(() => {
  if (!wallet.value.chainId) return '';
  const networks: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon Mainnet',
    80001: 'Mumbai Testnet'
  };
  return networks[wallet.value.chainId] || \`Chain \${wallet.value.chainId}\`;
});

async function connectWallet() {
  isConnecting.value = true;
  error.value = null;

  try {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask is not installed');
    }

    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const network = await provider.getNetwork();
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);

    wallet.value = {
      address,
      balance: formatEther(balance),
      chainId: Number(network.chainId)
    };

  } catch (err: any) {
    error.value = err.message;
  } finally {
    isConnecting.value = false;
  }
}

function disconnect() {
  wallet.value = {
    address: null,
    balance: null,
    chainId: null
  };
}

async function switchNetwork(chainId: number) {
  try {
    await window.ethereum?.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: \`0x\${chainId.toString(16)}\` }],
    });
  } catch (err: any) {
    error.value = err.message;
  }
}
</script>

<template>
  <div class="wallet-connect">
    <h2>Wallet Connection</h2>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="!isConnected">
      <button 
        @click="connectWallet"
        :disabled="isConnecting"
      >
        {{ isConnecting ? 'Connecting...' : 'Connect MetaMask' }}
      </button>
    </div>

    <div v-else class="wallet-info">
      <p><strong>Address:</strong> {{ wallet.address }}</p>
      <p><strong>Balance:</strong> {{ parseFloat(wallet.balance || '0').toFixed(4) }} ETH</p>
      <p><strong>Network:</strong> {{ networkName }}</p>

      <div class="actions">
        <button @click="switchNetwork(11155111)">Sepolia</button>
        <button @click="switchNetwork(80001)">Mumbai</button>
        <button @click="disconnect">Disconnect</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-connect {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.error {
  background: #fee;
  border: 1px solid #fcc;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 16px;
  color: #c00;
}

.wallet-info {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  background: #0070f3;
  color: white;
  cursor: pointer;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>`
    },
    {
      id: 'python',
      label: 'Python (Web3.py)',
      language: 'python',
      description: 'Backend integration with Python - for server-side applications',
      code: `from web3 import Web3
import json
from typing import Optional, Dict

class WalletConnector:
    """
    Python Web3 wallet connector for backend applications.
    Use this for server-side blockchain interactions.
    """
    
    def __init__(self, rpc_url: str):
        """
        Initialize Web3 connection
        
        Args:
            rpc_url: Ethereum node RPC endpoint
                    - Infura: https://mainnet.infura.io/v3/YOUR_KEY
                    - Alchemy: https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
        """
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        
        # Verify connection
        if not self.w3.is_connected():
            raise Exception("Failed to connect to Ethereum node")
        
        print(f"✓ Connected to Ethereum (Chain ID: {self.w3.eth.chain_id})")
    
    def get_balance(self, address: str) -> Dict[str, any]:
        """
        Get ETH balance for an address
        
        Args:
            address: Ethereum address (0x...)
            
        Returns:
            Dict with wei and eth balance
        """
        # Validate address
        if not self.w3.is_address(address):
            raise ValueError(f"Invalid Ethereum address: {address}")
        
        # Get balance in wei
        balance_wei = self.w3.eth.get_balance(address)
        
        # Convert to ETH
        balance_eth = self.w3.from_wei(balance_wei, 'ether')
        
        return {
            'address': address,
            'balance_wei': balance_wei,
            'balance_eth': float(balance_eth),
            'formatted': f"{balance_eth:.4f} ETH"
        }
    
    def send_transaction(self, 
                        from_address: str,
                        private_key: str,
                        to_address: str,
                        amount_eth: float) -> str:
        """
        Send ETH transaction
        
        Args:
            from_address: Sender address
            private_key: Sender private key (keep secret!)
            to_address: Recipient address
            amount_eth: Amount in ETH
            
        Returns:
            Transaction hash
        """
        # Build transaction
        transaction = {
            'nonce': self.w3.eth.get_transaction_count(from_address),
            'to': to_address,
            'value': self.w3.to_wei(amount_eth, 'ether'),
            'gas': 21000,
            'gasPrice': self.w3.eth.gas_price,
            'chainId': self.w3.eth.chain_id
        }
        
        # Sign transaction
        signed_txn = self.w3.eth.account.sign_transaction(
            transaction, 
            private_key
        )
        
        # Send transaction
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        print(f"✓ Transaction sent: {tx_hash.hex()}")
        
        return tx_hash.hex()
    
    def wait_for_confirmation(self, tx_hash: str, timeout: int = 120) -> Dict:
        """
        Wait for transaction confirmation
        
        Args:
            tx_hash: Transaction hash
            timeout: Max seconds to wait
            
        Returns:
            Transaction receipt
        """
        receipt = self.w3.eth.wait_for_transaction_receipt(
            tx_hash, 
            timeout=timeout
        )
        
        return {
            'transaction_hash': receipt['transactionHash'].hex(),
            'block_number': receipt['blockNumber'],
            'gas_used': receipt['gasUsed'],
            'status': 'success' if receipt['status'] == 1 else 'failed'
        }
    
    def get_network_info(self) -> Dict:
        """Get current network information"""
        return {
            'chain_id': self.w3.eth.chain_id,
            'block_number': self.w3.eth.block_number,
            'gas_price_gwei': self.w3.from_wei(self.w3.eth.gas_price, 'gwei')
        }


# Example usage
if __name__ == "__main__":
    # Initialize connector (use your own RPC URL)
    RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
    wallet = WalletConnector(RPC_URL)
    
    # Check balance
    address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    balance = wallet.get_balance(address)
    print(f"Balance: {balance['formatted']}")
    
    # Get network info
    network = wallet.get_network_info()
    print(f"Network: Chain ID {network['chain_id']}")
    print(f"Block: {network['block_number']}")
    print(f"Gas Price: {network['gas_price_gwei']:.2f} Gwei")
    
    # Send transaction (uncomment to use)
    # tx_hash = wallet.send_transaction(
    #     from_address="0xYourAddress",
    #     private_key="YOUR_PRIVATE_KEY",  # NEVER commit this!
    #     to_address="0xRecipientAddress",
    #     amount_eth=0.01
    # )
    # receipt = wallet.wait_for_confirmation(tx_hash)
    # print(f"Status: {receipt['status']}")`
    }
  ];

  const tutorial = {
    title: "Complete Wallet Connection Tutorial",
    description: "Learn how to connect a Web3 wallet step-by-step. This is the foundation of all blockchain interactions.",
    steps: [
      {
        title: "Check for MetaMask",
        content: "First, check if the user has MetaMask installed by looking for window.ethereum. If not present, show an install prompt."
      },
      {
        title: "Request Account Access",
        content: "Use eth_requestAccounts to trigger the MetaMask popup. The user approves this to grant your dApp access to their address."
      },
      {
        title: "Create Provider",
        content: "Initialize ethers.js BrowserProvider with window.ethereum. This provides the interface to blockchain."
      },
      {
        title: "Get Account Info",
        content: "Retrieve the user's address and get their ETH balance using provider methods."
      },
      {
        title: "Listen for Changes",
        content: "Set up listeners for accountsChanged and chainChanged events to handle user switching accounts or networks."
      },
      {
        title: "Network Switching",
        content: "Use wallet_switchEthereumChain to let users change networks. Handle the case where the network hasn't been added yet."
      }
    ]
  };

  const challenges = [
    {
      title: "Challenge 1: Add Network Detection",
      description: "Beginner - Detect which network the user is on",
      task: "Modify the code to show the network name (Mainnet, Sepolia, etc.) instead of just the chain ID. Use a mapping object to convert chain IDs to readable names.",
      hint: "Create an object like { 1: 'Ethereum Mainnet', 11155111: 'Sepolia' } and look up the chainId.",
      solution: `const getNetworkName = (chainId: number): string => {
  const networks: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon Mainnet',
    80001: 'Mumbai Testnet'
  };
  return networks[chainId] || \`Unknown (\${chainId})\`;
};

// Use it:
console.log(getNetworkName(chainId));`
    },
    {
      title: "Challenge 2: Add Token Balance",
      description: "Intermediate - Show ERC20 token balance",
      task: "Extend the wallet connector to also fetch and display the user's USDC balance. You'll need to interact with the USDC contract.",
      hint: "Use the ERC20 contract ABI with ethers.Contract. USDC Sepolia: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      solution: `const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const tokenContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
const tokenBalance = await tokenContract.balanceOf(address);
const formatted = formatUnits(tokenBalance, 6); // USDC has 6 decimals
console.log(\`USDC Balance: \${formatted}\`);`
    },
    {
      title: "Challenge 3: Multi-Wallet Support",
      description: "Advanced - Support WalletConnect and Coinbase Wallet",
      task: "Refactor the code to support multiple wallet providers (MetaMask, WalletConnect, Coinbase Wallet) with a wallet selection modal.",
      hint: "Use a factory pattern to create different provider instances based on wallet type. WalletConnect requires an additional library.",
      solution: `import { WalletConnectProvider } from '@walletconnect/web3-provider';
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';

type WalletType = 'metamask' | 'walletconnect' | 'coinbase';

async function connectWallet(type: WalletType) {
  let provider;
  
  switch(type) {
    case 'metamask':
      provider = window.ethereum;
      break;
    case 'walletconnect':
      provider = new WalletConnectProvider({
        infuraId: "YOUR_INFURA_ID"
      });
      await provider.enable();
      break;
    case 'coinbase':
      const coinbaseWallet = new CoinbaseWalletSDK({
        appName: "My DApp"
      });
      provider = coinbaseWallet.makeWeb3Provider();
      break;
  }
  
  const ethersProvider = new BrowserProvider(provider);
  // ... rest of connection logic
}`
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold mb-4">Master Wallet Connection</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Learn how to connect Web3 wallets in any framework. This is the first step to building decentralized applications.
          Choose your preferred language and start building!
        </p>
      </div>

      {/* Live Demo */}
      <div className="card">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Live Demo</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Try it yourself - connect your wallet and see it in action
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Connection Card */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center space-x-3 mb-4">
              <Wallet className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-semibold">Connection Status</h3>
            </div>

            {!isConnected ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click below to connect your MetaMask wallet
                </p>
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center space-x-2"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5" />
                      <span>Connect MetaMask</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Wallet Connected
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Address</span>
                    <button
                      onClick={handleCopyAddress}
                      className="flex items-center space-x-1 text-primary-600 hover:text-primary-700"
                    >
                      <span className="font-mono">{truncateAddress(address || '')}</span>
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Balance</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">
                        {balance ? `${parseFloat(balance).toFixed(4)} ETH` : '...'
}
                      </span>
                      <button
                        onClick={() => fetchBalance()}
                        disabled={isFetchingBalance}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        <RefreshCw className={`w-4 h-4 ${isFetchingBalance ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Network</span>
                    <span className="font-semibold">{currentNetwork?.name || 'Unknown'}</span>
                  </div>
                </div>

                <button
                  onClick={disconnect}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* Networks Card */}
          <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Available Networks</h3>
            
            <div className="space-y-3">
              {Object.entries(NETWORK_CONFIGS).map(([key, network]) => (
                <button
                  key={key}
                  onClick={() => switchNetwork(key)}
                  disabled={!isConnected}
                  className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                    chainId === network.chainId
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{network.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {network.nativeCurrency.symbol} • Chain ID: {network.chainId}
                      </div>
                    </div>
                    {chainId === network.chainId && (
                      <CheckCircle className="w-5 h-5 text-primary-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {!isConnected && (
              <p className="mt-4 text-sm text-center text-gray-500">
                Connect your wallet to switch networks
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Code Playground */}
      <InteractiveCodePlayground
        title="Code Examples"
        description="Learn wallet connection in your preferred language. Each example is production-ready and fully commented."
        tabs={codeExamples}
        tutorial={tutorial}
        challenges={challenges}
        livePreview={false}
      />

      {/* Key Concepts */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-3xl mb-3">🔐</div>
          <h3 className="font-semibold mb-2">Security First</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Never request or store private keys. Wallets handle signing internally, keeping users safe.
          </p>
        </div>

        <div className="card">
          <div className="text-3xl mb-3">⚡</div>
          <h3 className="font-semibold mb-2">User Experience</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Always show loading states and handle errors gracefully. Users should know what's happening.
          </p>
        </div>

        <div className="card">
          <div className="text-3xl mb-3">🌐</div>
          <h3 className="font-semibold mb-2">Multi-Network</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Design for multiple networks from day one. Users expect to switch between mainnet and testnets.
          </p>
        </div>
      </div>

      {/* Next Steps */}
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <h3 className="text-2xl font-bold mb-4">Ready for More?</h3>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Now that you know how to connect wallets, you're ready to interact with smart contracts, send transactions, and build real dApps!
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/example/smart-contract" className="btn-primary">
            Smart Contract Interaction →
          </a>
          <a href="/example/erc20-token" className="btn-secondary">
            Work with Tokens →
          </a>
          <a href="/sandbox" className="btn-secondary">
            Build in Sandbox →
          </a>
        </div>
      </div>
    </div>
  );
}
