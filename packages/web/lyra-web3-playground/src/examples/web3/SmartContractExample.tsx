/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Stay curious, keep creating 💡
 */

import { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Code, 
  Rocket, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  Copy,
  ExternalLink,
  FileCode,
  Play
} from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';
import { useThemeStore } from '@/stores/themeStore';
import { copyToClipboard, generateMockAddress, generateMockTxHash } from '@/utils/helpers';
import { NETWORK_CONFIGS } from '@/utils/networks';

interface DeployedContract {
  id: number;
  name: string;
  address: string;
  network: string;
  transactionHash: string;
  timestamp: number;
}

const SAMPLE_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private storedData;
    address public owner;
    
    event DataStored(uint256 newValue, address indexed by);
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    function set(uint256 x) public {
        storedData = x;
        emit DataStored(x, msg.sender);
    }
    
    function get() public view returns (uint256) {
        return storedData;
    }
    
    function increment() public {
        storedData += 1;
        emit DataStored(storedData, msg.sender);
    }
}`;

const CONTRACT_TEMPLATES = [
  {
    name: 'Simple Storage',
    description: 'Basic storage contract',
    code: SAMPLE_CONTRACT,
  },
  {
    name: 'ERC20 Token',
    description: 'Standard fungible token',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC20Token {
    string public name = "MyToken";
    string public symbol = "MTK";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(uint256 _initialSupply) {
        totalSupply = _initialSupply * 10 ** uint256(decimals);
        balanceOf[msg.sender] = totalSupply;
    }
    
    function transfer(address _to, uint256 _value) public returns (bool) {
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }
}`,
  },
  {
    name: 'Simple NFT',
    description: 'Basic ERC721 NFT',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleNFT {
    string public name = "MyNFT";
    string public symbol = "MNFT";
    uint256 public tokenCounter;
    
    mapping(uint256 => address) public tokenOwner;
    mapping(address => uint256) public balanceOf;
    
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    
    function mint() public returns (uint256) {
        uint256 newTokenId = tokenCounter;
        tokenOwner[newTokenId] = msg.sender;
        balanceOf[msg.sender] += 1;
        tokenCounter += 1;
        
        emit Transfer(address(0), msg.sender, newTokenId);
        return newTokenId;
    }
}`,
  },
];

export default function SmartContractExample() {
  const { isConnected, chainId } = useWalletStore();
  const { mode } = useThemeStore();
  const editorRef = useRef<any>(null);

  const [code, setCode] = useState(SAMPLE_CONTRACT);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [compilationResult, setCompilationResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deployedContracts, setDeployedContracts] = useState<DeployedContract[]>([]);
  const [copied, setCopied] = useState(false);

  // Get network name from NETWORK_CONFIGS
  const currentNetwork = chainId ? Object.values(NETWORK_CONFIGS).find(n => n.chainId === chainId) : null;
  const networkName = currentNetwork?.name || 'Unknown Network';

  const handleCompile = async () => {
    setError(null);
    setCompilationResult(null);
    setIsCompiling(true);

    try {
      // Simulate compilation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Basic validation
      if (!code.includes('pragma solidity')) {
        throw new Error('Missing Solidity version pragma');
      }
      if (!code.includes('contract ')) {
        throw new Error('No contract definition found');
      }

      setCompilationResult('✅ Compilation successful! Contract is ready to deploy.');
    } catch (err: any) {
      console.error('Compilation error:', err);
      setError(err.message || 'Compilation failed');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeploy = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!compilationResult) {
      setError('Please compile the contract first');
      return;
    }

    setError(null);
    setIsDeploying(true);

    try {
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 3000));

      const mockAddress = generateMockAddress();
      const mockTxHash = generateMockTxHash();

      // Extract contract name from code
      const nameMatch = code.match(/contract\s+(\w+)/);
      const contractName = nameMatch ? nameMatch[1] : 'UnnamedContract';

      const newContract: DeployedContract = {
        id: Date.now(),
        name: contractName,
        address: mockAddress,
        network: networkName,
        transactionHash: mockTxHash,
        timestamp: Date.now(),
      };

      setDeployedContracts([newContract, ...deployedContracts]);
      setCompilationResult(`✅ Contract deployed successfully at ${mockAddress}`);
    } catch (err: any) {
      console.error('Deployment error:', err);
      setError(err.message || 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const loadTemplate = (template: typeof CONTRACT_TEMPLATES[0]) => {
    setCode(template.code);
    setCompilationResult(null);
    setError(null);
  };

  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Smart Contract Deployer</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Write, compile, and deploy Solidity smart contracts to testnets
          </p>
        </div>

        <div className="card text-center py-16">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-4">Wallet Not Connected</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Please connect your wallet to deploy smart contracts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Smart Contract Deployer</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Write, compile, and deploy Solidity smart contracts to testnets
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Templates */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-3 flex items-center">
              <FileCode className="w-4 h-4 mr-2" />
              Templates
            </h2>
            <div className="space-y-2">
              {CONTRACT_TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => loadTemplate(template)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
                >
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Network Info */}
          <div className="card">
            <h3 className="font-semibold mb-3">Network Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Network:</span>
                <span className="font-semibold">{networkName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Chain ID:</span>
                <span className="font-semibold">{chainId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Solidity Editor</h2>
              <button
                onClick={handleCopy}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy Code
                  </>
                )}
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <Editor
                height="500px"
                language="sol"
                theme={mode === 'dark' ? 'vs-dark' : 'light'}
                value={code}
                onChange={(value) => setCode(value || '')}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

          {/* Compilation Result */}
          {compilationResult && (
            <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-lg flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-green-600 dark:text-green-400">{compilationResult}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-red-600 dark:text-red-400">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className="btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompiling ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Compiling...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Compile Contract
                </>
              )}
            </button>
            <button
              onClick={handleDeploy}
              disabled={isDeploying || !compilationResult}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Deploy to {networkName}
                </>
              )}
            </button>
          </div>

          {/* Info Card */}
          <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
              ℹ️ Demo Mode
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              This is a demonstration. In production, the contract would be compiled using solc
              and deployed to the actual blockchain. The demo simulates these processes.
            </p>
          </div>
        </div>

        {/* Right Sidebar - Deployed Contracts */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-4">Deployed Contracts</h2>
            
            {deployedContracts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No contracts deployed yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deployedContracts.map((contract) => (
                  <div 
                    key={contract.id} 
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{contract.name}</h3>
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                        {contract.network}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div>
                        <span className="text-gray-500">Address:</span>
                        <p className="font-mono text-xs break-all">{contract.address}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Deployed:</span>
                        <p>{new Date(contract.timestamp).toLocaleString()}</p>
                      </div>
                      <a
                        href={`https://${contract.network.toLowerCase()}.etherscan.io/address/${contract.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 flex items-center mt-2"
                      >
                        View on Etherscan
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="card">
            <h3 className="font-semibold mb-3">Deployment Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Deployed:</span>
                <span className="font-semibold">{deployedContracts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Current Network:</span>
                <span className="font-semibold">{networkName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
