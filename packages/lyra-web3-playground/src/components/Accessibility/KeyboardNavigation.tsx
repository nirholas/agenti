/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Navigate freely with your keyboard ⌨️
 */

import { useEffect, useRef, useCallback, RefObject } from 'react';

/**
 * useFocusTrap Hook
 * 
 * Traps focus within a container (essential for modals, dialogs, dropdowns)
 * When tabbing, focus cycles within the container instead of escaping to the page.
 * 
 * WCAG 2.1 Requirements:
 * - 2.1.2 No Keyboard Trap: Users must be able to escape (via Escape key)
 * - 2.4.3 Focus Order: Focus must follow logical order
 * 
 * @example
 * function Modal({ onClose }) {
 *   const containerRef = useFocusTrap<HTMLDivElement>({ onEscape: onClose });
 *   return <div ref={containerRef}>...</div>
 * }
 */
interface FocusTrapOptions {
  /** Callback when Escape key is pressed */
  onEscape?: () => void;
  /** Whether the focus trap is active */
  isActive?: boolean;
  /** Initial element to focus (selector or element) */
  initialFocus?: string | HTMLElement;
  /** Element to return focus to when trap is deactivated */
  returnFocusTo?: HTMLElement | null;
}

export function useFocusTrap<T extends HTMLElement>(
  options: FocusTrapOptions = {}
): RefObject<T | null> {
  const { onEscape, isActive = true, initialFocus, returnFocusTo } = options;
  const containerRef = useRef<T | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the currently focused element to restore later
    previousActiveElement.current = returnFocusTo || (document.activeElement as HTMLElement);

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const getFocusableElements = () => {
      const elements = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(elements).filter(
        el => !el.hasAttribute('disabled') && el.offsetParent !== null
      );
    };

    // Set initial focus
    const setInitialFocus = () => {
      if (initialFocus) {
        const element = typeof initialFocus === 'string'
          ? container.querySelector<HTMLElement>(initialFocus)
          : initialFocus;
        element?.focus();
      } else {
        const focusable = getFocusableElements();
        focusable[0]?.focus();
      }
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      // Shift+Tab from first element -> go to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
      // Tab from last element -> go to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    // Initialize
    setTimeout(setInitialFocus, 0);
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup: restore focus when trap is removed
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isActive, initialFocus, onEscape, returnFocusTo]);

  return containerRef;
}

/**
 * useArrowNavigation Hook
 * 
 * Enables arrow key navigation within a list of items (menus, toolbars, tabs)
 * 
 * WCAG 2.1 Requirements:
 * - 2.1.1 Keyboard: All functionality via keyboard
 * - 2.4.3 Focus Order: Logical navigation order
 * 
 * @example
 * function Menu({ items }) {
 *   const { containerRef, currentIndex } = useArrowNavigation({
 *     itemCount: items.length,
 *     onSelect: (index) => items[index].onClick()
 *   });
 *   return <ul ref={containerRef} role="menu">...</ul>
 * }
 */
interface ArrowNavigationOptions {
  /** Total number of items */
  itemCount: number;
  /** Callback when Enter/Space is pressed on an item */
  onSelect?: (index: number) => void;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
  /** Direction of navigation (default: 'vertical') */
  direction?: 'vertical' | 'horizontal' | 'both';
  /** Whether navigation wraps around */
  wrap?: boolean;
  /** Initial focused index */
  initialIndex?: number;
}

export function useArrowNavigation<T extends HTMLElement>(
  options: ArrowNavigationOptions
) {
  const {
    itemCount,
    onSelect,
    onEscape,
    direction = 'vertical',
    wrap = true,
    initialIndex = 0,
  } = options;

  const containerRef = useRef<T | null>(null);
  const currentIndexRef = useRef(initialIndex);

  const focusItem = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="option"], [role="tab"], [data-nav-item]'
    );
    
    if (items[index]) {
      items[index].focus();
      currentIndexRef.current = index;
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const { key } = e;
    let newIndex = currentIndexRef.current;

    // Navigation keys based on direction
    const isUp = key === 'ArrowUp' && (direction === 'vertical' || direction === 'both');
    const isDown = key === 'ArrowDown' && (direction === 'vertical' || direction === 'both');
    const isLeft = key === 'ArrowLeft' && (direction === 'horizontal' || direction === 'both');
    const isRight = key === 'ArrowRight' && (direction === 'horizontal' || direction === 'both');

    if (isUp || isLeft) {
      e.preventDefault();
      newIndex = currentIndexRef.current - 1;
      if (newIndex < 0) {
        newIndex = wrap ? itemCount - 1 : 0;
      }
      focusItem(newIndex);
    } else if (isDown || isRight) {
      e.preventDefault();
      newIndex = currentIndexRef.current + 1;
      if (newIndex >= itemCount) {
        newIndex = wrap ? 0 : itemCount - 1;
      }
      focusItem(newIndex);
    } else if (key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (key === 'End') {
      e.preventDefault();
      focusItem(itemCount - 1);
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      onSelect?.(currentIndexRef.current);
    } else if (key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
    }
  }, [direction, itemCount, wrap, focusItem, onSelect, onEscape]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    containerRef,
    currentIndex: currentIndexRef.current,
    focusItem,
  };
}

/**
 * useRovingTabIndex Hook
 * 
 * Implements roving tabindex pattern for composite widgets
 * Only one item in the group is tabbable at a time (tabindex=0),
 * others have tabindex=-1 and are navigated with arrow keys.
 * 
 * Used for: tab lists, toolbars, menu bars, tree views
 */
export function useRovingTabIndex(itemCount: number, initialIndex: number = 0) {
  const currentIndexRef = useRef(initialIndex);

  const getTabIndex = useCallback((index: number) => {
    return index === currentIndexRef.current ? 0 : -1;
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    currentIndexRef.current = index;
  }, []);

  return {
    getTabIndex,
    currentIndex: currentIndexRef.current,
    setCurrentIndex,
  };
}

export default useFocusTrap;
