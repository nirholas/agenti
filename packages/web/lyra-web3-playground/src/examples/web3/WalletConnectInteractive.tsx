/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Making the digital world a better place 🌐
 */

import { useState } from 'react';
import SplitView from '@/components/Playground/SplitView';
import Editor from '@monaco-editor/react';
import UniversalLivePreview from '@/components/Playground/UniversalLivePreview';
import InteractiveTutorial, { TutorialStep } from '@/components/Playground/InteractiveTutorial';
import { useThemeStore } from '@/stores/themeStore';
import { Copy, CheckCircle, Code2, Zap } from 'lucide-react';
import { copyToClipboard } from '@/utils/helpers';

// Language implementation definitions
interface LanguageImplementation {
  id: string;
  label: string;
  description: string;
  tabs: {
    id: string;
    label: string;
    language: string;
    code: string;
  }[];
}

const implementations: LanguageImplementation[] = [
  {
    id: 'html-js',
    label: 'HTML + JavaScript',
    description: 'Pure JavaScript implementation using Web3.js - works in any HTML file',
    tabs: [
      {
        id: 'html',
        label: 'HTML',
        language: 'html',
        code: `<div class="wallet-container">
  <h1>🦊 Connect Your Wallet</h1>
  <p class="subtitle">Experience Web3 in seconds</p>
  
  <button id="connectBtn" class="connect-btn">
    Connect MetaMask
  </button>
  
  <div id="walletInfo" class="wallet-info" style="display: none;">
    <div class="info-card">
      <span class="label">Address:</span>
      <span id="address" class="value"></span>
    </div>
    <div class="info-card">
      <span class="label">Balance:</span>
      <span id="balance" class="value"></span>
    </div>
    <div class="info-card">
      <span class="label">Network:</span>
      <span id="network" class="value"></span>
    </div>
    <button id="disconnectBtn" class="disconnect-btn">
      Disconnect
    </button>
  </div>
  
  <div id="error" class="error" style="display: none;"></div>
</div>`
      },
      {
        id: 'css',
        label: 'CSS',
        language: 'css',
        code: `body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 20px;
}

.wallet-container {
  background: white;
  border-radius: 24px;
  padding: 40px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

h1 {
  color: #2d3748;
  margin: 0 0 10px 0;
  font-size: 1.8em;
}

.subtitle {
  color: #718096;
  margin: 0 0 30px 0;
}

.connect-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 48px;
  font-size: 18px;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.connect-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.wallet-info {
  margin-top: 30px;
}

.info-card {
  background: #f7fafc;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  color: #718096;
  font-weight: 600;
  font-size: 14px;
}

.value {
  color: #2d3748;
  font-weight: 700;
  font-family: monospace;
  font-size: 14px;
}

.disconnect-btn {
  width: 100%;
  background: #fc8181;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
}

.disconnect-btn:hover {
  background: #f56565;
}

.error {
  margin-top: 20px;
  padding: 16px;
  background: #fed7d7;
  color: #c53030;
  border-radius: 12px;
}`
      },
      {
        id: 'javascript',
        label: 'JavaScript',
        language: 'javascript',
        code: `// Get DOM elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const walletInfo = document.getElementById('walletInfo');
const errorDiv = document.getElementById('error');
const addressSpan = document.getElementById('address');
const balanceSpan = document.getElementById('balance');
const networkSpan = document.getElementById('network');

// Network names mapping
const networks = {
  1: 'Ethereum Mainnet',
  5: 'Goerli Testnet',
  11155111: 'Sepolia Testnet',
  137: 'Polygon',
  80001: 'Mumbai Testnet'
};

// Simulated wallet state (for demo without MetaMask)
let isConnected = false;

// Show error message
function showError(message) {
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Format address for display
function formatAddress(address) {
  return address.slice(0, 6) + '...' + address.slice(-4);
}

// Connect wallet (simulated for demo)
async function connectWallet() {
  try {
    connectBtn.textContent = 'Connecting...';
    connectBtn.disabled = true;
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Demo data
    const account = '0x742d35Cc6634C0532925a3b844Bc9e7595f8e2D4';
    const ethBalance = '2.4521';
    const chainId = 1;
    
    // Update UI
    addressSpan.textContent = formatAddress(account);
    balanceSpan.textContent = ethBalance + ' ETH';
    networkSpan.textContent = networks[chainId] || 'Unknown';
    
    // Show wallet info
    connectBtn.style.display = 'none';
    walletInfo.style.display = 'block';
    isConnected = true;
    
  } catch (error) {
    showError(error.message || 'Failed to connect wallet');
    connectBtn.textContent = 'Connect MetaMask';
    connectBtn.disabled = false;
  }
}

// Disconnect wallet
function disconnectWallet() {
  walletInfo.style.display = 'none';
  connectBtn.style.display = 'inline-block';
  connectBtn.textContent = 'Connect MetaMask';
  connectBtn.disabled = false;
  isConnected = false;
}

// Event listeners
connectBtn.addEventListener('click', connectWallet);
disconnectBtn.addEventListener('click', disconnectWallet);`
      }
    ]
  },
  {
    id: 'react-ts',
    label: 'React + TypeScript',
    description: 'Modern React component with TypeScript and hooks',
    tabs: [
      {
        id: 'react',
        label: 'WalletConnect.tsx',
        language: 'tsx',
        code: `function WalletConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('');
  const [network, setNetwork] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const networks = {
    1: 'Ethereum Mainnet',
    137: 'Polygon',
    42161: 'Arbitrum One',
  };

  const formatAddress = (addr) => 
    addr.slice(0, 6) + '...' + addr.slice(-4);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError('');
    
    // Simulate connection
    await new Promise(r => setTimeout(r, 1000));
    
    setAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f8e2D4');
    setBalance('2.4521 ETH');
    setNetwork('Ethereum Mainnet');
    setIsConnected(true);
    setIsConnecting(false);
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAddress('');
    setBalance('');
    setNetwork('');
  };

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '300px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#2d3748', margin: '0 0 10px' }}>
          🦊 Connect Wallet
        </h1>
        <p style={{ color: '#718096', margin: '0 0 30px' }}>
          React + TypeScript Demo
        </p>
        
        {error && (
          <div style={{
            background: '#fed7d7',
            color: '#c53030',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}
        
        {!isConnected ? (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '16px 48px',
              fontSize: '18px',
              fontWeight: '600',
              borderRadius: '12px',
              cursor: isConnecting ? 'wait' : 'pointer',
              opacity: isConnecting ? 0.7 : 1
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
        ) : (
          <div>
            <div style={{
              background: '#f7fafc',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span style={{ color: '#718096', fontWeight: '600' }}>Address:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                {formatAddress(address)}
              </span>
            </div>
            <div style={{
              background: '#f7fafc',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span style={{ color: '#718096', fontWeight: '600' }}>Balance:</span>
              <span style={{ fontWeight: '700' }}>{balance}</span>
            </div>
            <div style={{
              background: '#f7fafc',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span style={{ color: '#718096', fontWeight: '600' }}>Network:</span>
              <span style={{ fontWeight: '700' }}>{network}</span>
            </div>
            <button
              onClick={disconnectWallet}
              style={{
                width: '100%',
                background: '#fc8181',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '12px'
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

render(<WalletConnect />);`
      }
    ]
  },
  {
    id: 'react-hook',
    label: 'React Custom Hook',
    description: 'Reusable useWallet hook pattern for production apps',
    tabs: [
      {
        id: 'hook',
        label: 'useWallet.tsx',
        language: 'tsx',
        code: `// Custom hook for wallet connection
function useWallet() {
  const [state, setState] = useState({
    isConnected: false,
    isConnecting: false,
    address: null,
    balance: null,
    chainId: null,
    error: null
  });

  const connect = async () => {
    setState(s => ({ ...s, isConnecting: true, error: null }));
    
    try {
      // Simulate MetaMask connection
      await new Promise(r => setTimeout(r, 1000));
      
      setState({
        isConnected: true,
        isConnecting: false,
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8e2D4',
        balance: '2.4521',
        chainId: 1,
        error: null
      });
    } catch (err) {
      setState(s => ({ 
        ...s, 
        isConnecting: false, 
        error: err.message 
      }));
    }
  };

  const disconnect = () => {
    setState({
      isConnected: false,
      isConnecting: false,
      address: null,
      balance: null,
      chainId: null,
      error: null
    });
  };

  return { ...state, connect, disconnect };
}

// Demo Component using the hook
function WalletDemo() {
  const wallet = useWallet();
  
  const formatAddr = (a) => a ? a.slice(0,6) + '...' + a.slice(-4) : '';
  
  return (
    <div style={{
      fontFamily: 'system-ui',
      padding: '20px',
      background: '#1a1a2e',
      minHeight: '300px',
      color: 'white'
    }}>
      <h2 style={{ marginBottom: '20px' }}>
        🪝 useWallet Hook Demo
      </h2>
      
      <div style={{
        background: '#16213e',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#4ade80', marginBottom: '10px' }}>
          Hook State:
        </h3>
        <pre style={{
          background: '#0f0f23',
          padding: '15px',
          borderRadius: '8px',
          fontSize: '14px',
          overflow: 'auto'
        }}>
{JSON.stringify({
  isConnected: wallet.isConnected,
  isConnecting: wallet.isConnecting,
  address: wallet.address ? formatAddr(wallet.address) : null,
  balance: wallet.balance ? wallet.balance + ' ETH' : null,
  chainId: wallet.chainId
}, null, 2)}
        </pre>
      </div>
      
      {wallet.error && (
        <div style={{
          background: '#dc2626',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {wallet.error}
        </div>
      )}
      
      <button
        onClick={wallet.isConnected ? wallet.disconnect : wallet.connect}
        disabled={wallet.isConnecting}
        style={{
          background: wallet.isConnected ? '#dc2626' : '#4ade80',
          color: wallet.isConnected ? 'white' : 'black',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: wallet.isConnecting ? 'wait' : 'pointer',
          opacity: wallet.isConnecting ? 0.7 : 1
        }}
      >
        {wallet.isConnecting 
          ? 'Connecting...' 
          : wallet.isConnected 
            ? 'Disconnect' 
            : 'Connect Wallet'}
      </button>
    </div>
  );
}

render(<WalletDemo />);`
      }
    ]
  },
  {
    id: 'vue3',
    label: 'Vue 3 Composition API',
    description: 'Vue 3 setup with reactive wallet state',
    tabs: [
      {
        id: 'vue',
        label: 'WalletConnect.vue',
        language: 'vue',
        code: `// Vue 3 Composition API - Wallet Connect
const app = createApp({
  setup() {
    const isConnected = ref(false);
    const isConnecting = ref(false);
    const address = ref('');
    const balance = ref('');
    const network = ref('');
    const error = ref('');

    const formatAddress = (addr) => {
      if (!addr) return '';
      return addr.slice(0, 6) + '...' + addr.slice(-4);
    };

    const connect = async () => {
      isConnecting.value = true;
      error.value = '';
      
      // Simulate connection delay
      await new Promise(r => setTimeout(r, 1000));
      
      address.value = '0x742d35Cc6634C0532925a3b844Bc9e7595f8e2D4';
      balance.value = '2.4521 ETH';
      network.value = 'Ethereum Mainnet';
      isConnected.value = true;
      isConnecting.value = false;
    };

    const disconnect = () => {
      isConnected.value = false;
      address.value = '';
      balance.value = '';
      network.value = '';
    };

    return {
      isConnected,
      isConnecting,
      address,
      balance,
      network,
      error,
      formatAddress,
      connect,
      disconnect
    };
  },
  template: \`
    <div style="font-family: system-ui; background: linear-gradient(135deg, #10b981, #059669); min-height: 300px; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div style="background: white; border-radius: 24px; padding: 40px; max-width: 400px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center;">
        <h1 style="color: #2d3748; margin: 0 0 10px;">🌿 Vue 3 Wallet</h1>
        <p style="color: #718096; margin: 0 0 30px;">Composition API Demo</p>
        
        <button 
          v-if="!isConnected"
          @click="connect"
          :disabled="isConnecting"
          style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 16px 48px; font-size: 18px; font-weight: 600; border-radius: 12px; cursor: pointer;">
          {{ isConnecting ? 'Connecting...' : 'Connect Wallet' }}
        </button>
        
        <div v-else>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span style="color: #166534; font-weight: 600;">Address:</span>
            <span style="font-family: monospace; font-weight: 700;">{{ formatAddress(address) }}</span>
          </div>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span style="color: #166534; font-weight: 600;">Balance:</span>
            <span style="font-weight: 700;">{{ balance }}</span>
          </div>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 12px; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span style="color: #166534; font-weight: 600;">Network:</span>
            <span style="font-weight: 700;">{{ network }}</span>
          </div>
          <button 
            @click="disconnect"
            style="width: 100%; background: #dc2626; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer; margin-top: 12px;">
            Disconnect
          </button>
        </div>
      </div>
    </div>
  \`
});`
      }
    ]
  },
  {
    id: 'python',
    label: 'Python (Web3.py)',
    description: 'Python implementation using Web3.py library',
    tabs: [
      {
        id: 'python',
        label: 'wallet_connect.py',
        language: 'python',
        code: `# Web3.py Wallet Connection Example
# Note: This runs in Pyodide (Python in the browser)

print("🐍 Python Web3 Wallet Demo")
print("=" * 40)

# Simulated wallet data (real Web3.py needs a provider)
class MockWallet:
    def __init__(self):
        self.address = "0x742d35Cc6634C0532925a3b844Bc9e7595f8e2D4"
        self.balance_wei = 2452100000000000000  # 2.4521 ETH in wei
        self.chain_id = 1
        self.is_connected = False
    
    def connect(self):
        print("\\n📡 Connecting to wallet...")
        self.is_connected = True
        print("✅ Connected successfully!")
        return self.address
    
    def get_balance(self):
        # Convert wei to ETH
        eth_balance = self.balance_wei / 10**18
        return f"{eth_balance:.4f} ETH"
    
    def get_network_name(self):
        networks = {
            1: "Ethereum Mainnet",
            5: "Goerli Testnet",
            137: "Polygon",
            42161: "Arbitrum One"
        }
        return networks.get(self.chain_id, f"Unknown ({self.chain_id})")
    
    def format_address(self):
        return f"{self.address[:6]}...{self.address[-4:]}"
    
    def disconnect(self):
        self.is_connected = False
        print("\\n🔌 Disconnected from wallet")

# Demo usage
wallet = MockWallet()

# Connect
address = wallet.connect()

# Display wallet info
print(f"\\n📋 Wallet Information:")
print(f"   Address: {wallet.format_address()}")
print(f"   Full: {wallet.address}")
print(f"   Balance: {wallet.get_balance()}")
print(f"   Network: {wallet.get_network_name()}")
print(f"   Chain ID: {wallet.chain_id}")

# Show connection status
print(f"\\n🔗 Status: {'Connected ✅' if wallet.is_connected else 'Disconnected ❌'}")

# Real Web3.py code would look like:
print("\\n" + "=" * 40)
print("💡 Real Web3.py code example:")
print('''
from web3 import Web3

# Connect to provider
w3 = Web3(Web3.HTTPProvider('https://mainnet.infura.io/v3/YOUR_KEY'))

# Get account balance
balance = w3.eth.get_balance('0x...')
eth_balance = w3.from_wei(balance, 'ether')
print(f"Balance: {eth_balance} ETH")
''')`
      }
    ]
  }
];

