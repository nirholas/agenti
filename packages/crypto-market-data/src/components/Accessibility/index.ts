/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Accessibility exports ♿
 * 
 * Comprehensive accessibility toolkit for blind and deaf users
 * WCAG 2.1 AA compliant components
 */

// Core navigation
export { default as SkipLink } from './SkipLink';

// Screen reader announcements (for blind users)
export { LiveAnnouncerProvider, useAnnounce } from './LiveAnnouncer';

// Visual feedback (for deaf users)
export { VisualFeedbackProvider, useVisualFeedback } from './VisualFeedback';
export { useFeedback } from './useFeedback';

// Icons with proper accessibility
export { AccessibleIcon, IconButton } from './AccessibleIcon';

// Keyboard navigation utilities
export { 
  useFocusTrap, 
  useArrowNavigation, 
  useRovingTabIndex 
} from './KeyboardNavigation';

// Motion sensitivity
export { 
  ReducedMotionProvider, 
  useReducedMotion, 
  Motion, 
  SafeAnimation 
} from './ReducedMotion';

// High contrast and low vision
export { 
  HighContrastProvider, 
  useHighContrast, 
  ContrastText, 
  FocusVisible 
} from './HighContrast';

// Accessible interactive elements
export { 
  AccessibleButton, 
  LinkButton 
} from './AccessibleButton';

// Code output captions (for blind users)
export { 
  CodeOutputCaption, 
  ExecutionLog, 
  ConsoleOutput 
} from './CodeOutputCaption';

// New comprehensive accessibility system ✨
export { useAccessibilityStore } from '@/stores/accessibilityStore';
export type { AccessibilitySettings } from '@/stores/accessibilityStore';
export { default as AccessibilityPanel } from './AccessibilityPanel';
export { default as AccessibilityButton } from './AccessibilityButton';
export { default as ColorBlindFilters } from './ColorBlindFilters';
export { default as ReadingGuide } from './ReadingGuide';
export { default as DwellClick } from './DwellClick';
export { default as SkipLinks } from './SkipLinks';
export { AnnouncerProvider, useAnnouncer, useAnnouncePageChange } from './Announcer';
