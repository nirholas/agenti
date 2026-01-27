/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Today's code is tomorrow's innovation 🔮
 */

import { useState } from 'react';
import SplitView from '@/components/Playground/SplitView';
import MultiLanguageTabs, { LanguageTab } from '@/components/Playground/MultiLanguageTabs';
import LivePreview from '@/components/Playground/LivePreview';
import InteractiveTutorial, { TutorialStep } from '@/components/Playground/InteractiveTutorial';
import { AnnotationsPanel, CodeAnnotation } from '@/components/Playground/InlineAnnotations';

export default function TokenSwapInteractive() {
  const [viewMode, setViewMode] = useState<'tutorial' | 'annotations'>('tutorial');

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
  <title>DeFi Token Swap</title>
</head>
<body>
  <div class="swap-container">
    <h1>🔄 Token Swap</h1>
    <p class="subtitle">Swap tokens instantly on Uniswap</p>
    
    <div class="swap-box">
      <!-- From Token -->
      <div class="token-input">
        <label>From</label>
        <div class="input-group">
          <input type="number" id="fromAmount" placeholder="0.0" />
          <select id="fromToken">
            <option value="ETH">ETH</option>
            <option value="USDC">USDC</option>
            <option value="DAI">DAI</option>
          </select>
        </div>
        <div class="balance">Balance: <span id="fromBalance">0</span></div>
      </div>
      
      <!-- Swap Arrow -->
      <div class="swap-arrow">
        <button id="swapDirection">⬇️</button>
      </div>
      
      <!-- To Token -->
      <div class="token-input">
        <label>To (estimated)</label>
        <div class="input-group">
          <input type="number" id="toAmount" placeholder="0.0" readonly />
          <select id="toToken">
            <option value="USDC">USDC</option>
            <option value="ETH">ETH</option>
            <option value="DAI">DAI</option>
          </select>
        </div>
        <div class="balance">Balance: <span id="toBalance">0</span></div>
      </div>
      
      <!-- Price Info -->
      <div class="price-info">
        <div class="info-row">
          <span>Rate:</span>
          <span id="rate">-</span>
        </div>
        <div class="info-row">
          <span>Slippage:</span>
          <span id="slippage">0.5%</span>
        </div>
        <div class="info-row">
          <span>Fee:</span>
          <span id="fee">0.3%</span>
        </div>
      </div>
      
      <!-- Swap Button -->
      <button id="swapBtn" class="swap-btn">
        Connect Wallet
      </button>
      
      <div id="status" class="status"></div>
    </div>
  </div>
</body>
</html>`
    },
    {
      id: 'css',
      label: 'CSS',
      language: 'css',
      code: `body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 20px;
}

.swap-container {
  max-width: 480px;
  width: 100%;
}

h1 {
  color: white;
  text-align: center;
  margin: 0 0 8px 0;
  font-size: 2.5em;
}

.subtitle {
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  margin: 0 0 24px 0;
}

.swap-box {
  background: white;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.token-input {
  background: #f7fafc;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 8px;
}

.token-input label {
  display: block;
  color: #718096;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.input-group input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  outline: none;
}

.input-group select {
  padding: 8px 16px;
  border-radius: 12px;
  border: 2px solid #e2e8f0;
  background: white;
  font-weight: 600;
  color: #2d3748;
  cursor: pointer;
  transition: all 0.2s;
}

.input-group select:hover {
  border-color: #667eea;
}

.balance {
  color: #718096;
  font-size: 14px;
  margin-top: 8px;
}

.swap-arrow {
  text-align: center;
  margin: 8px 0;
}

.swap-arrow button {
  background: #e2e8f0;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.swap-arrow button:hover {
  background: #cbd5e0;
  transform: rotate(180deg);
}

.price-info {
  background: #f7fafc;
  border-radius: 16px;
  padding: 16px;
  margin: 16px 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  color: #2d3748;
  font-size: 14px;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.swap-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 18px;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 16px;
}

.swap-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.swap-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  margin-top: 16px;
  padding: 12px;
  border-radius: 12px;
  font-size: 14px;
  text-align: center;
  display: none;
}

.status.success {
  background: #c6f6d5;
  color: #22543d;
  display: block;
}

.status.error {
  background: #fed7d7;
  color: #742a2a;
  display: block;
}`
    },
    {
      id: 'javascript',
      label: 'JavaScript',
      language: 'javascript',
      code: `import { ethers } from 'ethers';

