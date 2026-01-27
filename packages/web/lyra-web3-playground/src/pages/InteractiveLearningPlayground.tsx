/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every expert was once a beginner 📚
 */

import { useState } from 'react';
import { ArrowLeft, Layout, BookOpen, Code2, Zap, FileCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import SplitView from '@/components/Playground/SplitView';
import MultiLanguageTabs, { LanguageTab } from '@/components/Playground/MultiLanguageTabs';
import LivePreview from '@/components/Playground/LivePreview';
import InteractiveTutorial, { TutorialStep } from '@/components/Playground/InteractiveTutorial';
import ChallengeSystem, { Challenge } from '@/components/Playground/ChallengeSystem';
import ProgressiveLevels, { LevelInfo, DifficultyLevel } from '@/components/Playground/ProgressiveLevels';
import { AnnotationsPanel, CodeAnnotation } from '@/components/Playground/InlineAnnotations';
import TemplateSelector from '@/components/Sandbox/TemplateSelector';
import { SandboxTemplate } from '@/utils/sandboxTemplates';
import { ContractTemplate } from '@/utils/contractTemplates';

type ViewMode = 'tutorial' | 'challenge' | 'freeform';

export default function InteractiveLearningPlayground() {
  useSEO({
    title: 'Interactive Learning Playground',
    description: 'Master blockchain development with interactive tutorials, coding challenges, and progressive difficulty levels. Learn Solidity and Web3 step-by-step.',
    path: '/learn'
  });

  const [viewMode, setViewMode] = useState<ViewMode>('tutorial');
  const [currentLevel, setCurrentLevel] = useState<DifficultyLevel>('beginner');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Multi-language code state
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
  <title>Web3 DApp</title>
</head>
<body>
  <div class="container">
    <h1>Connect Your Wallet</h1>
    <button id="connectBtn" class="btn">Connect Wallet</button>
    <div id="accountInfo" style="display: none;">
      <p>Connected: <span id="address"></span></p>
      <p>Balance: <span id="balance"></span> ETH</p>
    </div>
  </div>
</body>
</html>`
    },
    {
      id: 'css',
      label: 'CSS',
      language: 'css',
      code: `.container {
  max-width: 600px;
  margin: 50px auto;
  padding: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  color: white;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}

h1 {
  margin-bottom: 30px;
  font-size: 2.5em;
}

.btn {
  background: white;
  color: #667eea;
  border: none;
  padding: 15px 40px;
  font-size: 18px;
  border-radius: 50px;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn:hover {
  transform: scale(1.05);
}

#accountInfo {
  margin-top: 30px;
  padding: 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
}`
    },
    {
      id: 'javascript',
      label: 'JavaScript',
      language: 'javascript',
      code: `// Connect to MetaMask
const connectBtn = document.getElementById('connectBtn');
const accountInfo = document.getElementById('accountInfo');
const addressSpan = document.getElementById('address');
const balanceSpan = document.getElementById('balance');

connectBtn.addEventListener('click', async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      const account = accounts[0];
      
      // Get balance
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [account, 'latest']
      });
      
      // Convert balance from wei to ETH
      const ethBalance = parseInt(balance, 16) / 1e18;
      
      // Display account info
      addressSpan.textContent = account.slice(0, 6) + '...' + account.slice(-4);
      balanceSpan.textContent = ethBalance.toFixed(4);
      accountInfo.style.display = 'block';
      connectBtn.textContent = 'Connected!';
      connectBtn.disabled = true;
      
    } catch (error) {
      console.error('Error connecting:', error);
      alert('Failed to connect wallet');
    }
  } else {
    alert('Please install MetaMask!');
  }
});`
    },
    {
      id: 'solidity',
      label: 'Solidity',
      language: 'solidity',
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleWallet {
    address public owner;
    
    event Deposit(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
    
    function withdraw(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        payable(owner).transfer(amount);
        emit Withdrawal(owner, amount);
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}`
    }
  ]);

  // Tutorial steps
  const tutorialSteps: TutorialStep[] = [
    {
      id: 'step1',
      title: 'Connect to MetaMask',
      description: 'Learn how to detect and connect to MetaMask wallet',
      code: tabs[0].code,
      language: 'javascript',
      explanation: 'We use window.ethereum to detect MetaMask. The eth_requestAccounts method prompts the user to connect their wallet.',
      checkpoints: [
        {
          label: 'Detect MetaMask presence',
          check: (code) => code.includes('window.ethereum')
        },
        {
          label: 'Request account access',
          check: (code) => code.includes('eth_requestAccounts')
        }
      ]
    },
    {
      id: 'step2',
      title: 'Display Account Info',
      description: 'Show the connected wallet address and balance',
      code: tabs[0].code,
      language: 'javascript',
      explanation: 'We fetch the balance using eth_getBalance and convert from wei to ETH. Wei is the smallest unit of ether (1 ETH = 10^18 wei).',
      checkpoints: [
        {
          label: 'Get account balance',
          check: (code) => code.includes('eth_getBalance')
        },
        {
          label: 'Convert wei to ETH',
          check: (code) => code.includes('1e18')
        }
      ]
    }
  ];

  // Levels
  const levels: LevelInfo[] = [
    {
      level: 'beginner',
      title: 'Beginner',
      description: 'Learn the basics of Web3 and wallet connections',
      estimatedTime: '30 min',
      unlocked: true,
      topics: ['MetaMask Integration', 'Wallet Connect', 'Reading Balances', 'Basic Transactions']
    },
    {
      level: 'intermediate',
      title: 'Intermediate',
      description: 'Interact with smart contracts and handle events',
      estimatedTime: '1 hour',
      unlocked: true,
      prerequisites: ['Complete Beginner level'],
      topics: ['Contract ABI', 'Reading Contract Data', 'Writing Transactions', 'Event Listening']
    },
    {
      level: 'advanced',
      title: 'Advanced',
      description: 'Build complex DApps with advanced patterns',
      estimatedTime: '2 hours',
      unlocked: false,
      prerequisites: ['Complete Intermediate level', 'Understand Solidity basics'],
      topics: ['Multi-sig Wallets', 'Gas Optimization', 'Error Handling', 'State Management']
    },
    {
      level: 'expert',
      title: 'Expert',
      description: 'Master DeFi protocols and security patterns',
      estimatedTime: '3 hours',
      unlocked: false,
      prerequisites: ['Complete Advanced level', 'DeFi knowledge'],
      topics: ['DEX Integration', 'Lending Protocols', 'Security Auditing', 'Cross-chain']
    }
  ];

  // Challenge
  const challenge: Challenge = {
    id: 'challenge1',
    title: 'Add Disconnect Function',
    description: 'Implement a function to disconnect the wallet and reset the UI',
    difficulty: 'easy',
    points: 100,
    initialCode: tabs[2].code,
    solution: tabs[2].code + '\n\n// Add disconnect logic here',
    tests: [
      {
        id: 'test1',
        description: 'Code includes disconnect button handler',
        validate: (code) => code.includes('disconnect') || code.includes('Disconnect')
      },
      {
        id: 'test2',
        description: 'Resets account info display',
        validate: (code) => code.includes('accountInfo') && code.includes('display')
      }
    ],
    hints: [
      'Add a new button in HTML for disconnecting',
      'Hide the accountInfo element when disconnecting',
      'Reset the connect button text and state'
    ]
  };

  // Annotations
  const annotations: CodeAnnotation[] = [
    {
      lineStart: 8,
      type: 'concept',
      title: 'EIP-1193 Provider',
      content: 'window.ethereum is the standard Ethereum Provider API. MetaMask injects this object into the browser.',
      code: 'if (typeof window.ethereum !== "undefined") { ... }'
    },
    {
      lineStart: 11,
      type: 'info',
      title: 'Account Request',
      content: 'This prompts the user to connect their wallet. It returns an array of addresses they approve.',
    },
    {
      lineStart: 20,
      type: 'tip',
      title: 'Wei Conversion',
      content: 'Always convert wei to ether for display. 1 ETH = 1,000,000,000,000,000,000 wei (10^18)',
      code: 'const ethBalance = parseInt(balance, 16) / 1e18;'
    }
  ];

  const handleCodeChange = (tabId: string, code: string) => {
    setTabs(tabs.map(tab => tab.id === tabId ? { ...tab, code } : tab));
  };

  const handleTutorialCodeChange = (code: string) => {
    // Update the active tab with new code
    const activeTab = tabs[0];
    setTabs(tabs.map(tab => tab.id === activeTab.id ? { ...tab, code } : tab));
  };

  const handleLoadTemplate = (template: SandboxTemplate) => {
    // Load workspace template files into tabs
    const newTabs: LanguageTab[] = template.files.map((file, index) => ({
      id: file.path || `file-${index}`,
      label: file.name,
      language: file.language as LanguageTab['language'],
      code: file.content
    }));
    if (newTabs.length > 0) {
      setTabs(newTabs);
    }
    setShowTemplateSelector(false);
  };

  const handleLoadContractTemplate = (template: ContractTemplate) => {
    // Add contract as a Solidity tab
    const existingSolidityTab = tabs.find(t => t.language === 'solidity');
    if (existingSolidityTab) {
      setTabs(tabs.map(tab => 
        tab.id === existingSolidityTab.id 
          ? { ...tab, code: template.code, label: template.name }
          : tab
      ));
    } else {
      setTabs([...tabs, {
        id: 'solidity',
        label: template.name,
        language: 'solidity',
        code: template.code
      }]);
    }
    setShowTemplateSelector(false);
  };

  return (
    <>
      {showTemplateSelector && (
        <TemplateSelector
          onClose={() => setShowTemplateSelector(false)}
          onSelect={handleLoadTemplate}
          onContractSelect={handleLoadContractTemplate}
          showContractTemplates={true}
        />
      )}
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Interactive Learning Playground
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('tutorial')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'tutorial'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Tutorial
            </button>
            <button
              onClick={() => setViewMode('challenge')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'challenge'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              Challenge
            </button>
            <button
              onClick={() => setViewMode('freeform')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'freeform'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Code2 className="w-4 h-4" />
              Freeform
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

            <button
              onClick={() => setShowTemplateSelector(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-medium transition-colors hover:bg-purple-200 dark:hover:bg-purple-900/50"
              title="Load from 46 templates"
            >
              <FileCode className="w-4 h-4" />
              Templates
            </button>

            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Layout className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Left Sidebar - Levels */}
          {showSidebar && (
            <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <div className="p-6">
                <ProgressiveLevels
                  levels={levels}
                  currentLevel={currentLevel}
                  onLevelChange={setCurrentLevel}
                  userProgress={{
                    completedLevels: ['beginner'],
                    currentStreak: 5,
                    totalPoints: 450
                  }}
                />
              </div>
            </div>
          )}

          {/* Center - Code Editor with Preview */}
          <div className="flex-1 overflow-hidden">
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
                    title="Live Preview"
                  />
                </div>
              }
              defaultSplit={50}
            />
          </div>

          {/* Right Sidebar - Tutorial/Challenge/Annotations */}
          <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-hidden">
            {viewMode === 'tutorial' && (
              <InteractiveTutorial
                steps={tutorialSteps}
                currentCode={tabs[0].code}
                onCodeChange={handleTutorialCodeChange}
                onStepChange={setCurrentStepIndex}
                onComplete={() => alert('Tutorial completed! 🎉')}
              />
            )}

            {viewMode === 'challenge' && (
              <ChallengeSystem
                challenge={challenge}
                currentCode={tabs.find(t => t.id === 'javascript')?.code || ''}
                onCodeChange={(code) => handleCodeChange('javascript', code)}
                onComplete={(points) => alert(`Challenge completed! You earned ${points} points! 🏆`)}
              />
            )}

            {viewMode === 'freeform' && (
              <div className="p-6 overflow-y-auto h-full">
                <AnnotationsPanel annotations={annotations} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
