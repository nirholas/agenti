/**
 * External Data Sources for Edge Detection
 * Fetches probabilities from models, polls, and betting odds
 */

import { logger } from '../../utils/logger';

export interface ExternalSource {
  name: string;
  type: 'model' | 'poll' | 'betting' | 'official';
  probability: number;
  lastUpdated: Date;
  url?: string;
}

export interface EdgeAnalysis {
  marketId: string;
  marketQuestion: string;
  marketPrice: number;
  sources: ExternalSource[];
  fairValue: number;
  edge: number;
  edgePct: number;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * CME FedWatch Tool - Fed rate probabilities
 * Scrapes from CME website
 */
export async function getFedWatchProbabilities(): Promise<Map<string, number>> {
  const probs = new Map<string, number>();

  try {
    const baseUrl = process.env.CME_FEDWATCH_BASE_URL || 'https://markets.api.cmegroup.com/fedwatch/v1';
    const accessToken = process.env.CME_FEDWATCH_ACCESS_TOKEN || '';

    if (!accessToken) {
      logger.warn('FedWatch access token missing (CME_FEDWATCH_ACCESS_TOKEN).');
      return probs;
    }

    const response = await fetch(`${baseUrl}/forecasts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`FedWatch API error: ${response.status}`);
    }

    const data = await response.json();
    const meetings = extractFedWatchMeetings(data);
    for (const meeting of meetings) {
      if (meeting.label) {
        if (meeting.mostLikelyProbability !== null) {
          probs.set(meeting.label, meeting.mostLikelyProbability);
        }
        for (const outcome of meeting.outcomes) {
          if (outcome.label) {
            probs.set(`${meeting.label} ${outcome.label}`, outcome.probability);
          }
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to fetch FedWatch data:', error);
  }

  return probs;
}

type FedWatchOutcome = { label: string; probability: number };
type FedWatchMeeting = { label: string; outcomes: FedWatchOutcome[]; mostLikelyProbability: number | null };

function extractFedWatchMeetings(payload: unknown): FedWatchMeeting[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as Record<string, unknown>;

  const candidates: unknown[] = Array.isArray(data)
    ? (data as unknown[])
    : (data.data as unknown[]) ||
      (data.forecasts as unknown[]) ||
      (data.meetings as unknown[]) ||
      [];

  if (!Array.isArray(candidates)) return [];

  const meetings: FedWatchMeeting[] = [];
  for (const entry of candidates) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const label =
      (e.meetingDate as string | undefined) ||
      (e.meeting as string | undefined) ||
      (e.label as string | undefined) ||
      (e.name as string | undefined) ||
      '';

    const outcomesRaw = (e.outcomes as unknown[]) ||
      (e.probabilities as unknown[]) ||
      (e.ranges as unknown[]) ||
      (e.targetRateRanges as unknown[]) ||
      [];

    const outcomes: FedWatchOutcome[] = [];
    if (Array.isArray(outcomesRaw)) {
      for (const outcomeEntry of outcomesRaw) {
        if (!outcomeEntry || typeof outcomeEntry !== 'object') continue;
        const o = outcomeEntry as Record<string, unknown>;
        const outcomeLabel =
          (o.range as string | undefined) ||
          (o.targetRateRange as string | undefined) ||
          (o.label as string | undefined) ||
          (o.name as string | undefined) ||
          '';
        const probabilityValue = normalizeProbability(o.probability ?? o.prob ?? o.value ?? o.percent ?? null);
        if (!outcomeLabel || probabilityValue === null) continue;
        outcomes.push({ label: outcomeLabel, probability: probabilityValue });
      }
    }

    const mostLikely = outcomes.length
      ? Math.max(...outcomes.map(o => o.probability))
      : normalizeProbability(e.probability ?? e.prob ?? e.value ?? e.percent ?? null);

    if (!label || (outcomes.length === 0 && mostLikely === null)) continue;

    meetings.push({
      label,
      outcomes,
      mostLikelyProbability: mostLikely,
    });
  }

  return meetings;
}

function normalizeProbability(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return value > 1 ? value / 100 : value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace('%', ''));
    if (!Number.isFinite(parsed)) return null;
    return parsed > 1 ? parsed / 100 : parsed;
  }
  return null;
}

/**
 * RealClearPolitics polling averages
 */
export async function getRCPPollingAverage(race: string): Promise<ExternalSource | null> {
  try {
    const response = await fetch('https://www.realclearpolitics.com/polls/', {
      headers: {
        'User-Agent': 'Clodds/1.0 Polling Aggregator',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`RCP fetch error: ${response.status}`);
    }

    const html = await response.text();
    const lines = htmlToLines(html);

    const section = findBestRcpSection(lines, race);
    const startIndex = section?.index ?? 0;
    const parsed = parseRcpAverage(lines, startIndex);

    if (!parsed) {
      return null;
    }

    return {
      name: `RealClearPolitics${section?.title ? ` (${section.title})` : ''}`,
      type: 'poll',
      probability: parsed.probability,
      lastUpdated: new Date(),
      url: 'https://www.realclearpolitics.com/polls/',
    };
  } catch (error) {
    logger.warn('Failed to fetch RCP data:', error);
    return null;
  }
}

function htmlToLines(html: string): string[] {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n');

  const text = withBreaks
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n');

  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function findBestRcpSection(lines: string[], query: string): { index: number; title: string } | null {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return null;

  let best: { index: number; title: string; score: number } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length < 5 || line.length > 120) continue;
    if (line.toLowerCase().includes('rcp average')) continue;
    if (line.toLowerCase().includes('poll date')) continue;

    const tokens = tokenize(line);
    if (tokens.length === 0) continue;

    let score = 0;
    for (const token of tokens) {
      if (queryTokens.has(token)) score += 1;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { index: i, title: line, score };
    }
  }

  return best ? { index: best.index, title: best.title } : null;
}

function parseRcpAverage(lines: string[], startIndex: number): { probability: number } | null {
  const maxLookahead = Math.min(lines.length, startIndex + 40);

  for (let i = startIndex; i < maxLookahead; i += 1) {
    const line = lines[i];
    if (!line) continue;

    if (line.toLowerCase().includes('rcp average') || line.toLowerCase().includes('rcp poll average')) {
      const joined = [line, lines[i + 1] || '', lines[i + 2] || ''].join(' ');
      const numbers = extractPercentNumbers(joined);

      if (numbers.length >= 1) {
        const probability = numbers[0] / 100;
        return { probability };
      }
    }
  }

  return null;
}

function extractPercentNumbers(text: string): number[] {
  const matches = text.match(/[-+]?\d+(?:\.\d+)?/g) || [];
  const numbers = matches
    .map(value => Number.parseFloat(value))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 100);
  return numbers;
}

/**
 * 538/Silver Bulletin model probabilities
 */
export async function get538Probability(market: string): Promise<ExternalSource | null> {
  try {
    const urlList = (process.env.FIVETHIRTYEIGHT_FORECAST_URLS ||
      process.env.FIVETHIRTYEIGHT_FORECAST_URL ||
      'https://projects.fivethirtyeight.com/2024-election-forecast/')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const probability = await scrapeModelProbability(urlList, market);
    if (probability === null) {
      return null;
    }

    return {
      name: 'FiveThirtyEight',
      type: 'model',
      probability,
      lastUpdated: new Date(),
      url: urlList[0],
    };
  } catch (error) {
    logger.warn('Failed to fetch 538 data:', error);
    return null;
  }
}

export async function getSilverBulletinProbability(market: string): Promise<ExternalSource | null> {
  try {
    const urlList = (process.env.SILVER_BULLETIN_FORECAST_URLS ||
      process.env.SILVER_BULLETIN_FORECAST_URL ||
      'https://www.natesilver.net/')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const probability = await scrapeModelProbability(urlList, market);
    if (probability === null) {
      return null;
    }

    return {
      name: 'Silver Bulletin',
      type: 'model',
      probability,
      lastUpdated: new Date(),
      url: urlList[0],
    };
  } catch (error) {
    logger.warn('Failed to fetch Silver Bulletin data:', error);
    return null;
  }
}

async function scrapeModelProbability(urls: string[], market: string): Promise<number | null> {
  if (urls.length === 0) return null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Clodds/1.0 Forecast Scraper',
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      const lines = htmlToLines(html);
      const probability = extractProbabilityFromLines(lines, market);
      if (probability !== null) {
        return probability;
      }
    } catch (error) {
      logger.debug({ error, url }, 'Forecast scrape failed');
    }
  }

  return null;
}

function extractProbabilityFromLines(lines: string[], market: string): number | null {
  const marketTokens = tokenize(market);
  if (marketTokens.length === 0) return null;

  const candidateHints = ['trump', 'biden', 'harris', 'democrat', 'republican', 'gop', 'dnc'];
  const targetCandidates = candidateHints.filter((hint) => marketTokens.includes(hint));

  let fallbackValues: number[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const percents = extractPercentNumbers(line);
    if (percents.length === 0) continue;

    if (targetCandidates.length > 0 && targetCandidates.some((name) => lower.includes(name))) {
      return percents[0] / 100;
    }

    if (lower.includes('chance') || lower.includes('probability') || lower.includes('odds')) {
      fallbackValues = fallbackValues.concat(percents);
    }
  }

  if (fallbackValues.length > 0) {
    return fallbackValues[0] / 100;
  }

  return null;
}

/**
 * Get betting odds from offshore books
 * Converts American odds to probability
 */
function americanOddsToProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Analyze edge for a market by comparing to external sources
 */
export async function analyzeEdge(
  marketId: string,
  marketQuestion: string,
  marketPrice: number,
  category: 'politics' | 'economics' | 'sports' | 'other'
): Promise<EdgeAnalysis> {
  const sources: ExternalSource[] = [];

  // Fetch relevant external data based on category
  if (category === 'economics') {
    const fedWatch = await getFedWatchProbabilities();
    // Match market to FedWatch data
    for (const [meeting, prob] of fedWatch) {
      if (marketQuestion.toLowerCase().includes(meeting.toLowerCase())) {
        sources.push({
          name: 'CME FedWatch',
          type: 'official',
          probability: prob,
          lastUpdated: new Date(),
          url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
        });
      }
    }
  }

  if (category === 'politics') {
    const rcp = await getRCPPollingAverage(marketQuestion);
    if (rcp) sources.push(rcp);

    const fiveThirtyEight = await get538Probability(marketQuestion);
    if (fiveThirtyEight) sources.push(fiveThirtyEight);

    const silverBulletin = await getSilverBulletinProbability(marketQuestion);
    if (silverBulletin) sources.push(silverBulletin);
  }

  if (category === 'sports') {
    const odds = await getBettingOddsProbability(marketQuestion);
    if (odds) sources.push(odds);
  }

  // Calculate fair value as average of sources
  let fairValue = marketPrice;
  if (sources.length > 0) {
    const sum = sources.reduce((acc, s) => acc + s.probability, 0);
    fairValue = sum / sources.length;
  }

  const edge = fairValue - marketPrice;
  const edgePct = marketPrice > 0 ? (edge / marketPrice) * 100 : 0;

  // Determine confidence based on number and agreement of sources
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (sources.length >= 3) {
    const stdDev = calculateStdDev(sources.map(s => s.probability));
    if (stdDev < 0.05) confidence = 'high';
    else if (stdDev < 0.10) confidence = 'medium';
  } else if (sources.length >= 1) {
    confidence = 'medium';
  }

  return {
    marketId,
    marketQuestion,
    marketPrice,
    sources,
    fairValue,
    edge,
    edgePct,
    confidence,
  };
}

type OddsApiSport = {
  key: string;
  group: string;
  title: string;
  active: boolean;
  has_outrights?: boolean;
};

type OddsApiOutcome = { name: string; price: number };
type OddsApiMarket = { key: string; outcomes: OddsApiOutcome[] };
type OddsApiBookmaker = { title: string; markets: OddsApiMarket[] };
type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

let cachedSportsList: { fetchedAt: number; sports: OddsApiSport[] } | null = null;

async function fetchOddsApiSports(apiKey: string, baseUrl: string): Promise<OddsApiSport[]> {
  const now = Date.now();
  if (cachedSportsList && now - cachedSportsList.fetchedAt < 24 * 60 * 60 * 1000) {
    return cachedSportsList.sports;
  }

  const response = await fetch(`${baseUrl}/v4/sports?apiKey=${encodeURIComponent(apiKey)}`);
  if (!response.ok) {
    throw new Error(`Odds API error: ${response.status}`);
  }

  const sports = await response.json() as OddsApiSport[];
  cachedSportsList = { fetchedAt: now, sports };
  return sports;
}

function impliedProbabilityFromDecimal(decimalOdds: number): number | null {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return null;
  return 1 / decimalOdds;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingOutcome(marketQuestion: string, event: OddsApiEvent): string | null {
  const normalizedQuestion = normalizeText(marketQuestion);
  const home = normalizeText(event.home_team);
  const away = normalizeText(event.away_team);

  if (home && normalizedQuestion.includes(home)) return event.home_team;
  if (away && normalizedQuestion.includes(away)) return event.away_team;

  return null;
}

function selectSportKeys(
  marketQuestion: string,
  sports: OddsApiSport[],
  explicitKeys?: string[]
): string[] {
  if (explicitKeys && explicitKeys.length > 0) return explicitKeys;

  const tokens = tokenize(marketQuestion);
  if (tokens.length === 0) return ['upcoming'];

  const matches: { key: string; score: number }[] = [];
  for (const sport of sports) {
    if (!sport.active) continue;
    const haystack = `${sport.title} ${sport.group} ${sport.key}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
    }
    if (score > 0) matches.push({ key: sport.key, score });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.length > 0 ? matches.slice(0, 3).map(m => m.key) : ['upcoming'];
}

export async function getBettingOddsProbability(marketQuestion: string): Promise<ExternalSource | null> {
  const apiKey = process.env.ODDS_API_KEY || '';
  if (!apiKey) {
    logger.warn('Odds API key missing (ODDS_API_KEY).');
    return null;
  }

  const baseUrl = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com';
  const regions = process.env.ODDS_API_REGIONS || 'us';
  const markets = process.env.ODDS_API_MARKETS || 'h2h';
  const oddsFormat = 'decimal';

  try {
    const sports = await fetchOddsApiSports(apiKey, baseUrl);
    const explicitKeys = (process.env.ODDS_API_SPORT_KEYS || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const sportKeys = selectSportKeys(marketQuestion, sports, explicitKeys);
    const probabilities: number[] = [];
    const sourceBookmakers: string[] = [];

    for (const sportKey of sportKeys) {
      const url = `${baseUrl}/v4/sports/${sportKey}/odds` +
        `?apiKey=${encodeURIComponent(apiKey)}` +
        `&regions=${encodeURIComponent(regions)}` +
        `&markets=${encodeURIComponent(markets)}` +
        `&oddsFormat=${encodeURIComponent(oddsFormat)}`;

      const response = await fetch(url);
      if (!response.ok) {
        logger.warn(`Odds API error for ${sportKey}: ${response.status}`);
        continue;
      }

      const events = await response.json() as OddsApiEvent[];
      for (const event of events) {
        const targetOutcome = findMatchingOutcome(marketQuestion, event);
        if (!targetOutcome) continue;

        for (const bookmaker of event.bookmakers || []) {
          const h2h = bookmaker.markets?.find((m) => m.key === 'h2h');
          if (!h2h) continue;
          const outcome = h2h.outcomes.find((o) => normalizeText(o.name) === normalizeText(targetOutcome));
          if (!outcome) continue;
          const implied = impliedProbabilityFromDecimal(outcome.price);
          if (implied === null) continue;
          probabilities.push(implied);
          sourceBookmakers.push(bookmaker.title);
        }
      }
    }

    if (probabilities.length === 0) return null;

    const avg = probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length;
    const uniqueBooks = Array.from(new Set(sourceBookmakers)).slice(0, 5);

    return {
      name: `Betting Odds${uniqueBooks.length ? ` (${uniqueBooks.join(', ')})` : ''}`,
      type: 'betting',
      probability: avg,
      lastUpdated: new Date(),
      url: 'https://the-odds-api.com/',
    };
  } catch (error) {
    logger.warn('Failed to fetch betting odds:', error);
    return null;
  }
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Kelly Criterion calculator
 */
export function calculateKelly(
  marketPrice: number,
  estimatedProbability: number,
  bankroll: number
): { fullKelly: number; halfKelly: number; quarterKelly: number } {
  // Kelly = (bp - q) / b
  // where b = odds received (1/price - 1), p = prob of winning, q = prob of losing

  if (marketPrice <= 0 || marketPrice >= 1) {
    return { fullKelly: 0, halfKelly: 0, quarterKelly: 0 };
  }

  const b = (1 / marketPrice) - 1;
  const p = estimatedProbability;
  const q = 1 - p;

  const kellyFraction = (b * p - q) / b;

  // Never bet negative Kelly (edge is wrong direction)
  const safeKelly = Math.max(0, kellyFraction);

  return {
    fullKelly: bankroll * safeKelly,
    halfKelly: bankroll * safeKelly * 0.5,
    quarterKelly: bankroll * safeKelly * 0.25,
  };
}
