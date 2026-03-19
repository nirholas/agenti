/**
 * Metaculus Feed
 * Forecasting platform API integration
 */

import { EventEmitter } from 'events';
import { Market, Platform } from '../../types';
import { logger } from '../../utils/logger';

const API_URL = 'https://www.metaculus.com/api2';

interface MetaculusQuestion {
  id: number;
  title: string;
  description: string;
  created_time: string;
  publish_time: string;
  close_time: string;
  resolve_time: string | null;
  resolution: number | null;
  community_prediction: {
    full: { q2: number } | null;
    recent: { q2: number } | null;
  } | null;
  number_of_predictions: number;
  url: string;
  page_url: string;
  status: string;
  type: string;
  possibilities: {
    type: string;
  };
}

interface PaginatedResponse<T> {
  results: T[];
  next?: string | null;
}

export interface MetaculusFeed extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): void;
  searchMarkets(query: string): Promise<Market[]>;
  getMarket(id: string): Promise<Market | null>;
  getTournaments(): Promise<Array<{ id: number; name: string; questionCount: number }>>;
  getTournamentQuestions(
    tournamentId: number,
    options?: { maxResults?: number; status?: string }
  ): Promise<Market[]>;
}

export async function createMetaculusFeed(): Promise<MetaculusFeed> {
  const emitter = new EventEmitter() as MetaculusFeed;
  let pollInterval: NodeJS.Timeout | null = null;

  function convertToMarket(q: MetaculusQuestion): Market {
    const probability = q.community_prediction?.full?.q2 ??
                       q.community_prediction?.recent?.q2 ??
                       0.5;

    return {
      id: q.id.toString(),
      platform: 'metaculus' as Platform,
      slug: q.id.toString(),
      question: q.title,
      description: q.description,
      outcomes: [
        {
          id: `${q.id}-yes`,
          name: 'Yes',
          price: probability,
          volume24h: 0,
        },
        {
          id: `${q.id}-no`,
          name: 'No',
          price: 1 - probability,
          volume24h: 0,
        },
      ],
      volume24h: q.number_of_predictions,
      liquidity: q.number_of_predictions,
      endDate: q.close_time ? new Date(q.close_time) : undefined,
      resolved: q.resolution !== null,
      resolutionValue: q.resolution !== null ? q.resolution : undefined,
      tags: [],
      url: q.page_url || `https://www.metaculus.com/questions/${q.id}/`,
      createdAt: new Date(q.created_time),
      updatedAt: new Date(),
    };
  }

  async function fetchPaginated<T>(
    url: string,
    params: Record<string, string>,
    maxResults: number
  ): Promise<T[]> {
    try {
      const results: T[] = [];
      let nextUrl: string | null = `${url}?${new URLSearchParams(params).toString()}`;

      while (nextUrl && results.length < maxResults) {
        const response = await fetch(nextUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Metaculus API error: ${response.status}`);
        }

        const data = await response.json() as PaginatedResponse<T>;
        if (Array.isArray(data.results)) {
          results.push(...data.results);
        }

        if (!data.next) break;
        nextUrl = data.next;
      }

      return results.slice(0, maxResults);
    } catch (error) {
      logger.error('Metaculus fetch error:', error);
      return [];
    }
  }

  async function fetchQuestions(
    params: Record<string, string>,
    maxResults = Number(params.limit ?? 20)
  ): Promise<MetaculusQuestion[]> {
    const safeMax = Number.isFinite(maxResults) && maxResults > 0 ? maxResults : 20;
    const limit = Math.min(Number(params.limit ?? safeMax), 100);
    return fetchPaginated<MetaculusQuestion>(
      `${API_URL}/questions/`,
      { ...params, limit: limit.toString() },
      safeMax
    );
  }

  emitter.connect = async () => {
    logger.info('Metaculus feed connected (polling mode)');
    // Metaculus doesn't have WebSocket, so we just poll periodically for updates
    // For now, just mark as connected
  };

  emitter.disconnect = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    logger.info('Metaculus feed disconnected');
  };

  emitter.searchMarkets = async (query: string): Promise<Market[]> => {
    const questions = await fetchQuestions({
      search: query,
      status: 'open',
      type: 'forecast',
      limit: '20',
      order_by: '-activity',
    });

    return questions.map(convertToMarket);
  };

  emitter.getMarket = async (id: string): Promise<Market | null> => {
    try {
      const response = await fetch(`${API_URL}/questions/${id}/`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Metaculus API error: ${response.status}`);
      }

      const question = await response.json() as MetaculusQuestion;
      return convertToMarket(question);
    } catch (error) {
      logger.error(`Error fetching Metaculus question ${id}:`, error);
      return null;
    }
  };

  emitter.getTournaments = async () => {
    try {
      const tournaments = await fetchPaginated<{ id: number; name: string; questions_count: number }>(
        `${API_URL}/tournaments/`,
        { limit: '50' },
        200
      );
      return tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        questionCount: t.questions_count,
      }));
    } catch (error) {
      logger.error('Error fetching Metaculus tournaments:', error);
      return [];
    }
  };

  emitter.getTournamentQuestions = async (tournamentId, options) => {
    const status = options?.status ?? 'open';
    const maxResults = options?.maxResults ?? 200;
    const questions = await fetchQuestions({
      contest: tournamentId.toString(),
      status,
      type: 'forecast',
      limit: '50',
    }, maxResults);

    return questions.map(convertToMarket);
  };

  return emitter;
}
