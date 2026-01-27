# 🌍 Internationalization (i18n) Guide

Free Crypto News supports **18 languages** with full UI translations, API response translation, and localized documentation.

---

## Supported Languages

| Code | Language | Native Name | Direction | Status |
|------|----------|-------------|-----------|--------|
| `en` | English | English | LTR | ✅ Complete |
| `es` | Spanish | Español | LTR | ✅ Complete |
| `fr` | French | Français | LTR | ✅ Complete |
| `de` | German | Deutsch | LTR | ✅ Complete |
| `pt` | Portuguese | Português | LTR | ✅ Complete |
| `ja` | Japanese | 日本語 | LTR | ✅ Complete |
| `zh-CN` | Chinese (Simplified) | 简体中文 | LTR | ✅ Complete |
| `zh-TW` | Chinese (Traditional) | 繁體中文 | LTR | ✅ Complete |
| `ko` | Korean | 한국어 | LTR | ✅ Complete |
| `ar` | Arabic | العربية | RTL | ✅ Complete |
| `ru` | Russian | Русский | LTR | ✅ Complete |
| `it` | Italian | Italiano | LTR | ✅ Complete |
| `nl` | Dutch | Nederlands | LTR | ✅ Complete |
| `pl` | Polish | Polski | LTR | ✅ Complete |
| `tr` | Turkish | Türkçe | LTR | ✅ Complete |
| `vi` | Vietnamese | Tiếng Việt | LTR | ✅ Complete |
| `th` | Thai | ไทย | LTR | ✅ Complete |
| `id` | Indonesian | Bahasa Indonesia | LTR | ✅ Complete |

---

## URL Structure

### Web App Routes

The web app uses locale-prefixed URLs:

| Locale | URL Pattern | Example |
|--------|-------------|---------|
| English (default) | `/` or `/en/` | `https://freecryptonews.app/` |
| Spanish | `/es/` | `https://freecryptonews.app/es/` |
| Japanese | `/ja/` | `https://freecryptonews.app/ja/` |
| Arabic (RTL) | `/ar/` | `https://freecryptonews.app/ar/` |

### Examples

```
https://freecryptonews.app/          # English (default)
https://freecryptonews.app/es/       # Spanish home
https://freecryptonews.app/ja/news   # Japanese news page
https://freecryptonews.app/ar/about  # Arabic about page (RTL)
```

---

## API Translation

The API supports response translation via the `lang` parameter:

### Basic Usage

```bash
# Get news in Spanish
curl "https://free-crypto-news.vercel.app/api/news?lang=es"

# Get news in Japanese
curl "https://free-crypto-news.vercel.app/api/news?lang=ja"

# Get news in Arabic
curl "https://free-crypto-news.vercel.app/api/news?lang=ar"
```

### Response Format

```json
{
  "articles": [
    {
      "title": "Bitcoin alcanza nuevo máximo histórico",
      "description": "El precio de Bitcoin superó los $100,000...",
      "source": "CoinDesk",
      "pubDate": "2026-01-23T12:00:00Z"
    }
  ],
  "lang": "es",
  "availableLanguages": ["en", "es", "fr", "de", "pt", "ja", "zh-CN", "zh-TW", "ko", "ar", "ru", "it", "nl", "pl", "tr", "vi", "th", "id"]
}
```

### Endpoints Supporting Translation

| Endpoint | Translation Support |
|----------|---------------------|
| `/api/news` | ✅ Full |
| `/api/breaking` | ✅ Full |
| `/api/defi` | ✅ Full |
| `/api/bitcoin` | ✅ Full |
| `/api/search` | ✅ Full |
| `/api/digest` | ✅ Full |
| `/api/archive` | ✅ Full |
| `/api/archive/v2` | ✅ Full |

### Translation Requirements

