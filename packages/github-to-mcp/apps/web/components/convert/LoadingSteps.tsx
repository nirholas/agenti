/**
 * Loading Steps Component - Shows conversion progress with real-time streaming
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Github, 
  Code2, 
  Package, 
  Terminal, 
  Check, 
  Loader2,
  FileSearch,
  Layers,
  FileJson,
  Sparkles,
  AlertCircle,
  Braces,
} from 'lucide-react';
import type { StreamingStep } from '@/hooks/use-streaming-conversion';

// Icon mapping for each step
const STEP_ICONS: Record<string, typeof Github> = {
  'validate': Github,
  'fetch': Github,
  'classify': Layers,
  'readme': FileSearch,
  'openapi': FileJson,
  'code': Braces,
  'generate-ts': Terminal,
  'generate-py': Code2,
  'configs': Package,
  'complete': Sparkles,
};

interface LoadingStepsProps {
  steps?: StreamingStep[];
  currentStep?: string | null;
  progress?: number;
  isStreaming?: boolean;
}

// Step status type
type StepStatus = 'pending' | 'in-progress' | 'complete' | 'error';

// Internal step type
interface InternalStep {
  id: string;
  label: string;
  description: string;
  detail?: string;
  status: StepStatus;
}

// Default steps for fallback/non-streaming mode
const DEFAULT_STEPS: InternalStep[] = [
  { id: 'fetch', label: 'Fetching repository', description: 'Cloning and analyzing repo structure', status: 'pending' },
  { id: 'classify', label: 'Classifying repository', description: 'Detecting repo type and structure', status: 'pending' },
  { id: 'readme', label: 'Analyzing README', description: 'Extracting documentation and examples', status: 'pending' },
  { id: 'openapi', label: 'Scanning for OpenAPI specs', description: 'Looking for API definitions', status: 'pending' },
  { id: 'code', label: 'Analyzing code', description: 'Extracting functions and patterns', status: 'pending' },
  { id: 'generate-ts', label: 'Generating TypeScript server', description: 'Creating MCP server code', status: 'pending' },
  { id: 'configs', label: 'Creating configurations', description: 'Building platform configs', status: 'pending' },
];

export default function LoadingSteps({ 
  steps: externalSteps, 
  currentStep: externalCurrentStep,
  progress: externalProgress = 0,
  isStreaming = false,
}: LoadingStepsProps) {
  const [internalSteps, setInternalSteps] = useState<InternalStep[]>(DEFAULT_STEPS);
  const [internalCurrentStep, setInternalCurrentStep] = useState(0);
  const [internalProgress, setInternalProgress] = useState(0);

  // Use external steps if streaming, otherwise use internal simulation
  const displaySteps = isStreaming && externalSteps ? externalSteps : internalSteps;
  const displayProgress = isStreaming ? externalProgress : internalProgress;

  // Simulate progress for non-streaming mode
  useEffect(() => {
    if (isStreaming) return;

    const timers: NodeJS.Timeout[] = [];
    let totalTime = 0;
    const stepDurations = [800, 1200, 1000, 1500, 1200, 800, 600];

    DEFAULT_STEPS.forEach((step, index) => {
      const duration = stepDurations[index] || 1000;
      
      // Start step
      const startTimer = setTimeout(() => {
        setInternalCurrentStep(index);
        setInternalSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < index ? 'complete' as const : i === index ? 'in-progress' as const : 'pending' as const,
        })));
        setInternalProgress(Math.round((index / DEFAULT_STEPS.length) * 100));
      }, totalTime);
      timers.push(startTimer);

      // Complete step
      const completeTimer = setTimeout(() => {
        setInternalSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i <= index ? 'complete' as const : s.status,
        })));
        setInternalProgress(Math.round(((index + 1) / DEFAULT_STEPS.length) * 100));
      }, totalTime + duration - 200);
      timers.push(completeTimer);

      totalTime += duration;
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [isStreaming]);

  // Filter to show relevant steps (skip validate step as it's instant)
  const visibleSteps = displaySteps.filter(s => s.id !== 'validate' && s.id !== 'complete');

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-2xl border border-neutral-800 p-8 bg-neutral-900/50 backdrop-blur-xl">
        {/* Header with animated progress ring */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-20 h-20 mb-4">
            {/* Background ring */}
            <svg className="absolute inset-0 w-20 h-20 -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-neutral-800"
              />
              <motion.circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                className="text-white"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: displayProgress / 100 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  strokeDasharray: '226.19',
                  strokeDashoffset: 0,
                }}
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-white font-mono">{displayProgress}%</span>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Converting Repository</h2>
          <p className="text-neutral-400">
            {isStreaming ? 'Real-time extraction in progress...' : 'Analyzing and extracting tools...'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-white to-neutral-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {visibleSteps.map((step) => {
              const Icon = STEP_ICONS[step.id] || Package;
              const isActive = step.status === 'in-progress';
              const isCompleted = step.status === 'complete';
              const isError = step.status === 'error';
              const isPending = step.status === 'pending';

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  layout
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                    isActive
                      ? 'border-white/30 bg-white/5 shadow-lg shadow-white/5'
                      : isCompleted
                      ? 'border-green-500/20 bg-green-500/5'
                      : isError
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-neutral-800/50 bg-transparent opacity-50'
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-green-500/20 border border-green-500/30'
                      : isError
                      ? 'bg-red-500/20 border border-red-500/30'
                      : isActive
                      ? 'bg-white/10 border border-white/20'
                      : 'bg-neutral-800/50 border border-neutral-700/50'
                  }`}>
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <Check className="w-5 h-5 text-green-400" />
                      </motion.div>
                    ) : isError ? (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    ) : isActive ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </motion.div>
                    ) : (
                      <Icon className="w-5 h-5 text-neutral-500" />
                    )}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium transition-colors ${
                      isCompleted ? 'text-green-400' : 
                      isError ? 'text-red-400' :
                      isActive ? 'text-white' : 
                      'text-neutral-500'
                    }`}>
                      {step.label}
                    </div>
                    <div className={`text-sm truncate transition-colors ${
                      isActive ? 'text-neutral-400' : 'text-neutral-600'
                    }`}>
                      {(step.detail ?? step.description) || ''}
                    </div>
                  </div>

                  {/* Status indicator */}
                  {isActive && (
                    <motion.div
                      className="flex items-center gap-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-white"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-white"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-white"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
                      />
                    </motion.div>
                  )}

                  {isCompleted && (
                    <span className="text-xs text-green-400/70 font-mono">✓</span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Fun tip at bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="mt-6 pt-6 border-t border-neutral-800"
        >
          <p className="text-xs text-neutral-500 text-center">
            💡 Tip: Generated MCP servers work with Claude Desktop, Cursor, and other MCP-compatible tools
          </p>
        </motion.div>
      </div>
    </div>
  );
}
