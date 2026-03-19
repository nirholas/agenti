/**
 * Open-Meteo Weather Feed
 *
 * Free weather API — no API key needed.
 * Provides current conditions, hourly/daily forecasts, historical data, and alerts.
 *
 * API docs: https://open-meteo.com/en/docs
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface WeatherLocation {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  timezone?: string;
}

export interface CurrentWeather {
  location: WeatherLocation;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  weatherCode: number;
  weatherDescription: string;
  isDay: boolean;
  timestamp: Date;
}

export interface HourlyForecast {
  time: Date;
  temperature: number;
  humidity: number;
  precipitation: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
  weatherDescription: string;
}

export interface DailyForecast {
  date: Date;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  weatherCode: number;
  weatherDescription: string;
  sunrise: Date;
  sunset: Date;
}

export interface HistoricalData {
  date: Date;
  temperatureMax: number;
  temperatureMin: number;
  temperatureMean: number;
  precipitationSum: number;
  windSpeedMax: number;
}

export interface OpenMeteoFeed extends EventEmitter {
  start(): Promise<void>;
  stop(): void;

  /** Geocode a location name to coordinates */
  geocode(name: string): Promise<WeatherLocation[]>;

  /** Get current weather for a location */
  getCurrent(lat: number, lon: number): Promise<CurrentWeather>;

  /** Get hourly forecast (up to 16 days) */
  getHourlyForecast(lat: number, lon: number, days?: number): Promise<HourlyForecast[]>;

  /** Get daily forecast (up to 16 days) */
  getDailyForecast(lat: number, lon: number, days?: number): Promise<DailyForecast[]>;

  /** Get historical daily data */
  getHistorical(lat: number, lon: number, startDate: string, endDate: string): Promise<HistoricalData[]>;

  /** Quick summary: current + 7-day forecast for a named location */
  getSummary(locationName: string): Promise<{
    location: WeatherLocation;
    current: CurrentWeather;
    daily: DailyForecast[];
  } | null>;
}

// =============================================================================
// WMO WEATHER CODES
// =============================================================================

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function describeWeather(code: number): string {
  return WMO_CODES[code] || `Unknown (${code})`;
}

// =============================================================================
// API HELPERS
// =============================================================================

const BASE_URL = 'https://api.open-meteo.com/v1';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// =============================================================================
// FACTORY
// =============================================================================