- **API Key**: Requires `GROQ_API_KEY` environment variable (FREE at [console.groq.com](https://console.groq.com/keys))
- **Feature Flag**: Set `FEATURE_TRANSLATION=true` for real-time translation
- **Fallback**: Returns English if translation fails

---

## For Developers

### Project Structure

```
free-crypto-news/
├── messages/                    # UI translation files
│   ├── en.json                 # English (base)
│   ├── es.json                 # Spanish
│   ├── fr.json                 # French
│   ├── de.json                 # German
│   ├── ja.json                 # Japanese
│   ├── zh-CN.json              # Chinese Simplified
│   ├── zh-TW.json              # Chinese Traditional
│   ├── ko.json                 # Korean
│   ├── ar.json                 # Arabic (RTL)
│   ├── ru.json                 # Russian
│   ├── it.json                 # Italian
│   ├── nl.json                 # Dutch
│   ├── pl.json                 # Polish
│   ├── tr.json                 # Turkish
│   ├── vi.json                 # Vietnamese
│   ├── th.json                 # Thai
│   └── id.json                 # Indonesian
├── src/
│   ├── i18n/                   # i18n configuration
│   │   ├── config.ts           # Locale configuration
│   │   ├── request.ts          # next-intl request config
│   │   ├── navigation.ts       # i18n-aware navigation
│   │   └── index.ts            # Exports
│   ├── lib/
│   │   ├── translate.ts        # API translation service
│   │   └── source-translator.ts # International source translator
│   └── middleware.ts           # Locale detection middleware
├── scripts/i18n/               # Translation scripts
│   ├── translate.js            # Auto-translate documentation
│   └── validate.js             # Validate translation files
├── README.md                   # English README
├── README.es.md                # Spanish README
├── README.ja.md                # Japanese README
└── ...                         # Other language READMEs
```

### Using Translations in Components

#### Client Components

```typescript
'use client';

import { useTranslations } from 'next-intl';

export function NewsCard() {
  const t = useTranslations('news');
  
  return (
    <article>
      <h2>{t('latestNews')}</h2>
      <button>{t('readMore')}</button>
    </article>
  );
}
```

#### Server Components

```typescript
import { getTranslations } from 'next-intl/server';

export default async function NewsPage() {
  const t = await getTranslations('news');
  
  return (
    <main>
      <h1>{t('title')}</h1>
    </main>
  );
}
```

#### Multiple Namespaces

```typescript
import { useTranslations } from 'next-intl';

export function Header() {
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  
  return (
    <header>
      <span>{tCommon('appName')}</span>
      <nav>
        <a href="/">{tNav('home')}</a>
        <a href="/news">{tNav('news')}</a>
      </nav>
    </header>
  );
}
```

### Interpolation

Translation files support interpolation with `{variable}` syntax:

**messages/en.json:**
```json
{
  "greeting": "Hello, {name}!",
  "articles": "{count} articles found",
  "publishedAt": "Published {time}"
}
```

**Usage:**
```typescript
t('greeting', { name: 'World' })     // "Hello, World!"
t('articles', { count: 42 })         // "42 articles found"
t('publishedAt', { time: '2h ago' }) // "Published 2h ago"
```

### Pluralization

```json
{
  "article": "{count, plural, =0 {No articles} =1 {1 article} other {# articles}}"
}
```

```typescript
t('article', { count: 0 })  // "No articles"
t('article', { count: 1 })  // "1 article"
t('article', { count: 5 })  // "5 articles"
```

### Date/Time Formatting

```typescript
import { useFormatter } from 'next-intl';

function ArticleDate({ date }) {
  const format = useFormatter();
  
  return (
    <time dateTime={date.toISOString()}>
      {format.relativeTime(date)}
    </time>
  );
}
```

### i18n-Aware Navigation

Use the i18n navigation components instead of Next.js defaults:

```typescript
// ❌ Don't use
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ✅ Use
import { Link, useRouter, usePathname } from '@/i18n/navigation';
```

This ensures links automatically include the current locale prefix.

### Adding RTL Support

Arabic is an RTL (right-to-left) language. The layout handles this automatically:

```typescript
// src/app/[locale]/layout.tsx
import { useLocale } from 'next-intl';

export default function Layout({ children }) {
  const locale = useLocale();
  const isRTL = locale === 'ar';
  
  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'}>
      <body className={isRTL ? 'rtl' : 'ltr'}>
        {children}
      </body>
    </html>
  );
}
```

CSS considerations for RTL:

```css
/* Use logical properties */
.card {
  margin-inline-start: 1rem;  /* Instead of margin-left */
  padding-inline-end: 1rem;   /* Instead of padding-right */
}

/* Tailwind CSS RTL utilities */
<div className="ms-4 me-2">  /* margin-start, margin-end */
```

---

## Adding New Translations

### Step 1: Add strings to en.json

```json
{
  "myFeature": {
    "title": "My New Feature",
    "description": "This is a new feature",
    "button": "Click me"
  }
}
```

### Step 2: Add to all other locale files

Add the same keys with translated values to all 17 other files.

### Step 3: Use in components

```typescript
const t = useTranslations('myFeature');
return <h1>{t('title')}</h1>;
```

### Step 4: Run validation

```bash
npm run i18n:validate
```

---

## Translation Scripts

### Validate Translations

Check all translation files for completeness and consistency:

```bash
npm run i18n:validate
```

This checks:
- All locale files exist
- All keys match the English base file
- No extra/missing keys
- Interpolation placeholders preserved
- Valid JSON syntax

### Auto-Translate Documentation

Translate README and documentation files:

```bash
# Translate all files
npm run i18n:translate

# Translate specific file
node scripts/i18n/translate.js --file README.md

# Translate to specific language
node scripts/i18n/translate.js --lang ja
```

Requires `OPENAI_API_KEY` environment variable.

---

## Testing

### Unit Tests

```bash
npm run test:i18n
```

Tests:
- All locale files exist
- Key consistency across locales
- Interpolation placeholder preservation
- JSON validity

### E2E Tests

```bash
npm run e2e:i18n
```

Tests:
- Locale routing works
- Language switcher functions
- RTL support for Arabic
- Translated content renders
- SEO attributes correct

---

## Contributing Translations

We welcome translation contributions! Here's how:

### 1. Fork the Repository

```bash
git clone https://github.com/nirholas/free-crypto-news.git
cd free-crypto-news
```

### 2. Edit Translation Files

Edit files in the `messages/` directory. Each file is a JSON object with namespaced translations.

### 3. Translation Guidelines

- **Keep it natural**: Use fluent, natural language for the target locale
- **Preserve placeholders**: Keep `{variable}` syntax unchanged
- **Technical terms**: Keep these in English when appropriate:
  - API, JSON, SDK, HTTP, URL
  - Bitcoin, Ethereum (cryptocurrency names)
  - DeFi, NFT, TVL (crypto acronyms)
  - GitHub, Twitter, Discord (brand names)
- **Match tone**: Keep the same informal but professional tone as English
- **Test RTL**: For Arabic, ensure layout works correctly

### 4. Validate Your Changes

```bash
npm run i18n:validate
```

### 5. Submit a Pull Request

Create a PR with your translation improvements. Include:
- Which locale(s) you updated
- Summary of changes
- Any context for translation decisions

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | For API translation | Free API key from [console.groq.com](https://console.groq.com/keys) |
| `FEATURE_TRANSLATION` | No | Set to `true` to enable real-time API translation |
| `OPENAI_API_KEY` | For doc translation | Required for `npm run i18n:translate` script |

---

## Locale Detection

The middleware automatically detects the user's preferred language:

1. **URL path**: `/es/` → Spanish
2. **Cookie**: `NEXT_LOCALE` cookie value
3. **Accept-Language header**: Browser preference
4. **Default**: Falls back to English

---

## FAQ

### How do I change the default language?

Edit `src/i18n/config.ts`:

```typescript
export const defaultLocale = 'es'; // Change from 'en'
```

### How do I add a new language?

1. Add locale code to `src/i18n/config.ts`
2. Create `messages/{locale}.json` with all translations
3. Create `README.{locale}.md` (optional)
4. Run validation: `npm run i18n:validate`

### Why isn't translation working on the API?

1. Check `GROQ_API_KEY` is set
2. Check `FEATURE_TRANSLATION=true` is set
3. Check the `lang` parameter is a supported locale

### How do I handle missing translations?

The system falls back to English if a translation is missing. To find missing keys:

```bash
npm run i18n:validate
```

---

## Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [BCP 47 Language Tags](https://www.w3.org/International/articles/language-tags/)
- [RTL Styling Guide](https://rtlstyling.com/)
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
