/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Making the digital world a better place 🌐
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Editor, { OnMount } from '@monaco-editor/react';
import { useThemeStore } from '@/stores/themeStore';
import { useWalletStore } from '@/stores/walletStore';
import ShareModal from './ShareModal';
import WalletConnect from '@/components/WalletConnect';
import TemplateSelector from '@/components/Playground/TemplateSelector';
import { ContractTemplate } from '@/utils/contractTemplates';
import {
  Play,
  Rocket,
  FileCode,
  Settings,
  Maximize2,
  Minimize2,
  Plus,
  X,
  Copy,
  Check,
  Code2,
  Terminal,
  Layers,
  Zap,
  Trash2,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Wallet,
  Coins,
  Send,
  Eye,
  Edit3,
  Clock,
  Hash,
  Box,
  Activity,
  Database,
  GitBranch,
  ExternalLink,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
  Search,
  Share2,
  Home,
  BookOpen
} from 'lucide-react';
import { cn } from '@/utils/helpers';

// =============================================================================
// TYPES
// =============================================================================

interface ContractFile {
  id: string;
  name: string;
  content: string;
}

interface CompilationResult {
  success: boolean;
  errors: CompilerError[];
  warnings: CompilerError[];
  contracts: CompiledContract[];
  compileTime: number;
}

interface CompilerError {
  severity: 'error' | 'warning';
  message: string;
  line?: number;
  column?: number;
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
}

interface CompiledContract {
  name: string;
  abi: any[];
  bytecode: string;
  deployedBytecode: string;
  gasEstimates: {
    creation: { codeDepositCost: string; executionCost: string; totalCost: string };
    external: Record<string, string>;
  };
}

interface DeployedContract {
  id: string;
  name: string;
  address: string;
  abi: any[];
  deployedAt: Date;
  network: string;
  txHash: string;
}

interface Transaction {
  id: string;
  type: 'deploy' | 'call' | 'send';
  contractName?: string;
  functionName?: string;
  from: string;
  to?: string;
  value: string;
  gasUsed: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: Date;
  txHash: string;
  result?: any;
  error?: string;
}

interface Account {
  address: string;
  balance: string;
  nonce: number;
}

