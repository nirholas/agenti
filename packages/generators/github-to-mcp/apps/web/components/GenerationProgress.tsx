/**
 * GenerationProgress Component - Multi-step progress bar with real-time updates
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Github,
  Layers,
  FileSearch,
  Code2,
  Package,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export type GenerationStepId = 
  | 'fetching'
  | 'classifying'
  | 'extracting'
  | 'generating';

export type GenerationStepStatus = 'pending' | 'in-progress' | 'complete' | 'error';

export interface GenerationStep {
  id: GenerationStepId;
  label: string;
  description: string;
  status: GenerationStepStatus;
  toolsFound?: number;
  detail?: string;
}

const STEP_ICONS: Record<GenerationStepId, typeof Github> = {
  fetching: Github,
  classifying: Layers,
  extracting: FileSearch,
  generating: Code2,
};

const STEP_COLORS: Record<GenerationStepStatus, string> = {
  pending: 'text-neutral-500 bg-neutral-800/50 border-neutral-700',
  'in-progress': 'text-white bg-white/10 border-white/30',
  complete: 'text-green-400 bg-green-500/10 border-green-500/30',
  error: 'text-red-400 bg-red-500/10 border-red-500/30',
};

interface GenerationProgressProps {
  steps: GenerationStep[];
  currentStep: GenerationStepId | null;
  totalToolsFound: number;
  statusMessage?: string;
  className?: string;
}

export default function GenerationProgress({
  steps,
  currentStep,
  totalToolsFound,
  statusMessage,
  className = '',
}: GenerationProgressProps) {
  const progress = useMemo(() => {
    const completedSteps = steps.filter(s => s.status === 'complete').length;
    const inProgressSteps = steps.filter(s => s.status === 'in-progress').length;
    return Math.round(((completedSteps + inProgressSteps * 0.5) / steps.length) * 100);
  }, [steps]);

  const currentStepData = useMemo(() => {
    return steps.find(s => s.id === currentStep);
  }, [steps, currentStep]);

  return (
    <div className={`rounded-2xl border border-neutral-800 p-6 md:p-8 bg-neutral-900/50 backdrop-blur-xl ${className}`}>
      {/* Header with progress ring */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            {/* Background ring */}
            <svg className="w-16 h-16 -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-neutral-800"
              />
              <motion.circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                className="text-white"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: progress / 100 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{progress}%</span>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Generating MCP Server</h3>
            <AnimatePresence mode="wait">
              <motion.p
                key={statusMessage || currentStepData?.description}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-sm text-neutral-400"
              >
                {statusMessage || currentStepData?.description || 'Initializing...'}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Tools found counter */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-neutral-800"
        >
          <Package className="w-4 h-4 text-neutral-400" />
          <span className="text-sm text-neutral-400">Tools found:</span>
          <motion.span
            key={totalToolsFound}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-lg font-bold text-white"
          >
            {totalToolsFound}
          </motion.span>
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden mb-8">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-white to-neutral-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {/* Animated shimmer */}
        {progress < 100 && (
          <motion.div
            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '500%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id];
          const isActive = step.status === 'in-progress';
          const isComplete = step.status === 'complete';
          const isError = step.status === 'error';

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-4 rounded-xl border transition-all ${STEP_COLORS[step.status]}`}
            >
              {/* Step number connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-0.5 bg-neutral-800" />
              )}

              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  isComplete ? 'bg-green-500/20' :
                  isError ? 'bg-red-500/20' :
                  isActive ? 'bg-white/10' : 'bg-neutral-800/50'
                }`}>
                  {isComplete ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : isError ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-neutral-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${
                      isActive ? 'text-white' : 
                      isComplete ? 'text-green-400' : 
                      isError ? 'text-red-400' : 'text-neutral-500'
                    }`}>
                      Step {index + 1}
                    </span>
                    {step.toolsFound !== undefined && step.toolsFound > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-white/10 rounded text-white">
                        +{step.toolsFound}
                      </span>
                    )}
                  </div>
                  <h4 className={`font-medium truncate ${
                    isActive ? 'text-white' : 
                    isComplete ? 'text-green-300' : 
                    isError ? 'text-red-300' : 'text-neutral-400'
                  }`}>
                    {step.label}
                  </h4>
                  {step.detail && (
                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>

              {/* Active step glow effect */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl border-2 border-white/20"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
