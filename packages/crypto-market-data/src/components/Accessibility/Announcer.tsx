/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 📢 Announcer - Live region for screen reader announcements
 * 💫 Provides real-time updates without interrupting focus
 */

import { useEffect, useState, useRef, createContext, useContext, ReactNode } from 'react';

interface AnnouncerContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | null>(null);

export function useAnnouncer() {
  const context = useContext(AnnouncerContext);
  if (!context) {
    // Return a no-op if not within provider
    return { announce: () => {} };
  }
  return context;
}

interface AnnouncerProviderProps {
  children: ReactNode;
}

export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const politeTimeoutRef = useRef<NodeJS.Timeout>();
  const assertiveTimeoutRef = useRef<NodeJS.Timeout>();

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      // Clear previous timeout
      if (assertiveTimeoutRef.current) {
        clearTimeout(assertiveTimeoutRef.current);
      }
      // Clear and set message (needed for screen readers to re-announce)
      setAssertiveMessage('');
      requestAnimationFrame(() => {
        setAssertiveMessage(message);
      });
      // Clear after announcement
      assertiveTimeoutRef.current = setTimeout(() => {
        setAssertiveMessage('');
      }, 5000);
    } else {
      // Clear previous timeout
      if (politeTimeoutRef.current) {
        clearTimeout(politeTimeoutRef.current);
      }
      // Clear and set message
      setPoliteMessage('');
      requestAnimationFrame(() => {
        setPoliteMessage(message);
      });
      // Clear after announcement
      politeTimeoutRef.current = setTimeout(() => {
        setPoliteMessage('');
      }, 5000);
    }
  };

  useEffect(() => {
    return () => {
      if (politeTimeoutRef.current) clearTimeout(politeTimeoutRef.current);
      if (assertiveTimeoutRef.current) clearTimeout(assertiveTimeoutRef.current);
    };
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Polite announcements - waits for screen reader to finish current task */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="a11y-announcer"
      >
        {politeMessage}
      </div>
      {/* Assertive announcements - interrupts screen reader immediately */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="a11y-announcer"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

/**
 * Hook for announcing page transitions
 */
export function useAnnouncePageChange(pageName: string) {
  const { announce } = useAnnouncer();
  
  useEffect(() => {
    announce(`Navigated to ${pageName}`);
  }, [pageName, announce]);
}
