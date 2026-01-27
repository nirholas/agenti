/**
 * useStreamingConversion Hook - Real-time conversion progress
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import type { ConversionResult, ConversionStatus, ApiError } from '@/types';

export interface StreamingStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  progress?: number;
  detail?: string;
}

const INITIAL_STEPS: StreamingStep[] = [
  { id: 'validate', label: 'Validating GitHub URL', description: 'Checking repository accessibility', status: 'pending' },
  { id: 'fetch', label: 'Fetching repository', description: 'Downloading repository metadata', status: 'pending' },
  { id: 'classify', label: 'Classifying repository', description: 'Detecting repo type and structure', status: 'pending' },
  { id: 'readme', label: 'Analyzing README', description: 'Extracting documentation and examples', status: 'pending' },
  { id: 'openapi', label: 'Scanning for OpenAPI specs', description: 'Looking for API definitions', status: 'pending' },
  { id: 'code', label: 'Analyzing code', description: 'Extracting functions and patterns', status: 'pending' },
  { id: 'generate-ts', label: 'Generating TypeScript server', description: 'Creating MCP server code', status: 'pending' },
  { id: 'generate-py', label: 'Generating Python server', description: 'Creating Python alternative', status: 'pending' },
  { id: 'configs', label: 'Creating configurations', description: 'Building platform configs', status: 'pending' },
  { id: 'complete', label: 'Conversion complete', description: 'MCP server ready', status: 'pending' },
];

interface UseStreamingConversionReturn {
  status: ConversionStatus;
  result: ConversionResult | null;
  error: ApiError | null;
  steps: StreamingStep[];
  currentStep: string | null;
  progress: number;
  convert: (url: string) => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

export function useStreamingConversion(): UseStreamingConversionReturn {
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [steps, setSteps] = useState<StreamingStep[]>(INITIAL_STEPS);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateStep = useCallback((stepId: string, updates: Partial<StreamingStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }, []);

  const convert = useCallback(async (url: string) => {
    // Reset state
    setStatus('loading');
    setError(null);
    setResult(null);
    setSteps(INITIAL_STEPS);
    setCurrentStep(null);
    setProgress(0);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/convert/stream?url=${encodeURIComponent(url)}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Conversion failed');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            const dataLineIndex = lines.indexOf(line) + 1;
            const dataLine = lines[dataLineIndex];
            
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6));
              
              switch (eventType) {
                case 'progress':
                  setCurrentStep(data.step);
                  setProgress(data.progress || 0);
                  updateStep(data.step, {
                    status: data.status === 'complete' ? 'complete' : 'in-progress',
                    detail: data.description,
                  });
                  break;
                  
                case 'result':
                  setResult({
                    ...data,
                    stats: {
                      totalTools: data.tools.length,
                      filesAnalyzed: data.sources?.reduce((acc: number, s: { count: number }) => acc + s.count, 0) || 0,
                      processingTimeMs: 0,
                      cacheHit: false,
                    },
                    repository: {
                      owner: url.split('/')[3] || '',
                      name: data.name,
                      fullName: `${url.split('/')[3]}/${data.name}`,
                      url,
                    },
                    generatedAt: new Date().toISOString(),
                  });
                  break;
                  
                case 'error':
                  setError({
                    error: data.error,
                    code: data.code || 'UNKNOWN_ERROR',
                  });
                  setStatus('error');
                  updateStep(currentStep || 'validate', { status: 'error' });
                  return;
                  
                case 'done':
                  setStatus('success');
                  setProgress(100);
                  break;
              }
            }
          } else if (line.startsWith('data: ')) {
            // Handle data-only lines
            try {
              const data = JSON.parse(line.slice(6));
              if (data.step) {
                setCurrentStep(data.step);
                setProgress(data.progress || 0);
                updateStep(data.step, {
                  status: data.status === 'complete' ? 'complete' : 'in-progress',
                  detail: data.description,
                });
              }
              if (data.error) {
                setError({
                  error: data.error,
                  code: data.code || 'UNKNOWN_ERROR',
                });
                setStatus('error');
                return;
              }
            } catch {
              // Ignore parse errors for incomplete data
            }
          }
        }
      }

      // If we got here without setting success, do it now
      if (status === 'loading') {
        setStatus('success');
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      
      setError({
        error: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
        details: 'Failed to connect to the server.',
      });
      setStatus('error');
    }
  }, [updateStep, currentStep, status]);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setSteps(INITIAL_STEPS);
    setCurrentStep(null);
    setProgress(0);
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    reset();
  }, [reset]);

  return {
    status,
    result,
    error,
    steps,
    currentStep,
    progress,
    convert,
    reset,
    cancel,
  };
}
