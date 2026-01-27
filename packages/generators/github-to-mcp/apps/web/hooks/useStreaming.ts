/**
 * useStreaming Hook - SSE streaming connection management
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  StreamingEvent, 
  StreamingStatus, 
  StreamingProgressData,
  Tool,
  ConversionResult,
} from '@/types';

interface UseStreamingOptions {
  autoStart?: boolean;
  onProgress?: (progress: StreamingProgressData) => void;
  onTool?: (tool: Tool, index: number, total: number) => void;
  onComplete?: (result: ConversionResult) => void;
  onError?: (error: string) => void;
}

interface UseStreamingReturn {
  status: StreamingStatus;
  progress: number;
  currentStep: StreamingProgressData | null;
  discoveredTools: Tool[];
  error: string | null;
  elapsedTime: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useStreaming(
  url: string,
  options: UseStreamingOptions = {}
): UseStreamingReturn {
  const { autoStart = false, onProgress, onTool, onComplete, onError } = options;

  const [status, setStatus] = useState<StreamingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<StreamingProgressData | null>(null);
  const [discoveredTools, setDiscoveredTools] = useState<Tool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed time tracking
  useEffect(() => {
    if (status === 'streaming') {
      startTimeRef.current = startTimeRef.current || Date.now();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  // Start streaming
  const start = useCallback(() => {
    if (!url) return;

    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state
    setStatus('connecting');
    setProgress(0);
    setCurrentStep(null);
    setDiscoveredTools([]);
    setError(null);
    setElapsedTime(0);
    startTimeRef.current = null;

    const encodedUrl = encodeURIComponent(url);
    const eventSource = new EventSource(`/api/stream?url=${encodedUrl}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus('streaming');
    };

    eventSource.onmessage = (event) => {
      try {
        const data: StreamingEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'progress': {
            const progressData = data.data as StreamingProgressData;
            setCurrentStep(progressData);
            setProgress(progressData.progress);
            onProgress?.(progressData);
            break;
          }

          case 'tool': {
            const toolData = data.data as { tool: Tool; index: number; total: number };
            setDiscoveredTools(prev => [...prev, toolData.tool]);
            setProgress(prev => Math.min(90, prev + 5));
            onTool?.(toolData.tool, toolData.index, toolData.total);
            break;
          }

          case 'complete': {
            const completeData = data.data as { result: ConversionResult };
            setStatus('complete');
            setProgress(100);
            eventSource.close();
            onComplete?.(completeData.result);
            break;
          }

          case 'error': {
            const errorData = data.data as { error: string };
            setStatus('error');
            setError(errorData.error);
            eventSource.close();
            onError?.(errorData.error);
            break;
          }
        }
      } catch (err) {
        console.error('Failed to parse streaming event:', err);
      }
    };

    eventSource.onerror = () => {
      if (status !== 'complete' && status !== 'error') {
        setStatus('error');
        setError('Connection lost');
        eventSource.close();
        onError?.('Connection lost');
      }
    };
  }, [url, onProgress, onTool, onComplete, onError, status]);

  // Stop streaming
  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('idle');
  }, []);

  // Reset state
  const reset = useCallback(() => {
    stop();
    setProgress(0);
    setCurrentStep(null);
    setDiscoveredTools([]);
    setError(null);
    setElapsedTime(0);
    startTimeRef.current = null;
  }, [stop]);

  // Auto-start
  useEffect(() => {
    if (autoStart && url && status === 'idle') {
      start();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [autoStart, url]); // Intentionally not including start/status to prevent loops

  return {
    status,
    progress,
    currentStep,
    discoveredTools,
    error,
    elapsedTime,
    start,
    stop,
    reset,
  };
}
