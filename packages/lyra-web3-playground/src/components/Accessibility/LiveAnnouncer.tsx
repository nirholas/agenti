/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Everyone deserves access to technology 🌍
 */

import { useEffect, useState, createContext, useContext, ReactNode, useCallback } from 'react';

interface Announcement {
  message: string;
  priority: 'polite' | 'assertive';
  id: number;
}

interface LiveAnnouncerContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextType | null>(null);

/**
 * Hook to announce messages to screen readers
 * Use 'polite' for non-urgent updates (default)
 * Use 'assertive' for important/urgent announcements
 */
export function useAnnounce() {
  const context = useContext(LiveAnnouncerContext);
  if (!context) {
    // Return a no-op function if used outside provider
    return { announce: () => {} };
  }
  return context;
}

interface LiveAnnouncerProviderProps {
  children: ReactNode;
}

/**
 * LiveAnnouncer Provider
 * Provides a way to announce dynamic content changes to screen readers
 * This is essential for SPAs where content updates without page reload
 */
export function LiveAnnouncerProvider({ children }: LiveAnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage('');
      // Small delay to ensure the change is detected by screen readers
      setTimeout(() => setAssertiveMessage(message), 50);
    } else {
      setPoliteMessage('');
      setTimeout(() => setPoliteMessage(message), 50);
    }
  }, []);

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Polite announcements (non-interruptive) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      {/* Assertive announcements (interruptive - use sparingly) */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}
