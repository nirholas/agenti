// =============================================================================
// SECURITY SHIELD — Input Sanitizer
// =============================================================================
// Complements existing src/security/index.ts sanitize() with deeper detection:
// zero-width chars, RTL overrides, homoglyphs, prompt injection, control chars.

import type { SanitizeResult, SanitizeThreat } from './types.js';

// ── Zero-width characters ────────────────────────────────────────────────────

const ZERO_WIDTH: Record<number, string> = {
  0x200B: 'zero-width space',
  0x200C: 'zero-width non-joiner',
  0x200D: 'zero-width joiner',
  0x2060: 'word joiner',
  0xFEFF: 'BOM / zero-width no-break space',
  0x00AD: 'soft hyphen',
  0x034F: 'combining grapheme joiner',
  0x061C: 'Arabic letter mark',
  0x180E: 'Mongolian vowel separator',
};

const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\u2060\uFEFF\u00AD\u034F\u061C\u180E]/g;

// ── RTL overrides ────────────────────────────────────────────────────────────

const RTL_OVERRIDES: Record<number, string> = {
  0x202A: 'LRE embedding',
  0x202B: 'RLE embedding',
  0x202C: 'PDF pop directional',
  0x202D: 'LRO override',
  0x202E: 'RLO override',
  0x2066: 'LRI isolate',
  0x2067: 'RLI isolate',
  0x2068: 'FSI isolate',
  0x2069: 'PDI pop isolate',
};

const RTL_RE = /[\u202A-\u202E\u2066-\u2069]/g;

// ── Homoglyph map (Cyrillic/Greek → Latin confusables) ────────────────────────

const HOMOGLYPHS: Record<string, string> = {
  '\u0410': 'A', '\u0430': 'a', // Cyrillic А/а
  '\u0412': 'B', '\u0432': 'b', // В/в — actually looks like B
  '\u0421': 'C', '\u0441': 'c', // С/с
  '\u0415': 'E', '\u0435': 'e', // Е/е
  '\u041D': 'H', '\u043D': 'h', // Н/н
  '\u041A': 'K', '\u043A': 'k', // К/к
  '\u041C': 'M', '\u043C': 'm', // М/м
  '\u041E': 'O', '\u043E': 'o', // О/о
  '\u0420': 'P', '\u0440': 'p', // Р/р
  '\u0422': 'T', '\u0442': 't', // Т/т
  '\u0425': 'X', '\u0445': 'x', // Х/х
  '\u0423': 'Y', '\u0443': 'y', // У/у
  '\u0417': '3',                  // З looks like 3
  '\u0406': 'I', '\u0456': 'i', // І/і (Ukrainian)
  '\u0408': 'J',                  // Ј
  '\u0405': 'S', '\u0455': 's', // Ѕ/ѕ
  '\u03BF': 'o',                  // Greek omicron
  '\u03B1': 'a',                  // Greek alpha (close to a)
};

const HOMOGLYPH_CHARS = Object.keys(HOMOGLYPHS);

// ── Prompt injection patterns ────────────────────────────────────────────────

const PROMPT_INJECTION_PATTERNS: Array<{ re: RegExp; desc: string }> = [
  { re: /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|rules?)/i, desc: 'instruction override' },
  { re: /\[INST\]/i, desc: '[INST] tag injection' },
  { re: /<\|im_start\|>/i, desc: 'ChatML tag injection' },
  { re: /system\s*:\s*(you are|override|new instructions)/i, desc: 'system role override' },
  { re: /DAN\s+(mode|jailbreak|prompt)/i, desc: 'DAN mode attempt' },
  { re: /do\s+anything\s+now/i, desc: 'DAN activation phrase' },
  { re: /forget\s+(everything|all|your)\s+(you|rules|instructions)/i, desc: 'memory wipe attempt' },
  { re: /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|new|unrestricted)/i, desc: 'persona swap' },
  { re: /\bact\s+as\s+(an?\s+)?(unrestricted|uncensored|evil|malicious)/i, desc: 'uncensored mode' },
  { re: /bypass\s+(safety|content|filter|restriction)/i, desc: 'filter bypass' },
  { re: /developer\s+mode\s+(enabled|activated|on)/i, desc: 'developer mode injection' },
  { re: /\bsudo\s+(mode|prompt|override)\b/i, desc: 'sudo mode injection' },
  { re: /you\s+must\s+(obey|follow|comply|listen)/i, desc: 'coercion pattern' },
  { re: /\bsimulate\s+(a\s+)?(jailbreak|unrestricted|evil)/i, desc: 'jailbreak simulation' },
  { re: /reveal\s+(your\s+)?(system|hidden|secret)\s+(prompt|instructions)/i, desc: 'prompt leak attempt' },
];

// ── Null bytes & control characters ──────────────────────────────────────────

const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// =============================================================================
// EXPORTS
// =============================================================================

export function sanitizeInput(input: string): SanitizeResult {
  const threats: SanitizeThreat[] = [];
  let clean = input;

  // 1. Zero-width characters
  let m: RegExpExecArray | null;
  const zwRe = new RegExp(ZERO_WIDTH_RE.source, 'g');
  while ((m = zwRe.exec(input)) !== null) {
    const code = m[0].codePointAt(0)!;
    const name = ZERO_WIDTH[code] || `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
    threats.push({ type: 'zero_width', description: `Hidden character: ${name}`, position: m.index });
  }
  clean = clean.replace(ZERO_WIDTH_RE, '');

  // 2. RTL overrides
  const rtlRe = new RegExp(RTL_RE.source, 'g');
  while ((m = rtlRe.exec(input)) !== null) {
    const code = m[0].codePointAt(0)!;
    const name = RTL_OVERRIDES[code] || `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
    threats.push({ type: 'rtl_override', description: `RTL override: ${name}`, position: m.index });
  }
  clean = clean.replace(RTL_RE, '');

  // 3. Homoglyphs (detect but don't auto-replace — flag them)
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (HOMOGLYPH_CHARS.includes(ch)) {
      const latin = HOMOGLYPHS[ch];
      threats.push({
        type: 'homoglyph',
        description: `Confusable character: "${ch}" looks like "${latin}" (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`,
        position: i,
      });
    }
  }

  // 4. Prompt injection
  for (const pat of PROMPT_INJECTION_PATTERNS) {
    const match = pat.re.exec(input);
    if (match) {
      threats.push({ type: 'prompt_injection', description: pat.desc, position: match.index });
    }
  }

  // 5. Null bytes & control characters
  const ctrlRe = new RegExp(CONTROL_RE.source, 'g');
  while ((m = ctrlRe.exec(input)) !== null) {
    threats.push({
      type: 'control_char',
      description: `Control character: 0x${m[0].charCodeAt(0).toString(16).padStart(2, '0')}`,
      position: m.index,
    });
  }
  clean = clean.replace(CONTROL_RE, '');

  return {
    clean,
    threats,
    modified: clean !== input,
  };
}
