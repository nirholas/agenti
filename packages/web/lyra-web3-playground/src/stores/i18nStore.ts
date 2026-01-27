/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Innovation starts with a single keystroke ⌨️
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translateAllStrings, getCachedTranslations, clearTranslationCache } from '@/services/translation';

export type Language = 'en' | 'es' | 'zh' | 'fr' | 'de' | 'ja' | 'ko' | 'pt' | 'ru' | 'ar';

interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

export const languages: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true }
];

// Base English translations (source of truth)
export const baseTranslations: Record<string, string> = {
    // Navigation
    'nav.home': 'Home',
    'nav.examples': 'Examples',
    'nav.playground': 'Playground',
    'nav.sandbox': 'Sandbox',
    'nav.docs': 'Documentation',
    'nav.tutorials': 'Tutorials',
    'nav.about': 'About',
    'nav.faq': 'FAQ',
    'nav.community': 'Community',
    'nav.settings': 'Settings',
    
    // Hero
    'hero.title': 'Learn Web3 Development',
    'hero.subtitle': 'The Interactive Way',
    'hero.description': 'Build, deploy, and understand smart contracts with AI-powered tools and interactive tutorials.',
    'hero.cta.start': 'Start Building',
    'hero.cta.explore': 'Explore Examples',
    
    // Features
    'features.title': 'Revolutionary Features',
    'features.ai.title': 'AI Code Whisperer',
    'features.ai.description': 'Real-time AI analysis with voice control',
    'features.timemachine.title': 'Time Machine',
    'features.timemachine.description': 'Travel through code evolution',
    'features.exploit.title': 'Exploit Lab',
    'features.exploit.description': 'Learn security by hacking safely',
    'features.arena.title': 'Collaborative Arena',
    'features.arena.description': 'Code with AI teammates',
    'features.neural.title': 'Neural Gas Oracle',
    'features.neural.description': 'ML-powered gas optimization',
    'features.crosschain.title': 'Cross-Chain Deploy',
    'features.crosschain.description': 'Deploy to 8+ networks instantly',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.copy': 'Copy',
    'common.copied': 'Copied!',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.close': 'Close',
    'common.open': 'Open',
    'common.learn_more': 'Learn More',
    'common.get_started': 'Get Started',
    
    // Sandbox
    'sandbox.compile': 'Compile',
    'sandbox.deploy': 'Deploy',
    'sandbox.compiling': 'Compiling...',
    'sandbox.deploying': 'Deploying...',
    'sandbox.console': 'Console',
    'sandbox.files': 'Files',
    'sandbox.interaction': 'Interact',
    'sandbox.innovation': 'Innovation Mode',
    'sandbox.activate_innovation': 'Activate Innovation',
    
    // About
    'about.title': 'About Us',
    'about.mission': 'Our Mission',
    'about.vision': 'Our Vision',
    'about.team': 'Meet the Team',
    'about.values': 'Our Values',
    'about.join': 'Join Our Mission',
    
    // Docs
    'docs.title': 'Documentation',
    'docs.search_placeholder': 'Search documentation...',
    'docs.getting_started': 'Getting Started',
    'docs.quick_links': 'Quick Links',
    'docs.read_time': 'min read',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.system': 'System',
    'settings.notifications': 'Notifications',
    'settings.privacy': 'Privacy',
    
    // Footer
    'footer.rights': 'All rights reserved',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
    
    // Explore Page
    'explore.title': 'Explore the Community',
    'explore.subtitle': 'Discover shared projects, templates, and tutorials from developers around the world',
    'explore.search_placeholder': 'Search projects, templates, tutorials...',
    'explore.no_projects': 'No projects found',
    'explore.be_first': 'Be the first to share something!',
    'explore.create_project': 'Create a Project',
    'explore.showing': 'Showing {count} of {total} projects',
    
    // Categories
    'category.all': 'All',
    'category.sandbox': 'Sandboxes',
    'category.template': 'Templates',
    'category.tutorial': 'Tutorials',
    'category.example': 'Examples',
    
    // Sort
    'sort.recent': 'Most Recent',
    'sort.popular': 'Most Viewed',
    'sort.likes': 'Most Liked',
    
    // Tutorial Page
    'tutorial.difficulty': 'Difficulty',
    'tutorial.duration': 'Duration',
    'tutorial.prerequisites': 'Prerequisites',
    'tutorial.start': 'Start Tutorial',
    'tutorial.continue': 'Continue',
    'tutorial.complete': 'Complete',
    'tutorial.step': 'Step {current} of {total}',
    
    // Markets Page
    'markets.title': 'Live Markets',
    'markets.price': 'Price',
    'markets.change_24h': '24h Change',
    'markets.volume': 'Volume',
    'markets.market_cap': 'Market Cap',
    
    // DeFi
    'defi.analytics': 'Live DeFi Analytics',
    'defi.tvl': 'Total Value Locked',
    'defi.protocols': 'Top Protocols',
    'defi.learn_build': 'Learn How to Build This',
    
    // Auth
    'auth.connect_wallet': 'Connect Wallet',
    'auth.disconnect': 'Disconnect',
    'auth.sign_in': 'Sign In',
    'auth.sign_out': 'Sign Out',
    
    // Errors
    'error.generic': 'Something went wrong',
    'error.not_found': 'Page not found',
    'error.network': 'Network error',
    'error.try_again': 'Try Again',
};

