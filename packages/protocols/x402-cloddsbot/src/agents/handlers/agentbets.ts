/**
 * AgentBets Handlers
 *
 * Platform handlers for AgentBets — AI-native prediction markets on Solana.
 * Built for the Colosseum Agent Hackathon.
 */

import type { ToolInput, HandlerResult, HandlersMap } from './types';
import { safeHandler } from './types';

const API_URL = 'https://agentbets-api-production.up.railway.app';

/**
 * agentbets_markets - List/search markets
 */
async function marketsHandler(toolInput: ToolInput): Promise<HandlerResult> {
  const query = (toolInput.query as string) || '';
  const limit = (toolInput.limit as number) ?? 20;

  return safeHandler(async () => {
    const response = await fetch(`${API_URL}/markets`);
    if (!response.ok) throw new Error(`AgentBets API error: ${response.status}`);
    const data = await response.json() as { markets: Record<string, unknown>[]; count: number };
    let markets = data.markets || [];

    if (query) {
      const q = query.toLowerCase();
      markets = markets.filter((m: any) =>
        m.question?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
      );
    }

    return markets.slice(0, limit);
  });
}

/**
 * agentbets_market - Get single market
 */
async function marketHandler(toolInput: ToolInput): Promise<HandlerResult> {
  const marketId = toolInput.market_id as string;
  if (!marketId) return JSON.stringify({ success: false, error: 'market_id is required' });

  return safeHandler(async () => {
    const response = await fetch(`${API_URL}/markets/${marketId}`);
    if (!response.ok) throw new Error(`AgentBets API error: ${response.status}`);
    return (await response.json() as { market: any }).market;
  });
}

/**
 * agentbets_opportunities - Find +EV edges
 */
async function opportunitiesHandler(_toolInput: ToolInput): Promise<HandlerResult> {
  return safeHandler(async () => {
    const response = await fetch(`${API_URL}/opportunities`);
    if (!response.ok) throw new Error(`AgentBets API error: ${response.status}`);
    const data = await response.json() as { opportunities?: Record<string, unknown>[] };
    return data.opportunities || [];
  });
}

export const agentbetsHandlers: HandlersMap = {
  agentbets_markets: marketsHandler,
  agentbets_market: marketHandler,
  agentbets_opportunities: opportunitiesHandler,
};