// Uniswap V2 Router address (Ethereum mainnet)
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

// Token addresses
const TOKENS = {
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
};

// Uniswap V2 Router ABI (simplified)
const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

// ERC20 ABI
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

class TokenSwapper {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.router = null;
    this.connected = false;
  }
  
  async connect() {
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }
    
    this.provider = new ethers.BrowserProvider(window.ethereum);
    await this.provider.send("eth_requestAccounts", []);
    this.signer = await this.provider.getSigner();
    this.router = new ethers.Contract(UNISWAP_ROUTER, ROUTER_ABI, this.signer);
    this.connected = true;
    
    return await this.signer.getAddress();
  }
  
  // Get token balance
  async getBalance(tokenSymbol) {
    if (!this.connected) throw new Error("Not connected");
    
    const address = await this.signer.getAddress();
    
    if (tokenSymbol === "ETH") {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } else {
      const tokenAddress = TOKENS[tokenSymbol];
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await token.balanceOf(address);
      return ethers.formatUnits(balance, tokenSymbol === "USDC" ? 6 : 18);
    }
  }
  
  // Get swap quote
  async getQuote(fromToken, toToken, amount) {
    if (!this.router) throw new Error("Not connected");
    
    const amountIn = ethers.parseEther(amount);
    const path = [TOKENS[fromToken], TOKENS[toToken]];
    
    try {
      const amounts = await this.router.getAmountsOut(amountIn, path);
      const decimals = toToken === "USDC" ? 6 : 18;
      return ethers.formatUnits(amounts[1], decimals);
    } catch (error) {
      console.error("Quote error:", error);
      return "0";
    }
  }
  
  // Execute swap
  async swap(fromToken, toToken, amountIn, slippage = 0.5) {
    if (!this.connected) throw new Error("Not connected");
    
    const address = await this.signer.getAddress();
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    
    // Calculate minimum amount out with slippage
    const quote = await this.getQuote(fromToken, toToken, amountIn);
    const minAmountOut = ethers.parseUnits(
      (parseFloat(quote) * (1 - slippage / 100)).toFixed(6),
      toToken === "USDC" ? 6 : 18
    );
    
    const path = [TOKENS[fromToken], TOKENS[toToken]];
    
    try {
      let tx;
      
      if (fromToken === "ETH") {
        // Swap ETH for tokens
        const value = ethers.parseEther(amountIn);
        tx = await this.router.swapExactETHForTokens(
          minAmountOut,
          path,
          address,
          deadline,
          { value }
        );
      } else if (toToken === "ETH") {
        // Swap tokens for ETH
        const amountInWei = ethers.parseUnits(
          amountIn,
          fromToken === "USDC" ? 6 : 18
        );
        
        // Check and approve if needed
        await this.checkAndApprove(fromToken, amountInWei);
        
        tx = await this.router.swapExactTokensForETH(
          amountInWei,
          minAmountOut,
          path,
          address,
          deadline
        );
      } else {
        // Swap token for token
        const amountInWei = ethers.parseUnits(
          amountIn,
          fromToken === "USDC" ? 6 : 18
        );
        
        await this.checkAndApprove(fromToken, amountInWei);
        
        tx = await this.router.swapExactTokensForTokens(
          amountInWei,
          minAmountOut,
          path,
          address,
          deadline
        );
      }
      
      console.log("Swap transaction:", tx.hash);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: tx.hash,
        receipt
      };
      
    } catch (error) {
      console.error("Swap failed:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Check allowance and approve if needed
  async checkAndApprove(tokenSymbol, amount) {
    const tokenAddress = TOKENS[tokenSymbol];
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const address = await this.signer.getAddress();
    
    const allowance = await token.allowance(address, UNISWAP_ROUTER);
    
    if (allowance < amount) {
      console.log("Approving token...");
      const approveTx = await token.approve(UNISWAP_ROUTER, ethers.MaxUint256);
      await approveTx.wait();
      console.log("Token approved");
    }
  }
}

// UI Integration
const swapper = new TokenSwapper();

document.getElementById('swapBtn').addEventListener('click', async () => {
  const btn = document.getElementById('swapBtn');
  
  if (!swapper.connected) {
    try {
      btn.textContent = "Connecting...";
      await swapper.connect();
      btn.textContent = "Swap";
      await updateBalances();
    } catch (error) {
      showStatus(error.message, 'error');
      btn.textContent = "Connect Wallet";
    }
  } else {
    await executeSwap();
  }
});

// Get quote on input change
document.getElementById('fromAmount').addEventListener('input', async (e) => {
  const amount = e.target.value;
  if (!amount || !swapper.connected) return;
  
  const fromToken = document.getElementById('fromToken').value;
  const toToken = document.getElementById('toToken').value;
  
  const quote = await swapper.getQuote(fromToken, toToken, amount);
  document.getElementById('toAmount').value = parseFloat(quote).toFixed(6);
  
  // Update rate
  const rate = parseFloat(quote) / parseFloat(amount);
  document.getElementById('rate').textContent = \`1 \${fromToken} = \${rate.toFixed(4)} \${toToken}\`;
});

async function updateBalances() {
  const fromToken = document.getElementById('fromToken').value;
  const toToken = document.getElementById('toToken').value;
  
  const fromBalance = await swapper.getBalance(fromToken);
  const toBalance = await swapper.getBalance(toToken);
  
  document.getElementById('fromBalance').textContent = parseFloat(fromBalance).toFixed(4);
  document.getElementById('toBalance').textContent = parseFloat(toBalance).toFixed(4);
}

async function executeSwap() {
  const fromToken = document.getElementById('fromToken').value;
  const toToken = document.getElementById('toToken').value;
  const amount = document.getElementById('fromAmount').value;
  
  if (!amount || amount === "0") {
    showStatus("Please enter an amount", 'error');
    return;
  }
  
  const btn = document.getElementById('swapBtn');
  btn.textContent = "Swapping...";
  btn.disabled = true;
  
  const result = await swapper.swap(fromToken, toToken, amount);
  
  if (result.success) {
    showStatus(\`Swap successful! Tx: \${result.transactionHash.slice(0, 10)}...\`, 'success');
    await updateBalances();
  } else {
    showStatus(\`Swap failed: \${result.error}\`, 'error');
  }
  
  btn.textContent = "Swap";
  btn.disabled = false;
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = \`status \${type}\`;
  setTimeout(() => {
    status.className = 'status';
  }, 5000);
}`
    }
  ]);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'step1',
      title: 'Understanding Uniswap',
      description: 'Learn how automated market makers (AMMs) work',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'Uniswap is a decentralized exchange (DEX) that uses liquidity pools instead of order books. The Router contract handles all swaps by finding the best path through pools.',
      checkpoints: [
        {
          label: 'Import Uniswap Router address',
          check: (code) => code.includes('UNISWAP_ROUTER')
        },
        {
          label: 'Define token addresses',
          check: (code) => code.includes('TOKENS') && code.includes('USDC')
        }
      ]
    },
    {
      id: 'step2',
      title: 'Getting Price Quotes',
      description: 'Fetch swap rates before executing',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'getAmountsOut calculates how many tokens you\'ll receive for a given input. It simulates the swap without executing it, accounting for fees and slippage.',
      checkpoints: [
        {
          label: 'Call getAmountsOut function',
          check: (code) => code.includes('getAmountsOut')
        },
        {
          label: 'Create token path array',
          check: (code) => code.includes('path =')
        },
        {
          label: 'Parse amount from wei',
          check: (code) => code.includes('parseEther') || code.includes('parseUnits')
        }
      ]
    },
    {
      id: 'step3',
      title: 'Token Approval',
      description: 'Allow Uniswap to spend your tokens',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'ERC20 tokens require approval before a contract can transfer them. We check the current allowance and approve if needed. Using MaxUint256 means you won\'t need to approve again.',
      checkpoints: [
        {
          label: 'Check current allowance',
          check: (code) => code.includes('allowance')
        },
        {
          label: 'Approve if insufficient',
          check: (code) => code.includes('approve')
        },
        {
          label: 'Use MaxUint256 for unlimited approval',
          check: (code) => code.includes('MaxUint256')
        }
      ],
      hints: [
        'Always check allowance before approving',
        'Approval is a separate transaction',
        'MaxUint256 avoids future approvals'
      ]
    },
    {
      id: 'step4',
      title: 'Slippage Protection',
      description: 'Set minimum output to protect against price changes',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'Prices can change between quote and execution. Slippage tolerance sets the minimum tokens you\'ll accept. If the price moves too much, the transaction reverts.',
      checkpoints: [
        {
          label: 'Calculate minimum output',
          check: (code) => code.includes('minAmountOut')
        },
        {
          label: 'Apply slippage percentage',
          check: (code) => code.includes('slippage') && code.includes('1 -')
        }
      ]
    },
    {
      id: 'step5',
      title: 'Execute Swap',
      description: 'Call the appropriate swap function',
      code: tabs[2].code,
      language: 'javascript',
      explanation: 'Different functions for different swap types: ETH to tokens, tokens to ETH, or token to token. ETH swaps use the native currency, while token swaps require prior approval.',
      checkpoints: [
        {
          label: 'Handle ETH to token swaps',
          check: (code) => code.includes('swapExactETHForTokens')
        },
        {
          label: 'Handle token to ETH swaps',
          check: (code) => code.includes('swapExactTokensForETH')
        },
        {
          label: 'Handle token to token swaps',
          check: (code) => code.includes('swapExactTokensForTokens')
        },
        {
          label: 'Set deadline for swap',
          check: (code) => code.includes('deadline')
        }
      ],
      challenge: {
        task: 'Add support for multi-hop swaps (swapping through an intermediate token)',
        solution: 'Extend the path array: [tokenA, WETH, tokenB]'
      }
    }
  ];

  const annotations: CodeAnnotation[] = [
    {
      lineStart: 6,
      type: 'concept',
      title: 'Uniswap Router',
      content: 'The Router is a helper contract that makes swapping easier. It handles all the complex logic of interacting with liquidity pools.',
      code: 'const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";'
    },
    {
      lineStart: 52,
      type: 'info',
      title: 'Swap Path',
      content: 'The path defines the route for the swap. Direct swaps use [tokenA, tokenB]. Multi-hop swaps go through intermediate tokens.',
      code: 'const path = [TOKENS[fromToken], TOKENS[toToken]];'
    },
    {
      lineStart: 72,
      type: 'warning',
      title: 'Slippage Calculation',
      content: 'Always set a minimum output amount. Without it, you could get much less than expected due to price volatility.',
      code: 'const minAmountOut = quote * (1 - slippage / 100);'
    },
    {
      lineStart: 142,
      type: 'tip',
      title: 'Unlimited Approval',
      content: 'MaxUint256 approval means you never need to approve again, saving gas on future swaps. Some users prefer approving exact amounts for security.',
      code: 'await token.approve(UNISWAP_ROUTER, ethers.MaxUint256);'
    }
  ];

  const handleCodeChange = (tabId: string, code: string) => {
    setTabs(tabs.map(tab => tab.id === tabId ? { ...tab, code } : tab));
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              DeFi Token Swap Tutorial
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Learn how to swap tokens using Uniswap
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('tutorial')}
              className={`px-4 py-2 rounded-lg font-medium ${
                viewMode === 'tutorial'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'
              }`}
            >
              Tutorial
            </button>
            <button
              onClick={() => setViewMode('annotations')}
              className={`px-4 py-2 rounded-lg font-medium ${
                viewMode === 'annotations'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'
              }`}
            >
              Explanations
            </button>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-full">
              Intermediate
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1">
          <SplitView
            left={
              <div className="h-full p-4">
                <MultiLanguageTabs tabs={tabs} onCodeChange={handleCodeChange} height="100%" />
              </div>
            }
            right={
              <div className="h-full p-4">
                <LivePreview
                  html={tabs.find(t => t.id === 'html')?.code || ''}
                  css={tabs.find(t => t.id === 'css')?.code || ''}
                  javascript={tabs.find(t => t.id === 'javascript')?.code || ''}
                  title="Token Swap Interface"
                />
              </div>
            }
          />
        </div>

        <div className="w-96 bg-white dark:bg-gray-800 overflow-hidden">
          {viewMode === 'tutorial' ? (
            <InteractiveTutorial
              steps={tutorialSteps}
              currentCode={tabs[2].code}
              onCodeChange={(code) => handleCodeChange('javascript', code)}
              onStepChange={() => {}}
              onComplete={() => alert('🎉 You mastered DeFi swaps!')}
            />
          ) : (
            <div className="p-6 overflow-y-auto h-full">
              <AnnotationsPanel annotations={annotations} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
