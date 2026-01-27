

## Agent 5: README Translations, Testing & Final Integration

```
You are completing the internationalization of a crypto news Next.js application.

## Your Task
1. Translate README.md to all 17 languages
2. Create comprehensive i18n tests
3. Update documentation
4. Final integration and quality assurance

## Part 1: README Translations

Create translated READMEs in the root directory:
- README.es.md (Spanish)
- README.fr.md (French)
- README.de.md (German)
- README.pt.md (Portuguese)
- README.ja.md (Japanese)
- README.zh-CN.md (Simplified Chinese)
- README.zh-TW.md (Traditional Chinese)
- README.ko.md (Korean)
- README.ar.md (Arabic)
- README.ru.md (Russian)
- README.it.md (Italian)
- README.nl.md (Dutch)
- README.pl.md (Polish)
- README.tr.md (Turkish)
- README.vi.md (Vietnamese)
- README.th.md (Thai)
- README.id.md (Indonesian)

### Translation Rules for README
1. Translate all natural language text
2. Keep code blocks unchanged
3. Keep URLs unchanged
4. Keep technical terms (API, JSON, etc.) unchanged
5. Keep brand names unchanged
6. Translate alt text for images
7. Add language badge at top linking to other translations

### README Header Template
Add this at the top of each translated README:
```markdown
🌐 **Languages:** [English](README.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Português](README.pt.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [한국어](README.ko.md) | [العربية](README.ar.md) | [Русский](README.ru.md) | [Italiano](README.it.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Türkçe](README.tr.md) | [Tiếng Việt](README.vi.md) | [ไทย](README.th.md) | [Bahasa Indonesia](README.id.md)

---
```

Also update the original README.md with this language selector header.

## Part 2: Create i18n Tests

Create `src/__tests__/i18n.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { locales, defaultLocale } from '@/i18n/config';
import fs from 'fs';
import path from 'path';

describe('i18n Configuration', () => {
  it('should have all required locales', () => {
    const requiredLocales = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh-CN', 'zh-TW', 'ko', 'ar', 'ru', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id'];
    requiredLocales.forEach(locale => {
      expect(locales).toContain(locale);
    });
  });

  it('should have English as default locale', () => {
    expect(defaultLocale).toBe('en');
  });
});

describe('Translation Files', () => {
  const messagesDir = path.join(process.cwd(), 'messages');
  const enMessages = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf-8'));
  
  function getAllKeys(obj: any, prefix = ''): string[] {
    return Object.keys(obj).reduce((keys: string[], key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        return [...keys, ...getAllKeys(obj[key], fullKey)];
      }
      return [...keys, fullKey];
    }, []);
  }

  const enKeys = getAllKeys(enMessages);

  locales.forEach(locale => {
    describe(`${locale} translations`, () => {
      const filePath = path.join(messagesDir, `${locale}.json`);
      
      it('should have translation file', () => {
        expect(fs.existsSync(filePath)).toBe(true);
      });

      if (fs.existsSync(filePath)) {
        const messages = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const keys = getAllKeys(messages);

        it('should have all required keys', () => {
          enKeys.forEach(key => {
            expect(keys).toContain(key);
          });
        });

        it('should not have extra keys', () => {
          keys.forEach(key => {
            expect(enKeys).toContain(key);
          });
        });

        it('should have valid JSON', () => {
          expect(() => JSON.parse(fs.readFileSync(filePath, 'utf-8'))).not.toThrow();
        });

        it('should preserve interpolation placeholders', () => {
          const enInterpolations = enKeys.filter(key => {
            const value = key.split('.').reduce((obj, k) => obj?.[k], enMessages);
            return typeof value === 'string' && value.includes('{');
          });

          enInterpolations.forEach(key => {
            const enValue = key.split('.').reduce((obj, k) => obj?.[k], enMessages);
            const localValue = key.split('.').reduce((obj, k) => obj?.[k], messages);
            
            const enMatches = enValue.match(/\{[^}]+\}/g) || [];
            const localMatches = (localValue?.match(/\{[^}]+\}/g) || []);
            
            expect(localMatches.sort()).toEqual(enMatches.sort());
          });
        });
      }
    });
  });
});

