/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every line of code is a step toward something amazing ✨
 */

import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Copy,
  Check,
  Eye,
  Code,
  BookOpen,
  Lightbulb,
  Target,
  Zap,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { 
  getProgress, 
  saveProgress, 
  clearProgress, 
  TutorialProgress 
} from '@/utils/tutorialProgress';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  explanation?: string;
  code: Record<string, string>; // language -> code
  expectedOutput?: string;
  hints?: string[];
  challenge?: {
    prompt: string;
    solution: string;
    hints: string[];
  };
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  prerequisites?: string[];
  steps: TutorialStep[];
  languages: string[]; // ['solidity', 'typescript', 'react', 'vue']
}

interface InteractiveTutorialProps {
  tutorial: Tutorial;
  onComplete?: () => void;
}

export default function InteractiveTutorial({ tutorial, onComplete }: InteractiveTutorialProps) {
  const { mode } = useThemeStore();
  const [progressState, setProgressState] = useState<TutorialProgress>(() => getProgress(tutorial.id));
  const [currentStepIndex, setCurrentStepIndex] = useState(() => progressState.currentStepIndex ?? 0);
  const [activeLanguage, setActiveLanguage] = useState(() => progressState.activeLanguage || tutorial.languages[0]);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    () => new Set(progressState.completedStepIds)
  );
  const [showHints, setShowHints] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [annotations, setAnnotations] = useState<any[]>([]);
  
  const editorRef = useRef<any>(null);
  const currentStep = tutorial.steps[currentStepIndex];

  useEffect(() => {
    if (currentStepIndex >= tutorial.steps.length) {
      setCurrentStepIndex(0);
      persistProgress(p => ({ ...p, currentStepIndex: 0 }));
    }
  }, [tutorial.steps.length, currentStepIndex]);

  const persistProgress = (updater: (prev: TutorialProgress) => TutorialProgress) => {
    setProgressState(prev => {
      const next = updater(prev);
      return saveProgress(tutorial.id, next);
    });
  };

  useEffect(() => {
    // Load step code when step or language changes (with snapshots)
    if (currentStep && currentStep.code[activeLanguage]) {
      const snapshot = progressState.codeSnapshots?.[currentStep.id]?.[activeLanguage];
      const nextCode = snapshot ?? currentStep.code[activeLanguage];

      setCode(nextCode);
      setOutput('');
      setShowHints(false);
      setShowChallenge(false);
      setShowSolution(false);
      
      // Generate annotations for the code
      generateAnnotations(nextCode);
    }
  }, [currentStepIndex, activeLanguage, progressState.codeSnapshots, currentStep]);

  const generateAnnotations = (codeContent: string) => {
    // Parse code and generate inline annotations
    const lines = codeContent.split('\n');
    const newAnnotations: any[] = [];
    
    lines.forEach((line, index) => {
      // Detect important patterns and add annotations
      if (line.includes('contract ')) {
        newAnnotations.push({
          lineNumber: index + 1,
          type: 'info',
          message: 'Contract declaration - defines a new smart contract'
        });
      }
      if (line.includes('function ')) {
        newAnnotations.push({
          lineNumber: index + 1,
          type: 'info',
          message: 'Function definition - encapsulates reusable logic'
        });
      }
      if (line.includes('event ')) {
        newAnnotations.push({
          lineNumber: index + 1,
          type: 'tip',
          message: 'Event - logs data to the blockchain for tracking'
        });
      }
      if (line.includes('require(')) {
        newAnnotations.push({
          lineNumber: index + 1,
          type: 'warning',
          message: 'Validation check - reverts transaction if condition fails'
        });
      }
    });
    
    setAnnotations(newAnnotations);
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Add inline decorations for annotations
    if (annotations.length > 0 && monaco) {
      const decorations = annotations.map(ann => ({
        range: new monaco.Range(ann.lineNumber, 1, ann.lineNumber, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: `annotation-glyph-${ann.type}`,
          glyphMarginHoverMessage: { value: ann.message }
        }
      }));
      editor.deltaDecorations([], decorations);
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Executing code...\n');
    
    // Simulate code execution
    setTimeout(() => {
      if (currentStep.expectedOutput) {
        setOutput(currentStep.expectedOutput);
        
        // Mark step as completed
        setCompletedSteps(prev => {
          const next = new Set(prev).add(currentStep.id);
          persistProgress(p => ({
            ...p,
            completedStepIds: Array.from(next)
          }));
          return next;
        });
        if (currentStepIndex === tutorial.steps.length - 1) {
          persistProgress(p => ({ ...p, completedAt: new Date().toISOString() }));
        }
      } else {
        setOutput('✓ Code executed successfully!\n\nCheck the preview panel for results.');
      }
      setIsRunning(false);
    }, 1500);
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNextStep = () => {
    if (currentStepIndex < tutorial.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      persistProgress(p => ({ ...p, currentStepIndex: nextIndex }));
    } else if (onComplete) {
      persistProgress(p => ({
        ...p,
        completedStepIds: Array.from(new Set([...completedSteps, currentStep.id])),
        completedAt: new Date().toISOString()
      }));
      onComplete();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      persistProgress(p => ({ ...p, currentStepIndex: prevIndex }));
    }
  };

  const handleResetCode = () => {
    setCode(currentStep.code[activeLanguage]);
    setOutput('');
  };

  const handleShowSolution = () => {
    if (currentStep.challenge && currentStep.challenge.solution) {
      setCode(currentStep.challenge.solution);
      setShowSolution(true);
      // Persist the learner's updated code snapshot
      persistProgress(prev => {
        const snapshots = prev.codeSnapshots ?? {};
        const stepSnap = snapshots[currentStep.id] || {};
        const updatedSnapshots = {
          ...snapshots,
          [currentStep.id]: { ...stepSnap, [activeLanguage]: currentStep.challenge?.solution || '' }
        };
        return { ...prev, codeSnapshots: updatedSnapshots };
      });
    }
  };

  const getLanguageIcon = (lang: string) => {
    switch (lang) {
      case 'solidity': return '⚡';
      case 'typescript': return 'TS';
      case 'javascript': return 'JS';
      case 'react': return '⚛️';
      case 'vue': return 'V';
      default: return '📄';
    }
  };

  const progressPercentage = ((currentStepIndex + 1) / tutorial.steps.length) * 100;
  const isLastStep = currentStepIndex === tutorial.steps.length - 1;

  const handleLanguageChange = (lang: string) => {
    setActiveLanguage(lang);
    persistProgress(p => ({ ...p, activeLanguage: lang }));
  };

  const handleCodeChange = (value: string) => {
    const nextValue = value || '';
    setCode(nextValue);
    persistProgress(prev => {
      const snapshots = prev.codeSnapshots ?? {};
      const stepSnap = snapshots[currentStep.id] || {};
      const updatedSnapshots = {
        ...snapshots,
        [currentStep.id]: { ...stepSnap, [activeLanguage]: nextValue }
      };
      return { ...prev, codeSnapshots: updatedSnapshots };
    });
  };

  const handleResetProgress = () => {
    clearProgress(tutorial.id);
    const fresh = getProgress(tutorial.id);
    setProgressState(fresh);
    setCompletedSteps(new Set());
    setCurrentStepIndex(0);
    setActiveLanguage(tutorial.languages[0]);
    setCode(tutorial.steps[0].code[tutorial.languages[0]]);
    setOutput('');
    setShowHints(false);
    setShowChallenge(false);
    setShowSolution(false);
  };

  return (
    <div className={`flex flex-col h-screen ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : ''}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tutorial.title}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{tutorial.description}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
                  {tutorial.difficulty}
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  ⏱️ {tutorial.estimatedTime}
                </span>
                {progressState.completedAt && (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Completed
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleResetProgress}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                >
                  Reset Progress
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Step {currentStepIndex + 1} of {tutorial.steps.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Step Info */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentStep.title}
              </h2>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              {currentStep.description}
            </p>

            {currentStep.explanation && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                      Understanding the Code
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                      {currentStep.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Hints Section */}
            {currentStep.hints && currentStep.hints.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 mb-2"
                >
                  <Target className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {showHints ? 'Hide' : 'Show'} Hints ({currentStep.hints.length})
                  </span>
                </button>
                {showHints && (
                  <div className="space-y-2">
                    {currentStep.hints.map((hint, index) => (
                      <div
                        key={index}
                        className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-900 dark:text-yellow-200"
                      >
                        💡 {hint}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Challenge Section */}
            {currentStep.challenge && (
              <div className="mb-6">
                <button
                  onClick={() => setShowChallenge(!showChallenge)}
                  className="flex items-center space-x-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 mb-2"
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {showChallenge ? 'Hide' : 'Show'} Challenge
                  </span>
                </button>
                {showChallenge && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                      Now You Try! 🎯
                    </h4>
                    <p className="text-sm text-green-800 dark:text-green-300 mb-3">
                      {currentStep.challenge.prompt}
                    </p>
                    <button
                      onClick={handleShowSolution}
                      className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 underline"
                    >
                      {showSolution ? '✓ Solution shown' : 'Show solution'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step Navigation */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                All Steps
              </p>
              {tutorial.steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStepIndex(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    index === currentStepIndex
                      ? 'bg-primary-100 dark:bg-primary-900 border-2 border-primary-500'
                      : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {completedSteps.has(step.id) ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${
                      index === currentStepIndex
                        ? 'font-semibold text-primary-700 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {index + 1}. {step.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Language Tabs & Controls */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center space-x-1">
                {tutorial.languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang)}
                    className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                      activeLanguage === lang
                        ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <span className="mr-2">{getLanguageIcon(lang)}</span>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 mr-2">
                  <button
                    onClick={() => setViewMode('code')}
                    className={`p-2 rounded ${viewMode === 'code' ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    title="Code only"
                  >
                    <Code className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    className={`p-2 rounded ${viewMode === 'split' ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    title="Split view"
                  >
                    <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                      <div className="bg-current" />
                      <div className="bg-current" />
                    </div>
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={`p-2 rounded ${viewMode === 'preview' ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    title="Preview only"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
                
                <button
                  onClick={handleResetCode}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Reset code"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCopyCode}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Copy code"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>{isRunning ? 'Running...' : 'Run Code'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Editor & Preview Split */}
          <div className="flex-1 flex overflow-hidden">
            {/* Code Editor */}
            {(viewMode === 'code' || viewMode === 'split') && (
              <div className={viewMode === 'split' ? 'w-1/2 border-r border-gray-200 dark:border-gray-700' : 'w-full'}>
                <Editor
                  height="100%"
                  language={activeLanguage === 'react' || activeLanguage === 'vue' ? 'typescript' : activeLanguage}
                  value={code}
                  onChange={(value) => handleCodeChange(value || '')}
                  onMount={handleEditorMount}
                  theme={mode === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    glyphMargin: true
                  }}
                />
              </div>
            )}

            {/* Live Preview / Output */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className={viewMode === 'split' ? 'w-1/2' : 'w-full'}>
                <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
                  <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-2 bg-white dark:bg-gray-800">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Output & Preview
                    </h3>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {output ? (
                      <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap">
                        {output}
                      </pre>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
                        <div className="text-center">
                          <Play className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Run the code to see output</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevStep}
            disabled={currentStepIndex === 0}
            className="btn-secondary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>{completedSteps.size} of {tutorial.steps.length} completed</span>
          </div>
          
          <button
            onClick={handleNextStep}
            className="btn-primary flex items-center space-x-2"
          >
            <span>{isLastStep ? 'Complete Tutorial' : 'Next Step'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
