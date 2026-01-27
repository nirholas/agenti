/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * ♿ Floating Accessibility Button - Always accessible, never intrusive
 * 💫 One-click access to inclusive features
 */

import { useState, useEffect, useCallback } from 'react';
import { Accessibility, X, Settings, Volume2, VolumeX, Moon, Sun, Minus, Plus, Eye } from 'lucide-react';
import { useAccessibilityStore } from '@/stores/accessibilityStore';
import AccessibilityPanel from './AccessibilityPanel';

export default function AccessibilityButton() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const { settings, updateSetting, speak } = useAccessibilityStore();

  // Handle dragging for repositioning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Keyboard shortcut: Alt + A to open accessibility panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        setIsPanelOpen(prev => !prev);
        speak(isPanelOpen ? 'Closing accessibility panel' : 'Opening accessibility panel');
      }
      if (e.key === 'Escape' && isPanelOpen) {
        setIsPanelOpen(false);
        speak('Accessibility panel closed');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, speak]);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    speak(document.documentElement.classList.contains('dark') ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const increaseFontSize = () => {
    const sizes = ['normal', 'large', 'x-large', 'xx-large'] as const;
    const currentIndex = sizes.indexOf(settings.fontSize);
    if (currentIndex < sizes.length - 1) {
      updateSetting('fontSize', sizes[currentIndex + 1]);
      speak(`Font size increased to ${sizes[currentIndex + 1]}`);
    }
  };

  const decreaseFontSize = () => {
    const sizes = ['normal', 'large', 'x-large', 'xx-large'] as const;
    const currentIndex = sizes.indexOf(settings.fontSize);
    if (currentIndex > 0) {
      updateSetting('fontSize', sizes[currentIndex - 1]);
      speak(`Font size decreased to ${sizes[currentIndex - 1]}`);
    }
  };

  const toggleHighContrast = () => {
    updateSetting('highContrast', !settings.highContrast);
    speak(settings.highContrast ? 'High contrast disabled' : 'High contrast enabled');
  };

  const toggleTextToSpeech = () => {
    updateSetting('textToSpeech', !settings.textToSpeech);
    if (!settings.textToSpeech) {
      setTimeout(() => speak('Text to speech enabled'), 100);
    }
  };

  return (
    <>
      {/* Main Floating Button */}
      <button
        onMouseDown={handleMouseDown}
        onClick={() => {
          if (!isDragging) {
            setIsQuickMenuOpen(prev => !prev);
          }
        }}
        className="fixed z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary-600 to-secondary-600 text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center cursor-move group"
        style={{ left: position.x, top: position.y }}
        aria-label="Open accessibility quick menu"
        aria-expanded={isQuickMenuOpen}
        aria-haspopup="true"
        title="Accessibility options (Alt + A for full panel)"
      >
        <Accessibility className="w-7 h-7 group-hover:scale-110 transition-transform" aria-hidden="true" />
      </button>

      {/* Quick Menu Popup */}
      {isQuickMenuOpen && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 border border-gray-200 dark:border-gray-700 min-w-[280px]"
          style={{ 
            left: Math.min(position.x, window.innerWidth - 300),
            top: Math.max(20, position.y - 280)
          }}
          role="menu"
          aria-label="Accessibility quick menu"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Accessibility className="w-5 h-5 text-primary-600" />
              Quick Access
            </h3>
            <button
              onClick={() => setIsQuickMenuOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              aria-label="Close quick menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Font Size Controls */}
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium">Text Size</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={decreaseFontSize}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                  aria-label="Decrease font size"
                  disabled={settings.fontSize === 'normal'}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm min-w-[60px] text-center capitalize">{settings.fontSize}</span>
                <button
                  onClick={increaseFontSize}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                  aria-label="Increase font size"
                  disabled={settings.fontSize === 'xx-large'}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Toggles */}
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition"
              role="menuitem"
            >
              <span className="flex items-center gap-3">
                {document.documentElement.classList.contains('dark') ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
                <span>Dark Mode</span>
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                document.documentElement.classList.contains('dark') 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {document.documentElement.classList.contains('dark') ? 'On' : 'Off'}
              </span>
            </button>

            <button
              onClick={toggleHighContrast}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition"
              role="menuitem"
            >
              <span className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-blue-500" />
                <span>High Contrast</span>
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                settings.highContrast 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {settings.highContrast ? 'On' : 'Off'}
              </span>
            </button>

            <button
              onClick={toggleTextToSpeech}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition"
              role="menuitem"
            >
              <span className="flex items-center gap-3">
                {settings.textToSpeech ? (
                  <Volume2 className="w-5 h-5 text-green-500" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-500" />
                )}
                <span>Text to Speech</span>
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                settings.textToSpeech 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {settings.textToSpeech ? 'On' : 'Off'}
              </span>
            </button>

            {/* Full Settings Button */}
            <button
              onClick={() => {
                setIsQuickMenuOpen(false);
                setIsPanelOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-lg hover:opacity-90 transition"
              role="menuitem"
            >
              <Settings className="w-5 h-5" />
              <span>All Accessibility Settings</span>
            </button>

            <p className="text-xs text-gray-500 text-center mt-2">
              Keyboard shortcut: <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Alt + A</kbd>
            </p>
          </div>
        </div>
      )}

      {/* Full Accessibility Panel */}
      <AccessibilityPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </>
  );
}