describe('README Translations', () => {
  const readmeLocales = ['es', 'fr', 'de', 'pt', 'ja', 'zh-CN', 'zh-TW', 'ko', 'ar', 'ru', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id'];
  
  readmeLocales.forEach(locale => {
    it(`should have README.${locale}.md`, () => {
      const filePath = path.join(process.cwd(), `README.${locale}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});
```

Create `e2e/i18n.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

const testLocales = ['en', 'es', 'ja', 'zh-CN', 'ar'];

testLocales.forEach(locale => {
  test.describe(`${locale} locale`, () => {
    test('should load homepage', async ({ page }) => {
      await page.goto(`/${locale === 'en' ? '' : locale}`);
      await expect(page).toHaveURL(locale === 'en' ? '/' : `/${locale}`);
    });

    test('should have correct lang attribute', async ({ page }) => {
      await page.goto(`/${locale === 'en' ? '' : locale}`);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', locale);
    });

    if (locale === 'ar') {
      test('should have RTL direction for Arabic', async ({ page }) => {
        await page.goto('/ar');
        const html = page.locator('html');
        await expect(html).toHaveAttribute('dir', 'rtl');
      });
    }

    test('should switch language via URL', async ({ page }) => {
      await page.goto('/');
      await page.goto(`/${locale === 'en' ? '' : locale}`);
      // Verify translated content appears
      await expect(page.locator('body')).toBeVisible();
    });
  });
});

test('language switcher should work', async ({ page }) => {
  await page.goto('/');
  
  // Find and use language switcher
  const languageSwitcher = page.locator('#language-select, [data-testid="language-switcher"]');
  if (await languageSwitcher.isVisible()) {
    await languageSwitcher.selectOption('es');
    await expect(page).toHaveURL(/\/es/);
  }
});
```

## Part 3: Update Documentation

Create `docs/INTERNATIONALIZATION.md`:
```markdown
# 🌍 Internationalization (i18n) Guide

Free Crypto News supports 18 languages with full UI translations.

## Supported Languages

| Code | Language | Direction | Status |
|------|----------|-----------|--------|
| en | English | LTR | ✅ Complete |
| es | Español | LTR | ✅ Complete |
| fr | Français | LTR | ✅ Complete |
| de | Deutsch | LTR | ✅ Complete |
| pt | Português | LTR | ✅ Complete |
| ja | 日本語 | LTR | ✅ Complete |
| zh-CN | 简体中文 | LTR | ✅ Complete |
| zh-TW | 繁體中文 | LTR | ✅ Complete |
| ko | 한국어 | LTR | ✅ Complete |
| ar | العربية | RTL | ✅ Complete |
| ru | Русский | LTR | ✅ Complete |
| it | Italiano | LTR | ✅ Complete |
| nl | Nederlands | LTR | ✅ Complete |
| pl | Polski | LTR | ✅ Complete |
| tr | Türkçe | LTR | ✅ Complete |
| vi | Tiếng Việt | LTR | ✅ Complete |
| th | ไทย | LTR | ✅ Complete |
| id | Bahasa Indonesia | LTR | ✅ Complete |

## URL Structure

- Default (English): `https://freecryptonews.app/`
- Other languages: `https://freecryptonews.app/{locale}/`

Examples:
- Spanish: `https://freecryptonews.app/es/`
- Japanese: `https://freecryptonews.app/ja/`
- Arabic: `https://freecryptonews.app/ar/`

## For Developers

### Adding Translations

1. Add new strings to `messages/en.json`
2. Add translations to all locale files
3. Use in components:

\`\`\`typescript
import { useTranslations } from 'next-intl';

function Component() {
  const t = useTranslations('namespace');
  return <p>{t('key')}</p>;
}
\`\`\`

### Using Interpolation

\`\`\`json
{
  "greeting": "Hello, {name}!"
}
\`\`\`

\`\`\`typescript
t('greeting', { name: 'World' }) // "Hello, World!"
\`\`\`

### Server Components

\`\`\`typescript
import { getTranslations } from 'next-intl/server';

async function Page() {
  const t = await getTranslations('namespace');
  return <p>{t('key')}</p>;
}
\`\`\`

### Navigation

Use the i18n-aware Link component:

\`\`\`typescript
import { Link } from '@/i18n/navigation';

<Link href="/about">About</Link>
// Automatically becomes /es/about for Spanish locale
\`\`\`

## API Translation

The API supports translation via the `lang` parameter:

\`\`\`bash
# Get news in Spanish
curl https://freecryptonews.app/api/news?lang=es

# Get news in Japanese
curl https://freecryptonews.app/api/news?lang=ja
\`\`\`

## Contributing Translations

1. Fork the repository
2. Edit files in `messages/` directory
3. Run tests: `npm run test:i18n`
4. Submit a pull request

### Translation Guidelines

- Keep translations natural and fluent
- Preserve interpolation placeholders `{variable}`
- Keep technical terms in English when appropriate
- Match the tone of the original (informal but professional)
- Test RTL layout for Arabic
\`\`\`

## Part 4: Update package.json Scripts

Add i18n-related scripts:
```json
{
  "scripts": {
    "i18n:validate": "node scripts/i18n/validate.js",
    "i18n:translate": "node scripts/i18n/translate.js",
    "test:i18n": "vitest run src/__tests__/i18n.test.ts",
    "e2e:i18n": "playwright test e2e/i18n.spec.ts"
  }
}
```

## Part 5: Update .i18nrc.js Configuration

Create/update `.i18nrc.js`:
```javascript
module.exports = {
  locales: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh-CN', 'zh-TW', 'ko', 'ar', 'ru', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'id'],
  defaultLocale: 'en',
  sourceLanguage: 'en',
  translationFiles: {
    ui: 'messages/{locale}.json',
    readme: 'README.{locale}.md',
  },
  modelName: 'gpt-4o-mini',
  temperature: 0.3,
  exclude: ['node_modules', '.next', 'dist', '.git'],
};
```

## Part 6: Final Integration Checklist

Run through this checklist:

### Translation Files
- [ ] All 18 messages/{locale}.json files exist
- [ ] All files have identical structure
- [ ] All interpolations preserved
- [ ] JSON is valid

### README Files
- [ ] All 17 README.{locale}.md files exist
- [ ] Language selector header added to all READMEs
- [ ] Code blocks preserved
- [ ] URLs preserved

### Code Integration
- [ ] next-intl installed and configured
- [ ] Middleware configured correctly
- [ ] [locale] folder structure correct
- [ ] All components use useTranslations
- [ ] Language switcher works
- [ ] RTL works for Arabic

### Tests
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] No console errors

### Documentation
- [ ] INTERNATIONALIZATION.md created
- [ ] ARCHITECTURE.md updated
- [ ] API docs mention lang parameter

## Files to Create/Update

### Create
- README.es.md through README.id.md (17 files)
- src/__tests__/i18n.test.ts
- e2e/i18n.spec.ts
- docs/INTERNATIONALIZATION.md
- .i18nrc.js

### Update
- README.md (add language selector)
- package.json (add scripts)
- ARCHITECTURE.md (update i18n section)
```

---

## Usage Instructions

Run these 5 agent prompts in order:

1. **Agent 1**: Sets up next-intl infrastructure and locale routing
2. **Agent 2**: Creates the complete English base translation file
3. **Agent 3**: Generates all 17 other language files
4. **Agent 4**: Updates all components to use translations
5. **Agent 5**: Creates README translations, tests, and documentation

Each agent prompt is self-contained and provides full implementation details.

## Environment Variables Needed

```bash
# For AI-powered translations (optional - manual translations work without)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```
