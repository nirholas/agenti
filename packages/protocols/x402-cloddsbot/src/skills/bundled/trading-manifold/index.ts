/**
 * Trading Manifold CLI Skill
 *
 * Wired to:
 *   - src/feeds/manifold (createManifoldFeed - market search, data, WebSocket)
 *   - Manifold REST API v0 (bet placement, positions, balance)
 *
 * Commands:
 * /manifold search <query>                  - Search markets
 * /manifold market <id|slug>                - Market details
 * /manifold bet <market-id> <YES|NO> <amt>  - Place bet (mana)
 * /manifold positions                       - View positions
 * /manifold balance                         - Mana balance
 * /manifold trending                        - Trending markets
 */

import type { ManifoldFeed } from '../../../feeds/manifold';
import { logger } from '../../../utils/logger';

const MANIFOLD_API = 'https://api.manifold.markets/v0';

// =============================================================================
// HELPERS
// =============================================================================

function formatNumber(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
  return n.toFixed(decimals);
}

let feedInstance: ManifoldFeed | null = null;

async function getFeed(): Promise<ManifoldFeed> {
  if (!feedInstance) {
    const { createManifoldFeed } = await import('../../../feeds/manifold');
    feedInstance = await createManifoldFeed();
  }
  return feedInstance;
}

function getApiKey(): string | null {
  return process.env.MANIFOLD_API_KEY || null;
}

function authHeaders(): Record<string, string> {
  const key = getApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) {
    headers['Authorization'] = `Key ${key}`;
  }
  return headers;
}

// =============================================================================
// HELP TEXT
// =============================================================================

function helpText(): string {
  return [
    '**Manifold Trading Commands**',
    '',
    '**Market Data:**',
    '  /manifold search <query>                  - Search markets',
    '  /manifold market <id|slug>                - Market details',
    '  /manifold trending                        - Trending markets',
    '',
    '**Trading:**',
    '  /manifold bet <market-id> <YES|NO> <amt>  - Place bet (mana)',
    '  /manifold positions                       - Your positions',
    '  /manifold balance                         - Mana balance',
    '',
    '**Env vars:** MANIFOLD_API_KEY (required for trading/positions)',
    '',
    '**Examples:**',
    '  /manifold search bitcoin',
    '  /manifold bet abc123 YES 100',
    '  /manifold market will-trump-win-2024',
  ].join('\n');
}

// =============================================================================
// MARKET DATA HANDLERS
// =============================================================================

