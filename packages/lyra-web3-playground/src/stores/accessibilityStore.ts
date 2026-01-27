/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Accessibility is not a feature, it's a right ♿
 * 
 * Cutting-edge accessibility settings store
 * Features beyond WCAG 2.1 AA - truly inclusive design
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AccessibilitySettings {
  // Vision
  highContrast: boolean;
  contrastLevel: 'normal' | 'more' | 'maximum';
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';
  fontSize: 'normal' | 'large' | 'x-large' | 'xx-large';
  fontFamily: 'default' | 'dyslexia' | 'monospace' | 'sans-serif';
  lineHeight: 'normal' | 'relaxed' | 'loose';
  letterSpacing: 'normal' | 'wide' | 'wider';
  cursorSize: 'normal' | 'large' | 'x-large';
  focusIndicator: 'default' | 'enhanced' | 'maximum';
  
  // Motion & Animation
  reducedMotion: boolean;
  pauseAnimations: boolean;
  reducedTransparency: boolean;
  
  // Audio & Speech
  screenReaderOptimized: boolean;
  textToSpeech: boolean;
  speechRate: number; // 0.5 to 2.0
  speechPitch: number; // 0.5 to 2.0
  speakCodeNaturally: boolean; // "function" instead of "f-u-n-c-t-i-o-n"
  soundEffects: boolean;
  visualSoundIndicators: boolean; // For deaf users - visual pulses for sounds
  
  // Motor / Physical
  stickyKeys: boolean;
  largeClickTargets: boolean;
  extendedTimeouts: boolean;
  keyboardOnly: boolean;
  dwellClick: boolean; // Click by hovering
  dwellTime: number; // ms before click triggers
  
  // Cognitive
  simplifiedUI: boolean;
  readingGuide: boolean; // Line highlighting
  readingGuideColor: string;
  focusMode: boolean; // Dims non-essential UI
  autoReadAloud: boolean;
  showTooltipsLonger: boolean;
  confirmActions: boolean; // Confirm before destructive actions
  
  // Advanced
  customCSS: string;
  savedProfile: string;
  announcePageChanges: boolean;
  describeTables: boolean;
  describeImages: boolean;
  mathAsText: boolean;
  codeAsNaturalLanguage: boolean;
}

const defaultSettings: AccessibilitySettings = {
  // Vision
  highContrast: false,
  contrastLevel: 'normal',
  colorBlindMode: 'none',
  fontSize: 'normal',
  fontFamily: 'default',
  lineHeight: 'normal',
  letterSpacing: 'normal',
  cursorSize: 'normal',
  focusIndicator: 'default',
  
  // Motion
  reducedMotion: false,
  pauseAnimations: false,
  reducedTransparency: false,
  
  // Audio
  screenReaderOptimized: false,
  textToSpeech: false,
  speechRate: 1.0,
  speechPitch: 1.0,
  speakCodeNaturally: true,
  soundEffects: true,
  visualSoundIndicators: false,
  
  // Motor
  stickyKeys: false,
  largeClickTargets: false,
  extendedTimeouts: false,
  keyboardOnly: false,
  dwellClick: false,
  dwellTime: 1000,
  
  // Cognitive
  simplifiedUI: false,
  readingGuide: false,
  readingGuideColor: '#ffff00',
  focusMode: false,
  autoReadAloud: false,
  showTooltipsLonger: false,
  confirmActions: false,
  
  // Advanced
  customCSS: '',
  savedProfile: '',
  announcePageChanges: true,
  describeTables: true,
  describeImages: true,
  mathAsText: false,
  codeAsNaturalLanguage: true,
};

interface AccessibilityStore {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void;
  resetSettings: () => void;
  applyProfile: (profile: 'vision' | 'motor' | 'cognitive' | 'deaf' | 'blind') => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
  speak: (text: string, priority?: 'polite' | 'assertive') => void;
  stopSpeaking: () => void;
  applyAccessibilityCSS: () => void;
}

