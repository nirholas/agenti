/**
 * AgentBets Feed
 * Prediction markets for AI agents on Solana devnet
 * 
 * Built for the Colosseum Agent Hackathon
 * https://github.com/nox-oss/agentbets
 */

import { EventEmitter } from 'events';
import { Market, Outcome, Platform } from '../../types';
import { logger } from '../../utils/logger';

const API_URL = 'https://agentbets-api-production.up.railway.app';

interface AgentBetsMarket {
  id: string;
  question: string;
  description?: string;
  outcomes: Array<{
    name: string;
    shares: number;
  }>;
  totalPool: number;
  status: 'open' | 'resolved' | 'disputed';
  resolutionTime: string;
  winningOutcome?: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentBetsResponse {
  markets: AgentBetsMarket[];
  count: number;
}

export interface AgentBetsFeed extends EventEmitter {
  connect: () => Promise<void>;
  disconnect: () => void;
  searchMarkets: (query?: string) => Promise<Market[]>;
  getMarket: (id: string) => Promise<Market | null>;
  getOpportunities: () => Promise<Record<string, unknown>[]>;
}

export async function createAgentBetsFeed(): Promise<AgentBetsFeed> {
  const emitter = new EventEmitter();
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  const POLL_INTERVAL_MS = 30000; // 30 seconds

  function convertToMarket(m: AgentBetsMarket): Market {
    const totalShares = m.outcomes.reduce((sum, o) => sum + o.shares, 0) || 1;
    
    const outcomes: Outcome[] = m.outcomes.map((o, idx) => ({
      id: `${m.id}-${idx}`,
      name: o.name,
      price: totalShares > 0 ? o.shares / totalShares : 0.5,
      volume24h: 0, // Not tracked yet
    }));

    return {
      id: m.id,
      platform: 'agentbets' as Platform,
      slug: m.id,
      question: m.question,
      description: m.description,
      outcomes,
      volume24h: m.totalPool,
      liquidity: m.totalPool,
      endDate: new Date(m.resolutionTime),
      resolved: m.status === 'resolved',
      resolutionValue: m.winningOutcome ? 
        (m.outcomes.findIndex(o => o.name === m.winningOutcome) === 0 ? 1 : 0) : 
        undefined,
      tags: ['agent-hackathon', 'solana'],
      url: `https://github.com/nox-oss/agentbets#${m.id}`,
      createdAt: new Date(m.createdAt),
      updatedAt: new Date(m.updatedAt),
    };
  }

  async function fetchMarkets(): Promise<Market[]> {
    try {
      const response = await fetch(`${API_URL}/markets`);
      
      if (!response.ok) {
        throw new Error(`AgentBets API error: ${response.status}`);
      }

      const data = await response.json() as AgentBetsResponse;
      return data.markets.map(convertToMarket);
    } catch (error) {
      logger.error('AgentBets: Fetch error', error);
      return [];
    }
  }

  async function searchMarkets(query?: string): Promise<Market[]> {
    const markets = await fetchMarkets();
    
    if (!query) return markets;
    
    const lowerQuery = query.toLowerCase();
    return markets.filter(m => 
      m.question.toLowerCase().includes(lowerQuery) ||
      m.description?.toLowerCase().includes(lowerQuery)
    );
  }

  async function getMarket(id: string): Promise<Market | null> {
    try {
      const response = await fetch(`${API_URL}/markets/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`AgentBets API error: ${response.status}`);
      }

      const data = await response.json();
      return convertToMarket(data.market);
    } catch (error) {
      logger.error(`AgentBets: Error fetching market ${id}`, error);
      return null;
    }
  }

  async function getOpportunities(): Promise<Record<string, unknown>[]> {
    try {
      const response = await fetch(`${API_URL}/opportunities`);
      
      if (!response.ok) {
        throw new Error(`AgentBets API error: ${response.status}`);
      }

      const data = await response.json();
      return data.opportunities || [];
    } catch (error) {
      logger.error('AgentBets: Opportunities fetch error', error);
      return [];
    }
  }

  function startPolling(): void {
    if (pollInterval) return;
    
    pollInterval = setInterval(async () => {
      try {
        const markets = await fetchMarkets();
        emitter.emit('markets', markets);
      } catch (error) {
        logger.error('AgentBets: Polling error', error);
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return Object.assign(emitter, {
    async connect(): Promise<void> {
      logger.info('AgentBets: Connecting...');
      
      // Fetch initial markets
      const markets = await fetchMarkets();
      logger.info(`AgentBets: Loaded ${markets.length} markets`);
      emitter.emit('connected');
      emitter.emit('markets', markets);
      
      // Start polling
      startPolling();
    },

    disconnect(): void {
      stopPolling();
      emitter.emit('disconnected');
    },

    searchMarkets,
    getMarket,
    getOpportunities,
  }) as AgentBetsFeed;
}