interface SolidityVersion {
  version: string;
  longVersion: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SOLIDITY_VERSIONS: SolidityVersion[] = [
  { version: '0.8.24', longVersion: 'v0.8.24+commit.e11b9ed9' },
  { version: '0.8.23', longVersion: 'v0.8.23+commit.f704f362' },
  { version: '0.8.22', longVersion: 'v0.8.22+commit.4fc1097e' },
  { version: '0.8.21', longVersion: 'v0.8.21+commit.d9974bed' },
  { version: '0.8.20', longVersion: 'v0.8.20+commit.a1b79de6' },
  { version: '0.8.19', longVersion: 'v0.8.19+commit.7dd6d404' },
  { version: '0.7.6', longVersion: 'v0.7.6+commit.7338295f' },
  { version: '0.6.12', longVersion: 'v0.6.12+commit.27d51765' },
];

const NETWORKS = [
  { id: 'vm', name: 'JavaScript VM', icon: '💻' },
  { id: 'sepolia', name: 'Sepolia Testnet', icon: '🔷' },
  { id: 'goerli', name: 'Goerli Testnet', icon: '🔶' },
  { id: 'mumbai', name: 'Polygon Mumbai', icon: '🟣' },
  { id: 'mainnet', name: 'Ethereum Mainnet', icon: '⚫' },
];

const DEFAULT_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🏦 DeFi Staking Vault - Learn Solidity with a Real DeFi Contract
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * This contract demonstrates key DeFi concepts:
 * - Depositing and withdrawing ETH
 * - Earning yield based on time staked
 * - Tracking user balances with mappings
 * - Secure withdrawal patterns
 * - Events for off-chain tracking
 * 
 * Try these interactions:
 * 1. Call deposit() with some ETH value
 * 2. Wait a bit, then call getRewards() to see earned yield
 * 3. Call withdraw() to get your ETH + rewards back
 */

contract StakingVault {
    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════
    
    /// @notice Contract owner (deployer)
    address public owner;
    
    /// @notice Annual Percentage Yield (in basis points, e.g., 1000 = 10%)
    uint256 public constant APY_BPS = 1000; // 10% APY
    
    /// @notice Minimum deposit amount
    uint256 public constant MIN_DEPOSIT = 0.01 ether;
    
    /// @notice Total ETH deposited in the vault
    uint256 public totalDeposits;
    
    /// @notice Total rewards distributed
    uint256 public totalRewardsDistributed;
    
    /// @notice Tracks each user's stake info
    struct Stake {
        uint256 amount;        // Amount of ETH staked
        uint256 timestamp;     // When they staked
        uint256 rewardsClaimed; // Total rewards claimed
    }
    
    /// @notice User address => Stake info
    mapping(address => Stake) public stakes;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS - Emit these to track activity off-chain
    // ═══════════════════════════════════════════════════════════════════════════
    
    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 rewards);
    event VaultFunded(address indexed funder, uint256 amount);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    modifier hasStake() {
        require(stakes[msg.sender].amount > 0, "No active stake");
        _;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    
    constructor() {
        owner = msg.sender;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Deposit ETH to start earning yield
     * @dev Creates or adds to existing stake
     */
    function deposit() external payable {
        require(msg.value >= MIN_DEPOSIT, "Below minimum deposit");
        
        Stake storage userStake = stakes[msg.sender];
        
        // If user already has a stake, claim pending rewards first
        if (userStake.amount > 0) {
            uint256 pendingRewards = calculateRewards(msg.sender);
            if (pendingRewards > 0) {
                _claimRewards(msg.sender, pendingRewards);
            }
        }
        
        // Update stake
        userStake.amount += msg.value;
        userStake.timestamp = block.timestamp;
        totalDeposits += msg.value;
        
        emit Deposited(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @notice Withdraw all staked ETH plus earned rewards
     */
    function withdraw() external hasStake {
        Stake storage userStake = stakes[msg.sender];
        
        uint256 amount = userStake.amount;
        uint256 rewards = calculateRewards(msg.sender);
        uint256 totalPayout = amount + rewards;
        
        // Check vault has enough balance for rewards
        require(address(this).balance >= totalPayout, "Insufficient vault balance");
        
        // Reset user's stake (before transfer to prevent reentrancy)
        userStake.amount = 0;
        userStake.timestamp = 0;
        userStake.rewardsClaimed += rewards;
        
        totalDeposits -= amount;
        totalRewardsDistributed += rewards;
        
        // Transfer ETH to user
        (bool success, ) = payable(msg.sender).call{value: totalPayout}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount, rewards);
    }
    
    /**
     * @notice Claim only rewards without withdrawing stake
     */
    function claimRewards() external hasStake {
        uint256 rewards = calculateRewards(msg.sender);
        require(rewards > 0, "No rewards to claim");
        require(address(this).balance >= rewards, "Insufficient vault balance");
        
        _claimRewards(msg.sender, rewards);
        
        // Reset timestamp to start new reward period
        stakes[msg.sender].timestamp = block.timestamp;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Calculate pending rewards for a user
     * @param user The user's address
     * @return rewards The amount of ETH rewards earned
     */
    function calculateRewards(address user) public view returns (uint256) {
        Stake memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;
        
        // Time staked in seconds
        uint256 timeStaked = block.timestamp - userStake.timestamp;
        
        // Calculate rewards: (amount * APY * time) / (365 days * 10000)
        // 10000 because APY is in basis points
        uint256 rewards = (userStake.amount * APY_BPS * timeStaked) / (365 days * 10000);
        
        return rewards;
    }
    
    /**
     * @notice Get user's current stake info
     * @param user The user's address
     */
    function getStakeInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 pendingRewards,
        uint256 stakedSince,
        uint256 totalClaimed
    ) {
        Stake memory userStake = stakes[user];
        return (
            userStake.amount,
            calculateRewards(user),
            userStake.timestamp,
            userStake.rewardsClaimed
        );
    }
    
    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 _totalDeposits,
        uint256 _totalRewards,
        uint256 _vaultBalance,
        uint256 _apy
    ) {
        return (
            totalDeposits,
            totalRewardsDistributed,
            address(this).balance,
            APY_BPS
        );
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    function _claimRewards(address user, uint256 rewards) internal {
        stakes[user].rewardsClaimed += rewards;
        totalRewardsDistributed += rewards;
        
        (bool success, ) = payable(user).call{value: rewards}("");
        require(success, "Reward transfer failed");
        
        emit RewardsClaimed(user, rewards);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // OWNER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Owner can fund the vault for reward payouts
     */
    function fundVault() external payable onlyOwner {
        require(msg.value > 0, "Must send ETH");
        emit VaultFunded(msg.sender, msg.value);
    }
    
    /**
     * @notice Receive ETH sent directly to contract
     */
    receive() external payable {
        emit VaultFunded(msg.sender, msg.value);
    }
}`;

const SIMULATED_ACCOUNTS: Account[] = [
  { address: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4', balance: '100', nonce: 0 },
  { address: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', balance: '100', nonce: 0 },
  { address: '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', balance: '100', nonce: 0 },
  { address: '0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB', balance: '100', nonce: 0 },
  { address: '0x617F2E2fD72FD9D5503197092aC168c91465E7f2', balance: '100', nonce: 0 },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function SoliditySandbox() {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  const { mode: appTheme } = useThemeStore();
  const [files, setFiles] = useState<ContractFile[]>([
    { id: 'main', name: 'StakingVault.sol', content: DEFAULT_CONTRACT }
  ]);
  const [activeFileId, setActiveFileId] = useState('main');
  const [openTabs, setOpenTabs] = useState<string[]>(['main']);
  
  const [solcVersion, setSolcVersion] = useState(SOLIDITY_VERSIONS[0]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null);
  
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0]);
  const [selectedAccount, setSelectedAccount] = useState(SIMULATED_ACCOUNTS[0]);
  const [accounts, setAccounts] = useState(SIMULATED_ACCOUNTS);
  const [gasLimit, setGasLimit] = useState('3000000');
  const [value, setValue] = useState('0');
  const [valueUnit, setValueUnit] = useState<'wei' | 'gwei' | 'ether'>('wei');
  
  const [deployedContracts, setDeployedContracts] = useState<DeployedContract[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [activePanel, setActivePanel] = useState<'compile' | 'deploy' | 'contracts' | 'transactions'>('compile');
  const [showConsole, setShowConsole] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [consoleMessages, setConsoleMessages] = useState<Array<{
    id: string;
    type: 'log' | 'error' | 'warn' | 'info';
    message: string;
    timestamp: Date;
  }>>([]);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [splitPosition, setSplitPosition] = useState(60);
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());
  const [functionInputs, setFunctionInputs] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  
  const { address, isConnected } = useWalletStore();
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // ---------------------------------------------------------------------------
  // COMPUTED
  // ---------------------------------------------------------------------------
  
  const activeFile = files.find(f => f.id === activeFileId);
  const compiledContracts = compilationResult?.contracts || [];
  
  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  
  const log = useCallback((type: 'log' | 'error' | 'warn' | 'info', message: string) => {
    setConsoleMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      type,
      message,
      timestamp: new Date()
    }]);
  }, []);
  
  const updateFile = (fileId: string, content: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, content } : f
    ));
  };
  
  const handleTemplateSelect = (template: ContractTemplate) => {
    const newFile: ContractFile = {
      id: Date.now().toString(),
      name: `${template.name.replace(/[^a-zA-Z0-9]/g, '')}.sol`,
      content: template.code
    };
    
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setOpenTabs(prev => [...prev, newFile.id]);
    setShowTemplateSelector(false);
    log('info', `Loaded template: ${template.name}`);
  };
  
  const createNewFile = () => {
    const name = prompt('Enter contract file name (e.g., Token.sol):');
    if (!name) return;
    
    const newFile: ContractFile = {
      id: Date.now().toString(),
      name: name.endsWith('.sol') ? name : `${name}.sol`,
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ${name.replace('.sol', '')} {
    // Your code here
}`
    };
    
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setOpenTabs(prev => [...prev, newFile.id]);
  };
  
  const deleteFile = (fileId: string) => {
    if (files.length <= 1) return;
    if (!confirm('Delete this file?')) return;
    
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setOpenTabs(prev => prev.filter(id => id !== fileId));
    
    if (activeFileId === fileId) {
      const remaining = files.filter(f => f.id !== fileId);
      setActiveFileId(remaining[0]?.id || '');
    }
  };
  
  const openFile = (fileId: string) => {
    setActiveFileId(fileId);
    if (!openTabs.includes(fileId)) {
      setOpenTabs(prev => [...prev, fileId]);
    }
  };
  
  const closeTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(id => id !== fileId);
    setOpenTabs(newTabs);
    
    if (activeFileId === fileId && newTabs.length > 0) {
      setActiveFileId(newTabs[newTabs.length - 1]);
    }
  };
  
