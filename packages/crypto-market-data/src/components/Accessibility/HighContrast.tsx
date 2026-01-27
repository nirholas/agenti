/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Visibility for all 👁️
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ContrastMode = 'normal' | 'more' | 'less' | 'custom';

interface HighContrastContextType {
  /** Current contrast mode */
  contrastMode: ContrastMode;
  /** Whether system prefers high contrast (forced-colors) */
  systemHighContrast: boolean;
  /** Set contrast mode manually */
  setContrastMode: (mode: ContrastMode) => void;
  /** Whether contrast is currently enhanced */
  isHighContrast: boolean;
}

const HighContrastContext = createContext<HighContrastContextType>({
  contrastMode: 'normal',
  systemHighContrast: false,
  setContrastMode: () => {},
  isHighContrast: false,
});

/**
 * useHighContrast Hook
 * 
 * Detects and manages high contrast mode for users with low vision.
 * 
 * WCAG 2.1 Requirements:
 * - 1.4.3 Contrast (Minimum): 4.5:1 for text (AA)
 * - 1.4.6 Contrast (Enhanced): 7:1 for text (AAA)
 * - 1.4.11 Non-text Contrast: 3:1 for UI components
 * 
 * @example
 * function MyComponent() {
 *   const { isHighContrast } = useHighContrast();
 *   return (
 *     <button className={isHighContrast ? 'border-2 border-black' : 'border'}>
 *       Click me
 *     </button>
 *   );
 * }
 */
export function useHighContrast() {
  return useContext(HighContrastContext);
}

interface HighContrastProviderProps {
  children: ReactNode;
}

/**
 * HighContrastProvider
 * 
 * Provides high contrast mode context throughout the app.
 * Detects system preferences and allows manual override.
 */
export function HighContrastProvider({ children }: HighContrastProviderProps) {
  const [contrastMode, setContrastMode] = useState<ContrastMode>('normal');
  const [systemHighContrast, setSystemHighContrast] = useState(false);

  // Detect system high contrast preference
  useEffect(() => {
    // Check for Windows High Contrast Mode
    const forcedColors = window.matchMedia('(forced-colors: active)');
    const prefersContrast = window.matchMedia('(prefers-contrast: more)');
    
    const updateSystemPreference = () => {
      const isForced = forcedColors.matches;
      const prefersMore = prefersContrast.matches;
      setSystemHighContrast(isForced || prefersMore);
      
      // Auto-set mode based on system preference
      if (isForced || prefersMore) {
        setContrastMode('more');
      }
    };

    updateSystemPreference();
    
    forcedColors.addEventListener('change', updateSystemPreference);
    prefersContrast.addEventListener('change', updateSystemPreference);
    
    return () => {
      forcedColors.removeEventListener('change', updateSystemPreference);
      prefersContrast.removeEventListener('change', updateSystemPreference);
    };
  }, []);

  // Apply high contrast class to document
  useEffect(() => {
    const root = document.documentElement;
    
    root.classList.remove('contrast-normal', 'contrast-more', 'contrast-less');
    root.classList.add(`contrast-${contrastMode}`);
    
    return () => {
      root.classList.remove(`contrast-${contrastMode}`);
    };
  }, [contrastMode]);

  const isHighContrast = contrastMode === 'more' || systemHighContrast;

  return (
    <HighContrastContext.Provider
      value={{
        contrastMode,
        systemHighContrast,
        setContrastMode,
        isHighContrast,
      }}
    >
      {children}
    </HighContrastContext.Provider>
  );
}

/**
 * ContrastText Component
 * 
 * Automatically adjusts text colors for better contrast.
 * 
 * @example
 * <ContrastText normal="text-gray-600" high="text-gray-900">
 *   This text adapts to contrast preferences
 * </ContrastText>
 */
interface ContrastTextProps {
  children: ReactNode;
  /** Classes for normal contrast */
  normal?: string;
  /** Classes for high contrast */
  high?: string;
  /** Base classes that always apply */
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function ContrastText({
  children,
  normal = '',
  high = '',
  className = '',
  as: Component = 'span',
}: ContrastTextProps) {
  const { isHighContrast } = useHighContrast();
  
  const classes = [
    className,
    isHighContrast ? high : normal,
  ].filter(Boolean).join(' ');

  // @ts-ignore - dynamic component
  return <Component className={classes}>{children}</Component>;
}

/**
 * FocusVisible Component
 * 
 * Enhanced focus indicator that's always visible, especially important
 * for high contrast mode where default focus rings may not be visible.
 * 
 * @example
 * <FocusVisible>
 *   <button>Always has visible focus</button>
 * </FocusVisible>
 */
interface FocusVisibleProps {
  children: ReactNode;
  /** Ring color for focus (default: primary) */
  ringColor?: 'primary' | 'white' | 'black';
}

export function FocusVisible({ children, ringColor = 'primary' }: FocusVisibleProps) {
  const ringClasses = {
    primary: 'focus-visible:ring-primary-500',
    white: 'focus-visible:ring-white',
    black: 'focus-visible:ring-black',
  };

  return (
    <span 
      className={`
        focus-within:ring-2 focus-within:ring-offset-2
        ${ringClasses[ringColor]}
        rounded
      `}
    >
      {children}
    </span>
  );
}

export default HighContrastProvider;
