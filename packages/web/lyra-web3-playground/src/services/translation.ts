/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 AI-powered translations for global reach 🌍
 */

// Use serverless function in production, local server in dev
const getTranslateUrl = () => {
  if (import.meta.env.PROD) {
    // In production, use Vercel serverless function
    return '/api/translate';
  }
  // In development, use local Express server
  return (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/translate';
};

const CACHE_KEY = 'lyra-translations-cache';
const CACHE_VERSION = 1;

interface TranslationCache {
  version: number;
  translations: Record<string, Record<string, string>>;
  timestamps: Record<string, number>;
}

/**
 * Load cached translations from localStorage
 */
function loadCache(): TranslationCache {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data.version === CACHE_VERSION) {
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to load translation cache:', e);
  }
  return { version: CACHE_VERSION, translations: {}, timestamps: {} };
}

/**
 * Save translations to localStorage cache
 */
function saveCache(cache: TranslationCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to save translation cache:', e);
  }
}

/**
 * Get cached translations for a language
 */
export function getCachedTranslations(language: string): Record<string, string> | null {
  const cache = loadCache();
  const translations = cache.translations[language];
  const timestamp = cache.timestamps[language];
  
  // Cache valid for 7 days
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  if (translations && timestamp && Date.now() - timestamp < maxAge) {
    return translations;
  }
  
  return null;
}

/**
 * Cache translations for a language
 */
export function cacheTranslations(language: string, translations: Record<string, string>): void {
  const cache = loadCache();
  cache.translations[language] = translations;
  cache.timestamps[language] = Date.now();
  saveCache(cache);
}

/**
 * Clear translation cache
 */
export function clearTranslationCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Translate texts using the server API (which calls Groq)
 */
export async function translateTexts(
  texts: Record<string, string>,
  targetLanguage: string,
  sourceLanguage: string = 'en'
): Promise<{ translations: Record<string, string>; fromCache: boolean; error?: string }> {
  // Check cache first
  const cached = getCachedTranslations(targetLanguage);
  if (cached) {
    // Check if all requested keys are in cache
    const allCached = Object.keys(texts).every(key => key in cached);
    if (allCached) {
      return { translations: cached, fromCache: true };
    }
  }

  // If same language, return original
  if (targetLanguage === sourceLanguage) {
    return { translations: texts, fromCache: false };
  }

  try {
    const response = await fetch(getTranslateUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        texts,
        targetLanguage,
        sourceLanguage
      })
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.translations) {
      // Merge with existing cache
      const existingCache = getCachedTranslations(targetLanguage) || {};
      const mergedTranslations = { ...existingCache, ...data.translations };
      cacheTranslations(targetLanguage, mergedTranslations);
      
      return { 
        translations: mergedTranslations, 
        fromCache: false,
        error: data.fallback ? 'Used fallback translations' : undefined
      };
    }

    return { translations: texts, fromCache: false, error: 'No translations returned' };
  } catch (error: any) {
    console.error('Translation service error:', error);
    return { translations: texts, fromCache: false, error: error.message };
  }
}

/**
 * Batch translate all UI strings for a language
 * This is called when the user switches language
 */
export async function translateAllStrings(
  baseStrings: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
  // First check if we have a complete cache
  const cached = getCachedTranslations(targetLanguage);
  if (cached && Object.keys(cached).length >= Object.keys(baseStrings).length) {
    return cached;
  }

  // Translate in batches to avoid rate limits and large payloads
  const entries = Object.entries(baseStrings);
  const batchSize = 50;
  const batches: Record<string, string>[] = [];
  
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = Object.fromEntries(entries.slice(i, i + batchSize));
    batches.push(batch);
  }

  let allTranslations: Record<string, string> = cached ? { ...cached } : {};
  
  for (const batch of batches) {
    const { translations } = await translateTexts(batch, targetLanguage);
    allTranslations = { ...allTranslations, ...translations };
    
    // Small delay between batches to respect rate limits
    if (batches.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Cache the complete translations
  cacheTranslations(targetLanguage, allTranslations);
  
  return allTranslations;
}
