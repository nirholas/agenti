/**
 * FRED (Federal Reserve Economic Data) Feed
 *
 * Access to 800,000+ US and international economic time series.
 * Free API key from https://fred.stlouisfed.org/docs/api/api_key.html
 *
 * API docs: https://fred.stlouisfed.org/docs/api/fred/
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface FREDSeries {
  id: string;
  title: string;
  frequency: string;
  units: string;
  seasonalAdjustment: string;
  lastUpdated: Date;
  observationStart: string;
  observationEnd: string;
  popularity: number;
  notes?: string;
}

export interface FREDObservation {
  date: Date;
  value: number | null;
  /** Raw string value (some entries are ".") */
  rawValue: string;
}

export interface FREDCategory {
  id: number;
  name: string;
  parentId: number;
}

export interface FREDRelease {
  id: number;
  name: string;
  pressRelease: boolean;
  link?: string;
  notes?: string;
}

export interface EconomicSnapshot {
  gdp: { value: number | null; date: string } | null;
  cpi: { value: number | null; date: string } | null;
  unemployment: { value: number | null; date: string } | null;
  fedFundsRate: { value: number | null; date: string } | null;
  tenYearYield: { value: number | null; date: string } | null;
  sp500: { value: number | null; date: string } | null;
  timestamp: Date;
}

/** Common FRED series IDs for quick access */
export const FRED_SERIES = {
  // Growth
  GDP: 'GDP',
  REAL_GDP: 'GDPC1',
  GDP_GROWTH: 'A191RL1Q225SBEA',

  // Inflation
  CPI: 'CPIAUCSL',
  CPI_YOY: 'CPIAUCSL',
  CORE_CPI: 'CPILFESL',
  PCE: 'PCEPI',
  CORE_PCE: 'PCEPILFE',

  // Employment
  UNEMPLOYMENT: 'UNRATE',
  NONFARM_PAYROLLS: 'PAYEMS',
  INITIAL_CLAIMS: 'ICSA',
  CONTINUING_CLAIMS: 'CCSA',
  LABOR_FORCE_PARTICIPATION: 'CIVPART',

  // Interest Rates
  FED_FUNDS_RATE: 'FEDFUNDS',
  FED_FUNDS_EFFECTIVE: 'DFF',
  TEN_YEAR_YIELD: 'DGS10',
  TWO_YEAR_YIELD: 'DGS2',
  THIRTY_YEAR_YIELD: 'DGS30',
  YIELD_SPREAD_10Y2Y: 'T10Y2Y',
  PRIME_RATE: 'DPRIME',

  // Markets
  SP500: 'SP500',
  WILSHIRE_5000: 'WILL5000IND',
  VIX: 'VIXCLS',

  // Housing
  HOUSING_STARTS: 'HOUST',
  CASE_SHILLER: 'CSUSHPISA',
  MORTGAGE_30Y: 'MORTGAGE30US',

  // Consumer
  CONSUMER_SENTIMENT: 'UMCSENT',
  RETAIL_SALES: 'RSXFS',
  CONSUMER_CONFIDENCE: 'CSCICP03USM665S',

  // Trade
  TRADE_BALANCE: 'BOPGSTB',

  // Money Supply
  M2: 'M2SL',

  // Commodity
  WTI_OIL: 'DCOILWTICO',
  GOLD: 'GOLDAMGBD228NLBM',
} as const;

export interface FREDFeed extends EventEmitter {
  start(): Promise<void>;
  stop(): void;

  /** Get series metadata */
  getSeries(seriesId: string): Promise<FREDSeries | null>;

  /** Get observations (data points) for a series */
  getObservations(seriesId: string, options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    sort?: 'asc' | 'desc';
    frequency?: 'd' | 'w' | 'bw' | 'm' | 'q' | 'sa' | 'a';
  }): Promise<FREDObservation[]>;

  /** Get the latest value for a series */
  getLatest(seriesId: string): Promise<FREDObservation | null>;

  /** Search for series by keywords */
  search(query: string, limit?: number): Promise<FREDSeries[]>;

  /** Get series in a category */
  getCategory(categoryId: number): Promise<FREDCategory[]>;

  /** Get a quick snapshot of key economic indicators */
  getSnapshot(): Promise<EconomicSnapshot>;

  /** Get year-over-year change for a series */
  getYoYChange(seriesId: string): Promise<{ current: number | null; previous: number | null; change: number | null; changePercent: number | null }>;

  /** Compare multiple series for the same date range */
  compare(seriesIds: string[], startDate: string, endDate: string): Promise<Record<string, FREDObservation[]>>;
}

// =============================================================================
// API HELPERS
// =============================================================================

const BASE_URL = 'https://api.stlouisfed.org/fred';

function getApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    throw new Error('FRED_API_KEY environment variable is required. Get a free key at https://fred.stlouisfed.org/docs/api/api_key.html');
  }
  return key;
}

async function fredFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams({
    api_key: apiKey,
    file_type: 'json',
    ...params,
  });

  const url = `${BASE_URL}/${endpoint}?${queryParams.toString()}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`FRED API error ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

function parseObservation(raw: { date: string; value: string }): FREDObservation {
  const value = raw.value === '.' ? null : parseFloat(raw.value);
  return {
    date: new Date(raw.date),
    value: Number.isNaN(value) ? null : value,
    rawValue: raw.value,
  };
}

function parseSeries(raw: any): FREDSeries {
  return {
    id: raw.id,
    title: raw.title,
    frequency: raw.frequency,
    units: raw.units,
    seasonalAdjustment: raw.seasonal_adjustment,
    lastUpdated: new Date(raw.last_updated),
    observationStart: raw.observation_start,
    observationEnd: raw.observation_end,
    popularity: raw.popularity || 0,
    notes: raw.notes || undefined,
  };
}

