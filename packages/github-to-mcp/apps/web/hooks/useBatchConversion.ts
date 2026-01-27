/**
 * useBatchConversion Hook - Batch conversion state management
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { BatchConversionItem, BatchConversionState, ConversionResult, ApiError } from '@/types';

interface UseBatchConversionOptions {
  maxConcurrent?: number;
  onItemComplete?: (item: BatchConversionItem) => void;
  onItemError?: (item: BatchConversionItem, error: string) => void;
  onBatchComplete?: (items: BatchConversionItem[]) => void;
}

interface UseBatchConversionReturn {
  items: BatchConversionItem[];
  state: BatchConversionState;
  stats: {
    total: number;
    pending: number;
    converting: number;
    success: number;
    error: number;
    progress: number;
    totalTools: number;
  };
  addUrl: (url: string) => boolean;
  addUrls: (urls: string[]) => number;
  removeItem: (id: string) => void;
  clearAll: () => void;
  clearCompleted: () => void;
  retryFailed: () => void;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
}

const isValidGithubUrl = (url: string): boolean => {
  const pattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/i;
  return pattern.test(url.trim());
};

export function useBatchConversion(
  options: UseBatchConversionOptions = {}
): UseBatchConversionReturn {
  const {
    maxConcurrent = 3,
    onItemComplete,
    onItemError,
    onBatchComplete,
  } = options;

  const [items, setItems] = useState<BatchConversionItem[]>([]);
  const [state, setState] = useState<BatchConversionState>('idle');
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Computed stats
  const stats = useMemo(() => {
    const pending = items.filter(i => i.status === 'pending').length;
    const converting = items.filter(i => i.status === 'converting').length;
    const success = items.filter(i => i.status === 'success').length;
    const error = items.filter(i => i.status === 'error').length;
    const total = items.length;
    const progress = total > 0 ? ((success + error) / total) * 100 : 0;
    const totalTools = items.reduce((sum, item) => sum + (item.result?.tools.length || 0), 0);

    return { pending, converting, success, error, total, progress, totalTools };
  }, [items]);

  // Add single URL
  const addUrl = useCallback((url: string): boolean => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !isValidGithubUrl(trimmedUrl)) return false;

    // Check for duplicates
    if (items.some(item => item.url.toLowerCase() === trimmedUrl.toLowerCase())) {
      return false;
    }

    const newItem: BatchConversionItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      url: trimmedUrl,
      status: 'pending',
    };

    setItems(prev => [...prev, newItem]);
    return true;
  }, [items]);

  // Add multiple URLs
  const addUrls = useCallback((urls: string[]): number => {
    let added = 0;
    urls.forEach(url => {
      if (addUrl(url)) added++;
    });
    return added;
  }, [addUrl]);

  // Remove item
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setItems([]);
    setState('idle');
  }, []);

  // Clear completed
  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(item => item.status !== 'success'));
  }, []);

  // Retry failed
  const retryFailed = useCallback(() => {
    setItems(prev =>
      prev.map(item =>
        item.status === 'error'
          ? { ...item, status: 'pending', error: undefined, progress: 0 }
          : item
      )
    );
  }, []);

  // Convert single item
  const convertItem = useCallback(
    async (item: BatchConversionItem, signal: AbortSignal) => {
      // Update to converting status
      setItems(prev =>
        prev.map(i =>
          i.id === item.id ? { ...i, status: 'converting', progress: 10 } : i
        )
      );

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setItems(prev =>
            prev.map(i =>
              i.id === item.id && i.status === 'converting'
                ? { ...i, progress: Math.min((i.progress || 10) + Math.random() * 20, 90) }
                : i
            )
          );
        }, 500);

        // API call
        const response = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url }),
          signal,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const errorData = (await response.json()) as ApiError;
          throw new Error(errorData.error || 'Conversion failed');
        }

        const result = (await response.json()) as ConversionResult;

        const updatedItem: BatchConversionItem = {
          ...item,
          status: 'success',
          result,
          progress: 100,
        };

        setItems(prev =>
          prev.map(i => (i.id === item.id ? updatedItem : i))
        );

        onItemComplete?.(updatedItem);
        return result;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setItems(prev =>
            prev.map(i =>
              i.id === item.id ? { ...i, status: 'pending', progress: 0 } : i
            )
          );
          return null;
        }

        const updatedItem: BatchConversionItem = {
          ...item,
          status: 'error',
          error: { error: err.message, code: 'CONVERSION_FAILED' },
          progress: 0,
        };

        setItems(prev =>
          prev.map(i => (i.id === item.id ? updatedItem : i))
        );

        onItemError?.(updatedItem, err.message);
        return null;
      }
    },
    [onItemComplete, onItemError]
  );

  // Start batch conversion
  const start = useCallback(async () => {
    if (state === 'running') return;

    setState('running');
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const pendingItems = items.filter(i => i.status === 'pending');
    const queue = [...pendingItems];
    const running: Promise<any>[] = [];

    while ((queue.length > 0 || running.length > 0) && !signal.aborted) {
      // Fill up to maxConcurrent
      while (queue.length > 0 && running.length < maxConcurrent) {
        const item = queue.shift()!;
        const promise = convertItem(item, signal).finally(() => {
          running.splice(running.indexOf(promise), 1);
        });
        running.push(promise);
      }

      // Wait for at least one to complete
      if (running.length > 0) {
        await Promise.race(running);
      }
    }

    // Wait for remaining
    await Promise.all(running);

    if (!signal.aborted) {
      setState('complete');
      onBatchComplete?.(items);
    }
  }, [items, state, maxConcurrent, convertItem, onBatchComplete]);

  // Pause batch
  const pause = useCallback(() => {
    abortControllerRef.current?.abort();
    setState('paused');
  }, []);

  // Resume batch
  const resume = useCallback(async () => {
    await start();
  }, [start]);

  return {
    items,
    state,
    stats,
    addUrl,
    addUrls,
    removeItem,
    clearAll,
    clearCompleted,
    retryFailed,
    start,
    pause,
    resume,
  };
}
