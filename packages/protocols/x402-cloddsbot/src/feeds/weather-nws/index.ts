/**
 * National Weather Service (NWS) Feed
 *
 * Free US government weather API — no API key needed (just User-Agent).
 * Provides official forecasts, severe weather alerts, and station observations.
 *
 * API docs: https://www.weather.gov/documentation/services-web-api
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface NWSAlert {
  id: string;
  event: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
  certainty: 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';
  headline: string;
  description: string;
  instruction?: string;
  areaDesc: string;
  onset: Date;
  expires: Date;
  senderName: string;
}

export interface NWSForecastPeriod {
  name: string;
  startTime: Date;
  endTime: Date;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation: number | null;
}

export interface NWSObservation {
  station: string;
  timestamp: Date;
  temperature: number | null;
  dewpoint: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  barometricPressure: number | null;
  visibility: number | null;
  description: string;
}

export interface NWSPoint {
  gridId: string;
  gridX: number;
  gridY: number;
  forecastUrl: string;
  forecastHourlyUrl: string;
  observationStationsUrl: string;
  city: string;
  state: string;
}

export interface NWSFeed extends EventEmitter {
  start(): Promise<void>;
  stop(): void;

  /** Resolve lat/lon to NWS grid point */
  getPoint(lat: number, lon: number): Promise<NWSPoint>;

  /** Get 7-day forecast for lat/lon */
  getForecast(lat: number, lon: number): Promise<NWSForecastPeriod[]>;

  /** Get hourly forecast for lat/lon */
  getHourlyForecast(lat: number, lon: number): Promise<NWSForecastPeriod[]>;

  /** Get active weather alerts (optionally filtered by state) */
  getAlerts(state?: string): Promise<NWSAlert[]>;

  /** Get latest observation from nearest station */
  getObservation(lat: number, lon: number): Promise<NWSObservation | null>;
}

// =============================================================================
// API HELPERS
// =============================================================================

const BASE_URL = 'https://api.weather.gov';
const USER_AGENT = 'CloddsBot/1.0 (weather-feed; contact@clodds.com)';