export const useAccessibilityStore = create<AccessibilityStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      
      updateSetting: (key, value) => {
        set((state) => ({
          settings: { ...state.settings, [key]: value }
        }));
        
        // Apply CSS changes immediately
        applyAccessibilityCSS(get().settings);
      },
      
      resetSettings: () => {
        set({ settings: defaultSettings });
        applyAccessibilityCSS(defaultSettings);
      },
      
      applyProfile: (profile) => {
        let newSettings = { ...defaultSettings };
        
        switch (profile) {
          case 'vision':
            newSettings = {
              ...newSettings,
              highContrast: true,
              contrastLevel: 'more',
              fontSize: 'large',
              focusIndicator: 'enhanced',
              cursorSize: 'large',
            };
            break;
            
          case 'blind':
            newSettings = {
              ...newSettings,
              screenReaderOptimized: true,
              textToSpeech: true,
              speakCodeNaturally: true,
              announcePageChanges: true,
              reducedMotion: true,
              codeAsNaturalLanguage: true,
              keyboardOnly: true,
            };
            break;
            
          case 'deaf':
            newSettings = {
              ...newSettings,
              visualSoundIndicators: true,
              soundEffects: false,
              focusIndicator: 'enhanced',
              showTooltipsLonger: true,
            };
            break;
            
          case 'motor':
            newSettings = {
              ...newSettings,
              largeClickTargets: true,
              stickyKeys: true,
              extendedTimeouts: true,
              focusIndicator: 'maximum',
              dwellClick: true,
              dwellTime: 1500,
              confirmActions: true,
            };
            break;
            
          case 'cognitive':
            newSettings = {
              ...newSettings,
              simplifiedUI: true,
              readingGuide: true,
              focusMode: true,
              reducedMotion: true,
              fontSize: 'large',
              lineHeight: 'loose',
              showTooltipsLonger: true,
              confirmActions: true,
              extendedTimeouts: true,
            };
            break;
        }
        
        set({ settings: newSettings });
        applyAccessibilityCSS(newSettings);
      },
      
      exportSettings: () => {
        return JSON.stringify(get().settings, null, 2);
      },
      
      importSettings: (json) => {
        try {
          const parsed = JSON.parse(json);
          set({ settings: { ...defaultSettings, ...parsed } });
          applyAccessibilityCSS(get().settings);
          return true;
        } catch {
          return false;
        }
      },
      
      speak: (text, priority = 'polite') => {
        const { settings } = get();
        if (!settings.textToSpeech && !settings.autoReadAloud) return;
        
        // Cancel any ongoing speech
        window.speechSynthesis?.cancel();
        
        // Process code to natural language if enabled
        let processedText = text;
        if (settings.speakCodeNaturally || settings.codeAsNaturalLanguage) {
          processedText = codeToNaturalLanguage(text);
        }
        
        const utterance = new SpeechSynthesisUtterance(processedText);
        utterance.rate = settings.speechRate;
        utterance.pitch = settings.speechPitch;
        
        window.speechSynthesis?.speak(utterance);
      },
      
      stopSpeaking: () => {
        window.speechSynthesis?.cancel();
      },
      
      applyAccessibilityCSS: () => {
        applyAccessibilityCSS(get().settings);
      },
    }),
    {
      name: 'accessibility-settings',
    }
  )
);

