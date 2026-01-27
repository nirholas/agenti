/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your dedication inspires others 🌠
 */

import { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  Copy,
  Download,
  RefreshCw,
  Maximize2,
  Code2,
  Eye,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Lightbulb,
  Zap
} from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

interface CodeTab {
  id: string;
  label: string;
  language: string;
  code: string;
  description?: string;
}

interface Tutorial {
  title: string;
  description: string;
  steps: {
    title: string;
    content: string;
    highlight?: { start: number; end: number };
  }[];
}

interface Challenge {
  title: string;
  description: string;
  task: string;
  hint?: string;
  solution: string;
}

interface InteractiveCodePlaygroundProps {
  title: string;
  description: string;
  tabs: CodeTab[];
  tutorial?: Tutorial;
  challenges?: Challenge[];
  livePreview?: boolean;
  previewComponent?: React.ReactNode;
  onRun?: (code: string, language: string) => void;
}

export default function InteractiveCodePlayground({
  title,
  description,
  tabs,
  tutorial,
  challenges,
  livePreview = false,
  previewComponent,
  onRun
}: InteractiveCodePlaygroundProps) {
  const { mode } = useThemeStore();
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');
  const [code, setCode] = useState<Record<string, string>>(
    tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: tab.code }), {})
  );
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'split' | 'editor' | 'preview'>('split');
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showChallenges, setShowChallenges] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeTabData = tabs.find(t => t.id === activeTab);
  const currentCode = code[activeTab] || '';

  const handleRun = async () => {
    if (!onRun || !activeTabData) return;
    
    setIsRunning(true);
    setError(null);
    setOutput('Running...');

    try {
      await onRun(currentCode, activeTabData.language);
      setOutput('Execution completed successfully');
    } catch (err: any) {
      setError(err.message || 'Execution failed');
      setOutput('');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}.${getFileExtension(activeTabData?.language || 'javascript')}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    const originalCode = tabs.find(t => t.id === activeTab)?.code || '';
    setCode(prev => ({ ...prev, [activeTab]: originalCode }));
    setOutput('');
    setError(null);
  };

  const getFileExtension = (language: string): string => {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      solidity: 'sol',
      html: 'html',
      css: 'css',
      json: 'json',
      python: 'py'
    };
    return extensions[language] || 'txt';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {tutorial && (
            <button
              onClick={() => setShowTutorial(!showTutorial)}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium ${
                showTutorial
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Tutorial
            </button>
          )}
          {challenges && challenges.length > 0 && (
            <button
              onClick={() => setShowChallenges(!showChallenges)}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium ${
                showChallenges
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              Challenges
            </button>
          )}
        </div>
      </div>

      {/* Tutorial Panel */}
      {showTutorial && tutorial && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            {tutorial.title}
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{tutorial.description}</p>
          
          <div className="space-y-4">
            {tutorial.steps.map((step, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  currentStep === index
                    ? 'border-purple-400 bg-white dark:bg-gray-800'
                    : 'border-transparent bg-purple-100/50 dark:bg-purple-900/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    currentStep > index
                      ? 'bg-green-500 text-white'
                      : currentStep === index
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {currentStep > index ? '✓' : index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">{step.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{step.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(tutorial.steps.length - 1, currentStep + 1))}
              disabled={currentStep === tutorial.steps.length - 1}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Challenges Panel */}
      {showChallenges && challenges && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            Coding Challenges
          </h3>
          <div className="space-y-4">
            {challenges.map((challenge, index) => (
              <details key={index} className="group">
                <summary className="cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700 hover:border-orange-400 dark:hover:border-orange-500">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{challenge.title}</span>
                    <Lightbulb className="w-4 h-4 text-orange-500 group-open:rotate-180 transition-transform" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{challenge.description}</p>
                </summary>
                <div className="mt-2 p-4 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700">
                  <div className="mb-4">
                    <h4 className="font-medium text-sm mb-2">Task:</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{challenge.task}</p>
                  </div>
                  {challenge.hint && (
                    <details className="mb-4">
                      <summary className="cursor-pointer text-sm font-medium text-orange-600 dark:text-orange-400">
                        Show Hint
                      </summary>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{challenge.hint}</p>
                    </details>
                  )}
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-green-600 dark:text-green-400">
                      Show Solution
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                      <code>{challenge.solution}</code>
                    </pre>
                  </details>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Main Playground */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        {/* Toolbar */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Language Tabs */}
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {onRun && (
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm font-medium flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Copy code"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Reset to original"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <button
              onClick={() => setLayout(layout === 'split' ? 'editor' : layout === 'editor' ? 'preview' : 'split')}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title="Toggle layout"
            >
              {layout === 'split' ? <Code2 className="w-4 h-4" /> : layout === 'editor' ? <Eye className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Tab Description */}
        {activeTabData?.description && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
            {activeTabData.description}
          </div>
        )}

        {/* Editor & Preview Area */}
        <div className={`flex ${layout === 'split' ? 'flex-row' : 'flex-col'}`}>
          {/* Editor */}
          {layout !== 'preview' && (
            <div className={`${layout === 'split' ? 'w-1/2 border-r dark:border-gray-700' : 'w-full'}`}>
              <Editor
                height="600px"
                language={activeTabData?.language || 'javascript'}
                value={currentCode}
                onChange={(value) => setCode(prev => ({ ...prev, [activeTab]: value || '' }))}
                theme={mode === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on'
                }}
              />
            </div>
          )}

          {/* Preview/Output */}
          {layout !== 'editor' && (livePreview || output || error) && (
            <div className={`${layout === 'split' ? 'w-1/2' : 'w-full'} bg-gray-50 dark:bg-gray-900`}>
              {livePreview && previewComponent ? (
                <div className="h-[500px] overflow-auto p-4">
                  {previewComponent}
                </div>
              ) : (
                <div className="h-[500px] overflow-auto p-4 font-mono text-sm">
                  {error ? (
                    <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <pre className="whitespace-pre-wrap">{error}</pre>
                    </div>
                  ) : output ? (
                    <div className="flex items-start gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <pre className="whitespace-pre-wrap">{output}</pre>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Output will appear here</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Learning Notes */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Key Concepts
        </h3>
        <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-6 list-disc">
          <li>This code is production-ready and can be used in your projects</li>
          <li>Try modifying the code to see how it changes the behavior</li>
          <li>Check the challenges above to test your understanding</li>
        </ul>
      </div>
    </div>
  );
}
