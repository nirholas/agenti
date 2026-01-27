/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your dedication inspires others 🌠
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useThemeStore } from '@/stores/themeStore';
import { 
  Play, 
  Rocket, 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  Send, 
  Terminal, 
  Code2, 
  FileCode, 
  Globe, 
  Copy, 
  Check, 
  Settings, 
  Maximize2, 
  Minimize2,
  RefreshCw,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Box,
  Activity,
  Trash2,
  ExternalLink,
  Wallet,
  Coins
} from 'lucide-react';
import { cn } from '@/utils/helpers';
import { getTemplateById } from '@/utils/contractTemplates';

// =============================================================================
// TYPES
// =============================================================================

interface UnifiedSandboxProps {
  templateId?: string;
  initialContract?: string;
  initialFrontend?: string;
  title?: string;
  description?: string;
}

interface ConsoleMessage {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

interface CompilationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  abi: any[];
  bytecode: string;
  gasEstimate: string;
}

interface DeployedContract {
  id: string;
  name: string;
  address: string;
  abi: any[];
  deployedAt: Date;
}

// =============================================================================
// UTILS
// =============================================================================

const generateAddress = () => 
  '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const generateTxHash = () => 
  '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

// Generate frontend from contract
const generateFrontendFromContract = (contractCode: string, contractName: string): string => {
  // Parse the ABI from contract code
  interface FuncInput { name: string; type: string; }
  interface ParsedFunc { name: string; inputs: FuncInput[]; isView: boolean; }
  const functions: ParsedFunc[] = [];
  const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*(public|external)?\s*(view|pure|payable)?\s*(returns\s*\(([^)]*)\))?/g;
  let match;
  
  while ((match = funcRegex.exec(contractCode)) !== null) {
    const [, name, params, , mutability, , returns] = match;
    const inputs = params.split(',').filter(p => p.trim()).map(p => {
      const parts = p.trim().split(/\s+/);
      return { name: parts[1] || parts[0], type: parts[0] };
    });
    functions.push({ name, inputs, isView: mutability === 'view' || mutability === 'pure' });
  }
  
  return `import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Auto-generated dApp Frontend for ${contractName}
// This connects to the deployed contract and provides a UI for all functions

const CONTRACT_ABI = ${JSON.stringify(functions.map(f => ({
    type: 'function',
    name: f.name,
    inputs: f.inputs,
    stateMutability: f.isView ? 'view' : 'nonpayable'
  })), null, 2)};

export default function ${contractName}App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  
  const CONTRACT_ADDRESS = '0x...'; // Replace with deployed address
  
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const web3Signer = await web3Provider.getSigner();
        
        setProvider(web3Provider);
        setSigner(web3Signer);
        setAccount(accounts[0]);
        
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          web3Signer
        );
        setContract(contractInstance);
      } catch (error) {
        console.error('Connection failed:', error);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };
  
  ${functions.map(func => `
  const call${func.name.charAt(0).toUpperCase() + func.name.slice(1)} = async (${func.inputs.map(i => i.name).join(', ')}) => {
    if (!contract) return;
    setLoading(prev => ({ ...prev, ${func.name}: true }));
    try {
      ${func.isView 
        ? `const result = await contract.${func.name}(${func.inputs.map(i => i.name).join(', ')});
      setResults(prev => ({ ...prev, ${func.name}: result.toString() }));`
        : `const tx = await contract.${func.name}(${func.inputs.map(i => i.name).join(', ')});
      const receipt = await tx.wait();
      setResults(prev => ({ ...prev, ${func.name}: 'TX: ' + receipt.hash }));`
      }
    } catch (error) {
      console.error('${func.name} failed:', error);
      setResults(prev => ({ ...prev, ${func.name}: 'Error: ' + error.message }));
    } finally {
      setLoading(prev => ({ ...prev, ${func.name}: false }));
    }
  };
  `).join('')}
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">${contractName} dApp</h1>
        <p className="text-gray-400 mb-8">Interact with the ${contractName} smart contract</p>
        
        {!account ? (
          <button
            onClick={connectWallet}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <p className="text-sm text-gray-400">Connected Account</p>
              <p className="font-mono text-sm">{account.slice(0, 6)}...{account.slice(-4)}</p>
            </div>
            
            ${functions.map(func => `
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <h3 className="font-semibold mb-3">${func.name}()</h3>
              ${func.inputs.map(input => `
              <input
                type="text"
                placeholder="${input.name} (${input.type})"
                className="w-full bg-gray-700 rounded-lg px-4 py-2 mb-2"
                id="input-${func.name}-${input.name}"
              />`).join('')}
              <button
                onClick={() => call${func.name.charAt(0).toUpperCase() + func.name.slice(1)}(${func.inputs.map(i => `document.getElementById('input-${func.name}-${i.name}').value`).join(', ')})}
                disabled={loading.${func.name}}
                className="${func.isView ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'} px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading.${func.name} ? 'Loading...' : '${func.isView ? 'Read' : 'Write'}'}
              </button>
              {results.${func.name} && (
                <p className="mt-2 text-sm font-mono bg-gray-900 p-2 rounded">{results.${func.name}}</p>
              )}
            </div>
            `).join('')}
          </div>
        )}
      </div>
    </div>
  );
}`;
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function UnifiedSandbox({ 
  templateId = 'erc20-basic',
  initialContract,
  initialFrontend,
  title,
  description 
}: UnifiedSandboxProps) {
  // Get template if available
  const template = templateId ? getTemplateById(templateId) : undefined;
  const contractCode = initialContract || template?.code || '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract Hello {\n    string public greeting = "Hello, World!";\n}';
  const contractName = contractCode.match(/contract\s+(\w+)/)?.[1] || 'Contract';
  
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  
  const { mode } = useThemeStore();
  const [activeTab, setActiveTab] = useState<'contract' | 'frontend' | 'preview'>('contract');
  const [contract, setContract] = useState(contractCode);
  const [frontend, setFrontend] = useState(initialFrontend || generateFrontendFromContract(contractCode, contractName));
  
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null);
  
  const [deployedContracts, setDeployedContracts] = useState<DeployedContract[]>([]);
  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());
  const [functionInputs, setFunctionInputs] = useState<Record<string, Record<string, Record<string, string>>>>({});
  
  const [console, setConsole] = useState<ConsoleMessage[]>([]);
  const [showConsole, setShowConsole] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<any>(null);
  
  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  
  const log = useCallback((type: ConsoleMessage['type'], message: string) => {
    setConsole(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      type,
      message,
      timestamp: new Date()
    }]);
  }, []);
  
  const clearConsole = () => setConsole([]);
  
  const parseABI = (code: string): any[] => {
    const abi: any[] = [];
    const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*(public|external|internal|private)?\s*(view|pure|payable)?\s*(returns\s*\(([^)]*)\))?/g;
    let match;
    
    while ((match = funcRegex.exec(code)) !== null) {
      const [, name, params, visibility, mutability, , returns] = match;
      if (visibility === 'internal' || visibility === 'private') continue;
      
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
        stateMutability: mutability || 'nonpayable'
      });
    }
    
    return abi;
  };
  
  const compile = async () => {
    setIsCompiling(true);
    setCompilationResult(null);
    log('info', 'Compiling contract...');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!contract.includes('pragma solidity')) {
      errors.push('Missing pragma statement');
    }
    if (!contract.includes('SPDX-License-Identifier')) {
      warnings.push('Missing SPDX license identifier');
    }
    
    const result: CompilationResult = {
      success: errors.length === 0,
      errors,
      warnings,
      abi: parseABI(contract),
      bytecode: '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe',
      gasEstimate: '68716'
    };
    
    setCompilationResult(result);
    setIsCompiling(false);
    
    if (result.success) {
      log('log', `✓ Compilation successful`);
      log('log', `  ABI: ${result.abi.length} functions`);
    } else {
      log('error', '✗ Compilation failed');
      errors.forEach(e => log('error', `  ${e}`));
    }
    warnings.forEach(w => log('warn', `  ${w}`));
  };
  
  const deploy = async () => {
    if (!compilationResult?.success) {
      log('error', 'Please compile first');
      return;
    }
    
    log('info', `Deploying ${contractName}...`);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const deployed: DeployedContract = {
      id: Date.now().toString(),
      name: contractName,
      address: generateAddress(),
      abi: compilationResult.abi,
      deployedAt: new Date()
    };
    
    setDeployedContracts(prev => [...prev, deployed]);
    setExpandedContracts(prev => new Set([...prev, deployed.id]));
    
    log('log', `✓ Deployed at ${deployed.address}`);
    log('log', `  Gas: ${compilationResult.gasEstimate}`);
  };
  
  const callFunction = async (contractId: string, func: any, isWrite: boolean) => {
    const inputs = functionInputs[contractId]?.[func.name] || {};
    const args = func.inputs.map((i: any) => inputs[i.name] || '');
    
    log('info', `Calling ${func.name}(${args.join(', ')})...`);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const result = func.outputs?.length > 0 
      ? (func.outputs[0].type.includes('uint') ? Math.floor(Math.random() * 1000).toString() : 'true')
      : 'success';
    
    log('log', `✓ Result: ${result}`);
  };
  
  const runPreview = () => {
    if (!iframeRef.current) return;
    
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    
    const previewCode = `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>body { margin: 0; }</style>
      </head>
      <body>
        <div id="root"></div>
        <script type="text/babel">
          ${frontend.replace(/export default function/g, 'function').replace(/import .+?;/g, '')}
          const App = ${contractName}App;
          ReactDOM.createRoot(document.getElementById('root')).render(<App />);
        </script>
      </body>
      </html>
    `;
    
    doc.open();
    doc.write(previewCode);
    doc.close();
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
  
  const regenerateFrontend = () => {
    const name = contract.match(/contract\s+(\w+)/)?.[1] || 'Contract';
    setFrontend(generateFrontendFromContract(contract, name));
    log('info', 'Frontend regenerated from contract');
  };
  
  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    if (activeTab === 'preview') {
      runPreview();
    }
  }, [activeTab, frontend]);
  
  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  
  return (
    <div className={cn(
      "flex flex-col h-screen bg-gray-900 text-white",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-purple-500" />
            <span className="font-semibold">{title || template?.name || 'Unified Sandbox'}</span>
          </div>
          {description && (
            <span className="text-xs text-gray-400 hidden md:inline">
              {description || template?.description}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={compile}
            disabled={isCompiling}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50"
          >
            {isCompiling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Compile
          </button>
          <button
            onClick={deploy}
            disabled={!compilationResult?.success}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded text-sm font-medium disabled:opacity-50"
          >
            <Rocket className="w-4 h-4" />
            Deploy
          </button>
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-700 rounded"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>
      
      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Section */}
        <div className="flex-1 flex flex-col border-r border-gray-700">
          {/* Tabs */}
          <div className="flex bg-gray-800 border-b border-gray-700">
            {[
              { id: 'contract', icon: FileCode, label: 'Contract.sol' },
              { id: 'frontend', icon: Globe, label: 'Frontend.jsx' },
              { id: 'preview', icon: Eye, label: 'Preview' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-gray-900 text-white border-b-2 border-purple-500"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            
            {activeTab === 'frontend' && (
              <button
                onClick={regenerateFrontend}
                className="ml-auto mr-2 flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </button>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1">
            {activeTab === 'contract' && (
              <Editor
                height="100%"
                language="sol"
                value={contract}
                theme={mode === 'dark' ? 'vs-dark' : 'light'}
                onChange={(v) => setContract(v || '')}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16 },
                }}
              />
            )}
            
            {activeTab === 'frontend' && (
              <Editor
                height="100%"
                language="javascript"
                value={frontend}
                theme={mode === 'dark' ? 'vs-dark' : 'light'}
                onChange={(v) => setFrontend(v || '')}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16 },
                }}
              />
            )}
            
            {activeTab === 'preview' && (
              <iframe
                ref={iframeRef}
                className="w-full h-full bg-white"
                sandbox="allow-scripts"
              />
            )}
          </div>
        </div>
        
        {/* Right Panel - Deployed Contracts */}
        <div className="w-72 bg-gray-850 flex flex-col">
          <div className="p-3 border-b border-gray-700">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Box className="w-4 h-4 text-orange-400" />
              Deployed Contracts
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {deployedContracts.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No contracts deployed yet
              </div>
            ) : (
              deployedContracts.map(c => (
                <div key={c.id} className="bg-gray-800 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedContracts(prev => {
                      const next = new Set(prev);
                      next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                      return next;
                    })}
                    className="w-full flex items-center gap-2 p-3 hover:bg-gray-700/50"
                  >
                    {expandedContracts.has(c.id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="font-medium text-orange-400">{c.name}</span>
                  </button>
                  
                  {expandedContracts.has(c.id) && (
                    <div className="p-3 pt-0 space-y-2">
                      <div className="text-xs font-mono text-gray-400 bg-gray-900 p-2 rounded flex items-center justify-between">
                        <span>{c.address.slice(0, 10)}...</span>
                        <button onClick={() => navigator.clipboard.writeText(c.address)}>
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {c.abi.map((func, i) => {
                        const isView = func.stateMutability === 'view' || func.stateMutability === 'pure';
                        return (
                          <div key={i} className="space-y-1">
                            {func.inputs.map((input: any, j: number) => (
                              <input
                                key={j}
                                type="text"
                                placeholder={`${input.name || 'arg'} (${input.type})`}
                                value={functionInputs[c.id]?.[func.name]?.[input.name] || ''}
                                onChange={(e) => updateFunctionInput(c.id, func.name, input.name, e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono"
                              />
                            ))}
                            <button
                              onClick={() => callFunction(c.id, func, !isView)}
                              className={cn(
                                "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium",
                                isView
                                  ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                                  : "bg-orange-600/20 text-orange-400 hover:bg-orange-600/30"
                              )}
                            >
                              <span>{func.name}</span>
                              {isView ? <Eye className="w-3 h-3" /> : <Send className="w-3 h-3" />}
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
        </div>
      </div>
      
      {/* Console */}
      {showConsole && (
        <div className="h-32 bg-gray-900 border-t border-gray-700 flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-400">Console</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearConsole} className="p-1 hover:bg-gray-700 rounded">
                <Trash2 className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button onClick={() => setShowConsole(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5">
            {console.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  msg.type === 'error' && 'text-red-400',
                  msg.type === 'warn' && 'text-yellow-400',
                  msg.type === 'info' && 'text-blue-400',
                  msg.type === 'log' && 'text-gray-300'
                )}
              >
                <span className="text-gray-600">[{msg.timestamp.toLocaleTimeString()}]</span>{' '}
                {msg.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
