/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Respecting everyone's needs 🧠
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ReducedMotionContextType {
  prefersReducedMotion: boolean;
}

const ReducedMotionContext = createContext<ReducedMotionContextType>({
  prefersReducedMotion: false,
});

/**
 * useReducedMotion Hook
 * 
 * Detects if the user has requested reduced motion in their OS settings.
 * Essential for users with vestibular disorders who get motion sick from animations.
 * 
 * WCAG 2.1 Requirements:
 * - 2.3.3 Animation from Interactions (AAA): Disable motion if requested
 * 
 * @example
 * function AnimatedComponent() {
 *   const { prefersReducedMotion } = useReducedMotion();
 *   return (
 *     <div className={prefersReducedMotion ? '' : 'animate-bounce'}>
 *       Content
 *     </div>
 *   );
 * }
 */
export function useReducedMotion() {
  return useContext(ReducedMotionContext);
}

interface ReducedMotionProviderProps {
  children: ReactNode;
}

/**
 * ReducedMotionProvider
 * 
 * Provides context for reduced motion preference throughout the app.
 * Automatically updates when user changes system preferences.
 */
export function ReducedMotionProvider({ children }: ReducedMotionProviderProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return (
    <ReducedMotionContext.Provider value={{ prefersReducedMotion }}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

/**
 * Motion Component
 * 
 * Wrapper that conditionally applies animations based on user preference.
 * 
 * @example
 * <Motion
 *   animate="animate-fade-in"
 *   reduced="opacity-100"
 * >
 *   <p>This will animate in, or appear instantly for reduced motion users</p>
 * </Motion>
 */
interface MotionProps {
  children: ReactNode;
  /** Animation class to apply when motion is allowed */
  animate?: string;
  /** Class to apply when reduced motion is preferred */
  reduced?: string;
  /** Base classes that always apply */
  className?: string;
  /** HTML element to render (default: 'div') */
  as?: keyof JSX.IntrinsicElements;
}

export function Motion({
  children,
  animate = '',
  reduced = '',
  className = '',
  as: Component = 'div',
}: MotionProps) {
  const { prefersReducedMotion } = useReducedMotion();
  
  const classes = [
    className,
    prefersReducedMotion ? reduced : animate,
  ].filter(Boolean).join(' ');

  // @ts-ignore - dynamic component
  return <Component className={classes}>{children}</Component>;
}

/**
 * SafeAnimation Component
 * 
 * Only renders animated content if user hasn't requested reduced motion.
 * For purely decorative animations that add no informational value.
 * 
 * @example
 * <SafeAnimation>
 *   <SparkleEffect />  // Only shows if motion is OK
 * </SafeAnimation>
 */
interface SafeAnimationProps {
  children: ReactNode;
  /** Fallback content for reduced motion users */
  fallback?: ReactNode;
}

export function SafeAnimation({ children, fallback = null }: SafeAnimationProps) {
  const { prefersReducedMotion } = useReducedMotion();
  
  if (prefersReducedMotion) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

export default ReducedMotionProvider;