export async function createOpenMeteoFeed(): Promise<OpenMeteoFeed> {
  const emitter = new EventEmitter() as OpenMeteoFeed;
  let running = false;

  emitter.start = async () => {
    running = true;
    logger.info('Open-Meteo weather feed started');
  };

  emitter.stop = () => {
    running = false;
    logger.info('Open-Meteo weather feed stopped');
  };

  emitter.geocode = async (name: string): Promise<WeatherLocation[]> => {
    const data = await fetchJson<{
      results?: Array<{
        name: string;
        latitude: number;
        longitude: number;
        country?: string;
        timezone?: string;
      }>;
    }>(`${GEOCODING_URL}/search?name=${encodeURIComponent(name)}&count=5&language=en`);

    return (data.results || []).map(r => ({
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      country: r.country,
      timezone: r.timezone,
    }));
  };

  emitter.getCurrent = async (lat: number, lon: number): Promise<CurrentWeather> => {
    const params = [
      `latitude=${lat}`,
      `longitude=${lon}`,
      'current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day',
      'temperature_unit=fahrenheit',
      'wind_speed_unit=mph',
      'precipitation_unit=inch',
    ].join('&');

    const data = await fetchJson<{
      latitude: number;
      longitude: number;
      timezone: string;
      current: {
        time: string;
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
        is_day: number;
      };
    }>(`${BASE_URL}/forecast?${params}`);

    const c = data.current;
    return {
      location: { name: '', latitude: data.latitude, longitude: data.longitude, timezone: data.timezone },
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      windDirection: c.wind_direction_10m,
      precipitation: c.precipitation,
      weatherCode: c.weather_code,
      weatherDescription: describeWeather(c.weather_code),
      isDay: c.is_day === 1,
      timestamp: new Date(c.time),
    };
  };

  emitter.getHourlyForecast = async (lat: number, lon: number, days = 3): Promise<HourlyForecast[]> => {
    const params = [
      `latitude=${lat}`,
      `longitude=${lon}`,
      'hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m,weather_code',
      'temperature_unit=fahrenheit',
      'wind_speed_unit=mph',
      'precipitation_unit=inch',
      `forecast_days=${Math.min(days, 16)}`,
    ].join('&');

    const data = await fetchJson<{
      hourly: {
        time: string[];
        temperature_2m: number[];
        relative_humidity_2m: number[];
        precipitation: number[];
        precipitation_probability: number[];
        wind_speed_10m: number[];
        weather_code: number[];
      };
    }>(`${BASE_URL}/forecast?${params}`);

    const h = data.hourly;
    return h.time.map((t, i) => ({
      time: new Date(t),
      temperature: h.temperature_2m[i],
      humidity: h.relative_humidity_2m[i],
      precipitation: h.precipitation[i],
      precipitationProbability: h.precipitation_probability[i],
      windSpeed: h.wind_speed_10m[i],
      weatherCode: h.weather_code[i],
      weatherDescription: describeWeather(h.weather_code[i]),
    }));
  };

  emitter.getDailyForecast = async (lat: number, lon: number, days = 7): Promise<DailyForecast[]> => {
    const params = [
      `latitude=${lat}`,
      `longitude=${lon}`,
      'daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset',
      'temperature_unit=fahrenheit',
      'wind_speed_unit=mph',
      'precipitation_unit=inch',
      `forecast_days=${Math.min(days, 16)}`,
    ].join('&');

    const data = await fetchJson<{
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max: number[];
        wind_speed_10m_max: number[];
        weather_code: number[];
        sunrise: string[];
        sunset: string[];
      };
    }>(`${BASE_URL}/forecast?${params}`);

    const d = data.daily;
    return d.time.map((t, i) => ({
      date: new Date(t),
      temperatureMax: d.temperature_2m_max[i],
      temperatureMin: d.temperature_2m_min[i],
      precipitationSum: d.precipitation_sum[i],
      precipitationProbabilityMax: d.precipitation_probability_max[i],
      windSpeedMax: d.wind_speed_10m_max[i],
      weatherCode: d.weather_code[i],
      weatherDescription: describeWeather(d.weather_code[i]),
      sunrise: new Date(d.sunrise[i]),
      sunset: new Date(d.sunset[i]),
    }));
  };

  emitter.getHistorical = async (lat: number, lon: number, startDate: string, endDate: string): Promise<HistoricalData[]> => {
    const params = [
      `latitude=${lat}`,
      `longitude=${lon}`,
      'daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max',
      'temperature_unit=fahrenheit',
      'wind_speed_unit=mph',
      'precipitation_unit=inch',
      `start_date=${startDate}`,
      `end_date=${endDate}`,
    ].join('&');

    const data = await fetchJson<{
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        temperature_2m_mean: number[];
        precipitation_sum: number[];
        wind_speed_10m_max: number[];
      };
    }>(`${ARCHIVE_URL}/archive?${params}`);

    const d = data.daily;
    return d.time.map((t, i) => ({
      date: new Date(t),
      temperatureMax: d.temperature_2m_max[i],
      temperatureMin: d.temperature_2m_min[i],
      temperatureMean: d.temperature_2m_mean[i],
      precipitationSum: d.precipitation_sum[i],
      windSpeedMax: d.wind_speed_10m_max[i],
    }));
  };

  emitter.getSummary = async (locationName: string) => {
    const locations = await emitter.geocode(locationName);
    if (locations.length === 0) return null;

    const loc = locations[0];
    const [current, daily] = await Promise.all([
      emitter.getCurrent(loc.latitude, loc.longitude),
      emitter.getDailyForecast(loc.latitude, loc.longitude, 7),
    ]);

    current.location.name = loc.name;
    current.location.country = loc.country;

    return { location: loc, current, daily };
  };

  return emitter;
}
