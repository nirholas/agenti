export interface TradingIdea {
  instrument: string
  direction: 'long' | 'short' | 'neutral'
  confidence: number
  timeframe: 'short' | 'medium' | 'long'
  thesis: string
  suggestedMarkets: Market[]
}

export interface Market {
  name: string
  type: 'spot' | 'perp' | 'prediction' | 'dex'
  chain?: string
  url?: string
}

export interface TradeRecord {
  id: string
  instrument: string
  direction: 'long' | 'short'
  market: string
  entryPrice: number
  currentPrice?: number
  pnlPercent?: number
  createdAt: number
  thesis: string
  author?: string
}

// ---------------------------------------------------------------------------
// Instrument → CoinGecko ID mapping (best-effort)
// ---------------------------------------------------------------------------

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  AVAX: 'avalanche-2', MATIC: 'matic-network', LINK: 'chainlink',
  UNI: 'uniswap', DOGE: 'dogecoin', SHIB: 'shiba-inu',
  ARB: 'arbitrum', OP: 'optimism', SUI: 'sui', APT: 'aptos',
  INJ: 'injective-protocol', TIA: 'celestia', SEI: 'sei-network',
  WIF: 'dogwifcoin', BONK: 'bonk', PEPE: 'pepe',
  JTO: 'jito-governance-token', JUP: 'jupiter-exchange-solana',
}

function toGeckoId(instrument: string): string {
  return COINGECKO_IDS[instrument.toUpperCase()] ?? instrument.toLowerCase()
}

// ---------------------------------------------------------------------------
// Keyword-based fallback extraction
// ---------------------------------------------------------------------------

const BULLISH_WORDS = /\b(bullish|long|buy|buying|accumulate|breakout|moon|pump|upside|rally|bounce|support)\b/i
const BEARISH_WORDS = /\b(bearish|short|sell|selling|dump|downside|breakdown|crash|drop|resistance)\b/i
const TICKER_RE = /\b([A-Z]{2,6})(?:\/USD[TC]?)?\b/g

const KNOWN_TICKERS = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'AVAX', 'MATIC', 'LINK', 'UNI', 'DOGE', 'SHIB',
  'ARB', 'OP', 'SUI', 'APT', 'INJ', 'TIA', 'SEI', 'WIF', 'BONK', 'PEPE',
  'JTO', 'JUP', 'NEAR', 'FTM', 'ATOM', 'DOT', 'ADA', 'XRP', 'LTC', 'BCH',
])

// Words that look like tickers but aren't
const FALSE_POSITIVES = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER',
  'WAS', 'ONE', 'OUR', 'OUT', 'WHO', 'GET', 'HAS', 'HIM', 'HIS', 'HOW',
  'ITS', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'ASK', 'DID', 'PUT',
  'SAY', 'SHE', 'USE', 'NEW', 'USD', 'USA', 'NFT', 'APY', 'APR', 'TVL',
  'AUM', 'ATH', 'ATL', 'ETF', 'SEC', 'IMO', 'TBH', 'IMO', 'FAQ', 'KYC',
  'AML', 'CEX', 'DEX', 'DCA', 'PNL', 'ROI', 'P&L',
])

function keywordExtract(text: string): TradingIdea[] {
  const ideas: TradingIdea[] = []
  const seen = new Set<string>()

  const matches = [...text.matchAll(TICKER_RE)]
  for (const m of matches) {
    const instrument = m[1]!
    if (FALSE_POSITIVES.has(instrument)) continue
    if (!KNOWN_TICKERS.has(instrument)) continue
    if (seen.has(instrument)) continue
    seen.add(instrument)

    const isBullish = BULLISH_WORDS.test(text)
    const isBearish = BEARISH_WORDS.test(text)
    const direction = isBullish && !isBearish ? 'long'
      : isBearish && !isBullish ? 'short'
      : 'neutral'

    ideas.push({
      instrument,
      direction,
      confidence: direction === 'neutral' ? 0.3 : 0.5,
      timeframe: 'medium',
      thesis: text.slice(0, 200),
      suggestedMarkets: [],
    })
  }

  return ideas
}

// ---------------------------------------------------------------------------
// Claude 3-pass extraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a crypto trade thesis extractor. Analyze text and extract ALL tradeable ideas.

For each idea found respond with JSON only — no markdown, no explanation:
{
  "ideas": [
    {
      "instrument": "BTC",
      "direction": "long",
      "confidence": 0.85,
      "timeframe": "short",
      "thesis": "author's core reasoning in one sentence"
    }
  ]
}