async function nwsFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/geo+json',
    },
  });
  if (!res.ok) {
    throw new Error(`NWS API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

function celsiusToFahrenheit(c: number | null): number | null {
  if (c === null) return null;
  return Math.round(c * 9 / 5 + 32);
}

// =============================================================================
// FACTORY
// =============================================================================

export async function createNWSFeed(): Promise<NWSFeed> {
  const emitter = new EventEmitter() as NWSFeed;
  let running = false;
  let alertPollTimer: ReturnType<typeof setInterval> | null = null;
  const pointCache = new Map<string, NWSPoint>();

  emitter.start = async () => {
    running = true;
    logger.info('NWS weather feed started');
  };

  emitter.stop = () => {
    running = false;
    if (alertPollTimer) {
      clearInterval(alertPollTimer);
      alertPollTimer = null;
    }
    logger.info('NWS weather feed stopped');
  };

  emitter.getPoint = async (lat: number, lon: number): Promise<NWSPoint> => {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = pointCache.get(key);
    if (cached) return cached;

    const data = await nwsFetch<{
      properties: {
        gridId: string;
        gridX: number;
        gridY: number;
        forecast: string;
        forecastHourly: string;
        observationStations: string;
        relativeLocation: {
          properties: {
            city: string;
            state: string;
          };
        };
      };
    }>(`${BASE_URL}/points/${lat},${lon}`);

    const p = data.properties;
    const point: NWSPoint = {
      gridId: p.gridId,
      gridX: p.gridX,
      gridY: p.gridY,
      forecastUrl: p.forecast,
      forecastHourlyUrl: p.forecastHourly,
      observationStationsUrl: p.observationStations,
      city: p.relativeLocation.properties.city,
      state: p.relativeLocation.properties.state,
    };

    pointCache.set(key, point);
    return point;
  };

  emitter.getForecast = async (lat: number, lon: number): Promise<NWSForecastPeriod[]> => {
    const point = await emitter.getPoint(lat, lon);
    const data = await nwsFetch<{
      properties: {
        periods: Array<{
          name: string;
          startTime: string;
          endTime: string;
          isDaytime: boolean;
          temperature: number;
          temperatureUnit: string;
          windSpeed: string;
          windDirection: string;
          shortForecast: string;
          detailedForecast: string;
          probabilityOfPrecipitation: { value: number | null };
        }>;
      };
    }>(point.forecastUrl);

    return data.properties.periods.map(p => ({
      name: p.name,
      startTime: new Date(p.startTime),
      endTime: new Date(p.endTime),
      isDaytime: p.isDaytime,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      windSpeed: p.windSpeed,
      windDirection: p.windDirection,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
      probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value ?? null,
    }));
  };

  emitter.getHourlyForecast = async (lat: number, lon: number): Promise<NWSForecastPeriod[]> => {
    const point = await emitter.getPoint(lat, lon);
    const data = await nwsFetch<{
      properties: {
        periods: Array<{
          name: string;
          startTime: string;
          endTime: string;
          isDaytime: boolean;
          temperature: number;
          temperatureUnit: string;
          windSpeed: string;
          windDirection: string;
          shortForecast: string;
          detailedForecast: string;
          probabilityOfPrecipitation: { value: number | null };
        }>;
      };
    }>(point.forecastHourlyUrl);

    return data.properties.periods.map(p => ({
      name: p.name,
      startTime: new Date(p.startTime),
      endTime: new Date(p.endTime),
      isDaytime: p.isDaytime,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      windSpeed: p.windSpeed,
      windDirection: p.windDirection,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
      probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value ?? null,
    }));
  };

  emitter.getAlerts = async (state?: string): Promise<NWSAlert[]> => {
    const url = state
      ? `${BASE_URL}/alerts/active?area=${encodeURIComponent(state.toUpperCase())}`
      : `${BASE_URL}/alerts/active`;

    const data = await nwsFetch<{
      features: Array<{
        properties: {
          id: string;
          event: string;
          severity: string;
          urgency: string;
          certainty: string;
          headline: string;
          description: string;
          instruction: string | null;
          areaDesc: string;
          onset: string;
          expires: string;
          senderName: string;
        };
      }>;
    }>(url);

    return data.features.map(f => {
      const p = f.properties;
      return {
        id: p.id,
        event: p.event,
        severity: p.severity as NWSAlert['severity'],
        urgency: p.urgency as NWSAlert['urgency'],
        certainty: p.certainty as NWSAlert['certainty'],
        headline: p.headline,
        description: p.description,
        instruction: p.instruction || undefined,
        areaDesc: p.areaDesc,
        onset: new Date(p.onset),
        expires: new Date(p.expires),
        senderName: p.senderName,
      };
    });
  };

  emitter.getObservation = async (lat: number, lon: number): Promise<NWSObservation | null> => {
    try {
      const point = await emitter.getPoint(lat, lon);
      const stations = await nwsFetch<{
        features: Array<{ properties: { stationIdentifier: string } }>;
      }>(point.observationStationsUrl);

      if (!stations.features.length) return null;

      const stationId = stations.features[0].properties.stationIdentifier;
      const obs = await nwsFetch<{
        properties: {
          timestamp: string;
          textDescription: string;
          temperature: { value: number | null };
          dewpoint: { value: number | null };
          relativeHumidity: { value: number | null };
          windSpeed: { value: number | null };
          windDirection: { value: number | null };
          barometricPressure: { value: number | null };
          visibility: { value: number | null };
        };
      }>(`${BASE_URL}/stations/${stationId}/observations/latest`);

      const p = obs.properties;
      return {
        station: stationId,
        timestamp: new Date(p.timestamp),
        temperature: celsiusToFahrenheit(p.temperature.value),
        dewpoint: celsiusToFahrenheit(p.dewpoint.value),
        humidity: p.relativeHumidity.value ? Math.round(p.relativeHumidity.value) : null,
        windSpeed: p.windSpeed.value ? Math.round(p.windSpeed.value * 0.621371) : null, // km/h -> mph
        windDirection: p.windDirection.value ? Math.round(p.windDirection.value) : null,
        barometricPressure: p.barometricPressure.value ? Math.round(p.barometricPressure.value / 100) : null, // Pa -> hPa
        visibility: p.visibility.value ? Math.round(p.visibility.value / 1609.34) : null, // m -> miles
        description: p.textDescription || '',
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to get NWS observation');
      return null;
    }
  };

  return emitter;
}
