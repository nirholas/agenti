/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The web is your canvas, code is your brush ��️
 */

import { useState } from 'react';
import {
  Sparkles,
  Loader,
  Code2,
  FileCode,
  TestTube,
  Lightbulb,
  Copy,
  CheckCircle
} from 'lucide-react';
import { generateContract, explainCode, generateTests } from '@/services/api';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { copyToClipboard } from '@/utils/helpers';

interface AIAssistantProps {
  onLog: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}

type AIMode = 'generate' | 'explain' | 'test';

export default function AIAssistant({ onLog }: AIAssistantProps) {
  const { getActiveFile, getCurrentWorkspace, addFile } = useWorkspaceStore();
  
  const [mode, setMode] = useState<AIMode>('generate');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const activeFile = getActiveFile();
  const workspace = getCurrentWorkspace();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      onLog('error', 'Please enter a prompt');
      return;
    }

    setIsLoading(true);
    onLog('info', 'AI is generating contract...');

    try {
      const result = await generateContract({ prompt });
      setResponse(result.code);
      onLog('success', 'Contract generated successfully!');
      
      // Optionally add explanation
      if (result.explanation) {
        onLog('info', `AI: ${result.explanation}`);
      }
    } catch (error: any) {
      onLog('error', `AI generation failed: ${error.message}`);
      setResponse('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!activeFile) {
      onLog('error', 'No file selected to explain');
      return;
    }

    setIsLoading(true);
    onLog('info', 'AI is analyzing your code...');

    try {
      const result = await explainCode({ code: activeFile.content });
      setResponse(result.explanation);
      onLog('success', 'Code explanation generated!');
    } catch (error: any) {
      onLog('error', `AI explanation failed: ${error.message}`);
      setResponse('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!activeFile) {
      onLog('error', 'No file selected to generate tests for');
      return;
    }

    setIsLoading(true);
    onLog('info', 'AI is generating tests...');

    try {
      const result = await generateTests({ code: activeFile.content });
      setResponse(result.tests);
      onLog('success', 'Test suite generated!');
    } catch (error: any) {
      onLog('error', `Test generation failed: ${error.message}`);
      setResponse('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsertCode = () => {
    if (!response || !workspace) return;

    if (mode === 'generate' || mode === 'test') {
      // Create new file
      const fileName = mode === 'test' 
        ? `${activeFile?.name.replace('.sol', '')}.test.sol` 
        : 'Generated.sol';
      
      addFile(workspace.id, {
        name: fileName,
        path: fileName,
        content: response,
        language: 'solidity'
      });
      
      onLog('success', `Created ${fileName}`);
    } else if (mode === 'explain') {
      // Just copy to clipboard
      handleCopy();
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(response);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onLog('success', 'Copied to clipboard!');
    }
  };

  const modes = [
    { id: 'generate' as AIMode, label: 'Generate', icon: Code2, description: 'Create a new contract' },
    { id: 'explain' as AIMode, label: 'Explain', icon: Lightbulb, description: 'Explain code' },
    { id: 'test' as AIMode, label: 'Test', icon: TestTube, description: 'Generate tests' },
  ];

  return (
    <div className="h-full flex flex-col p-4">
      {/* Mode Selector */}
      <div className="flex gap-2 mb-4">
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setPrompt('');
                setResponse('');
              }}
              className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                mode === m.id
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${mode === m.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500'}`} />
              <span className={`text-sm font-medium ${mode === m.id ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="mb-4">
        {mode === 'generate' && (
          <>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Describe the contract you want to create:
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create an ERC721 NFT contract with minting and royalties..."
              className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 resize-none"
              disabled={isLoading}
            />
            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="mt-2 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Contract
                </>
              )}
            </button>
          </>
        )}

        {mode === 'explain' && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Selected file: <span className="font-medium">{activeFile?.name || 'None'}</span>
            </p>
            <button
              onClick={handleExplain}
              disabled={isLoading || !activeFile}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4" />
                  Explain Code
                </>
              )}
            </button>
          </>
        )}

        {mode === 'test' && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Generate tests for: <span className="font-medium">{activeFile?.name || 'None'}</span>
            </p>
            <button
              onClick={handleGenerateTests}
              disabled={isLoading || !activeFile}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating Tests...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4" />
                  Generate Tests
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Response Area */}
      {response && (
        <div className="flex-1 flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              AI Response
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Copy"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              {(mode === 'generate' || mode === 'test') && (
                <button
                  onClick={handleInsertCode}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center gap-1"
                >
                  <FileCode className="w-3 h-3" />
                  Insert as File
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-900">
            <pre className="text-sm font-mono whitespace-pre-wrap text-gray-900 dark:text-gray-100">
              {response}
            </pre>
          </div>
        </div>
      )}

      {!response && !isLoading && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">AI assistant ready to help</p>
            <p className="text-xs mt-1">
              {modes.find(m => m.id === mode)?.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