async function handleSearch(query: string): Promise<string> {
  if (!query) return 'Usage: /manifold search <query>';

  try {
    const feed = await getFeed();
    const markets = await feed.searchMarkets(query);

    if (markets.length === 0) {
      return `No Manifold markets found for "${query}"`;
    }

    const lines = ['**Manifold Markets**', ''];

    for (const m of markets.slice(0, 15)) {
      const yesPrice = m.outcomes.find(o => o.name === 'Yes' || o.name === 'Higher')?.price ?? m.outcomes[0]?.price ?? 0;
      lines.push(`  [${m.id}] ${m.question}`);
      lines.push(`       ${(yesPrice * 100).toFixed(0)}% | Vol: M$${formatNumber(m.volume24h)} | Liq: M$${formatNumber(m.liquidity)}`);
    }

    if (markets.length > 15) {
      lines.push('', `...and ${markets.length - 15} more`);
    }

    return lines.join('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error searching: ${message}`;
  }
}

async function handleMarket(idOrSlug: string): Promise<string> {
  if (!idOrSlug) return 'Usage: /manifold market <id-or-slug>';

  try {
    const feed = await getFeed();
    const market = await feed.getMarket(idOrSlug);

    if (!market) {
      return `Market "${idOrSlug}" not found`;
    }

    const lines = [
      `**${market.question}**`,
      '',
      `ID: ${market.id}`,
      `Slug: ${market.slug}`,
      `Platform: Manifold Markets`,
      market.description ? `Description: ${typeof market.description === 'string' ? market.description.slice(0, 200) : ''}` : '',
      '',
      '**Outcomes:**',
    ];

    for (const o of market.outcomes) {
      lines.push(`  ${o.name}: ${(o.price * 100).toFixed(1)}%`);
    }

    lines.push(
      '',
      `Volume 24h: M$${formatNumber(market.volume24h)}`,
      `Liquidity: M$${formatNumber(market.liquidity)}`,
      market.endDate ? `Closes: ${market.endDate.toLocaleDateString()}` : '',
      `Resolved: ${market.resolved ? 'Yes' : 'No'}`,
      market.resolutionValue !== undefined ? `Resolution: ${(market.resolutionValue * 100).toFixed(0)}%` : '',
      '',
      `URL: ${market.url}`,
    );

    return lines.filter(l => l !== '').join('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

async function handleTrending(): Promise<string> {
  try {
    // Use the Manifold API to get trending (sorted by activity)
    const response = await fetch(`${MANIFOLD_API}/search-markets?limit=15&filter=open&sort=score`);
    if (!response.ok) {
      return `Failed to fetch trending: HTTP ${response.status}`;
    }

    const markets = await response.json() as Array<{
      id: string;
      question: string;
      probability?: number;
      volume24Hours: number;
      totalLiquidity: number;
    }>;

    if (markets.length === 0) {
      return 'No trending markets found';
    }

    const lines = ['**Trending Manifold Markets**', ''];

    for (const m of markets) {
      const prob = m.probability !== undefined ? `${(m.probability * 100).toFixed(0)}%` : '?';
      lines.push(`  [${m.id}] ${m.question}`);
      lines.push(`       ${prob} | Vol: M$${formatNumber(m.volume24Hours)} | Liq: M$${formatNumber(m.totalLiquidity)}`);
    }

    return lines.join('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

// =============================================================================
// TRADING HANDLERS
// =============================================================================

async function handleBet(marketId: string, outcome: string, amountStr: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return 'Set MANIFOLD_API_KEY to place bets on Manifold.';
  }

  if (!marketId || !outcome || !amountStr) {
    return 'Usage: /manifold bet <market-id> <YES|NO> <amount>\nExample: /manifold bet abc123 YES 100';
  }

  const normalizedOutcome = outcome.toUpperCase();
  if (normalizedOutcome !== 'YES' && normalizedOutcome !== 'NO') {
    return 'Outcome must be YES or NO.';
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return 'Amount must be a positive number (mana).';
  }

  try {
    const response = await fetch(`${MANIFOLD_API}/bet`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        contractId: marketId,
        outcome: normalizedOutcome,
        amount,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `Bet failed: HTTP ${response.status} - ${errorText}`;
    }

    const data = await response.json() as {
      betId?: string;
      amount?: number;
      probBefore?: number;
      probAfter?: number;
      shares?: number;
    };

    const lines = [
      '**Bet Placed**',
      `Market: ${marketId}`,
      `${normalizedOutcome} M$${amount}`,
    ];

    if (data.betId) lines.push(`Bet ID: ${data.betId}`);
    if (data.shares) lines.push(`Shares: ${formatNumber(data.shares)}`);
    if (data.probBefore !== undefined && data.probAfter !== undefined) {
      lines.push(`Probability: ${(data.probBefore * 100).toFixed(1)}% -> ${(data.probAfter * 100).toFixed(1)}%`);
    }

    return lines.join('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error placing bet: ${message}`;
  }
}

async function handlePositions(): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return 'Set MANIFOLD_API_KEY to view positions.';
  }

  try {
    // First get user ID from /me
    const meRes = await fetch(`${MANIFOLD_API}/me`, { headers: authHeaders() });
    if (!meRes.ok) {
      return `Failed to fetch profile: HTTP ${meRes.status}`;
    }

    const me = await meRes.json() as { id?: string; username?: string; balance?: number };
    if (!me.id) {
      return 'Could not identify user from API key.';
    }

    // Then get recent bets for this user
    const betsRes = await fetch(`${MANIFOLD_API}/bets?userId=${me.id}&limit=50`, {
      headers: authHeaders(),
    });

    if (!betsRes.ok) {
      return `Failed to fetch bets: HTTP ${betsRes.status}`;
    }

    const bets = await betsRes.json() as Array<{
      id: string;
      contractId: string;
      outcome: string;
      amount: number;
      shares: number;
      probBefore: number;
      probAfter: number;
      createdTime: number;
      isFilled?: boolean;
      isCancelled?: boolean;
    }>;

    if (bets.length === 0) {
      return 'No recent bets/positions found.';
    }

    // Group bets by contract to show net position
    const contractBets = new Map<string, { outcome: string; totalShares: number; totalAmount: number; count: number }>();

    for (const bet of bets) {
      if (bet.isCancelled) continue;
      const existing = contractBets.get(bet.contractId);
      if (existing) {
        existing.totalShares += bet.shares;
        existing.totalAmount += bet.amount;
        existing.count++;
      } else {
        contractBets.set(bet.contractId, {
          outcome: bet.outcome,
          totalShares: bet.shares,
          totalAmount: bet.amount,
          count: 1,
        });
      }
    }

    const lines = [`**Manifold Positions** (${me.username})`, ''];

    for (const [contractId, pos] of contractBets) {
      if (Math.abs(pos.totalShares) < 0.01) continue; // Skip near-zero positions
      lines.push(`  [${contractId}]`);
      lines.push(`    ${pos.outcome}: ${formatNumber(pos.totalShares)} shares | Cost: M$${formatNumber(pos.totalAmount)} (${pos.count} bet(s))`);
    }

    if (lines.length <= 2) {
      return 'No active positions found.';
    }

    return lines.join('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

async function handleBalance(): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return 'Set MANIFOLD_API_KEY to check balance.';
  }

  try {
    const response = await fetch(`${MANIFOLD_API}/me`, { headers: authHeaders() });

    if (!response.ok) {
      return `Failed to fetch balance: HTTP ${response.status}`;
    }

    const data = await response.json() as {
      balance?: number;
      totalDeposits?: number;
      username?: string;
      name?: string;
      profitCached?: { allTime?: number; monthly?: number; weekly?: number; daily?: number };
    };

    const lines = [
      `**Manifold Balance** (${data.name || data.username || 'unknown'})`,
      '',
      `Mana: M$${formatNumber(data.balance ?? 0)}`,
    ];

    if (data.totalDeposits !== undefined) {
      lines.push(`Total Deposits: M$${formatNumber(data.totalDeposits)}`);
    }

    if (data.profitCached) {
      lines.push('');
      lines.push('**Profit:**');
      if (data.profitCached.daily !== undefined) lines.push(`  Today: M$${formatNumber(data.profitCached.daily)}`);
      if (data.profitCached.weekly !== undefined) lines.push(`  Week: M$${formatNumber(data.profitCached.weekly)}`);
      if (data.profitCached.monthly !== undefined) lines.push(`  Month: M$${formatNumber(data.profitCached.monthly)}`);
      if (data.profitCached.allTime !== undefined) lines.push(`  All Time: M$${formatNumber(data.profitCached.allTime)}`);
    }

    return lines.join('\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error: ${message}`;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  try {
    switch (cmd) {
      case 'search':
      case 's':
        return handleSearch(parts.slice(1).join(' '));

      case 'market':
      case 'm':
        return handleMarket(parts.slice(1).join(' '));

      case 'bet':
      case 'buy':
      case 'b':
        return handleBet(parts[1], parts[2], parts[3]);

      case 'positions':
      case 'pos':
      case 'portfolio':
      case 'p':
        return handlePositions();

      case 'balance':
      case 'bal':
        return handleBalance();

      case 'trending':
      case 't':
        return handleTrending();

      case 'help':
      default:
        return helpText();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message, args }, 'Manifold command failed');
    return `Error: ${message}`;
  }
}

export default {
  name: 'trading-manifold',
  description: 'Manifold Markets trading - search, bet, and track positions',
  commands: ['/manifold', '/trading-manifold'],
  handle: execute,
};
