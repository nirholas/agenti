/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Visual cues for everyone to see 👁️
 */

import { useEffect, useState, createContext, useContext, ReactNode, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/utils/helpers';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface VisualFeedbackContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const VisualFeedbackContext = createContext<VisualFeedbackContextType | null>(null);

/**
 * Hook to show visual toast notifications
 * Essential for deaf users who cannot hear audio cues
 */
export function useVisualFeedback() {
  const context = useContext(VisualFeedbackContext);
  if (!context) {
    return { showToast: () => {} };
  }
  return context;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
};

interface VisualFeedbackProviderProps {
  children: ReactNode;
}

/**
 * Visual Feedback Provider
 * Provides toast notifications with visual cues for status updates
 * This is essential for deaf users who rely on visual feedback
 */
export function VisualFeedbackProvider({ children }: VisualFeedbackProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let toastId = 0;

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);

    // Auto-remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <VisualFeedbackContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div 
        className="fixed top-20 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map(toast => {
          const Icon = icons[toast.type];
          return (
            <div
              key={toast.id}
              role="alert"
              aria-live="polite"
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border shadow-lg pointer-events-auto',
                'animate-slide-in',
                colors[toast.type]
              )}
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 hover:opacity-70 transition-opacity"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </VisualFeedbackContext.Provider>
  );
}