// =============================================================================
// FACTORY
// =============================================================================

export async function createFREDFeed(): Promise<FREDFeed> {
  const emitter = new EventEmitter() as FREDFeed;
  let running = false;

  // Simple cache for series metadata (rarely changes)
  const seriesCache = new Map<string, FREDSeries>();

  emitter.start = async () => {
    running = true;
    logger.info('FRED economic data feed started');
  };

  emitter.stop = () => {
    running = false;
    seriesCache.clear();
    logger.info('FRED economic data feed stopped');
  };

  emitter.getSeries = async (seriesId: string): Promise<FREDSeries | null> => {
    const cached = seriesCache.get(seriesId);
    if (cached) return cached;

    try {
      const data = await fredFetch<{ seriess: Record<string, unknown>[] }>('series', {
        series_id: seriesId,
      });

      if (!data.seriess || data.seriess.length === 0) return null;

      const series = parseSeries(data.seriess[0]);
      seriesCache.set(seriesId, series);
      return series;
    } catch (error) {
      logger.warn({ error, seriesId }, 'Failed to get FRED series');
      return null;
    }
  };

  emitter.getObservations = async (seriesId: string, options = {}): Promise<FREDObservation[]> => {
    const params: Record<string, string> = {
      series_id: seriesId,
      sort_order: options.sort || 'desc',
    };

    if (options.startDate) params.observation_start = options.startDate;
    if (options.endDate) params.observation_end = options.endDate;
    if (options.limit) params.limit = String(options.limit);
    if (options.frequency) params.frequency = options.frequency;

    const data = await fredFetch<{
      observations: Array<{ date: string; value: string }>;
    }>('series/observations', params);

    return data.observations.map(parseObservation);
  };

  emitter.getLatest = async (seriesId: string): Promise<FREDObservation | null> => {
    const observations = await emitter.getObservations(seriesId, {
      sort: 'desc',
      limit: 1,
    });
    return observations.length > 0 ? observations[0] : null;
  };

  emitter.search = async (query: string, limit = 20): Promise<FREDSeries[]> => {
    const data = await fredFetch<{
      seriess: Record<string, unknown>[];
    }>('series/search', {
      search_text: query,
      limit: String(limit),
      order_by: 'popularity',
      sort_order: 'desc',
    });

    return (data.seriess || []).map(parseSeries);
  };

  emitter.getCategory = async (categoryId: number): Promise<FREDCategory[]> => {
    const data = await fredFetch<{
      categories: Array<{ id: number; name: string; parent_id: number }>;
    }>('category/children', {
      category_id: String(categoryId),
    });

    return (data.categories || []).map(c => ({
      id: c.id,
      name: c.name,
      parentId: c.parent_id,
    }));
  };

  emitter.getSnapshot = async (): Promise<EconomicSnapshot> => {
    const seriesIds = [
      FRED_SERIES.GDP,
      FRED_SERIES.CPI,
      FRED_SERIES.UNEMPLOYMENT,
      FRED_SERIES.FED_FUNDS_RATE,
      FRED_SERIES.TEN_YEAR_YIELD,
      FRED_SERIES.SP500,
    ];

    const results = await Promise.allSettled(
      seriesIds.map(id => emitter.getLatest(id))
    );

    const getValue = (idx: number) => {
      const result = results[idx];
      if (result.status === 'fulfilled' && result.value) {
        return {
          value: result.value.value,
          date: result.value.date.toISOString().slice(0, 10),
        };
      }
      return null;
    };

    return {
      gdp: getValue(0),
      cpi: getValue(1),
      unemployment: getValue(2),
      fedFundsRate: getValue(3),
      tenYearYield: getValue(4),
      sp500: getValue(5),
      timestamp: new Date(),
    };
  };

  emitter.getYoYChange = async (seriesId: string) => {
    const observations = await emitter.getObservations(seriesId, {
      sort: 'desc',
      limit: 13, // Get ~13 months of monthly data to find YoY
    });

    if (observations.length < 2) {
      return { current: null, previous: null, change: null, changePercent: null };
    }

    const current = observations[0].value;

    // Find observation approximately 12 months ago
    const currentDate = observations[0].date.getTime();
    const targetDate = currentDate - 365 * 24 * 60 * 60 * 1000;

    let closest = observations[observations.length - 1];
    let closestDiff = Math.abs(closest.date.getTime() - targetDate);

    for (const obs of observations) {
      const diff = Math.abs(obs.date.getTime() - targetDate);
      if (diff < closestDiff) {
        closest = obs;
        closestDiff = diff;
      }
    }

    const previous = closest.value;

    if (current === null || previous === null || previous === 0) {
      return { current, previous, change: null, changePercent: null };
    }

    const change = current - previous;
    const changePercent = (change / Math.abs(previous)) * 100;

    return {
      current,
      previous,
      change: Math.round(change * 1000) / 1000,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  };

  emitter.compare = async (seriesIds: string[], startDate: string, endDate: string): Promise<Record<string, FREDObservation[]>> => {
    const results = await Promise.allSettled(
      seriesIds.map(id =>
        emitter.getObservations(id, { startDate, endDate, sort: 'asc' })
      )
    );

    const output: Record<string, FREDObservation[]> = {};
    for (let i = 0; i < seriesIds.length; i++) {
      const result = results[i];
      output[seriesIds[i]] = result.status === 'fulfilled' ? result.value : [];
    }
    return output;
  };

  return emitter;
}
