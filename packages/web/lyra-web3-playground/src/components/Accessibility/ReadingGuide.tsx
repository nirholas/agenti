/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 📖 Reading Guide - Visual line tracker for easier reading
 * 💫 Helps users with dyslexia, ADHD, or visual tracking difficulties
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccessibilityStore } from '@/stores/accessibilityStore';

export default function ReadingGuide() {
  const { settings } = useAccessibilityStore();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (settings.readingGuide) {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    }
  }, [settings.readingGuide]);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (settings.readingGuide) {
      window.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseleave', handleMouseLeave);
      };
    } else {
      setIsVisible(false);
    }
  }, [settings.readingGuide, handleMouseMove, handleMouseLeave]);

  if (!settings.readingGuide || !isVisible) return null;

  // Get the line height from settings or use default
  const getLineHeight = () => {
    switch (settings.lineHeight) {
      case 'relaxed': return 44;
      case 'loose': return 52;
      default: return 36;
    }
  };

  const lineHeight = getLineHeight();

  return (
    <div
      className="a11y-reading-guide-line"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: position.y - lineHeight / 2,
        height: lineHeight,
        backgroundColor: settings.readingGuideColor,
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: 0.4,
        transition: 'top 0.1s ease-out',
        mixBlendMode: 'multiply',
      }}
      aria-hidden="true"
    />
  );
}
