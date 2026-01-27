/**
 * i18n Configuration
 *
 * Internationalization configuration for Free Crypto News.
 * Used by translation scripts and validation.
 */

module.exports = {
  // Supported locales (BCP 47 language tags)
  locales: [
    'en', // English (default)
    'es', // Spanish
    'fr', // French
    'de', // German
    'pt', // Portuguese
    'ja', // Japanese
    'zh-CN', // Chinese Simplified
    'zh-TW', // Chinese Traditional
    'ko', // Korean
    'ar', // Arabic (RTL)
    'ru', // Russian
    'it', // Italian
    'nl', // Dutch
    'pl', // Polish
    'tr', // Turkish
    'vi', // Vietnamese
    'th', // Thai
    'id', // Indonesian
  ],

  // Default/source locale
  defaultLocale: 'en',
  sourceLanguage: 'en',

  // RTL locales
  rtlLocales: ['ar'],

  // Locale metadata
  localeMetadata: {
    en: { name: 'English', nativeName: 'English', direction: 'ltr' },
    es: { name: 'Spanish', nativeName: 'Español', direction: 'ltr' },
    fr: { name: 'French', nativeName: 'Français', direction: 'ltr' },
    de: { name: 'German', nativeName: 'Deutsch', direction: 'ltr' },
    pt: { name: 'Portuguese', nativeName: 'Português', direction: 'ltr' },
    ja: { name: 'Japanese', nativeName: '日本語', direction: 'ltr' },
    'zh-CN': { name: 'Chinese (Simplified)', nativeName: '简体中文', direction: 'ltr' },
    'zh-TW': { name: 'Chinese (Traditional)', nativeName: '繁體中文', direction: 'ltr' },
    ko: { name: 'Korean', nativeName: '한국어', direction: 'ltr' },
    ar: { name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
    ru: { name: 'Russian', nativeName: 'Русский', direction: 'ltr' },
    it: { name: 'Italian', nativeName: 'Italiano', direction: 'ltr' },
    nl: { name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr' },
    pl: { name: 'Polish', nativeName: 'Polski', direction: 'ltr' },
    tr: { name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr' },
    vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr' },
    th: { name: 'Thai', nativeName: 'ไทย', direction: 'ltr' },
    id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr' },
  },

  // Translation file paths
  translationFiles: {
    ui: 'messages/{locale}.json',
    readme: 'README.{locale}.md',
  },

  // AI translation settings
  modelName: 'gpt-4o-mini',
  temperature: 0.3,

  // Files/directories to exclude from translation
  exclude: [
    'node_modules',
    '.next',
    'dist',
    '.git',
    'coverage',
    'test-results',
    'playwright-report',
  ],

  // Files to translate (glob patterns)
  include: ['README.md', 'docs/**/*.md', 'CONTRIBUTING.md', 'CHANGELOG.md'],

  // Translation rules
  rules: {
    // Keep these in English (don't translate)
    preserveTerms: [
      // Technical terms
      'API',
      'JSON',
      'SDK',
      'HTTP',
      'HTTPS',
      'URL',
      'REST',
      'GraphQL',
      'WebSocket',
      'RSS',
      'Atom',
      'OPML',
      'PWA',
      'MCP',
      'SSE',
      // Crypto terms (keep in English for consistency)
      'Bitcoin',
      'Ethereum',
      'DeFi',
      'NFT',
      'TVL',
      'DEX',
      'CEX',
      'USDT',
      'USDC',
      'BTC',
      'ETH',
      'altcoin',
      'stablecoin',
      // Brand names
      'GitHub',
      'Vercel',
      'Twitter',
      'Discord',
      'Telegram',
      'Slack',
      'CoinDesk',
      'CoinTelegraph',
      'Blockworks',
      'The Block',
      'Decrypt',
      'CoinGecko',
      'DeFiLlama',
      'Groq',
      'OpenAI',
      'Claude',
      'ChatGPT',
      // Project names
      'Free Crypto News',
      'next-intl',
      'Next.js',
      'React',
      'Node.js',
    ],
    // Preserve these patterns (regex)
    preservePatterns: [
      /\{[^}]+\}/g, // Interpolation: {variable}
      /`[^`]+`/g, // Inline code
      /```[\s\S]*?```/g, // Code blocks
      /https?:\/\/[^\s)]+/g, // URLs
      /\$[A-Z]+/g, // Ticker symbols: $BTC
      /#[A-Z][a-zA-Z]+/g, // Hashtags
      /@[a-zA-Z0-9_]+/g, // Mentions
    ],
  },

  // Namespaces for UI translations
  namespaces: [
    'common',
    'nav',
    'home',
    'news',
    'article',
    'markets',
    'coin',
    'search',
    'bookmarks',
    'watchlist',
    'portfolio',
    'settings',
    'sources',
    'topics',
    'digest',
    'sentiment',
    'compare',
    'movers',
    'defi',
    'share',
    'footer',
    'errors',
    'pwa',
    'time',
    'a11y',
    'metadata',
  ],
};
