/**
 * useExecutionHistory Hook
 * Tracks execution history across tools, resources, and prompts
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ExecutionHistoryEntry,
  ExecutionType,
  UseExecutionHistoryReturn,
  ToolExecution,
  ResourceRead,
  PromptExecution,
  UseExecutionHistoryOptions as TypedOptions,
} from './types';
import { generateId } from './types';

// ============================================================================
// Constants
// ============================================================================

const LOCAL_STORAGE_KEY = 'mcp-playground-execution-history';
const MAX_HISTORY_SIZE = 1000;

// ============================================================================
// Hook Implementation
// ============================================================================

export interface UseExecutionHistoryOptions {
  /** Maximum number of history entries to keep */
  maxSize?: number;
  /** Alias for maxSize */
  maxItems?: number;
  /** Whether to persist history to localStorage */
  persist?: boolean;
  /** Alias for persist */
  persistToStorage?: boolean;
  /** Custom storage key */
  storageKey?: string;
}

export function useExecutionHistory(
  options: UseExecutionHistoryOptions = {}
): UseExecutionHistoryReturn {
  const {
    maxSize = MAX_HISTORY_SIZE,
    maxItems,
    persist = false,
    persistToStorage,
    storageKey = LOCAL_STORAGE_KEY,
  } = options;

  // Support both naming conventions
  const effectiveMaxSize = maxItems ?? maxSize;
  const effectivePersist = persistToStorage ?? persist;

  // State
  const [history, setHistory] = useState<ExecutionHistoryEntry[]>([]);

  // Refs
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    mountedRef.current = true;

    if (effectivePersist && !initializedRef.current && typeof window !== 'undefined') {
      initializedRef.current = true;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as ExecutionHistoryEntry[];
          // Convert date strings back to Date objects
          const entries = parsed.map(entry => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          }));
          setHistory(entries);
        }
      } catch (err) {
        console.warn('[useExecutionHistory] Failed to load history from localStorage:', err);
      }
    }

    return () => {
      mountedRef.current = false;
    };
  }, [effectivePersist, storageKey]);

  // Save to localStorage when history changes
  useEffect(() => {
    if (effectivePersist && initializedRef.current && typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(history));
      } catch (err) {
        console.warn('[useExecutionHistory] Failed to save history to localStorage:', err);
      }
    }
  }, [history, effectivePersist, storageKey]);

  /**
   * Add a new entry to the history
   */
  const add = useCallback(
    (entry: Omit<ExecutionHistoryEntry, 'id' | 'timestamp'>): void => {
      const newEntry: ExecutionHistoryEntry = {
        ...entry,
        id: generateId(),
        timestamp: new Date(),
      };

      if (mountedRef.current) {
        setHistory(prev => {
          const updated = [newEntry, ...prev];
          // Trim to max size
          if (updated.length > effectiveMaxSize) {
            return updated.slice(0, effectiveMaxSize);
          }
          return updated;
        });
      }
    },
    [effectiveMaxSize]
  );

  /**
   * Add a tool execution to history
   */
  const addExecution = useCallback(
    (execution: ToolExecution): void => {
      add({
        type: 'tool',
        name: execution.toolName,
        params: execution.params,
        result: execution.result,
        error: execution.error,
        success: execution.status === 'success',
        executionTime: execution.executionTime,
      });
    },
    [add]
  );

  /**
   * Add a resource read to history
   */
  const addResourceRead = useCallback(
    (read: ResourceRead): void => {
      add({
        type: 'resource',
        name: read.uri,
        result: read.contents,
        error: read.error,
        success: read.status === 'success',
      });
    },
    [add]
  );

  /**
   * Add a prompt execution to history
   */
  const addPromptExecution = useCallback(
    (execution: PromptExecution): void => {
      add({
        type: 'prompt',
        name: execution.name || execution.promptName || 'unknown',
        params: execution.args || execution.arguments,
        result: execution.messages,
        error: execution.error,
        success: execution.status === 'success',
      });
    },
    [add]
  );

  /**
   * Clear all history
   */
  const clear = useCallback((): void => {
    if (mountedRef.current) {
      setHistory([]);
    }

    if (effectivePersist && typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        console.warn('[useExecutionHistory] Failed to clear localStorage:', err);
      }
    }
  }, [effectivePersist, storageKey]);

  /** Alias for clear */
  const clearHistory = clear;

  /**
   * Get entries by type
   */
  const getByType = useCallback(
    (type: ExecutionType): ExecutionHistoryEntry[] => {
      return history.filter(entry => entry.type === type);
    },
    [history]
  );

  /**
   * Get entries by success status
   */
  const getByStatus = useCallback(
    (success: boolean): ExecutionHistoryEntry[] => {
      return history.filter(entry => entry.success === success);
    },
    [history]
  );

  /**
   * Export history as JSON string
   */
  const exportHistory = useCallback((): string => {
    return JSON.stringify(history, null, 2);
  }, [history]);

  /**
   * Import history from JSON string
   */
  const importHistory = useCallback((json: string): void => {
    try {
      const parsed = JSON.parse(json) as ExecutionHistoryEntry[];
      
      // Validate structure
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid history format: expected an array');
      }

      // Convert and validate entries
      const entries = parsed.map((entry, index) => {
        if (!entry.type || !entry.name || typeof entry.success !== 'boolean') {
          throw new Error(`Invalid entry at index ${index}`);
        }
        return {
          ...entry,
          id: entry.id || generateId(),
          timestamp: new Date(entry.timestamp || Date.now()),
        };
      });

      if (mountedRef.current) {
        setHistory(entries.slice(0, maxSize));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import history';
      console.error('[useExecutionHistory] Import failed:', message);
      throw new Error(`Failed to import history: ${message}`);
    }
  }, [maxSize]);

  return {
    history,
    add,
    addExecution,
    addResourceRead,
    addPromptExecution,
    clear,
    clearHistory,
    getByType,
    getByStatus,
    export: exportHistory,
    exportHistory,
    import: importHistory,
    importHistory,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter history by type
 */
export function filterHistoryByType(
  history: ExecutionHistoryEntry[],
  type: ExecutionType
): ExecutionHistoryEntry[] {
  return history.filter(entry => entry.type === type);
}

/**
 * Filter history by success/failure
 */
export function filterHistoryBySuccess(
  history: ExecutionHistoryEntry[],
  success: boolean
): ExecutionHistoryEntry[] {
  return history.filter(entry => entry.success === success);
}

/**
 * Filter history by date range
 */
export function filterHistoryByDateRange(
  history: ExecutionHistoryEntry[],
  start: Date,
  end: Date
): ExecutionHistoryEntry[] {
  return history.filter(
    entry => entry.timestamp >= start && entry.timestamp <= end
  );
}

/**
 * Get history statistics
 */
export interface HistoryStats {
  total: number;
  tools: number;
  resources: number;
  prompts: number;
  successes: number;
  failures: number;
  averageExecutionTime: number | null;
}

export function getHistoryStats(history: ExecutionHistoryEntry[]): HistoryStats {
  const stats: HistoryStats = {
    total: history.length,
    tools: 0,
    resources: 0,
    prompts: 0,
    successes: 0,
    failures: 0,
    averageExecutionTime: null,
  };

  let totalExecutionTime = 0;
  let executionTimeCount = 0;

  for (const entry of history) {
    switch (entry.type) {
      case 'tool':
        stats.tools++;
        break;
      case 'resource':
        stats.resources++;
        break;
      case 'prompt':
        stats.prompts++;
        break;
    }

    if (entry.success) {
      stats.successes++;
    } else {
      stats.failures++;
    }

    if (entry.executionTime !== undefined) {
      totalExecutionTime += entry.executionTime;
      executionTimeCount++;
    }
  }

  if (executionTimeCount > 0) {
    stats.averageExecutionTime = totalExecutionTime / executionTimeCount;
  }

  return stats;
}

export default useExecutionHistory;
