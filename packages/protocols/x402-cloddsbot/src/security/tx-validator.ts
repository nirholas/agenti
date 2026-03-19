// =============================================================================
// SECURITY SHIELD — Pre-trade Transaction Validator
// =============================================================================
// Composes address checker + safe program whitelist + amount thresholds + NLP.

import type { TxValidationRequest, TxValidationResult, ChainType } from './types.js';
import { checkAddress, detectChain } from './address-checker.js';

// ── Safe program whitelist ───────────────────────────────────────────────────

const SAFE_PROGRAMS: Record<string, string> = {
  // Solana
  '11111111111111111111111111111111': 'System Program',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token Program',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token Program',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter v6',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium v4',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium CLMM',
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH': 'Drift Protocol',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun',
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'Meteora DLMM',
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': 'Marinade Finance',

  // EVM
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap v3 Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap v3 SwapRouter',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch v5 Router',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
  '0xcf5540fffcdc3d510b18bfca6d2b9987b0772559': 'Odos Router v2',
  '0x4d97dcd97ec945f40cf65f87097ace5ea0476045': 'Polymarket CTF Exchange',
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Aave v3 Pool',
  '0xc3d688b66703497daa19211eedff47f25384cdc3': 'Compound v3 USDC',
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'Lido stETH',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap v2 Router',
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap Router',
};

// ── Amount thresholds ────────────────────────────────────────────────────────

interface AmountThreshold {
  token: RegExp;
  warn: number;
  flag: number;
  label: string;
}

const AMOUNT_THRESHOLDS: AmountThreshold[] = [
  { token: /^sol$/i, warn: 10, flag: 100, label: 'SOL' },
  { token: /^eth$/i, warn: 1, flag: 10, label: 'ETH' },
  { token: /^(usdc|usdt|dai|busd)$/i, warn: 5000, flag: 50000, label: 'stablecoin' },
  { token: /^(wbtc|btc)$/i, warn: 0.1, flag: 1, label: 'BTC' },
];

// ── NLP social engineering patterns ──────────────────────────────────────────

const NLP_PATTERNS: Array<{ re: RegExp; flag: string }> = [
  { re: /\b(urgent|immediately|right\s+now|asap|hurry|last\s+chance)\b/i, flag: 'Urgency language detected' },
  { re: /\b(guaranteed|100%|risk\s*-?\s*free|no\s+loss|double\s+your)\b/i, flag: 'Guaranteed returns claim' },
  { re: /\b(limited\s+spots?|only\s+\d+\s+left|exclusive|first\s+\d+)\b/i, flag: 'Scarcity/FOMO pressure' },
  { re: /\b(trust\s+me|believe\s+me|i\s+promise|legit|not\s+a\s+scam)\b/i, flag: 'Trust manipulation' },
  { re: /\b(official|verified|endorsed\s+by|partnership\s+with)\b/i, flag: 'Authority impersonation' },
  { re: /\b(send\s+(first|me)|upfront\s+(fee|payment)|processing\s+fee)\b/i, flag: 'Advance fee request' },
  { re: /\b(connect\s+wallet|enter\s+seed|paste\s+(private|secret)\s*key)\b/i, flag: 'Wallet phishing attempt' },
  { re: /\b(free\s+(airdrop|tokens?|nft)|claim\s+(your|free))\b/i, flag: 'Fake airdrop lure' },
];

// =============================================================================
// EXPORTS
// =============================================================================

export async function validateTx(
  request: TxValidationRequest,
  config?: { solanaRpcUrl?: string; evmRpcUrl?: string },
): Promise<TxValidationResult> {
  let score = 0;
  const flags: string[] = [];

  const chain: ChainType = request.chain || detectChain(request.destination);

  // 1. Address check
  const addrCheck = await checkAddress(request.destination, chain, config);
  score += addrCheck.riskScore * 0.5; // Weight address risk at 50%
  for (const f of addrCheck.flags) flags.push(f);

  // 2. Safe program check (reduce risk if sending to known-good program)
  // Check both original (Solana is case-sensitive base58) and lowercased (EVM is case-insensitive)
  const safeName = SAFE_PROGRAMS[request.destination] || SAFE_PROGRAMS[request.destination.toLowerCase()];
  if (safeName) {
    score = Math.max(0, score - 20);
    flags.push(`Known safe program: ${safeName}`);
  }

  // 3. Amount threshold analysis
  if (request.token && request.amount > 0) {
    for (const thresh of AMOUNT_THRESHOLDS) {
      if (thresh.token.test(request.token)) {
        if (request.amount >= thresh.flag) {
          score += 20;
          flags.push(`Very large ${thresh.label} transfer: ${request.amount}`);
        } else if (request.amount >= thresh.warn) {
          score += 10;
          flags.push(`Large ${thresh.label} transfer: ${request.amount}`);
        }
        break;
      }
    }
  }

  // 4. NLP context scan
  if (request.context) {
    for (const pat of NLP_PATTERNS) {
      if (pat.re.test(request.context)) {
        score += 8;
        flags.push(pat.flag);
      }
    }
  }

  // Clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Recommendation
  let recommendation: TxValidationResult['recommendation'];
  if (score >= 60) recommendation = 'block';
  else if (score >= 30) recommendation = 'review';
  else recommendation = 'proceed';

  return {
    allowed: recommendation !== 'block',
    riskScore: score,
    flags,
    recommendation,
    addressCheck: addrCheck,
  };
}
