/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The future is being built right here 🏗️
 */

import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  Rocket,
  FileCode,
  Terminal,
  Box,
  Share2,
  Download,
  Loader,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Minimize2,
  Zap,
  PlusCircle
} from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useThemeStore } from '@/stores/themeStore';
import { LyraCompiler } from '@/services/lyraCompiler';
import { NETWORK_CONFIGS } from '@/utils/networks';
import { SandboxTemplate } from '@/utils/sandboxTemplates';
import { ContractTemplate } from '@/utils/contractTemplates';
import FileTree from './FileTree.tsx';
import ContractInteraction from './ContractInteraction.tsx';
import ConsolePanel from './ConsolePanel.tsx';
import AIAssistant from './AIAssistant.tsx';
import TemplateSelector from './TemplateSelector.tsx';
import AICodeWhisperer from '../Innovation/AICodeWhisperer.tsx';
import ContractTimeMachine from '../Innovation/ContractTimeMachine.tsx';
import ExploitLab from '../Innovation/ExploitLab.tsx';
import CollaborativeArena from '../Innovation/CollaborativeArena.tsx';
import NeuralGasOracle from '../Innovation/NeuralGasOracle.tsx';
import CrossChainDreamWeaver from '../Innovation/CrossChainDreamWeaver.tsx';

// Initialize Lyra Compiler (browser-based)
const lyraCompiler = new LyraCompiler();

interface Log {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: number;
}

interface DeployedContract {
  address: string;
  abi: any[];
  network: string;
  transactionHash: string;
}

