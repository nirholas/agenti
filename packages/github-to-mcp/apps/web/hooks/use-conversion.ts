/**
 * Conversion Hook - Handles all conversion logic
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback } from 'react';
import type { 
  ConversionResult, 
  ConversionStatus, 
  ConversionOptions,
  ApiError,
  ConversionHistory 
} from '@/types';
import { useLocalStorage } from './use-local-storage';
import { generateId, parseGitHubUrl } from '@/lib/utils';
import { MAX_HISTORY_ITEMS } from '@/lib/constants';

interface UseConversionReturn {
  status: ConversionStatus;
  result: ConversionResult | null;
  error: ApiError | null;
  convert: (url: string, options?: ConversionOptions) => Promise<void>;
  reset: () => void;
  history: ConversionHistory[];
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
}

export function useConversion(): UseConversionReturn {
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [history, setHistory] = useLocalStorage<ConversionHistory[]>('conversion-history', []);

  const convert = useCallback(async (url: string, options?: ConversionOptions) => {
    setStatus('loading');
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
      });

      const data = await response.json();

      if (!response.ok) {
        const apiError: ApiError = {
          error: data.error || 'Conversion failed',
          code: data.code || 'UNKNOWN_ERROR',
          details: data.details,
          retryAfter: response.status === 429 ? parseInt(response.headers.get('Retry-After') || '60') : undefined,
        };
        setError(apiError);
        setStatus('error');
        return;
      }

      // Enrich result with timing
      const endTime = performance.now();
      const enrichedResult: ConversionResult = {
        ...data,
        stats: {
          ...data.stats,
          processingTimeMs: Math.round(endTime - startTime),
        },
        generatedAt: new Date().toISOString(),
      };

      setResult(enrichedResult);
      setStatus('success');

      // Add to history
      const parsed = parseGitHubUrl(url);
      const historyEntry: ConversionHistory = {
        id: generateId(),
        url,
        name: enrichedResult.name,
        toolCount: enrichedResult.tools.length,
        classification: enrichedResult.classification.type,
        convertedAt: new Date().toISOString(),
      };

      setHistory(prev => {
        const filtered = prev.filter(h => h.url !== url);
        return [historyEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      });

    } catch (err) {
      const apiError: ApiError = {
        error: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
        details: 'Failed to connect to the server. Please check your internet connection.',
      };
      setError(apiError);
      setStatus('error');
    }
  }, [setHistory]);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  }, [setHistory]);

  return {
    status,
    result,
    error,
    convert,
    reset,
    history,
    clearHistory,
    removeFromHistory,
  };
}
