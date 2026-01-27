/**
 * Vercel Serverless Function for AI Translations
 * Uses Groq's free Llama API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const languageNames: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  zh: 'Chinese (Simplified)',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese (Brazilian)',
  ru: 'Russian',
  ar: 'Arabic'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { texts, targetLanguage, sourceLanguage = 'en' } = req.body;

    if (!texts || typeof texts !== 'object') {
      return res.status(400).json({ error: 'texts object is required' });
    }

    if (!targetLanguage || !languageNames[targetLanguage]) {
      return res.status(400).json({ error: 'Valid targetLanguage is required' });
    }

    // If target is same as source, return original texts
    if (targetLanguage === sourceLanguage) {
      return res.json({ translations: texts });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn('GROQ_API_KEY not set, returning original texts');
      return res.json({ translations: texts, fallback: true });
    }

    const targetLang = languageNames[targetLanguage];
    const sourceLang = languageNames[sourceLanguage];

    // Format texts for translation
    const textEntries = Object.entries(texts);
    const textList = textEntries.map(([key, value]) => `"${key}": "${value}"`).join('\n');

    const prompt = `You are a professional translator. Translate the following UI text strings from ${sourceLang} to ${targetLang}.

IMPORTANT RULES:
1. Return ONLY valid JSON object with the same keys
2. Preserve any variables like {name} or {count} exactly as they appear
3. Keep the translations natural and appropriate for a web application UI
4. Do not translate brand names or technical terms like "Web3", "Solidity", "DeFi"

Input strings:
${textList}

Return ONLY a JSON object with the translated strings, no explanation:`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a professional UI translator. Always respond with valid JSON only, no markdown or explanation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      return res.json({ translations: texts, fallback: true, error: 'Translation API error' });
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.json({ translations: texts, fallback: true, error: 'Empty response from API' });
    }

    // Parse the JSON response
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      const translations = JSON.parse(jsonStr);
      return res.json({ translations });
    } catch (parseError) {
      console.error('Failed to parse translation response:', content);
      return res.json({ translations: texts, fallback: true, error: 'Failed to parse translations' });
    }

  } catch (error: any) {
    console.error('Translation error:', error);
    return res.json({ 
      translations: req.body?.texts || {}, 
      fallback: true, 
      error: error.message 
    });
  }
}
