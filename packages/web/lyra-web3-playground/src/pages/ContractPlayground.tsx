/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Crafting digital magic since day one ✨
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useSEO } from '@/hooks/useSEO';
import {
  Sparkles,
  Copy,
  CheckCircle,
  AlertCircle,
  Play,
  Rocket,
  Code2,
  FileCode,
  Menu,
  X,
  Wallet,
  Network,
  Loader2
} from 'lucide-react';
import { copyToClipboard } from '@/utils/helpers';
import { contractTemplates, ContractTemplate, searchTemplates } from '@/utils/contractTemplates';
import { useWalletStore } from '@/stores/walletStore';
import { useThemeStore } from '@/stores/themeStore';
import { LyraCompiler, CompileOutput, CompiledContract } from '@/services/lyraCompiler';

export default function ContractPlayground() {
  const { address, isConnected, chainId } = useWalletStore();
  const { mode } = useThemeStore();
  
  useSEO({
    title: 'AI Contract Playground',
    description: 'Generate and deploy smart contracts with AI. 40+ templates for ERC-20, ERC-721, DeFi, DAO, and more. Compile and deploy to any EVM chain in seconds.',
    path: '/playground'
  });
  
  // State
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [code, setCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileOutput | null>(null);
  const [compilerLog, setCompilerLog] = useState<string[]>([]);
  // Multi-file playground for web preview and other file types
  const [files, setFiles] = useState<{name: string; content: string}[]>(() => [
    { name: 'index.html', content: '<h1>Hello Lyra Playground</h1>\n<button id="btn">Click me</button>' },
    { name: 'styles.css', content: 'body { font-family: system-ui, sans-serif; padding: 24px; } button { padding:8px 12px; }' },
    { name: 'script.js', content: 'document.getElementById("btn").addEventListener("click", () => console.log("Button clicked"))' },
  ]);
  const [selectedFile, setSelectedFile] = useState<string>('index.html');
  const [showPreview, setShowPreview] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<Array<{type?:string; text: string; time: string}>>(() => [
    { type: 'log', text: '🚀 App initialized!', time: new Date().toLocaleTimeString() },
    { type: 'info', text: 'ℹ️ Try clicking the button', time: new Date().toLocaleTimeString() },
  ]);
  const previewTimer = useRef<number | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  
  const editorRef = useRef<any>(null);
  
  // Initialize Lyra Compiler with progress callback
  const compiler = useMemo(() => new LyraCompiler({
    onProgress: (msg) => setCompilerLog(prev => [...prev, msg])
  }), []);

  // Filter templates
  const filteredTemplates = searchQuery 
    ? searchTemplates(searchQuery)
    : selectedCategory === 'all' 
      ? contractTemplates 
      : contractTemplates.filter(t => t.category === selectedCategory);

  // Categories
  const categories = [
    { id: 'all', name: 'All Templates', count: contractTemplates.length },
    { id: 'token', name: 'Tokens', count: contractTemplates.filter(t => t.category === 'token').length },
    { id: 'nft', name: 'NFTs', count: contractTemplates.filter(t => t.category === 'nft').length },
    { id: 'defi', name: 'DeFi', count: contractTemplates.filter(t => t.category === 'defi').length },
    { id: 'dao', name: 'DAO', count: contractTemplates.filter(t => t.category === 'dao').length },
    { id: 'security', name: 'Security', count: contractTemplates.filter(t => t.category === 'security').length },
    { id: 'other', name: 'Utilities', count: contractTemplates.filter(t => t.category === 'other').length },
  ];

  // Blockchain networks
  const networks = [
    { id: 1, name: 'Ethereum Mainnet', testnet: false },
    { id: 11155111, name: 'Sepolia Testnet', testnet: true },
    { id: 137, name: 'Polygon Mainnet', testnet: false },
    { id: 80001, name: 'Mumbai Testnet', testnet: true },
    { id: 42161, name: 'Arbitrum One', testnet: false },
    { id: 10, name: 'Optimism', testnet: false },
  ];

  // Load template when selected
  useEffect(() => {
    if (selectedTemplate) {
      setCode(selectedTemplate.code);
      setError(null);
    }
  }, [selectedTemplate]);

  // AI Generation Handler
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe what contract you want to generate');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Simulate AI generation with delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simple keyword matching for demo (in production, use OpenAI/Claude)
      const matchedTemplates = searchTemplates(prompt);
      const template = matchedTemplates.length > 0 
        ? matchedTemplates[0] 
        : contractTemplates[0];

      setSelectedTemplate(template);
      
      // Add a comment with the prompt (sanitized)
      const sanitizedPrompt = prompt.replace(/[^\w\s.,!?-]/g, '').substring(0, 200);
      const codeWithPrompt = `// Generated from prompt: "${sanitizedPrompt}"\n\n${template.code}`;
      setCode(codeWithPrompt);
      setDeploymentStatus(null);
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate contract');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Handler
  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Compile Handler - Real compilation with Lyra Compiler
  const handleCompile = async () => {
    if (!code.trim()) {
      setError('No contract code to compile');
      return;
    }

    setIsCompiling(true);
    setError(null);
    setCompileResult(null);
    setCompilerLog([]);
    setDeploymentStatus('Starting compilation...');
    
    try {
      // Real compilation using Lyra Compiler
      const result = await compiler.compile({
        source: code,
        optimize: true,
        runs: 200,
      });
      
      setCompileResult(result);
      
      if (result.success) {
        const contractNames = result.contracts.map(c => c.name).join(', ');
        const warningCount = result.warnings.length;
        const warningMsg = warningCount > 0 ? ` (${warningCount} warning${warningCount > 1 ? 's' : ''})` : '';
        setDeploymentStatus(`✓ Compiled successfully: ${contractNames}${warningMsg}\n\nReady to deploy.`);
      } else {
        const errorMessages = result.errors.map(e => e.formattedMessage || e.message).join('\n');
        throw new Error(errorMessages || 'Compilation failed');
      }
    } catch (err: any) {
      console.error('Compilation error:', err);
      setError(err.message || 'Compilation failed');
      setDeploymentStatus(null);
    } finally {
      setIsCompiling(false);
    }
  };

  // Deploy Handler
  const handleDeploy = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!compileResult?.success || compileResult.contracts.length === 0) {
      setError('Please compile the contract first');
      return;
    }

    setIsDeploying(true);
    setError(null);
    setDeploymentStatus('Preparing deployment...');

    try {
      const contract = compileResult.contracts[0]; // Use first contract
      const networkName = networks.find(n => n.id === chainId)?.name || 'Unknown Network';
      
      // Check if MetaMask/wallet is available
      if (typeof window.ethereum === 'undefined') {
        throw new Error('No wallet detected. Please install MetaMask.');
      }

      setDeploymentStatus(`Deploying ${contract.name} to ${networkName}...`);
      
      // Get ethers from window (loaded via CDN or npm)
      const { ethers } = await import('ethers');
      
      // Create provider and signer from MetaMask
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Create contract factory
      const factory = new ethers.ContractFactory(
        contract.abi,
        contract.bytecode,
        signer
      );
      
      setDeploymentStatus(`Waiting for transaction confirmation...`);
      
      // Deploy the contract
      const deployedContract = await factory.deploy();
      
      // Wait for deployment to complete
      await deployedContract.waitForDeployment();
      
      const contractAddress = await deployedContract.getAddress();
      
      setDeploymentStatus(
        `✓ Contract deployed successfully!\n\nContract: ${contract.name}\nAddress: ${contractAddress}\nNetwork: ${networkName}\n\nYou can now interact with your contract.`
      );
    } catch (err: any) {
      console.error('Deployment error:', err);
      // Handle user rejection
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        setError('Transaction rejected by user');
      } else {
        setError(err.message || 'Failed to deploy contract');
      }
      setDeploymentStatus(null);
    } finally {
      setIsDeploying(false);
    }
  };

  // Utilities for multi-file editor / preview
  const getLanguageForFile = (name: string) => {
    const ext = name.split('.').pop() || '';
    switch (ext) {
      case 'html': return 'html';
      case 'css': return 'css';
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'json': return 'json';
      case 'sol': return 'sol';
      default: return 'plaintext';
    }
  };

  const updateFileContent = (name: string, content: string) => {
    setFiles(prev => prev.map(f => f.name === name ? { ...f, content } : f));
  };

  const deleteFile = (name: string) => {
    if (files.length <= 1) return; // Keep at least one file
    const newFiles = files.filter(f => f.name !== name);
    setFiles(newFiles);
    if (selectedFile === name) {
      setSelectedFile(newFiles[0]?.name || '');
    }
    schedulePreviewUpdate();
  };

  const renameFile = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    if (files.some(f => f.name === newName)) return; // Name conflict
    setFiles(prev => prev.map(f => f.name === oldName ? { ...f, name: newName } : f));
    if (selectedFile === oldName) {
      setSelectedFile(newName);
    }
    schedulePreviewUpdate();
  };

  const addNewFile = () => {
    const name = newFileName.trim();
    if (!name) return;
    if (files.some(f => f.name === name)) return; // Already exists
    setFiles(prev => [...prev, { name, content: '' }]);
    setSelectedFile(name);
    setNewFileModalOpen(false);
    setNewFileName('');
  };

  const buildPreviewSrcDoc = () => {
    const htmlFile = files.find(f => f.name.endsWith('.html'))?.content || '<div id="root"></div>';
    const css = files.filter(f => f.name.endsWith('.css')).map(f => f.content).join('\n');
    const js = files.filter(f => f.name.endsWith('.js')).map(f => f.content).join('\n');

    // Inject console bridge to post messages to parent
    const consoleBridge = `\n<script>;(function(){const origConsole={log:console.log,warn:console.warn,error:console.error,info:console.info};function send(type,args){try{parent.postMessage({__lyra_preview_console:true,type,entries:args.map(a=>String(a))},'*')}catch(e){}}['log','warn','error','info'].forEach(function(m){console[m]=function(){send(m,Array.from(arguments));try{origConsole[m].apply(console,arguments);}catch(e){}}});})();</script>`;

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" /><style>${css}</style></head><body>${htmlFile}${consoleBridge}<script>${js}</script></body></html>`;
  };

  // Debounced preview update
  const schedulePreviewUpdate = () => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      setPreviewKey(k => k + 1);
    }, 200);
  };

  // Listen for console messages from iframe
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      // Security: Only accept messages from our own iframe (same origin or blob URLs)
      if (ev.origin !== window.location.origin && !ev.origin.startsWith('blob:')) {
        // For sandboxed iframes, origin may be 'null' - verify source is our iframe
        if (ev.origin !== 'null') return;
      }
      
      const data = ev.data as { __lyra_preview_console?: boolean; type?: string; entries?: string[] };
      if (data && data.__lyra_preview_console) {
        const time = new Date().toLocaleTimeString();
        const text = (data.entries || []).join(' ');
        setConsoleLogs(prev => [{ type: data.type || 'log', text, time }, ...prev].slice(0, 200));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Example prompts
  const examplePrompts = [
    'Create an ERC20 token with minting functionality',
    'Build an NFT collection with max supply and minting price',
    'Make a simple escrow contract for payments',
    'Create a staking contract with rewards',
    'Build a DAO governance with voting',
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 flex-shrink-0">
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mr-4"
        >
          {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        
        <div className="flex items-center space-x-3 flex-1">
          <Sparkles className="w-6 h-6 text-primary-600" />
          <h1 className="text-xl font-bold">AI Contract Playground</h1>
        </div>

        <div className="flex items-center space-x-3">
          {isConnected ? (
            <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <Wallet className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
              </span>
              <Network className="w-4 h-4 text-green-600" />
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Connect wallet to deploy
            </div>
          )}
          
          <Link to="/" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600">
            Back to Examples
          </Link>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* AI Prompt Section */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-primary-600" />
                AI Generator
              </h2>
              
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your contract..."
                className="w-full h-24 p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full mt-2 btn-primary py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>

              {/* Example Prompts */}
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Examples:</p>
                <div className="space-y-1">
                  {examplePrompts.slice(0, 3).map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setPrompt(example)}
                      className="w-full text-left p-1.5 text-xs bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Templates Section */}
            <div className="flex-1 overflow-auto p-4">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <FileCode className="w-5 h-5 mr-2" />
                Templates
              </h2>

              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 mb-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />

              {/* Categories */}
              <div className="space-y-1 mb-4">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setSearchQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                      selectedCategory === category.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{category.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{category.count}</span>
                  </button>
                ))}
              </div>

              {/* Template List */}
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedTemplate?.id === template.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                    }`}
                  >
                    <div className="font-medium text-sm mb-1">{template.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                      {template.description}
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        template.difficulty === 'beginner' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : template.difficulty === 'intermediate'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}>
                        {template.difficulty}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {template.blockchain}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 space-x-2">
            <button
              onClick={handleCompile}
              disabled={!code.trim() || isCompiling}
              className="btn-secondary text-sm flex items-center disabled:opacity-50"
            >
              {isCompiling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {isCompiling ? 'Compiling...' : 'Compile'}
            </button>
            
            <button
              onClick={handleDeploy}
              disabled={!compileResult?.success || isDeploying || !isConnected}
              className="btn-primary text-sm flex items-center disabled:opacity-50"
            >
              <Rocket className="w-4 h-4 mr-2" />
              {isDeploying ? 'Deploying...' : 'Deploy'}
            </button>

            <div className="flex-1" />

            <button
              onClick={handleCopy}
              disabled={!code.trim()}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 flex items-center disabled:opacity-50"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Error/Status Messages */}
          {(error || deploymentStatus || compilerLog.length > 0) && (
            <div className="px-4 pt-4 space-y-2">
              {error && (
                <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <pre className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap font-mono">{error}</pre>
                </div>
              )}
              
              {compilerLog.length > 0 && isCompiling && (
                <div className="flex items-start space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
                  <div className="text-sm text-blue-800 dark:text-blue-200 font-mono">
                    {compilerLog.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                </div>
              )}
              
              {deploymentStatus && (
                <div className="flex items-start space-x-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <pre className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap font-mono">
                    {deploymentStatus}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Editor / Multi-file Playground */}
          <div className="flex-1 overflow-hidden flex">
            {/* Left: Editor area with file tabs */}
            <div className={`${showPreview ? 'w-1/2' : 'flex-1'} border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800`}>
              <div className="flex items-center px-3 py-2 border-b border-gray-100 dark:border-gray-700 gap-2">
                <div className="flex-1 flex items-center gap-1 overflow-x-auto">
                  {files.map((f) => (
                    <div
                      key={f.name}
                      className={`group flex items-center text-sm px-3 py-1 rounded-t-lg -mb-px cursor-pointer ${selectedFile === f.name ? 'bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-700 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      onClick={() => setSelectedFile(f.name)}
                    >
                      <span>{f.name}</span>
                      {files.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFile(f.name); }}
                          className="ml-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Delete file"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNewFileModalOpen(true)}
                    title="New file"
                    className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setShowPreview(s => !s)}
                    title="Toggle preview"
                    className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {selectedFile && selectedFile.endsWith('.sol') ? (
                  // Keep legacy contract editor when editing .sol files
                  <Editor
                    height="100%"
                    defaultLanguage="sol"
                    language="sol"
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    theme={mode === 'dark' ? 'vs-dark' : 'light'}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 4,
                      wordWrap: 'on',
                    }}
                    onMount={(editor) => { editorRef.current = editor; }}
                  />
                ) : (
                  <Editor
                    height="100%"
                    defaultLanguage={getLanguageForFile(selectedFile || 'index.html')}
                    language={getLanguageForFile(selectedFile || 'index.html')}
                    value={files.find(f => f.name === selectedFile)?.content || ''}
                    onChange={(value) => {
                      updateFileContent(selectedFile, value || '');
                      schedulePreviewUpdate();
                    }}
                    theme={mode === 'dark' ? 'vs-dark' : 'light'}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: 'on',
                    }}
                    onMount={(editor) => { editorRef.current = editor; }}
                  />
                )}
              </div>
            </div>

            {/* Right: Live preview + console */}
            {showPreview && (
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
              <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100">
                <div className="w-full h-full max-w-full max-h-full transition-all duration-300">
                  <iframe
                    key={previewKey}
                    ref={iframeRef}
                    title="Preview"
                    className="w-full h-full bg-white"
                    sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                    srcDoc={buildPreviewSrcDoc()}
                  />
                </div>
              </div>

              {showConsole && (
              <div className="h-48 bg-gray-900 border-t border-gray-700 flex flex-col">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-terminal w-4 h-4 text-gray-400"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg>
                    <span className="text-xs font-medium text-gray-400">Console</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">{consoleLogs.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setConsoleLogs([])} className="p-1 hover:bg-gray-700 rounded transition-colors" title="Clear console">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash2 w-3.5 h-3.5 text-gray-400"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>
                    </button>
                    <button onClick={() => setShowConsole(false)} className="p-1 hover:bg-gray-700 rounded transition-colors" title="Hide console">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-bottom-close w-3.5 h-3.5 text-gray-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="3" x2="21" y1="15" y2="15"></line><path d="m15 8-3 3-3-3"></path></svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto font-mono text-xs">
                  {consoleLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-gray-800">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${log.type === 'error' ? 'text-red-500' : log.type === 'warn' ? 'text-yellow-400' : log.type === 'info' ? 'text-blue-500' : 'text-gray-400'}`}><circle cx="12" cy="12" r="10"></circle></svg>
                      <span className={`flex-1 whitespace-pre-wrap break-all ${log.type === 'info' ? 'text-blue-400' : 'text-gray-300'}`}>{log.text}</span>
                      <span className="text-gray-600 text-[10px]">{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}
              {!showConsole && (
                <button
                  onClick={() => setShowConsole(true)}
                  className="h-8 bg-gray-800 border-t border-gray-700 flex items-center justify-center gap-2 text-xs text-gray-400 hover:bg-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg>
                  Console ({consoleLogs.length})
                </button>
              )}
            </div>
            )}
          </div>

          {/* Footer Info */}
          {selectedTemplate && (
            <div className="h-auto bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold mb-1">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedTemplate.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedTemplate.difficulty === 'beginner' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : selectedTemplate.difficulty === 'intermediate'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>
                    {selectedTemplate.difficulty}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New File Modal */}
      {newFileModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New File</h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.html, styles.css, script.js, contract.sol..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 mb-4 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') addNewFile();
                if (e.key === 'Escape') { setNewFileModalOpen(false); setNewFileName(''); }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setNewFileModalOpen(false); setNewFileName(''); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={addNewFile}
                disabled={!newFileName.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