Rules:
- direction must be "long", "short", or "neutral"
- confidence is 0.0–1.0 (explicit buy/sell call = 0.8+, vague mention = 0.2–0.4)
- timeframe: "short" (days), "medium" (weeks), "long" (months)
- instrument must be a ticker symbol like BTC, ETH, SOL — uppercase, no $
- Only include ideas with identifiable ticker symbols
- Return empty ideas array if no tradeable ideas found`

interface ClaudeIdea {
  instrument?: string
  direction?: string
  confidence?: number
  timeframe?: string
  thesis?: string
}

async function claudeExtract(text: string): Promise<TradingIdea[] | null> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Analyze for trading ideas:\n\n${text.slice(0, 4000)}` }],
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) return null

    const data = await res.json() as { content?: Array<{ text: string }> }
    const raw = data.content?.[0]?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null

    const parsed = JSON.parse(match[0]) as { ideas?: ClaudeIdea[] }
    const rawIdeas: ClaudeIdea[] = parsed.ideas ?? []

    return rawIdeas
      .filter((i): i is ClaudeIdea & { instrument: string } => !!i.instrument)
      .map((i) => {
        const dir = i.direction === 'short' ? 'short' : i.direction === 'neutral' ? 'neutral' : 'long'
        const tf = i.timeframe === 'short' ? 'short' : i.timeframe === 'long' ? 'long' : 'medium'
        return {
          instrument: i.instrument.toUpperCase().replace(/^\$/, ''),
          direction: dir as TradingIdea['direction'],
          confidence: Math.min(1, Math.max(0, Number(i.confidence) || 0.5)),
          timeframe: tf,
          thesis: i.thesis ?? '',
          suggestedMarkets: [],
        }
      })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 3-pass thesis extraction from unstructured text.
 * Pass 1: Extract trading beliefs (bullish/bearish signals).
 * Pass 2: Convert beliefs to specific instrument ideas.
 * Pass 3: Score confidence and suggest markets.
 *
 * Uses Claude API if ANTHROPIC_API_KEY is set, otherwise simple keyword extraction.
 */
export async function extractTradingIdeas(text: string): Promise<TradingIdea[]> {
  const ideas = (await claudeExtract(text)) ?? keywordExtract(text)

  return ideas.map((idea) => ({
    ...idea,
    suggestedMarkets: routeIdea(idea, { hasEvm: true, hasSolana: true, hasBinance: false }),
  }))
}

/**
 * Route a trading idea to the best available market given the agent's
 * available chains and wallets.
 */
export function routeIdea(
  idea: TradingIdea,
  available: { hasEvm?: boolean; hasSolana?: boolean; hasBinance?: boolean },
): Market[] {
  const { instrument, direction } = idea
  const markets: Market[] = []

  const isCryptoPerp = KNOWN_TICKERS.has(instrument)
  const isSolanaToken = ['SOL', 'WIF', 'BONK', 'PEPE', 'JTO', 'JUP'].includes(instrument)

  // Hyperliquid perps — best for directional crypto bets (EVM wallet needed)
  if (available.hasEvm && isCryptoPerp && direction !== 'neutral') {
    markets.push({
      name: `Hyperliquid ${instrument}-PERP`,
      type: 'perp',
      chain: 'arbitrum',
      url: `https://app.hyperliquid.xyz/trade/${instrument}`,
    })
  }

  // Jupiter/pump.fun — Solana spot and meme tokens
  if (available.hasSolana && isSolanaToken) {
    markets.push({
      name: `Jupiter ${instrument}/SOL`,
      type: 'dex',
      chain: 'solana',
      url: `https://jup.ag/swap/SOL-${instrument}`,
    })
  }

  // Binance spot — liquid, supports most major assets
  if (available.hasBinance && isCryptoPerp) {
    markets.push({
      name: `Binance ${instrument}USDT`,
      type: 'spot',
      url: `https://www.binance.com/en/trade/${instrument}_USDT`,
    })
  }

  // Polymarket — for neutral or prediction-style ideas
  if (direction === 'neutral' || !isCryptoPerp) {
    markets.push({
      name: 'Polymarket',
      type: 'prediction',
      chain: 'polygon',
      url: 'https://polymarket.com',
    })
  }

  // EVM dex fallback — Uniswap on Base
  if (available.hasEvm && isCryptoPerp && markets.length === 0) {
    markets.push({
      name: `Uniswap ${instrument}/USDC`,
      type: 'dex',
      chain: 'base',
      url: `https://app.uniswap.org/swap?outputCurrency=${instrument}`,
    })
  }

  return markets
}

/**
 * Calculate P&L for a trade record.
 * Fetches current price from CoinGecko free API.
 */
export async function calculatePnl(trade: TradeRecord): Promise<{
  pnlPercent: number
  pnlUsd: number
  currentPrice: number
}> {
  const geckoId = toGeckoId(trade.instrument)
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(geckoId)}&vs_currencies=usd`,
    { signal: AbortSignal.timeout(8_000) },
  )

  if (!res.ok) throw new Error(`CoinGecko ${res.status}: price fetch failed for ${trade.instrument}`)

  const data = await res.json() as Record<string, { usd?: number }>
  const currentPrice = data[geckoId]?.usd
  if (currentPrice == null) throw new Error(`No price data for ${trade.instrument} (id: ${geckoId})`)

  const priceDiff = currentPrice - trade.entryPrice
  const directionMultiplier = trade.direction === 'short' ? -1 : 1
  const pnlPercent = (priceDiff / trade.entryPrice) * 100 * directionMultiplier
  const pnlUsd = priceDiff * directionMultiplier

  return { pnlPercent, pnlUsd, currentPrice }
}