// Dynamic translations storage (populated from API/cache)
let dynamicTranslations: Record<Language, Record<string, string>> = {
  en: { ...baseTranslations },
  es: {},
  zh: {},
  fr: {},
  de: {},
  ja: {},
  ko: {},
  pt: {},
  ru: {},
  ar: {},
};

interface I18nStore {
  language: Language;
  isLoading: boolean;
  translationError: string | null;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string>) => string;
  isRTL: () => boolean;
  refreshTranslations: () => Promise<void>;
  clearCache: () => void;
}

export const useI18n = create<I18nStore>()(
  persist(
    (set, get) => ({
      language: 'en',
      isLoading: false,
      translationError: null,
      
      setLanguage: async (lang: Language) => {
        set({ language: lang, isLoading: true, translationError: null });
        
        // Update document direction for RTL languages
        const langInfo = languages.find(l => l.code === lang);
        document.documentElement.dir = langInfo?.rtl ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        
        // If English, no need to translate
        if (lang === 'en') {
          dynamicTranslations.en = { ...baseTranslations };
          set({ isLoading: false });
          return;
        }
        
        // Check cache first
        const cached = getCachedTranslations(lang);
        if (cached && Object.keys(cached).length > 0) {
          dynamicTranslations[lang] = cached;
          set({ isLoading: false });
          return;
        }
        
        // Fetch translations from API
        try {
          const translations = await translateAllStrings(baseTranslations, lang);
          dynamicTranslations[lang] = translations;
          set({ isLoading: false });
        } catch (error: any) {
          console.error('Failed to load translations:', error);
          set({ isLoading: false, translationError: error.message });
        }
      },
      
      t: (key: string, params?: Record<string, string>) => {
        const { language } = get();
        
        // Get translation from dynamic store, fall back to English, then to key
        let text = dynamicTranslations[language]?.[key] 
          || dynamicTranslations.en[key] 
          || baseTranslations[key]
          || key;
        
        // Replace parameters like {name} with actual values
        if (params) {
          Object.entries(params).forEach(([param, value]) => {
            text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
          });
        }
        
        return text;
      },
      
      isRTL: () => {
        const { language } = get();
        const langInfo = languages.find(l => l.code === language);
        return langInfo?.rtl || false;
      },
      
      refreshTranslations: async () => {
        const { language, setLanguage } = get();
        clearTranslationCache();
        await setLanguage(language);
      },
      
      clearCache: () => {
        clearTranslationCache();
        // Reset dynamic translations
        Object.keys(dynamicTranslations).forEach(lang => {
          if (lang !== 'en') {
            dynamicTranslations[lang as Language] = {};
          }
        });
      }
    }),
    {
      name: 'i18n-storage',
      partialize: (state) => ({ language: state.language })
    }
  )
);

export default useI18n;
