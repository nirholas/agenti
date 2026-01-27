/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 One hook for all users ♿
 */

import { useCallback } from 'react';
import { useAnnounce } from './LiveAnnouncer';
import { useVisualFeedback } from './VisualFeedback';

type FeedbackType = 'success' | 'error' | 'info' | 'warning';

interface UseFeedbackOptions {
  /** Announce to screen readers (default: true) */
  announceToScreenReader?: boolean;
  /** Show visual toast notification (default: true) */
  showVisualToast?: boolean;
  /** Duration for toast in ms (default: 5000) */
  toastDuration?: number;
  /** Priority for screen reader announcement */
  priority?: 'polite' | 'assertive';
}

/**
 * Hook to provide feedback to all users:
 * - Screen reader users hear the announcement
 * - Deaf users see a visual toast notification
 * - All users benefit from consistent feedback
 */
export function useFeedback() {
  const { announce } = useAnnounce();
  const { showToast } = useVisualFeedback();

  const notify = useCallback((
    message: string,
    type: FeedbackType = 'info',
    options: UseFeedbackOptions = {}
  ) => {
    const {
      announceToScreenReader = true,
      showVisualToast = true,
      toastDuration = 5000,
      priority = type === 'error' ? 'assertive' : 'polite',
    } = options;

    // Announce to screen readers
    if (announceToScreenReader) {
      announce(message, priority);
    }

    // Show visual feedback
    if (showVisualToast) {
      showToast(message, type, toastDuration);
    }
  }, [announce, showToast]);

  return {
    notify,
    // Convenience methods
    success: (message: string, options?: UseFeedbackOptions) => 
      notify(message, 'success', options),
    error: (message: string, options?: UseFeedbackOptions) => 
      notify(message, 'error', { priority: 'assertive', ...options }),
    info: (message: string, options?: UseFeedbackOptions) => 
      notify(message, 'info', options),
    warning: (message: string, options?: UseFeedbackOptions) => 
      notify(message, 'warning', options),
  };
}
