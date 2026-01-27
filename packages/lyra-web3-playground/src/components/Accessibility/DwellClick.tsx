/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 🖱️ Dwell Click - Click by hovering for motor impairments
 * 💫 Essential for users who cannot perform physical clicks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccessibilityStore } from '@/stores/accessibilityStore';

export default function DwellClick() {
  const { settings } = useAccessibilityStore();
  const [dwellElement, setDwellElement] = useState<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationRef = useRef<number>(0);

  const startDwell = useCallback((element: HTMLElement, x: number, y: number) => {
    if (!settings.dwellClick) return;

    // Only dwell on clickable elements
    const isClickable = 
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.tagName === 'INPUT' ||
      element.tagName === 'SELECT' ||
      element.tagName === 'TEXTAREA' ||
      element.getAttribute('role') === 'button' ||
      element.getAttribute('role') === 'link' ||
      element.getAttribute('role') === 'tab' ||
      element.getAttribute('tabindex') !== null ||
      element.onclick !== null ||
      getComputedStyle(element).cursor === 'pointer';

    if (!isClickable) {
      cancelDwell();
      return;
    }

    setDwellElement(element);
    setPosition({ x, y });
    startTimeRef.current = Date.now();
    element.setAttribute('data-dwell-active', 'true');

    // Animate progress
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min(100, (elapsed / settings.dwellTime) * 100);
      setProgress(newProgress);

      if (newProgress < 100) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Trigger click
        element.click();
        element.focus();
        cancelDwell();
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [settings.dwellClick, settings.dwellTime]);

  const cancelDwell = useCallback(() => {
    if (dwellElement) {
      dwellElement.removeAttribute('data-dwell-active');
    }
    setDwellElement(null);
    setProgress(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, [dwellElement]);

  useEffect(() => {
    if (!settings.dwellClick) {
      cancelDwell();
      return;
    }

    let lastElement: HTMLElement | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      const element = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      
      if (element !== lastElement) {
        lastElement = element;
        cancelDwell();
        if (element) {
          startDwell(element, e.clientX, e.clientY);
        }
      }
    };

    const handleMouseLeave = () => {
      cancelDwell();
      lastElement = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelDwell();
    };
  }, [settings.dwellClick, startDwell, cancelDwell]);

  if (!settings.dwellClick || !dwellElement || progress === 0) return null;

  // Calculate the stroke dasharray for circular progress
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="fixed pointer-events-none z-[10000]"
      style={{
        left: position.x - 30,
        top: position.y - 30,
      }}
      aria-hidden="true"
    >
      <svg width="60" height="60" viewBox="0 0 60 60">
        {/* Background circle */}
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="4"
        />
        {/* Progress circle */}
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 30 30)"
          style={{ transition: 'stroke-dashoffset 0.05s linear' }}
        />
        {/* Center dot */}
        <circle
          cx="30"
          cy="30"
          r="4"
          fill="#3b82f6"
        />
      </svg>
    </div>
  );
}
