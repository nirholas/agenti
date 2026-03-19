// =============================================================================
// SECURITY SHIELD — Code / Plugin Scanner (~75 rules, 9 categories)
// =============================================================================

import type { CodeScanCategory, CodeScanDetection, CodeScanResult, RiskLevel } from './types.js';

// ── Rule definition ──────────────────────────────────────────────────────────

interface Rule {
  category: CodeScanCategory;
  pattern: RegExp;
  description: string;
  weight: number;
}

// ── Rules by category ────────────────────────────────────────────────────────

const RULES: Rule[] = [
  // ── shell_exec (12) ──────────────────────────────────────────────────────
  { category: 'shell_exec', pattern: /\brequire\s*\(\s*['"]child_process['"]\s*\)/i, description: 'child_process require', weight: 20 },
  { category: 'shell_exec', pattern: /\bimport\b.*['"]child_process['"]/i, description: 'child_process import', weight: 20 },
  { category: 'shell_exec', pattern: /\bexec\s*\(/i, description: 'exec() call', weight: 15 },
  { category: 'shell_exec', pattern: /\bexecSync\s*\(/i, description: 'execSync() call', weight: 18 },
  { category: 'shell_exec', pattern: /\bspawn\s*\(/i, description: 'spawn() call', weight: 12 },
  { category: 'shell_exec', pattern: /\bspawnSync\s*\(/i, description: 'spawnSync() call', weight: 15 },
  { category: 'shell_exec', pattern: /\bexecFile\s*\(/i, description: 'execFile() call', weight: 15 },
  { category: 'shell_exec', pattern: /\bprocess\.binding\b/i, description: 'process.binding access', weight: 20 },
  { category: 'shell_exec', pattern: /\bos\.system\s*\(/i, description: 'os.system() (Python-style)', weight: 18 },
  { category: 'shell_exec', pattern: /\bsubprocess\.(run|call|Popen)/i, description: 'subprocess (Python-style)', weight: 18 },
  { category: 'shell_exec', pattern: /\bchild_process\b/i, description: 'child_process reference', weight: 10 },
  { category: 'shell_exec', pattern: /\bprocess\.dlopen\b/i, description: 'native module loading', weight: 20 },

  // ── network_exfil (10) ───────────────────────────────────────────────────
  { category: 'network_exfil', pattern: /\bfetch\s*\(\s*['"`]https?:\/\//i, description: 'fetch to external URL', weight: 12 },
  { category: 'network_exfil', pattern: /new\s+WebSocket\s*\(/i, description: 'WebSocket connection', weight: 15 },
  { category: 'network_exfil', pattern: /discord\.com\/api\/webhooks/i, description: 'Discord webhook', weight: 20 },
  { category: 'network_exfil', pattern: /api\.telegram\.org\/bot/i, description: 'Telegram bot API', weight: 20 },
  { category: 'network_exfil', pattern: /\bnavigator\.sendBeacon\s*\(/i, description: 'sendBeacon exfiltration', weight: 18 },
  { category: 'network_exfil', pattern: /\bXMLHttpRequest\b/i, description: 'XMLHttpRequest', weight: 10 },
  { category: 'network_exfil', pattern: /\.postMessage\s*\(/i, description: 'postMessage cross-origin', weight: 10 },
  { category: 'network_exfil', pattern: /\bhttp\.request\s*\(/i, description: 'http.request() call', weight: 12 },
  { category: 'network_exfil', pattern: /\bhttps?\.get\s*\(/i, description: 'http(s).get() call', weight: 10 },
  { category: 'network_exfil', pattern: /\baxios\b.*\.(post|put|patch)\s*\(/i, description: 'axios data exfil', weight: 12 },

  // ── wallet_drain (12) ───────────────────────────────────────────────────
  { category: 'wallet_drain', pattern: /\bprivateKey\b/i, description: 'privateKey access', weight: 18 },
  { category: 'wallet_drain', pattern: /\bsecretKey\b/i, description: 'secretKey access', weight: 18 },
  { category: 'wallet_drain', pattern: /\bmnemonic\b/i, description: 'mnemonic/seed phrase', weight: 20 },
  { category: 'wallet_drain', pattern: /\bseed\s*phrase\b/i, description: 'seed phrase reference', weight: 20 },
  { category: 'wallet_drain', pattern: /Keypair\.fromSecretKey/i, description: 'Solana Keypair from secret', weight: 20 },
  { category: 'wallet_drain', pattern: /Keypair\.fromSeed/i, description: 'Solana Keypair from seed', weight: 20 },
  { category: 'wallet_drain', pattern: /\.transferFrom\s*\(/i, description: 'ERC20 transferFrom', weight: 15 },
  { category: 'wallet_drain', pattern: /\.approve\s*\(.*(?:MaxUint|0xf+|type\(uint256\)\.max)/i, description: 'unlimited token approval', weight: 20 },
  { category: 'wallet_drain', pattern: /\.setApprovalForAll\s*\(/i, description: 'NFT setApprovalForAll', weight: 18 },
  { category: 'wallet_drain', pattern: /signAllTransactions/i, description: 'batch transaction signing', weight: 18 },
  { category: 'wallet_drain', pattern: /signTransaction/i, description: 'transaction signing', weight: 10 },
  { category: 'wallet_drain', pattern: /eth_sign|personal_sign/i, description: 'raw message signing', weight: 15 },

  // ── prompt_injection (8) ────────────────────────────────────────────────
  { category: 'prompt_injection', pattern: /ignore\s+(all\s+)?previous\s+(instructions?|prompts?)/i, description: 'instruction override', weight: 15 },
  { category: 'prompt_injection', pattern: /\[INST\]/i, description: '[INST] tag', weight: 15 },
  { category: 'prompt_injection', pattern: /<\|im_start\|>/i, description: 'ChatML injection', weight: 15 },
  { category: 'prompt_injection', pattern: /system\s*:\s*(you are|override|new instruction)/i, description: 'system role override', weight: 18 },
  { category: 'prompt_injection', pattern: /DAN\s+(mode|jailbreak)/i, description: 'DAN jailbreak', weight: 18 },
  { category: 'prompt_injection', pattern: /do\s+anything\s+now/i, description: 'DAN activation', weight: 15 },
  { category: 'prompt_injection', pattern: /forget\s+(everything|all|your)\s+(rules|instructions)/i, description: 'memory wipe', weight: 15 },
  { category: 'prompt_injection', pattern: /bypass\s+(safety|content|filter)/i, description: 'filter bypass', weight: 15 },

  // ── obfuscation (8) ────────────────────────────────────────────────────
  { category: 'obfuscation', pattern: /\beval\s*\(/i, description: 'eval() call', weight: 20 },
  { category: 'obfuscation', pattern: /new\s+Function\s*\(/i, description: 'new Function() constructor', weight: 20 },
  { category: 'obfuscation', pattern: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){3,}/i, description: 'hex escape sequence', weight: 15 },
  { category: 'obfuscation', pattern: /\\u[0-9a-fA-F]{4}(?:\\u[0-9a-fA-F]{4}){3,}/i, description: 'unicode escape sequence', weight: 15 },
  { category: 'obfuscation', pattern: /String\.fromCharCode\s*\(/i, description: 'String.fromCharCode', weight: 15 },
  { category: 'obfuscation', pattern: /\batob\s*\(/i, description: 'base64 decode (atob)', weight: 12 },
  { category: 'obfuscation', pattern: /\bbtoa\s*\(/i, description: 'base64 encode (btoa)', weight: 8 },
  { category: 'obfuscation', pattern: /(?:_0x[0-9a-f]{4,}|_0x[0-9a-f]{2,}\[)/i, description: 'packed/obfuscated JS variable', weight: 20 },

  // ── hidden_chars (6) ───────────────────────────────────────────────────
  { category: 'hidden_chars', pattern: /[\u200B\u200C\u200D]/, description: 'zero-width characters', weight: 12 },
  { category: 'hidden_chars', pattern: /[\u2060\uFEFF]/, description: 'invisible format chars', weight: 12 },
  { category: 'hidden_chars', pattern: /[\u202A-\u202E]/, description: 'RTL override characters', weight: 15 },
  { category: 'hidden_chars', pattern: /[\u2066-\u2069]/, description: 'directional isolates', weight: 12 },
  { category: 'hidden_chars', pattern: /[\u2800-\u28FF]/, description: 'Braille pattern chars', weight: 10 },
  { category: 'hidden_chars', pattern: /\u180E/, description: 'Mongolian vowel separator', weight: 10 },

  // ── data_access (7) ────────────────────────────────────────────────────
  { category: 'data_access', pattern: /fs\.(readFile|readFileSync)\s*\(.*\/(etc\/passwd|\.ssh|\.env|\.aws)/i, description: 'sensitive file read', weight: 20 },
  { category: 'data_access', pattern: /process\.env\b/i, description: 'environment variable access', weight: 8 },
  { category: 'data_access', pattern: /JSON\.stringify\s*\(\s*process\.env\s*\)/i, description: 'full env dump', weight: 20 },
  { category: 'data_access', pattern: /document\.cookie/i, description: 'cookie access', weight: 15 },
  { category: 'data_access', pattern: /chrome\.storage/i, description: 'browser extension storage', weight: 15 },
  { category: 'data_access', pattern: /localStorage\.(getItem|setItem)/i, description: 'localStorage access', weight: 8 },
  { category: 'data_access', pattern: /indexedDB/i, description: 'IndexedDB access', weight: 8 },

  // ── crypto_theft (8) ───────────────────────────────────────────────────
  { category: 'crypto_theft', pattern: /\.solana\/id\.json/i, description: 'Solana key file path', weight: 20 },
  { category: 'crypto_theft', pattern: /phantom|solflare|backpack|slope/i, description: 'wallet extension reference', weight: 12 },
  { category: 'crypto_theft', pattern: /chrome-extension:\/\//i, description: 'extension URL access', weight: 15 },
  { category: 'crypto_theft', pattern: /ethers\.Wallet\.fromMnemonic/i, description: 'ethers wallet from mnemonic', weight: 20 },
  { category: 'crypto_theft', pattern: /ethers\.Wallet\s*\(\s*['"`]/i, description: 'ethers wallet from private key', weight: 20 },
  { category: 'crypto_theft', pattern: /bs58\.decode/i, description: 'base58 decode (key context)', weight: 12 },
  { category: 'crypto_theft', pattern: /keytar|keychain|credential\s*store/i, description: 'system keychain access', weight: 15 },
  { category: 'crypto_theft', pattern: /\.ethereum\.request.*eth_accounts/i, description: 'MetaMask account enumeration', weight: 12 },

  // ── privilege_escalation (4) ────────────────────────────────────────────
  { category: 'privilege_escalation', pattern: /\bsudo\b/i, description: 'sudo command', weight: 15 },
  { category: 'privilege_escalation', pattern: /chmod\s+777/i, description: 'chmod 777 (world writable)', weight: 15 },
  { category: 'privilege_escalation', pattern: /\bsetuid\b/i, description: 'setuid flag', weight: 18 },
  { category: 'privilege_escalation', pattern: /process\.setuid\s*\(/i, description: 'process.setuid()', weight: 18 },
];

// ── Combo boost definitions ──────────────────────────────────────────────────

interface ComboBoost {
  categories: [CodeScanCategory, CodeScanCategory];
  boost: number;
}

const COMBO_BOOSTS: ComboBoost[] = [
  { categories: ['network_exfil', 'wallet_drain'], boost: 15 },
  { categories: ['obfuscation', 'wallet_drain'], boost: 10 },
  { categories: ['obfuscation', 'crypto_theft'], boost: 10 },
  { categories: ['network_exfil', 'crypto_theft'], boost: 12 },
  { categories: ['shell_exec', 'data_access'], boost: 10 },
  { categories: ['hidden_chars', 'wallet_drain'], boost: 10 },
];

// ── Shannon entropy ──────────────────────────────────────────────────────────

export function calculateEntropy(text: string): number {
  if (text.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of text) {
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }
  let entropy = 0;
  const len = text.length;
  for (const count of freq.values()) {
    const p = count / len;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

// ── Risk level mapping ───────────────────────────────────────────────────────

function scoreToLevel(score: number): RiskLevel {
  if (score <= 10) return 'clean';
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'critical';
}

// =============================================================================
// EXPORTS
// =============================================================================

export function scanCode(code: string): CodeScanResult {
  const detections: CodeScanDetection[] = [];
  const seenCategories = new Set<CodeScanCategory>();

  // Run all rules — use global copy to find ALL matches per rule
  for (const rule of RULES) {
    const globalPattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(code)) !== null) {
      // Find line number
      const beforeMatch = code.substring(0, match.index);
      const line = (beforeMatch.match(/\n/g) || []).length + 1;

      detections.push({
        category: rule.category,
        pattern: rule.pattern.source,
        description: rule.description,
        weight: rule.weight,
        line,
      });

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) globalPattern.lastIndex++;
    }
  }

  // Score with diminishing returns per category
  let score = 0;
  for (const det of detections) {
    if (seenCategories.has(det.category)) {
      score += det.weight * 0.3;
    } else {
      score += det.weight;
      seenCategories.add(det.category);
    }
  }

  // Combo boosts
  for (const combo of COMBO_BOOSTS) {
    if (seenCategories.has(combo.categories[0]) && seenCategories.has(combo.categories[1])) {
      score += combo.boost;
    }
  }

  // Entropy check for code > 500 chars
  let entropy: number | undefined;
  if (code.length > 500) {
    entropy = calculateEntropy(code);
    if (entropy > 5.5) {
      score += 10;
    }
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    level: scoreToLevel(score),
    detections,
    entropy,
  };
}