  const compile = async () => {
    setIsCompiling(true);
    setCompilationResult(null);
    log('info', `Compiling with Solidity ${solcVersion.version}...`);
    
    const startTime = Date.now();
    
    // Simulate compilation (in real implementation, this would call solc-js)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Parse contract name from code
    const contractMatch = activeFile?.content.match(/contract\s+(\w+)/);
    const contractName = contractMatch?.[1] || 'Unknown';
    
    // Check for common errors
    const errors: CompilerError[] = [];
    const warnings: CompilerError[] = [];
    
    if (!activeFile?.content.includes('pragma solidity')) {
      errors.push({
        severity: 'error',
        message: 'Source file requires different compiler version',
        line: 1
      });
    }
    
    if (!activeFile?.content.includes('SPDX-License-Identifier')) {
      warnings.push({
        severity: 'warning',
        message: 'SPDX license identifier not provided in source file',
        line: 1
      });
    }
    
    // Simulate successful compilation
    const result: CompilationResult = {
      success: errors.length === 0,
      errors,
      warnings,
      compileTime: Date.now() - startTime,
      contracts: errors.length === 0 ? [{
        name: contractName,
        abi: parseABI(activeFile?.content || ''),
        bytecode: '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe',
        deployedBytecode: '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe',
        gasEstimates: {
          creation: { codeDepositCost: '68600', executionCost: '116', totalCost: '68716' },
          external: { 'get()': '2407', 'set(uint256)': '22520' }
        }
      }] : []
    };
    
    setCompilationResult(result);
    setIsCompiling(false);
    
    if (result.success) {
      log('log', `✓ Compilation successful in ${result.compileTime}ms`);
      log('log', `  Compiled ${result.contracts.length} contract(s): ${result.contracts.map(c => c.name).join(', ')}`);
    } else {
      log('error', `✗ Compilation failed with ${errors.length} error(s)`);
      errors.forEach(e => log('error', `  Line ${e.line}: ${e.message}`));
    }
    
    warnings.forEach(w => log('warn', `  Warning: ${w.message}`));
  };
  