// Apply CSS variables and classes based on settings
function applyAccessibilityCSS(settings: AccessibilitySettings) {
  const root = document.documentElement;
  const body = document.body;
  
  // Font size
  const fontSizes = {
    'normal': '16px',
    'large': '18px',
    'x-large': '20px',
    'xx-large': '24px',
  };
  root.style.setProperty('--a11y-font-size', fontSizes[settings.fontSize]);
  
  // Line height
  const lineHeights = {
    'normal': '1.5',
    'relaxed': '1.75',
    'loose': '2',
  };
  root.style.setProperty('--a11y-line-height', lineHeights[settings.lineHeight]);
  
  // Letter spacing
  const letterSpacings = {
    'normal': '0',
    'wide': '0.05em',
    'wider': '0.1em',
  };
  root.style.setProperty('--a11y-letter-spacing', letterSpacings[settings.letterSpacing]);
  
  // Font family
  const fontFamilies = {
    'default': 'inherit',
    'dyslexia': '"OpenDyslexic", "Comic Sans MS", cursive',
    'monospace': '"Fira Code", "Consolas", monospace',
    'sans-serif': '"Arial", "Helvetica", sans-serif',
  };
  root.style.setProperty('--a11y-font-family', fontFamilies[settings.fontFamily]);
  
  // Cursor size
  const cursorSizes = {
    'normal': 'auto',
    'large': 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\'%3E%3Ccircle cx=\'16\' cy=\'16\' r=\'14\' fill=\'%23000\' stroke=\'%23fff\' stroke-width=\'2\'/%3E%3C/svg%3E") 16 16, auto',
    'x-large': 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\'%3E%3Ccircle cx=\'24\' cy=\'24\' r=\'22\' fill=\'%23000\' stroke=\'%23fff\' stroke-width=\'2\'/%3E%3C/svg%3E") 24 24, auto',
  };
  root.style.setProperty('--a11y-cursor', cursorSizes[settings.cursorSize]);
  
  // Color blind filters
  const colorFilters = {
    'none': 'none',
    'protanopia': 'url(#protanopia)',
    'deuteranopia': 'url(#deuteranopia)',
    'tritanopia': 'url(#tritanopia)',
    'achromatopsia': 'grayscale(100%)',
  };
  root.style.setProperty('--a11y-color-filter', colorFilters[settings.colorBlindMode]);
  
  // Toggle classes
  body.classList.toggle('a11y-high-contrast', settings.highContrast);
  body.classList.toggle('a11y-contrast-more', settings.contrastLevel === 'more');
  body.classList.toggle('a11y-contrast-max', settings.contrastLevel === 'maximum');
  body.classList.toggle('a11y-reduced-motion', settings.reducedMotion);
  body.classList.toggle('a11y-pause-animations', settings.pauseAnimations);
  body.classList.toggle('a11y-large-targets', settings.largeClickTargets);
  body.classList.toggle('a11y-focus-enhanced', settings.focusIndicator === 'enhanced');
  body.classList.toggle('a11y-focus-maximum', settings.focusIndicator === 'maximum');
  body.classList.toggle('a11y-simplified', settings.simplifiedUI);
  body.classList.toggle('a11y-reading-guide', settings.readingGuide);
  body.classList.toggle('a11y-focus-mode', settings.focusMode);
  body.classList.toggle('a11y-keyboard-only', settings.keyboardOnly);
  body.classList.toggle('a11y-reduced-transparency', settings.reducedTransparency);
  
  // Custom CSS
  let customStyleEl = document.getElementById('a11y-custom-css');
  if (!customStyleEl) {
    customStyleEl = document.createElement('style');
    customStyleEl.id = 'a11y-custom-css';
    document.head.appendChild(customStyleEl);
  }
  customStyleEl.textContent = settings.customCSS;
  
  // Reading guide color
  root.style.setProperty('--a11y-reading-guide-color', settings.readingGuideColor);
}

// Convert code syntax to natural language for screen readers
function codeToNaturalLanguage(text: string): string {
  return text
    // Operators
    .replace(/===/g, ' strictly equals ')
    .replace(/!==/g, ' strictly not equals ')
    .replace(/==/g, ' equals ')
    .replace(/!=/g, ' not equals ')
    .replace(/=>/g, ' arrow function ')
    .replace(/<=/g, ' less than or equal to ')
    .replace(/>=/g, ' greater than or equal to ')
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/\+\+/g, ' increment ')
    .replace(/--/g, ' decrement ')
    .replace(/\+=/g, ' plus equals ')
    .replace(/-=/g, ' minus equals ')
    
    // Brackets
    .replace(/\{/g, ' open brace ')
    .replace(/\}/g, ' close brace ')
    .replace(/\[/g, ' open bracket ')
    .replace(/\]/g, ' close bracket ')
    .replace(/\(/g, ' open parenthesis ')
    .replace(/\)/g, ' close parenthesis ')
    
    // Common keywords
    .replace(/\bfunction\b/g, 'function')
    .replace(/\bconst\b/g, 'constant')
    .replace(/\blet\b/g, 'let variable')
    .replace(/\bvar\b/g, 'variable')
    .replace(/\breturn\b/g, 'return')
    .replace(/\basync\b/g, 'async')
    .replace(/\bawait\b/g, 'await')
    
    // Solidity specific
    .replace(/\bpragma\b/g, 'pragma directive')
    .replace(/\bcontract\b/g, 'smart contract')
    .replace(/\bmapping\b/g, 'mapping')
    .replace(/\bpayable\b/g, 'payable')
    .replace(/\bview\b/g, 'view function')
    .replace(/\bpure\b/g, 'pure function')
    .replace(/\bemit\b/g, 'emit event')
    .replace(/\brequire\b/g, 'require condition')
    
    // Clean up
    .replace(/\s+/g, ' ')
    .trim();
}

export default useAccessibilityStore;