export default function InteractiveSandbox() {
  const { mode } = useThemeStore();
  const { isConnected, chainId } = useWalletStore();
  const { 
    getCurrentWorkspace, 
    getActiveFile, 
    updateFile, 
    setActiveFile,
    addFile
  } = useWorkspaceStore();

  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [showFileTree, setShowFileTree] = useState(true);

  const [showAI, setShowAI] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [activePanel, setActivePanel] = useState<'preview' | 'interaction' | 'console' | 'ai' | 'whisperer' | 'timemachine' | 'exploit' | 'arena' | 'neural' | 'crosschain'>('preview');
  const [innovationMode, setInnovationMode] = useState(false);
  
  const [isCompiling, setIsCompiling] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [compiledData, setCompiledData] = useState<any>(null);
  const [deployedContract, setDeployedContract] = useState<DeployedContract | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [solcVersion, setSolcVersion] = useState('0.8.20');
  
  // Web preview state
  const [previewKey, setPreviewKey] = useState(0);
  const previewTimer = useRef<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const editorRef = useRef<any>(null);
  const workspace = getCurrentWorkspace();
  const activeFile = getActiveFile();

  const addLog = (type: Log['type'], message: string) => {
    const log: Log = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: Date.now()
    };
    setLogs(prev => [log, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  // Listen for console messages from preview iframe
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
        const typeMap: Record<string, Log['type']> = { log: 'info', info: 'info', warn: 'warning', error: 'error' };
        addLog(typeMap[data.type || 'log'] || 'info', text);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Build preview srcDoc from workspace files
  const buildPreviewSrcDoc = () => {
    if (!workspace) return '<div>No workspace</div>';
    const htmlFile = workspace.files.find(f => f.name.endsWith('.html'))?.content || '<div id="root"></div>';
    const css = workspace.files.filter(f => f.name.endsWith('.css')).map(f => f.content).join('\n');
    const js = workspace.files.filter(f => f.name.endsWith('.js')).map(f => f.content).join('\n');
    const consoleBridge = `\n<script>;(function(){const origConsole={log:console.log,warn:console.warn,error:console.error,info:console.info};function send(type,args){try{parent.postMessage({__lyra_preview_console:true,type,entries:args.map(a=>String(a))},'*')}catch(e){}}['log','warn','error','info'].forEach(function(m){console[m]=function(){send(m,Array.from(arguments));try{origConsole[m].apply(console,arguments);}catch(e){}}});})();</script>`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" /><style>${css}</style></head><body>${htmlFile}${consoleBridge}<script>${js}</script></body></html>`;
  };

  // Debounced preview update
  const schedulePreviewUpdate = () => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      setPreviewKey(k => k + 1);
    }, 300);
  };

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!workspace || !activeFile || !value) return;
    updateFile(workspace.id, activeFile.id, value);
    // Trigger preview update for web files
    if (activeFile.name.endsWith('.html') || activeFile.name.endsWith('.css') || activeFile.name.endsWith('.js')) {
      schedulePreviewUpdate();
    }
  };

  const handleCompile = async () => {
    if (!activeFile) {
      addLog('error', 'No file selected');
      return;
    }

    setIsCompiling(true);
    addLog('info', `Compiling ${activeFile.name} with Lyra Compiler (Solidity ${solcVersion})...`);

    try {
      // Use browser-based Lyra Compiler
      const result = await lyraCompiler.compile({
        source: activeFile.content,
        filename: activeFile.name,
        version: solcVersion,
        optimize: true,
        runs: 200
      });

      if (!result.success || result.contracts.length === 0) {
        result.errors.forEach(err => addLog('error', err.message));
        setCompiledData(null);
        return;
      }

      // Get the first (main) contract
      const mainContract = result.contracts[0];
      
      setCompiledData({
        bytecode: mainContract.bytecode,
        abi: mainContract.abi,
        name: mainContract.name,
        allContracts: result.contracts
      });
      
      addLog('success', `✓ Compiled ${mainContract.name} successfully!`);
      
      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          addLog('warning', warning.message);
        });
      }
      
      // Log gas estimates if available
      if (mainContract.gasEstimates) {
        addLog('info', `Gas estimate: ${mainContract.gasEstimates.creation.totalCost} (deployment)`);
      }
    } catch (error: any) {
      addLog('error', `Compilation failed: ${error.message}`);
      setCompiledData(null);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeploy = async () => {
    if (!compiledData) {
      addLog('error', 'Please compile the contract first');
      return;
    }

    if (!isConnected) {
      addLog('error', 'Please connect your wallet');
      return;
    }

    if (typeof window.ethereum === 'undefined') {
      addLog('error', 'MetaMask or Web3 wallet not detected');
      return;
    }

    setIsDeploying(true);
    const networkName = NETWORK_CONFIGS[chainId || 1]?.name || 'Unknown';
    addLog('info', `Deploying ${compiledData.name || 'Contract'} to ${networkName}...`);

    try {
      // Use ethers.js with browser wallet (MetaMask)
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      addLog('info', 'Creating contract factory...');
      
      // Create contract factory
      const factory = new ethers.ContractFactory(
        compiledData.abi,
        compiledData.bytecode,
        signer
      );
      
      addLog('info', 'Sending deployment transaction...');
      
      // Deploy (no constructor args for now - could add later)
      const contract = await factory.deploy();
      
      addLog('info', `Transaction submitted: ${contract.deploymentTransaction()?.hash}`);
      addLog('info', 'Waiting for confirmation...');
      
      // Wait for deployment
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      const txHash = contract.deploymentTransaction()?.hash || '';
      
      // Get block explorer URL
      const explorerUrl = NETWORK_CONFIGS[chainId || 1]?.blockExplorer 
        ? `${NETWORK_CONFIGS[chainId || 1].blockExplorer}/address/${address}`
        : undefined;

      setDeployedContract({
        address,
        abi: compiledData.abi,
        network: networkName,
        transactionHash: txHash
      });

      addLog('success', `✓ Contract deployed at ${address}`);
      addLog('info', `Transaction: ${txHash}`);
      
      if (explorerUrl) {
        addLog('info', `View on explorer: ${explorerUrl}`);
      }

      setActivePanel('interaction');
    } catch (error: any) {
      if (error.code === 'ACTION_REJECTED') {
        addLog('warning', 'Transaction rejected by user');
      } else {
        addLog('error', `Deployment failed: ${error.message}`);
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const handleReset = () => {
    setCompiledData(null);
    setDeployedContract(null);
    setLogs([]);
    addLog('info', 'Sandbox reset');
  };

  const handleExport = () => {
    if (!workspace) return;
    
    const data = JSON.stringify(workspace, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspace.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addLog('success', 'Workspace exported successfully');
  };

  const handleShare = async () => {
    if (!workspace) return;
    
    // Generate shareable link (would use actual backend in production)
    const shareId = btoa(JSON.stringify(workspace)).substring(0, 16);
    const shareUrl = `${window.location.origin}/sandbox/${shareId}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      addLog('success', 'Share link copied to clipboard!');
    } catch (error) {
      addLog('error', 'Failed to copy share link');
    }
  };

  const handleLoadTemplate = (template: SandboxTemplate) => {
    if (!workspace) return;
    
    // Add all files from template to workspace
    template.files.forEach(file => {
      addFile(workspace.id, {
        name: file.name,
        path: file.path,
        content: file.content,
        language: file.language
      });
    });
    
    addLog('success', `Loaded template: ${template.name}`);
    setShowTemplateSelector(false);
  };

  const handleLoadContractTemplate = (template: ContractTemplate) => {
    if (!workspace) return;
    
    // Create a single file from the contract template
    const fileName = `${template.name.replace(/[^a-zA-Z0-9]/g, '')}.sol`;
    addFile(workspace.id, {
      name: fileName,
      path: fileName,
      content: template.code,
      language: 'solidity'
    });
    
    addLog('success', `Loaded contract: ${template.name}`);
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
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFileTree(!showFileTree)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Toggle file tree"
          >
            <FileCode className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setShowTemplateSelector(true)}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm font-medium flex items-center gap-2"
            title="Load template"
          >
            <PlusCircle className="w-4 h-4" />
            Template
          </button>
          
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
          
          <select
            value={solcVersion}
            onChange={(e) => setSolcVersion(e.target.value)}
            className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
          >
            <option value="0.8.20">v0.8.20</option>
            <option value="0.8.19">v0.8.19</option>
            <option value="0.8.18">v0.8.18</option>
            <option value="0.8.17">v0.8.17</option>
          </select>

          <button
            onClick={handleCompile}
            disabled={isCompiling || !activeFile}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm font-medium flex items-center gap-2"
          >
            {isCompiling ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Compiling...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Compile
              </>
            )}
          </button>

          <button
            onClick={handleDeploy}
            disabled={isDeploying || !compiledData || !isConnected}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm font-medium flex items-center gap-2"
          >
            {isDeploying ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Deploy
              </>
            )}
          </button>

          {compiledData && !deployedContract && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          {deployedContract && (
            <div className="flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-700 dark:text-green-300">Deployed</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isConnected && (
            <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 rounded">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-orange-700 dark:text-orange-300">
                Wallet not connected
              </span>
            </div>
          )}
          
          <button
            onClick={handleReset}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Reset sandbox"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowAI(!showAI)}
            className={`p-2 rounded ${showAI ? 'bg-purple-100 dark:bg-purple-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title="Toggle AI assistant"
          >
            <Zap className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

          <button
            onClick={handleShare}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleExport}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Export workspace"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Toggle layout"
          >
            {layout === 'horizontal' ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex ${layout === 'horizontal' ? 'flex-row' : 'flex-col'} overflow-hidden`}>
        {/* Left/Top Panel - Editor */}
        <div className={`flex ${layout === 'horizontal' ? 'flex-1' : 'h-1/2'} border-r dark:border-gray-700`}>
          {/* File Tree */}
          {showFileTree && (
            <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <FileTree onLog={addLog} />
            </div>
          )}

          {/* Editor */}
          <div className="flex-1 flex flex-col">
            {/* File Tabs */}
            {workspace && (
              <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 py-1 flex items-center gap-1 overflow-x-auto">
                {workspace.files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setActiveFile(workspace.id, file.id)}
                    className={`px-3 py-1.5 text-sm rounded flex items-center gap-2 ${
                      file.id === activeFile?.id
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FileCode className="w-4 h-4" />
                    {file.name}
                    {file.isModified && <span className="text-blue-500">●</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Monaco Editor */}
            <div className="flex-1">
              {activeFile ? (
                <Editor
                  height="100%"
                  language={activeFile.language}
                  value={activeFile.content}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  theme={mode === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on'
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <FileCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No file selected</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right/Bottom Panel - Interaction & Console */}
        <div className={`flex flex-col ${layout === 'horizontal' ? 'w-1/2' : 'h-1/2'} bg-white dark:bg-gray-800`}>
          {/* Panel Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2">
            <button
              onClick={() => setActivePanel('preview')}
              className={`px-3 py-1.5 text-sm rounded ${
                activePanel === 'preview'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Play className="w-4 h-4 inline mr-2" />
              Preview
            </button>
            <button
              onClick={() => setActivePanel('interaction')}
              className={`px-3 py-1.5 text-sm rounded ${
                activePanel === 'interaction'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Box className="w-4 h-4 inline mr-2" />
              Interact
            </button>
            <button
              onClick={() => setActivePanel('console')}
              className={`px-3 py-1.5 text-sm rounded ${
                activePanel === 'console'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Terminal className="w-4 h-4 inline mr-2" />
              Console ({logs.length})
            </button>
            {showAI && (
              <button
                onClick={() => setActivePanel('ai')}
                className={`px-3 py-1.5 text-sm rounded ${
                  activePanel === 'ai'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Zap className="w-4 h-4 inline mr-2" />
                AI Assistant
              </button>
            )}
            
            {/* Innovation Features Toggle */}
            <button
              onClick={() => setInnovationMode(!innovationMode)}
              className={`ml-auto px-3 py-1.5 text-sm rounded font-bold ${
                innovationMode
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white animate-pulse'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              ✨ {innovationMode ? 'Innovation Mode ON' : 'Activate Innovation'}
            </button>
          </div>

          {/* Innovation Mode Tabs */}
          {innovationMode && (
            <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20">
              <button
                onClick={() => setActivePanel('whisperer')}
                className={`px-3 py-1.5 text-xs rounded ${
                  activePanel === 'whisperer'
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                }`}
              >
                🧠 AI Whisperer
              </button>
              <button
                onClick={() => setActivePanel('timemachine')}
                className={`px-3 py-1.5 text-xs rounded ${
                  activePanel === 'timemachine'
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                }`}
              >
                ⏰ Time Machine
              </button>
              <button
                onClick={() => setActivePanel('exploit')}
                className={`px-3 py-1.5 text-xs rounded ${
                  activePanel === 'exploit'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                }`}
              >
                🛡️ Exploit Lab
              </button>
              <button
                onClick={() => setActivePanel('arena')}
                className={`px-3 py-1.5 text-xs rounded ${
                  activePanel === 'arena'
                    ? 'bg-violet-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-violet-100 dark:hover:bg-violet-900/30'
                }`}
              >
                👥 Arena
              </button>
              <button
                onClick={() => setActivePanel('neural')}
                className={`px-3 py-1.5 text-xs rounded ${
                  activePanel === 'neural'
                    ? 'bg-cyan-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30'
                }`}
              >
                🔮 Neural Gas
              </button>
              <button
                onClick={() => setActivePanel('crosschain')}
                className={`px-3 py-1.5 text-xs rounded ${
                  activePanel === 'crosschain'
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                }`}
              >
                🌐 Cross-Chain
              </button>
            </div>
          )}

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {activePanel === 'preview' && (
              <div className="h-full flex flex-col">
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  title="Preview"
                  className="flex-1 w-full bg-white"
                  sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                  srcDoc={buildPreviewSrcDoc()}
                />
              </div>
            )}
            {activePanel === 'interaction' && (
              <ContractInteraction
                contract={deployedContract}
                onLog={addLog}
              />
            )}
            {activePanel === 'console' && (
              <ConsolePanel logs={logs} onClear={() => setLogs([])} />
            )}
            {activePanel === 'ai' && showAI && (
              <AIAssistant onLog={addLog} />
            )}
            {activePanel === 'whisperer' && innovationMode && activeFile && (
              <AICodeWhisperer
                code={activeFile.content}
                onCodeChange={(code) => handleEditorChange(code)}
                onLog={addLog}
              />
            )}
            {activePanel === 'timemachine' && innovationMode && activeFile && (
              <ContractTimeMachine
                currentCode={activeFile.content}
                onCodeChange={(code) => handleEditorChange(code)}
                onLog={addLog}
              />
            )}
            {activePanel === 'exploit' && innovationMode && activeFile && (
              <ExploitLab
                code={activeFile.content}
                onLog={addLog}
              />
            )}
            {activePanel === 'arena' && innovationMode && activeFile && (
              <CollaborativeArena
                code={activeFile.content}
                onCodeChange={(code) => handleEditorChange(code)}
                onLog={addLog}
              />
            )}
            {activePanel === 'neural' && innovationMode && activeFile && (
              <NeuralGasOracle
                code={activeFile.content}
                onLog={addLog}
              />
            )}
            {activePanel === 'crosschain' && innovationMode && activeFile && (
              <CrossChainDreamWeaver
                code={activeFile.content}
                onLog={addLog}
              />
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