  const parseABI = (code: string): any[] => {
    // Simple ABI parser (in real implementation, this comes from solc)
    const abi: any[] = [];
    
    // Find functions
    const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*(public|external|internal|private)?\s*(view|pure|payable)?\s*(returns\s*\(([^)]*)\))?/g;
    let match;
    
    while ((match = funcRegex.exec(code)) !== null) {
      const [, name, params, visibility, mutability, , returns] = match;
      
      const inputs = params.split(',').filter(p => p.trim()).map(p => {
        const parts = p.trim().split(/\s+/);
        return { name: parts[1] || '', type: parts[0] };
      });
      
      const outputs = returns ? returns.split(',').filter(p => p.trim()).map(p => {
        const parts = p.trim().split(/\s+/);
        return { name: parts[1] || '', type: parts[0] };
      }) : [];
      
      abi.push({
        type: 'function',
        name,
        inputs,
        outputs,
        stateMutability: mutability || (visibility === 'view' || visibility === 'pure' ? visibility : 'nonpayable')
      });
    }
    
    // Find events
    const eventRegex = /event\s+(\w+)\s*\(([^)]*)\)/g;
    while ((match = eventRegex.exec(code)) !== null) {
      const [, name, params] = match;
      const inputs = params.split(',').filter(p => p.trim()).map(p => {
        const indexed = p.includes('indexed');
        const parts = p.replace('indexed', '').trim().split(/\s+/);
        return { name: parts[1] || '', type: parts[0], indexed };
      });
      
      abi.push({ type: 'event', name, inputs });
    }
    
    // Add constructor if exists
    if (code.includes('constructor')) {
      abi.push({ type: 'constructor', inputs: [], stateMutability: 'nonpayable' });
    }
    
    return abi;
  };
  
  const deployContract = async (contract: CompiledContract) => {
    log('info', `Deploying ${contract.name}...`);
    
    // Simulate deployment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const address = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    const deployed: DeployedContract = {
      id: Date.now().toString(),
      name: contract.name,
      address,
      abi: contract.abi,
      deployedAt: new Date(),
      network: selectedNetwork.name,
      txHash
    };
    
    setDeployedContracts(prev => [...prev, deployed]);
    setExpandedContracts(prev => new Set([...prev, deployed.id]));
    
    const tx: Transaction = {
      id: Date.now().toString(),
      type: 'deploy',
      contractName: contract.name,
      from: selectedAccount.address,
      to: address,
      value: value,
      gasUsed: contract.gasEstimates.creation.totalCost,
      status: 'success',
      timestamp: new Date(),
      txHash
    };
    
    setTransactions(prev => [tx, ...prev]);
    
    log('log', `✓ Contract deployed at ${address}`);
    log('log', `  Transaction: ${txHash}`);
    log('log', `  Gas used: ${contract.gasEstimates.creation.totalCost}`);
    
    // Switch to contracts panel
    setActivePanel('contracts');
  };
  
  const callContractFunction = async (
    contract: DeployedContract,
    func: any,
    isWrite: boolean
  ) => {
    const funcInputs = functionInputs[contract.id]?.[func.name] || {};
    const args = func.inputs.map((input: any) => funcInputs[input.name as string] || '');
    
    log('info', `Calling ${contract.name}.${func.name}(${args.join(', ')})...`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    // Simulate result
    let result: any;
    if (func.name === 'get') {
      result = Math.floor(Math.random() * 1000);
    } else if (func.outputs?.length > 0) {
      result = func.outputs.map((o: any) => {
        if (o.type.startsWith('uint')) return Math.floor(Math.random() * 1000);
        if (o.type === 'bool') return Math.random() > 0.5;
        if (o.type === 'address') return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        return '0x0';
      });
    }
    
    const tx: Transaction = {
      id: Date.now().toString(),
      type: isWrite ? 'send' : 'call',
      contractName: contract.name,
      functionName: func.name,
      from: selectedAccount.address,
      to: contract.address,
      value: isWrite ? value : '0',
      gasUsed: isWrite ? '21000' : '0',
      status: 'success',
      timestamp: new Date(),
      txHash,
      result
    };
    
    setTransactions(prev => [tx, ...prev]);
    
    if (result !== undefined) {
      log('log', `✓ Result: ${JSON.stringify(result)}`);
    } else {
      log('log', `✓ Transaction successful: ${txHash}`);
    }
  };
  
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add Ctrl+S to compile
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      compile();
    });
  };
  
  const toggleContractExpanded = (contractId: string) => {
    setExpandedContracts(prev => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  };
  
  const updateFunctionInput = (contractId: string, funcName: string, inputName: string, value: string) => {
    setFunctionInputs(prev => ({
      ...prev,
      [contractId]: {
        ...(prev[contractId] || {}),
        [funcName]: {
          ...(prev[contractId]?.[funcName] || {}),
          [inputName]: value
        }
      }
    }));
  };
  
  // ---------------------------------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------------------------------
  
  const renderCompilePanel = () => (
    <div className="p-4 space-y-4">
      {/* Compiler Version */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">COMPILER</label>
        <select
          value={solcVersion.version}
          onChange={(e) => setSolcVersion(SOLIDITY_VERSIONS.find(v => v.version === e.target.value) || SOLIDITY_VERSIONS[0])}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
        >
          {SOLIDITY_VERSIONS.map(v => (
            <option key={v.version} value={v.version}>{v.version}</option>
          ))}
        </select>
      </div>
      
      {/* Compile Button */}
      <button
        onClick={compile}
        disabled={isCompiling}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors",
          isCompiling 
            ? "bg-gray-600 cursor-not-allowed" 
            : "bg-primary-600 hover:bg-primary-700"
        )}
      >
        {isCompiling ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Compiling...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Compile
          </>
        )}
      </button>
      
      {/* Compilation Result */}
      {compilationResult && (
        <div className="space-y-3">
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-lg",
            compilationResult.success 
              ? "bg-green-500/20 text-green-400" 
              : "bg-red-500/20 text-red-400"
          )}>
            {compilationResult.success ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">
              {compilationResult.success 
                ? `Compiled successfully (${compilationResult.compileTime}ms)` 
                : 'Compilation failed'}
            </span>
          </div>
          
          {/* Errors */}
          {compilationResult.errors.map((error, i) => (
            <div key={i} className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Error</span>
                {error.line && <span className="text-xs">Line {error.line}</span>}
              </div>
              <p className="mt-1 text-sm text-red-300">{error.message}</p>
            </div>
          ))}
          
          {/* Warnings */}
          {compilationResult.warnings.map((warning, i) => (
            <div key={i} className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-medium">Warning</span>
              </div>
              <p className="mt-1 text-sm text-yellow-300">{warning.message}</p>
            </div>
          ))}
          
          {/* Compiled Contracts */}
          {compiledContracts.map((contract, i) => (
            <div key={i} className="p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{contract.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(contract.abi, null, 2))}
                    className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
                  >
                    Copy ABI
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(contract.bytecode)}
                    className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
                  >
                    Copy Bytecode
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                <p>Gas: {contract.gasEstimates.creation.totalCost}</p>
                <p>ABI: {contract.abi.length} items</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  const renderDeployPanel = () => (
    <div className="p-4 space-y-4">
      {/* Network */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">ENVIRONMENT</label>
        <select
          value={selectedNetwork.id}
          onChange={(e) => setSelectedNetwork(NETWORKS.find(n => n.id === e.target.value) || NETWORKS[0])}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
        >
          {NETWORKS.map(n => (
            <option key={n.id} value={n.id}>{n.icon} {n.name}</option>
          ))}
        </select>
      </div>
      
      {/* Account */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">ACCOUNT</label>
        <select
          value={selectedAccount.address}
          onChange={(e) => setSelectedAccount(accounts.find(a => a.address === e.target.value) || accounts[0])}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono"
        >
          {accounts.map(a => (
            <option key={a.address} value={a.address}>
              {a.address.slice(0, 8)}...{a.address.slice(-6)} ({a.balance} ETH)
            </option>
          ))}
        </select>
      </div>
      
      {/* Gas Limit */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">GAS LIMIT</label>
        <input
          type="text"
          value={gasLimit}
          onChange={(e) => setGasLimit(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      
      {/* Value */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">VALUE</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={valueUnit}
            onChange={(e) => setValueUnit(e.target.value as any)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
          >
            <option value="wei">Wei</option>
            <option value="gwei">Gwei</option>
            <option value="ether">Ether</option>
          </select>
        </div>
      </div>
      
      {/* Deploy Contracts */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">CONTRACT</label>
        {compiledContracts.length === 0 ? (
          <div className="text-sm text-gray-500 p-4 bg-gray-700/50 rounded-lg text-center">
            No compiled contracts. Compile first.
          </div>
        ) : (
          <div className="space-y-2">
            {compiledContracts.map((contract, i) => (
              <button
                key={i}
                onClick={() => deployContract(contract)}
                className="w-full flex items-center justify-between p-3 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
              >
                <span className="font-medium">{contract.name}</span>
                <Rocket className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  
  const renderContractsPanel = () => (
    <div className="p-4 space-y-3">
      {deployedContracts.length === 0 ? (
        <div className="text-sm text-gray-500 p-8 text-center">
          <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No deployed contracts</p>
          <p className="text-xs mt-1">Deploy a contract to interact with it</p>
        </div>
      ) : (
        deployedContracts.map(contract => (
          <div key={contract.id} className="bg-gray-700/50 rounded-lg overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggleContractExpanded(contract.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-700/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedContracts.has(contract.id) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <span className="font-medium text-orange-400">{contract.name}</span>
              </div>
              <span className="text-xs font-mono text-gray-400">
                {contract.address.slice(0, 8)}...
              </span>
            </button>
            
            {/* Functions */}
            {expandedContracts.has(contract.id) && (
              <div className="border-t border-gray-600 p-3 space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>at</span>
                  <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">
                    {contract.address}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(contract.address)}
                    className="p-1 hover:bg-gray-600 rounded"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                
                {/* Group functions by type */}
                {contract.abi
                  .filter(item => item.type === 'function')
                  .map((func, i) => {
                    const isView = func.stateMutability === 'view' || func.stateMutability === 'pure';
                    
                    return (
                      <div key={i} className="space-y-2">
                        {/* Function inputs */}
                        {func.inputs.length > 0 && (
                          <div className="space-y-1">
                            {func.inputs.map((input: any, j: number) => (
                              <input
                                key={j}
                                type="text"
                                placeholder={`${input.name} (${input.type})`}
                                value={functionInputs[contract.id]?.[func.name]?.[input.name] || ''}
                                onChange={(e) => updateFunctionInput(contract.id, func.name, input.name, e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm font-mono"
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* Function button */}
                        <button
                          onClick={() => callContractFunction(contract, func, !isView)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isView 
                              ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30" 
                              : "bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 border border-orange-600/30"
                          )}
                        >
                          <span>{func.name}</span>
                          {isView ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
  
  const renderTransactionsPanel = () => (
    <div className="p-4 space-y-2">
      {transactions.length === 0 ? (
        <div className="text-sm text-gray-500 p-8 text-center">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No transactions yet</p>
        </div>
      ) : (
        transactions.map(tx => (
          <div key={tx.id} className="p-3 bg-gray-700/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {tx.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : tx.status === 'pending' ? (
                  <Clock className="w-4 h-4 text-yellow-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium text-sm">
                  {tx.type === 'deploy' ? 'Deploy' : tx.functionName}
                </span>
                {tx.contractName && (
                  <span className="text-xs text-gray-400">({tx.contractName})</span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {tx.timestamp.toLocaleTimeString()}
              </span>
            </div>
            
            <div className="text-xs font-mono text-gray-400 space-y-1">
              <p className="truncate">TX: {tx.txHash}</p>
              {tx.to && <p className="truncate">To: {tx.to}</p>}
              <p>Gas: {tx.gasUsed}</p>
              {tx.result !== undefined && (
                <p className="text-green-400">Result: {JSON.stringify(tx.result)}</p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
  
  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex flex-col h-screen bg-gray-900 text-white overflow-hidden",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Back to Home"
          >
            <Home className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-gray-700" />
          <Code2 className="w-5 h-5 text-purple-500" />
          <span className="font-semibold text-sm">Solidity UDE</span>
          <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-400 rounded">
            {solcVersion.version}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={compile}
            disabled={isCompiling}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
          
          <div className="w-px h-6 bg-gray-700" />
          
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>{selectedNetwork.icon} {selectedNetwork.name}</span>
          </div>
          
          <div className="w-px h-6 bg-gray-700" />
          
          <button
            onClick={() => {
              if (!isConnected || !address) {
                setShowWalletModal(true);
              } else {
                setShowShareModal(true);
              }
            }}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Files */}
        {showSidebar && (
          <aside className="w-56 bg-gray-850 border-r border-gray-700 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contracts</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowTemplateSelector(true)}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Browse 41 contract templates"
                >
                  <BookOpen className="w-4 h-4 text-purple-400" />
                </button>
                <button
                  onClick={createNewFile}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                  title="New file"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Templates Quick Access */}
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="mx-2 mt-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-400 text-xs font-medium flex items-center gap-2 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              41 Templates Available
            </button>
            
            <div className="flex-1 overflow-y-auto py-2">
              {files.map(file => (
                <div
                  key={file.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors",
                    activeFileId === file.id 
                      ? "bg-gray-700 text-white" 
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  )}
                  onClick={() => openFile(file.id)}
                >
                  <FileCode className="w-4 h-4 text-purple-500" />
                  <span className="flex-1 text-sm truncate">{file.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-600 rounded transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}
        
        {/* Editor */}
        <div 
          className="flex-1 flex flex-col bg-gray-900 overflow-hidden border-r border-gray-700"
          style={{ width: `${splitPosition}%` }}
        >
          {/* Tabs */}
          <div className="flex items-center bg-gray-800 border-b border-gray-700 overflow-x-auto">
            {openTabs.map(tabId => {
              const file = files.find(f => f.id === tabId);
              if (!file) return null;
              
              return (
                <div
                  key={tabId}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 border-r border-gray-700 cursor-pointer transition-colors",
                    activeFileId === tabId 
                      ? "bg-gray-900 text-white" 
                      : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  )}
                  onClick={() => setActiveFileId(tabId)}
                >
                  <FileCode className="w-4 h-4 text-purple-500" />
                  <span className="text-sm whitespace-nowrap">{file.name}</span>
                  <button
                    onClick={(e) => closeTab(tabId, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-700 rounded transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          
          {/* Editor */}
          <div className="flex-1">
            {activeFile && (
              <Editor
                height="100%"
                language="sol"
                value={activeFile.content}
                theme={appTheme === 'dark' ? 'vs-dark' : 'light'}
                onChange={(value) => updateFile(activeFile.id, value || '')}
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16 },
                  fontLigatures: true,
                }}
              />
            )}
          </div>
        </div>
        
        {/* Right Panel */}
        <div className="w-80 bg-gray-800 flex flex-col flex-shrink-0">
          {/* Panel Tabs */}
          <div className="flex border-b border-gray-700">
            {[
              { id: 'compile', icon: Code2, label: 'Compile' },
              { id: 'deploy', icon: Rocket, label: 'Deploy' },
              { id: 'contracts', icon: Box, label: 'Contracts' },
              { id: 'transactions', icon: Activity, label: 'TX' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                  activePanel === tab.id
                    ? "bg-gray-900 text-white border-b-2 border-primary-500"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {activePanel === 'compile' && renderCompilePanel()}
            {activePanel === 'deploy' && renderDeployPanel()}
            {activePanel === 'contracts' && renderContractsPanel()}
            {activePanel === 'transactions' && renderTransactionsPanel()}
          </div>
        </div>
      </div>
      
      {/* Console */}
      {showConsole && (
        <div className="h-40 bg-gray-900 border-t border-gray-700 flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-400">Console</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConsoleMessages([])}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-1">
            {consoleMessages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-start gap-2",
                  msg.type === 'error' && "text-red-400",
                  msg.type === 'warn' && "text-yellow-400",
                  msg.type === 'info' && "text-blue-400",
                  msg.type === 'log' && "text-gray-300"
                )}
              >
                <span className="text-gray-600">[{msg.timestamp.toLocaleTimeString()}]</span>
                <span className="whitespace-pre-wrap">{msg.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        projectData={{
          title: activeFile?.name.replace('.sol', '') || 'Solidity Contract',
          description: '',
          files: files.map(f => ({ filename: f.name, content: f.content })),
          category: 'sandbox'
        }}
        onShare={(url) => {
          log('info', `Project shared: ${url}`);
        }}
      />
      
      {/* Wallet Connect Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Connect Wallet</h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connect your wallet to share projects and access community features.
            </p>
            <WalletConnect onConnect={() => setShowWalletModal(false)} />
          </div>
        </div>
      )}
      
      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-6xl max-h-[90vh] mx-4 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Contract Templates</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">41 pre-built smart contract templates</p>
              </div>
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <TemplateSelector
                onTemplateSelect={handleTemplateSelect}
                compact={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
