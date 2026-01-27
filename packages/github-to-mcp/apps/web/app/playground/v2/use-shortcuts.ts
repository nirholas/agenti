/**
 * useShortcuts Hook - Keyboard shortcuts handler for playground
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UseShortcutsOptions {
  /** Callback when execute shortcut is triggered (Cmd/Ctrl+Enter) */
  onExecute?: () => void;
  /** Callback when search focus shortcut is triggered (Cmd/Ctrl+K) */
  onFocusSearch?: () => void;
  /** Callback when tab switch shortcut is triggered (Cmd/Ctrl+1/2/3) */
  onSwitchToTab?: (tabNumber: 1 | 2 | 3) => void;
  /** Callback when clear selection shortcut is triggered (Escape) */
  onClearSelection?: () => void;
  /** Callback when copy result shortcut is triggered (Cmd/Ctrl+Shift+C) */
  onCopyLastResult?: () => void;
  /** Callback when toggle history shortcut is triggered (Cmd/Ctrl+H) */
  onToggleHistory?: () => void;
  /** Callback when help shortcut is triggered (Cmd/Ctrl+/) */
  onShowHelp?: () => void;
  /** Whether shortcuts are enabled */
  enabled?: boolean;
}

export interface ShortcutInfo {
  key: string;
  description: string;
  modifier: 'cmd' | 'ctrl' | 'shift' | 'alt' | 'none';
}

// ============================================================================
// Shortcut Definitions
// ============================================================================

export const SHORTCUTS: ShortcutInfo[] = [
  { key: 'Enter', description: 'Execute selected tool', modifier: 'cmd' },
  { key: 'K', description: 'Focus search', modifier: 'cmd' },
  { key: '1', description: 'Switch to Tools tab', modifier: 'cmd' },
  { key: '2', description: 'Switch to Resources tab', modifier: 'cmd' },
  { key: '3', description: 'Switch to Prompts tab', modifier: 'cmd' },
  { key: 'Escape', description: 'Clear selection', modifier: 'none' },
  { key: 'C', description: 'Copy last result', modifier: 'shift' },
  { key: 'H', description: 'Toggle history panel', modifier: 'cmd' },
  { key: '/', description: 'Show keyboard shortcuts', modifier: 'cmd' },
];

// ============================================================================
// Hook Implementation
// ============================================================================

export function useShortcuts(options: UseShortcutsOptions): void {
  const {
    onExecute,
    onFocusSearch,
    onSwitchToTab,
    onClearSelection,
    onCopyLastResult,
    onToggleHistory,
    onShowHelp,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't handle shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Allow Escape in input fields
      if (isInputField && event.key !== 'Escape') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Cmd/Ctrl+Enter: Execute
      if (cmdOrCtrl && event.key === 'Enter') {
        event.preventDefault();
        onExecute?.();
        return;
      }

      // Cmd/Ctrl+K: Focus search
      if (cmdOrCtrl && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onFocusSearch?.();
        return;
      }

      // Cmd/Ctrl+1/2/3: Switch tabs
      if (cmdOrCtrl && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        onSwitchToTab?.(parseInt(event.key) as 1 | 2 | 3);
        return;
      }

      // Escape: Clear selection
      if (event.key === 'Escape') {
        event.preventDefault();
        onClearSelection?.();
        return;
      }

      // Cmd/Ctrl+Shift+C: Copy last result
      if (cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        onCopyLastResult?.();
        return;
      }

      // Cmd/Ctrl+H: Toggle history
      if (cmdOrCtrl && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        onToggleHistory?.();
        return;
      }

      // Cmd/Ctrl+/: Show help
      if (cmdOrCtrl && event.key === '/') {
        event.preventDefault();
        onShowHelp?.();
        return;
      }
    },
    [
      enabled,
      onExecute,
      onFocusSearch,
      onSwitchToTab,
      onClearSelection,
      onCopyLastResult,
      onToggleHistory,
      onShowHelp,
    ]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

// ============================================================================
// Shortcut Display Utilities
// ============================================================================

/**
 * Get the display string for a modifier key based on platform
 */
export function getModifierDisplay(modifier: ShortcutInfo['modifier']): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  switch (modifier) {
    case 'cmd':
      return isMac ? '⌘' : 'Ctrl';
    case 'ctrl':
      return isMac ? '⌃' : 'Ctrl';
    case 'shift':
      return isMac ? '⇧' : 'Shift';
    case 'alt':
      return isMac ? '⌥' : 'Alt';
    case 'none':
      return '';
  }
}

/**
 * Get the full display string for a shortcut
 */
export function getShortcutDisplay(shortcut: ShortcutInfo): string {
  const modifier = getModifierDisplay(shortcut.modifier);
  const key = shortcut.key === 'Enter' ? '↵' : shortcut.key;
  
  if (modifier) {
    return `${modifier}+${key}`;
  }
  return key;
}

/**
 * Format all shortcuts for display
 */
export function formatShortcuts(): Array<{ key: string; description: string }> {
  return SHORTCUTS.map((shortcut) => ({
    key: getShortcutDisplay(shortcut),
    description: shortcut.description,
  }));
}

export default useShortcuts;
