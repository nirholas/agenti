/**
 * Playground V2 Providers - Context providers for the playground
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { ReactNode, createContext, useContext, useState, useCallback } from 'react';

// ============================================================================
// Execution History Context
// ============================================================================

export interface ExecutionHistoryEntry {
  id: string;
  type: 'tool' | 'resource' | 'prompt';
  name: string;
  params?: unknown;
  result?: unknown;
  error?: string;
  success: boolean;
  timestamp: Date;
  executionTime?: number;
}

interface ExecutionHistoryContextValue {
  entries: ExecutionHistoryEntry[];
  add: (entry: Omit<ExecutionHistoryEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
  remove: (id: string) => void;
}

const ExecutionHistoryContext = createContext<ExecutionHistoryContextValue | null>(null);

export function useExecutionHistoryContext(): ExecutionHistoryContextValue {
  const context = useContext(ExecutionHistoryContext);
  if (!context) {
    throw new Error('useExecutionHistoryContext must be used within a PlaygroundV2Providers');
  }
  return context;
}

// ============================================================================
// Notifications Context
// ============================================================================

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  description?: string;
  duration?: number;
}

interface NotificationsContextValue {
  notifications: Notification[];
  add: (notification: Omit<Notification, 'id'>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a PlaygroundV2Providers');
  }
  return context;
}

// ============================================================================
// Playground Settings Context
// ============================================================================

export interface PlaygroundSettings {
  autoConnect: boolean;
  persistHistory: boolean;
  maxHistorySize: number;
  showLogs: boolean;
  theme: 'system' | 'light' | 'dark';
}

const DEFAULT_SETTINGS: PlaygroundSettings = {
  autoConnect: false,
  persistHistory: true,
  maxHistorySize: 1000,
  showLogs: true,
  theme: 'system',
};

interface PlaygroundSettingsContextValue {
  settings: PlaygroundSettings;
  updateSettings: (updates: Partial<PlaygroundSettings>) => void;
  resetSettings: () => void;
}

const PlaygroundSettingsContext = createContext<PlaygroundSettingsContextValue | null>(null);

export function usePlaygroundSettings(): PlaygroundSettingsContextValue {
  const context = useContext(PlaygroundSettingsContext);
  if (!context) {
    throw new Error('usePlaygroundSettings must be used within a PlaygroundV2Providers');
  }
  return context;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Provider Component
// ============================================================================

interface PlaygroundV2ProvidersProps {
  children: ReactNode;
}

export function PlaygroundV2Providers({ children }: PlaygroundV2ProvidersProps) {
  // Execution History State
  const [historyEntries, setHistoryEntries] = useState<ExecutionHistoryEntry[]>([]);

  const addHistoryEntry = useCallback((entry: Omit<ExecutionHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: ExecutionHistoryEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date(),
    };
    setHistoryEntries((prev) => [newEntry, ...prev].slice(0, DEFAULT_SETTINGS.maxHistorySize));
  }, []);

  const removeHistoryEntry = useCallback((id: string) => {
    setHistoryEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistoryEntries([]);
  }, []);

  // Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = generateId();
    const newNotification: Notification = { ...notification, id };
    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove after duration
    const duration = notification.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Settings State
  const [settings, setSettings] = useState<PlaygroundSettings>(DEFAULT_SETTINGS);

  const updateSettings = useCallback((updates: Partial<PlaygroundSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Context Values
  const executionHistoryValue: ExecutionHistoryContextValue = {
    entries: historyEntries,
    add: addHistoryEntry,
    clear: clearHistory,
    remove: removeHistoryEntry,
  };

  const notificationsValue: NotificationsContextValue = {
    notifications,
    add: addNotification,
    remove: removeNotification,
    clear: clearNotifications,
  };

  const settingsValue: PlaygroundSettingsContextValue = {
    settings,
    updateSettings,
    resetSettings,
  };

  return (
    <ExecutionHistoryContext.Provider value={executionHistoryValue}>
      <NotificationsContext.Provider value={notificationsValue}>
        <PlaygroundSettingsContext.Provider value={settingsValue}>
          {children}
        </PlaygroundSettingsContext.Provider>
      </NotificationsContext.Provider>
    </ExecutionHistoryContext.Provider>
  );
}

export default PlaygroundV2Providers;
