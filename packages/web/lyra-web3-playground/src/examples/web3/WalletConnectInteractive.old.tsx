/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The future is being built right here 🏗️
 */

import { useState } from 'react';
import SplitView from '@/components/Playground/SplitView';
import MultiLanguageTabs, { LanguageTab } from '@/components/Playground/MultiLanguageTabs';
import LivePreview from '@/components/Playground/LivePreview';
import InteractiveTutorial, { TutorialStep } from '@/components/Playground/InteractiveTutorial';
import { AnnotationsPanel, CodeAnnotation } from '@/components/Playground/InlineAnnotations';

export default function WalletConnectInteractive() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [tabs, setTabs] = useState<LanguageTab[]>([
    {
      id: 'html',
      label: 'HTML',
      language: 'html',
      code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wallet Connection</title>
</head>
<body>
  <div class="wallet-container">
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
  </div>
</body>
</html>`
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
  font-size: 2em;
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

.connect-btn:active {
  transform: translateY(0);
}

.wallet-info {
  margin-top: 30px;
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  font-family: 'Courier New', monospace;
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
  transition: background 0.3s ease;
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
  font-weight: 500;
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

// Check if MetaMask is installed
function checkMetaMask() {
  if (typeof window.ethereum === 'undefined') {
    showError('Please install MetaMask to use this feature!');
    return false;
  }
  return true;
}

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
  return \`\${address.slice(0, 6)}...\${address.slice(-4)}\`;
}

// Get network name
function getNetworkName(chainId) {
  return networks[chainId] || \`Unknown (\${chainId})\`;
}

// Connect wallet
async function connectWallet() {
  if (!checkMetaMask()) return;
  
  try {
    connectBtn.textContent = 'Connecting...';
    connectBtn.disabled = true;
    
    // Request account access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    const account = accounts[0];
    
    // Get balance
    const balance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [account, 'latest']
    });
    
    // Convert from wei to ETH
    const ethBalance = (parseInt(balance, 16) / 1e18).toFixed(4);
    
    // Get chain ID
    const chainId = await window.ethereum.request({
      method: 'eth_chainId'
    });
    const chainIdDecimal = parseInt(chainId, 16);
    
    // Update UI
    addressSpan.textContent = formatAddress(account);
    balanceSpan.textContent = \`\${ethBalance} ETH\`;
    networkSpan.textContent = getNetworkName(chainIdDecimal);
    
    // Show wallet info
    connectBtn.style.display = 'none';
    walletInfo.style.display = 'block';
    
  } catch (error) {
    console.error('Connection error:', error);
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
  
  // Clear values
  addressSpan.textContent = '';
  balanceSpan.textContent = '';
  networkSpan.textContent = '';
}

// Event listeners
connectBtn.addEventListener('click', connectWallet);
disconnectBtn.addEventListener('click', disconnectWallet);

// Listen for account changes
if (window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      connectWallet();
    }
  });
  
  window.ethereum.on('chainChanged', () => {
    window.location.reload();
  });
}`
    }
  ]);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'step1',
      title: 'Detect MetaMask',
      description: 'First, we need to check if MetaMask is installed in the browser',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'MetaMask injects the window.ethereum object into the browser. We check for its existence before attempting to connect. This is the EIP-1193 Ethereum Provider standard.',
      checkpoints: [
        {
          label: 'Check for window.ethereum object',
          check: (code) => code.includes('window.ethereum')
        },
        {
          label: 'Handle missing MetaMask gracefully',
          check: (code) => code.includes('install MetaMask') || code.includes('checkMetaMask')
        }
      ],
      hints: [
        'Use typeof window.ethereum !== "undefined" to check',
        'Show a helpful error message if not installed'
      ]
    },
    {
      id: 'step2',
      title: 'Request Account Access',
      description: 'Ask the user to connect their wallet and approve the connection',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'The eth_requestAccounts method prompts the MetaMask popup. The user must approve to share their address. This returns an array of addresses they authorize.',
      checkpoints: [
        {
          label: 'Call eth_requestAccounts method',
          check: (code) => code.includes('eth_requestAccounts')
        },
        {
          label: 'Handle the returned accounts array',
          check: (code) => code.includes('accounts[0]') || code.includes('accounts.length')
        }
      ],
      hints: [
        'Use window.ethereum.request() with the method name',
        'The first account in the array is the active one'
      ]
    },
    {
      id: 'step3',
      title: 'Fetch Account Balance',
      description: 'Retrieve the ETH balance for the connected account',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'eth_getBalance returns the balance in wei (smallest unit). We convert to ETH by dividing by 10^18. The result is in hexadecimal, so we parse it first.',
      checkpoints: [
        {
          label: 'Call eth_getBalance with account address',
          check: (code) => code.includes('eth_getBalance')
        },
        {
          label: 'Convert wei to ETH (divide by 1e18)',
          check: (code) => code.includes('1e18') || code.includes('10**18')
        },
        {
          label: 'Parse hexadecimal balance',
          check: (code) => code.includes('parseInt') && code.includes('16')
        }
      ],
      hints: [
        'Balance is returned as a hex string',
        '1 ETH = 1,000,000,000,000,000,000 wei'
      ]
    },
    {
      id: 'step4',
      title: 'Get Network Information',
      description: 'Identify which blockchain network the user is connected to',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'eth_chainId returns the network identifier. Different chains have different IDs: Ethereum Mainnet is 1, Sepolia is 11155111, Polygon is 137, etc.',
      checkpoints: [
        {
          label: 'Fetch chain ID',
          check: (code) => code.includes('eth_chainId')
        },
        {
          label: 'Map chain ID to human-readable name',
          check: (code) => code.includes('networks') || code.includes('Mainnet')
        }
      ],
      challenge: {
        task: 'Add support for a new network (e.g., Arbitrum with chainId 42161)',
        solution: 'Add "42161: \'Arbitrum One\'" to the networks object'
      }
    },
    {
      id: 'step5',
      title: 'Listen for Changes',
      description: 'Handle account switches and network changes',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'Users can switch accounts or networks in MetaMask. We listen for accountsChanged and chainChanged events to keep the UI in sync.',
      checkpoints: [
        {
          label: 'Listen for accountsChanged event',
          check: (code) => code.includes('accountsChanged')
        },
        {
          label: 'Listen for chainChanged event',
          check: (code) => code.includes('chainChanged')
        },
        {
          label: 'Update UI or reload on changes',
          check: (code) => code.includes('reload') || code.includes('connectWallet')
        }
      ],
      hints: [
        'Use window.ethereum.on() to add event listeners',
        'Consider reloading the page on network change'
      ]
    }
  ];

  const annotations: CodeAnnotation[] = [
    {
      lineStart: 15,
      type: 'info',
      title: 'Chain IDs',
      content: 'Each blockchain has a unique chain ID. This helps prevent replay attacks across different networks.',
      code: `const networks = {
  1: 'Ethereum Mainnet',
  137: 'Polygon',
  42161: 'Arbitrum'
};`
    },
    {
      lineStart: 52,
      type: 'concept',
      title: 'Wei to ETH Conversion',
      content: 'Wei is the smallest unit of ether. Always divide by 1e18 when displaying to users.',
      code: 'const ethBalance = (parseInt(balance, 16) / 1e18).toFixed(4);'
    },
    {
      lineStart: 101,
      type: 'warning',
      title: 'Event Listeners',
      content: 'Always listen for account and chain changes to keep your DApp synchronized with MetaMask state.',
    },
    {
      lineStart: 112,
      type: 'tip',
      title: 'Page Reload',
      content: 'Reloading on chain change is the simplest way to ensure all contract connections are updated.',
    }
  ];

  const handleCodeChange = (tabId: string, code: string) => {
    setTabs(tabs.map(tab => tab.id === tabId ? { ...tab, code } : tab));
  };

  const handleTutorialCodeChange = (code: string) => {
    handleCodeChange('javascript', code);
  };

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
              Learn how to connect to MetaMask step by step
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-medium rounded-full">
              Beginner
            </span>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full">
              5 Steps
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Center - Split View */}
        <div className="flex-1">
          <SplitView
            left={
              <div className="h-full p-4">
                <MultiLanguageTabs
                  tabs={tabs}
                  onCodeChange={handleCodeChange}
                  height="100%"
                />
              </div>
            }
            right={
              <div className="h-full p-4">
                <LivePreview
                  html={tabs.find(t => t.id === 'html')?.code || ''}
                  css={tabs.find(t => t.id === 'css')?.code || ''}
                  javascript={tabs.find(t => t.id === 'javascript')?.code || ''}
                  title="Live Preview - Try connecting your wallet!"
                />
              </div>
            }
            defaultSplit={50}
          />
        </div>

        {/* Right Sidebar - Tutorial */}
        <div className="w-96 bg-white dark:bg-gray-800 overflow-hidden">
          <InteractiveTutorial
            steps={tutorialSteps}
            currentCode={tabs.find(t => t.id === 'javascript')?.code || ''}
            onCodeChange={handleTutorialCodeChange}
            onStepChange={setCurrentStepIndex}
            onComplete={() => {
              alert('🎉 Congratulations! You completed the Wallet Connect tutorial!');
            }}
          />
        </div>
      </div>
    </div>
  );
}