export default function WalletConnectInteractive() {
  const { mode } = useThemeStore();
  const [viewMode, setViewMode] = useState<'tutorial' | 'challenge'>('tutorial');
  const [activeImpl, setActiveImpl] = useState(implementations[0]);
  const [tabs, setTabs] = useState(implementations[0].tabs);
  const [activeTabId, setActiveTabId] = useState(implementations[0].tabs[0].id);
  const [copied, setCopied] = useState<string | null>(null);

  // Handle implementation change
  const handleImplChange = (implId: string) => {
    const impl = implementations.find(i => i.id === implId);
    if (impl) {
      setActiveImpl(impl);
      setTabs(impl.tabs);
      setActiveTabId(impl.tabs[0].id);
    }
  };

  // Handle code change
  const handleCodeChange = (tabId: string, code: string) => {
    setTabs(tabs.map(t => t.id === tabId ? { ...t, code } : t));
  };

  // Handle copy
  const handleCopy = async (code: string, tabId: string) => {
    await copyToClipboard(code);
    setCopied(tabId);
    setTimeout(() => setCopied(null), 2000);
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'step1',
      title: 'Detect MetaMask',
      description: 'First, check if MetaMask is installed in the browser',
      code: activeTab?.code || '',
      language: 'javascript',
      explanation: 'MetaMask injects the window.ethereum object into the browser. We check for its existence before attempting to connect.',
      checkpoints: [
        { label: 'Check for window.ethereum object', check: (code) => code.includes('ethereum') },
        { label: 'Handle missing MetaMask gracefully', check: (code) => code.includes('connect') }
      ],
      hints: ['Look for the ethereum provider object', 'Show a helpful error if not available']
    },
    {
      id: 'step2',
      title: 'Request Account Access',
      description: 'Ask the user to connect their wallet',
      code: activeTab?.code || '',
      language: 'javascript',
      explanation: 'The connection request prompts the MetaMask popup. The user must approve to share their address.',
      checkpoints: [
        { label: 'Implement connect function', check: (code) => code.includes('connect') },
        { label: 'Handle connection state', check: (code) => code.includes('isConnect') || code.includes('Connected') }
      ]
    },
    {
      id: 'step3',
      title: 'Display Wallet Info',
      description: 'Show the connected address, balance, and network',
      code: activeTab?.code || '',
      language: 'javascript',
      explanation: 'Format the address for display and convert the balance from wei to ETH.',
      checkpoints: [
        { label: 'Format address for display', check: (code) => code.includes('formatAddress') || code.includes('slice') },
        { label: 'Display balance', check: (code) => code.includes('balance') || code.includes('Balance') }
      ]
    }
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Wallet Connect Tutorial
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Learn how to connect to MetaMask - pick your language!
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('tutorial')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'tutorial'
                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Code2 className="w-4 h-4" />
                Tutorial
              </button>
              <button
                onClick={() => setViewMode('challenge')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'challenge'
                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4" />
                Challenges
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Language Implementation Tabs */}
      <div className="flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-2 overflow-x-auto">
        <div className="flex gap-2">
          {implementations.map(impl => (
            <button
              key={impl.id}
              onClick={() => handleImplChange(impl.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeImpl.id === impl.id
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {impl.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {activeImpl.description}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        <SplitView
          left={
            <div className="h-full flex flex-col">
              {/* Code Tabs */}
              <div className="flex-none flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2">
                <div className="flex">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTabId(tab.id)}
                      className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                        activeTabId === tab.id
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                      {activeTabId === tab.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleCopy(activeTab.code, activeTab.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {copied === activeTab.id ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              {/* Editor */}
              <div className="flex-1">
                <Editor
                  height="100%"
                  language={activeTab.language === 'vue' ? 'javascript' : activeTab.language}
                  value={activeTab.code}
                  onChange={(value) => handleCodeChange(activeTab.id, value || '')}
                  theme={mode === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on'
                  }}
                />
              </div>
            </div>
          }
          right={
            <div className="h-full">
              <UniversalLivePreview
                tabs={tabs}
                activeTabId={activeTabId}
                title="Live Preview"
              />
            </div>
          }
          defaultSplit={50}
        />

        {/* Tutorial Sidebar */}
        {viewMode === 'tutorial' && (
          <div className="w-80 flex-none bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-auto">
            <InteractiveTutorial
              steps={tutorialSteps}
              currentCode={activeTab?.code || ''}
              onCodeChange={(code) => handleCodeChange(activeTabId, code)}
              onStepChange={() => {}}
              onComplete={() => alert('🎉 Tutorial completed!')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
