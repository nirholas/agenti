/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Small steps lead to big achievements 🏔️
 */

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useThemeStore } from '@/stores/themeStore';
import { 
  Play, 
  RefreshCw, 
  Copy, 
  CheckCircle, 
  FileCode, 
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Terminal,
  ChevronDown,
  ChevronRight,
  Loader,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { copyToClipboard } from '@/utils/helpers';

interface CodeFile {
  id: string;
  name: string;
  language: string;
  code: string;
  icon?: React.ReactNode;
}

interface ConsoleMessage {
  type: 'log' | 'error' | 'warn' | 'success' | 'info';
  message: string;
  timestamp: number;
}

interface ContractFunction {
  name: string;
  type: 'read' | 'write';
  inputs: { name: string; type: string }[];
  outputs?: string[];
}

interface FullStackPlaygroundProps {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  files: CodeFile[];
  contractFunctions?: ContractFunction[];
  initialState?: Record<string, any>;
  onDeploy?: () => Promise<{ address: string; success: boolean }>;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop' | 'full';

export default function FullStackPlayground({
  title,
  description,
  difficulty,
  files: initialFiles,
  contractFunctions = [],
  initialState = {},
  onDeploy
}: FullStackPlaygroundProps) {
  const { mode } = useThemeStore();
  const [files, setFiles] = useState<CodeFile[]>(initialFiles);
  const [activeFileId, setActiveFileId] = useState(initialFiles[0]?.id || '');
  const [copied, setCopied] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>('full');
  const [showConsole, setShowConsole] = useState(true);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [contractState, setContractState] = useState(initialState);
  const [functionInputs, setFunctionInputs] = useState<Record<string, Record<string, string>>>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  // Get files by type
  const solidityFiles = files.filter(f => f.language === 'solidity');
  const frontendFiles = files.filter(f => ['html', 'css', 'javascript', 'typescript', 'tsx'].includes(f.language));

  const viewportSizes: Record<ViewportSize, { width: string; label: string; icon: React.ReactNode }> = {
    mobile: { width: '375px', label: 'Mobile', icon: <Smartphone className="w-4 h-4" /> },
    tablet: { width: '768px', label: 'Tablet', icon: <Tablet className="w-4 h-4" /> },
    desktop: { width: '1024px', label: 'Desktop', icon: <Monitor className="w-4 h-4" /> },
    full: { width: '100%', label: 'Full', icon: <Monitor className="w-4 h-4" /> }
  };

  const difficultyColors = {
    Beginner: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    Intermediate: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    Advanced: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
  };

  // Log to console
  const log = (type: ConsoleMessage['type'], message: string) => {
    setConsoleMessages(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };

  // Handle code change
  const handleCodeChange = (fileId: string, code: string) => {
    setFiles(files.map(f => f.id === fileId ? { ...f, code } : f));
  };

  // Handle copy
  const handleCopy = async (code: string, fileId: string) => {
    await copyToClipboard(code);
    setCopied(fileId);
    setTimeout(() => setCopied(null), 2000);
  };

  // Simulate contract deployment
  const handleDeploy = async () => {
    setIsDeploying(true);
    log('info', '🚀 Compiling smart contract...');
    
    await new Promise(r => setTimeout(r, 800));
    log('success', '✓ Compilation successful');
    
    await new Promise(r => setTimeout(r, 500));
    log('info', '📡 Deploying to simulated blockchain...');
    
    await new Promise(r => setTimeout(r, 1000));
    
    const address = '0x' + Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    setContractAddress(address);
    log('success', `✓ Contract deployed at ${address.slice(0, 10)}...${address.slice(-8)}`);
    log('info', '🎉 Ready to interact!');
    
    setIsDeploying(false);
  };

  // Simulate contract function call
  const handleFunctionCall = async (fn: ContractFunction) => {
    const inputs = functionInputs[fn.name] || {};
    
    log('info', `📝 Calling ${fn.name}(${Object.values(inputs).join(', ')})...`);
    
    await new Promise(r => setTimeout(r, 500));
    
    // Simulate different function behaviors
    if (fn.type === 'read') {
      const result = contractState[fn.name] ?? 'N/A';
      log('success', `✓ Result: ${result}`);
    } else {
      log('success', `✓ Transaction confirmed`);
      // Update state based on function
      if (fn.name === 'mint' || fn.name === 'transfer') {
        setContractState(prev => ({
          ...prev,
          totalSupply: (prev.totalSupply || 0) + 1,
          balance: (prev.balance || 0) + parseFloat(inputs.amount || '1')
        }));
      }
    }
  };

  // Update live preview
  useEffect(() => {
    updatePreview();
  }, [files, contractState, contractAddress]);

  const updatePreview = () => {
    if (!iframeRef.current) return;

    const htmlFile = files.find(f => f.language === 'html');
    const cssFile = files.find(f => f.language === 'css');
    const jsFile = files.find(f => f.language === 'javascript');

    if (!htmlFile) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Inject contract state into the preview
    const contractScript = `
      window.CONTRACT_ADDRESS = "${contractAddress || ''}";
      window.CONTRACT_STATE = ${JSON.stringify(contractState)};
      window.IS_DEPLOYED = ${!!contractAddress};
    `;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          ${cssFile?.code || ''}
        </style>
      </head>
      <body>
        ${htmlFile.code}
        <script>${contractScript}</script>
        <script>
          // Console capture
          const origLog = console.log;
          const origError = console.error;
          console.log = (...args) => {
            window.parent.postMessage({ type: 'console', level: 'log', message: args.join(' ') }, '*');
            origLog.apply(console, args);
          };
          console.error = (...args) => {
            window.parent.postMessage({ type: 'console', level: 'error', message: args.join(' ') }, '*');
            origError.apply(console, args);
          };
        </script>
        <script>
          try {
            ${jsFile?.code || ''}
          } catch (e) {
            console.error('Error:', e.message);
          }
        </script>
      </body>
      </html>
    `;

    doc.open();
    doc.write(content);
    doc.close();
  };

  // Listen for console messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Only accept messages from our own iframe (same origin or blob URLs)
      if (event.origin !== window.location.origin && !event.origin.startsWith('blob:')) {
        // For sandboxed iframes, origin may be 'null' - verify source is our iframe
        if (event.origin !== 'null') return;
      }
      
      if (event.data?.type === 'console') {
        log(event.data.level || 'log', event.data.message || '');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="flex-none bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-white">{title}</h1>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${difficultyColors[difficulty]}`}>
              {difficulty}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg font-medium transition-colors"
            >
              {isDeploying ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {contractAddress ? 'Redeploy' : 'Deploy Contract'}
                </>
              )}
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code Editor */}
        <div className="w-1/2 flex flex-col border-r border-gray-700">
          {/* File Tabs */}
          <div className="flex-none flex items-center bg-gray-800 border-b border-gray-700 overflow-x-auto">
            {files.map(file => (
              <button
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-r border-gray-700 transition-colors ${
                  activeFileId === file.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <FileCode className="w-4 h-4" />
                {file.name}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => handleCopy(activeFile.code, activeFile.id)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {copied === activeFile.id ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Editor */}
          <div className="flex-1">
            <Editor
              height="100%"
              language={activeFile.language}
              value={activeFile.code}
              onChange={(value) => handleCodeChange(activeFile.id, value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                padding: { top: 10 }
              }}
            />
          </div>
        </div>

        {/* Right: Preview + Contract Interaction */}
        <div className="w-1/2 flex flex-col">
          {/* Preview Header */}
          <div className="flex-none flex items-center justify-between bg-gray-800 border-b border-gray-700 px-4 py-2">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-white">Live Preview</span>
              {contractAddress && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  Deployed
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1">
              {(Object.keys(viewportSizes) as ViewportSize[]).map(size => (
                <button
                  key={size}
                  onClick={() => setViewport(size)}
                  className={`p-1.5 rounded transition-colors ${
                    viewport === size
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-500 hover:text-white'
                  }`}
                  title={viewportSizes[size].label}
                >
                  {viewportSizes[size].icon}
                </button>
              ))}
            </div>
          </div>

          {/* Preview + Contract Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Live Preview */}
            <div className="flex-1 bg-gray-950 flex items-center justify-center overflow-auto p-4">
              <div
                className="bg-white h-full shadow-2xl rounded-lg overflow-hidden"
                style={{ width: viewportSizes[viewport].width, maxWidth: '100%' }}
              >
                <iframe
                  ref={iframeRef}
                  title="Live Preview"
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            </div>

            {/* Contract Interaction Panel */}
            {contractAddress && contractFunctions.length > 0 && (
              <div className="flex-none bg-gray-800 border-t border-gray-700 p-4 max-h-48 overflow-auto">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Contract Functions
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {contractFunctions.map(fn => (
                    <div
                      key={fn.name}
                      className="bg-gray-900 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-white">{fn.name}()</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          fn.type === 'read' 
                            ? 'bg-blue-900 text-blue-300' 
                            : 'bg-orange-900 text-orange-300'
                        }`}>
                          {fn.type}
                        </span>
                      </div>
                      {fn.inputs.map(input => (
                        <input
                          key={input.name}
                          type="text"
                          placeholder={`${input.name} (${input.type})`}
                          className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white mb-2"
                          onChange={e => setFunctionInputs(prev => ({
                            ...prev,
                            [fn.name]: { ...prev[fn.name], [input.name]: e.target.value }
                          }))}
                        />
                      ))}
                      <button
                        onClick={() => handleFunctionCall(fn)}
                        className={`w-full py-1 text-xs font-medium rounded ${
                          fn.type === 'read'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                        }`}
                      >
                        {fn.type === 'read' ? 'Query' : 'Execute'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Console */}
          <div className={`flex-none bg-gray-900 border-t border-gray-700 transition-all ${showConsole ? 'h-32' : 'h-8'}`}>
            <button
              onClick={() => setShowConsole(!showConsole)}
              className="w-full flex items-center justify-between px-4 py-1 text-sm text-gray-400 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Console
                {consoleMessages.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">
                    {consoleMessages.length}
                  </span>
                )}
              </div>
              {showConsole ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showConsole && (
              <div className="h-24 overflow-auto px-4 py-2 font-mono text-xs space-y-1">
                {consoleMessages.length === 0 ? (
                  <div className="text-gray-500">No messages yet. Deploy the contract to get started.</div>
                ) : (
                  consoleMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 ${
                        msg.type === 'error' ? 'text-red-400' :
                        msg.type === 'warn' ? 'text-yellow-400' :
                        msg.type === 'success' ? 'text-green-400' :
                        msg.type === 'info' ? 'text-blue-400' :
                        'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-600">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      <span>{msg.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
