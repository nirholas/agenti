import { logger } from '../utils/logger';

export interface TokenListEntry {
  address: string;
  symbol: string;
  name?: string;
  decimals?: number;
  tags?: string[];
  logoURI?: string;
}

const DEFAULT_TOKEN_LIST_URL = 'https://tokens.jup.ag/tokens?tags=verified';

let cachedTokenList: { fetchedAt: number; tokens: TokenListEntry[] } | null = null;

function looksLikeSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export async function getTokenList(): Promise<TokenListEntry[]> {
  const now = Date.now();
  if (cachedTokenList && now - cachedTokenList.fetchedAt < 24 * 60 * 60 * 1000) {
    return cachedTokenList.tokens;
  }

  const url = process.env.SOLANA_TOKEN_LIST_URL || DEFAULT_TOKEN_LIST_URL;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Token list fetch error: ${response.status}`);
  }

  const tokens = await response.json() as TokenListEntry[];
  cachedTokenList = { fetchedAt: now, tokens };
  return tokens;
}

export async function resolveTokenMints(inputs: string[]): Promise<string[]> {
  const normalized = inputs.map((value) => value.trim()).filter(Boolean);
  const explicitMints = normalized.filter(looksLikeSolanaAddress);
  const symbols = normalized.filter((value) => !looksLikeSolanaAddress(value));

  if (symbols.length === 0) {
    return explicitMints;
  }

  const tokens = await getTokenList();
  const symbolMap = new Map<string, TokenListEntry[]>();
  for (const token of tokens) {
    const key = token.symbol?.toLowerCase();
    if (!key) continue;
    const list = symbolMap.get(key) || [];
    list.push(token);
    symbolMap.set(key, list);
  }

  const resolved: string[] = [];
  for (const symbol of symbols) {
    const key = symbol.toLowerCase();
    const matches = symbolMap.get(key) || [];
    if (matches.length === 0) {
      logger.warn(`Token symbol not found in list: ${symbol}`);
      continue;
    }
    resolved.push(matches[0].address);
  }

  return [...new Set([...explicitMints, ...resolved])];
}
