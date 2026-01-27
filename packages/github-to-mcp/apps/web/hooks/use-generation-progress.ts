/**
 * useGenerationProgress Hook - Manages generation step state and progress
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { GenerationStep, GenerationStepId, GenerationStepStatus } from '@/components/GenerationProgress';

const INITIAL_STEPS: GenerationStep[] = [
  {
    id: 'fetching',
    label: 'Fetching Repository',
    description: 'Downloading repository metadata and files',
    status: 'pending',
  },
  {
    id: 'classifying',
    label: 'Classifying Repo',
    description: 'Detecting repository type and structure',
    status: 'pending',
  },
  {
    id: 'extracting',
    label: 'Extracting Tools',
    description: 'Analyzing code and documentation',
    status: 'pending',
  },
  {
    id: 'generating',
    label: 'Generating Server',
    description: 'Creating MCP server code and configs',
    status: 'pending',
  },
];

export interface UseGenerationProgressReturn {
  steps: GenerationStep[];
  currentStep: GenerationStepId | null;
  totalToolsFound: number;
  statusMessage: string;
  progress: number;
  isComplete: boolean;
  hasError: boolean;
  startStep: (stepId: GenerationStepId, detail?: string) => void;
  completeStep: (stepId: GenerationStepId, toolsFound?: number) => void;
  errorStep: (stepId: GenerationStepId, errorDetail?: string) => void;
  setStatusMessage: (message: string) => void;
  addToolsFound: (count: number) => void;
  reset: () => void;
}

export function useGenerationProgress(): UseGenerationProgressReturn {
  const [steps, setSteps] = useState<GenerationStep[]>(INITIAL_STEPS);
  const [currentStep, setCurrentStep] = useState<GenerationStepId | null>(null);
  const [totalToolsFound, setTotalToolsFound] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const updateStepStatus = useCallback((stepId: GenerationStepId, status: GenerationStepStatus, updates: Partial<GenerationStep> = {}) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, ...updates } : step
    ));
  }, []);

  const startStep = useCallback((stepId: GenerationStepId, detail?: string) => {
    // Mark previous steps as complete if not already
    setSteps(prev => prev.map(step => {
      const stepIndex = prev.findIndex(s => s.id === stepId);
      const currentIndex = prev.findIndex(s => s.id === step.id);
      
      if (currentIndex < stepIndex && step.status !== 'complete' && step.status !== 'error') {
        return { ...step, status: 'complete' as const };
      }
      if (step.id === stepId) {
        return { ...step, status: 'in-progress' as const, detail };
      }
      return step;
    }));
    setCurrentStep(stepId);
  }, []);

  const completeStep = useCallback((stepId: GenerationStepId, toolsFound?: number) => {
    updateStepStatus(stepId, 'complete', { toolsFound });
    if (toolsFound) {
      setTotalToolsFound(prev => prev + toolsFound);
    }
  }, [updateStepStatus]);

  const errorStep = useCallback((stepId: GenerationStepId, errorDetail?: string) => {
    updateStepStatus(stepId, 'error', { detail: errorDetail });
  }, [updateStepStatus]);

  const addToolsFound = useCallback((count: number) => {
    setTotalToolsFound(prev => prev + count);
    // Also update the current step's tools found
    if (currentStep) {
      setSteps(prev => prev.map(step =>
        step.id === currentStep
          ? { ...step, toolsFound: (step.toolsFound || 0) + count }
          : step
      ));
    }
  }, [currentStep]);

  const reset = useCallback(() => {
    setSteps(INITIAL_STEPS);
    setCurrentStep(null);
    setTotalToolsFound(0);
    setStatusMessage('');
  }, []);

  const progress = useMemo(() => {
    const weights = { pending: 0, 'in-progress': 0.5, complete: 1, error: 0 };
    const totalProgress = steps.reduce((acc, step) => acc + weights[step.status], 0);
    return Math.round((totalProgress / steps.length) * 100);
  }, [steps]);

  const isComplete = useMemo(() => 
    steps.every(step => step.status === 'complete'),
    [steps]
  );

  const hasError = useMemo(() =>
    steps.some(step => step.status === 'error'),
    [steps]
  );

  return {
    steps,
    currentStep,
    totalToolsFound,
    statusMessage,
    progress,
    isComplete,
    hasError,
    startStep,
    completeStep,
    errorStep,
    setStatusMessage,
    addToolsFound,
    reset,
  };
}

export default useGenerationProgress;
