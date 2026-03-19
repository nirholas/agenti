/**
 * OpenTelemetry Diagnostics Extension
 * Provides tracing, metrics, and logging via OpenTelemetry
 *
 * Supports exporters: Jaeger, Zipkin, OTLP, Console
 */

import { logger } from '../../utils/logger';

export interface OTelConfig {
  enabled: boolean;
  /** Service name for traces */
  serviceName?: string;
  /** Trace exporter: 'jaeger' | 'zipkin' | 'otlp' | 'console' */
  traceExporter?: 'jaeger' | 'zipkin' | 'otlp' | 'console';
  /** Metrics exporter: 'prometheus' | 'otlp' | 'console' */
  metricsExporter?: 'prometheus' | 'otlp' | 'console';
  /** OTLP endpoint */
  otlpEndpoint?: string;
  /** Jaeger endpoint */
  jaegerEndpoint?: string;
  /** Zipkin endpoint */
  zipkinEndpoint?: string;
  /** Prometheus port */
  prometheusPort?: number;
  /** Sample rate (0.0 to 1.0) */
  sampleRate?: number;
}

interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
  status: 'ok' | 'error' | 'unset';
}

interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface OTelExtension {
  /** Start a new trace span */
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): SpanContext;
  /** Record a metric */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void;
  /** Increment a counter */
  incrementCounter(name: string, labels?: Record<string, string>): void;
  /** Set a gauge value */
  setGauge(name: string, value: number, labels?: Record<string, string>): void;
  /** Record histogram observation */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
  /** Flush all pending telemetry */
  flush(): Promise<void>;
  /** Shutdown the extension */
  shutdown(): Promise<void>;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  /** Add an event to the span */
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  /** Set span attributes */
  setAttributes(attributes: Record<string, string | number | boolean>): void;
  /** Set span status */
  setStatus(status: 'ok' | 'error', message?: string): void;
  /** End the span */
  end(): void;
}

function generateId(length: number = 16): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function createOTelExtension(config: OTelConfig): Promise<OTelExtension> {
  const serviceName = config.serviceName || 'clodds';
  const sampleRate = config.sampleRate ?? 1.0;
  const MAX_BUFFERED_SPANS = 10000;
  const MAX_BUFFERED_METRICS = 10000;
  const spans: Span[] = [];
  const metrics: Metric[] = [];
  const counters = new Map<string, number>();
  const gauges = new Map<string, number>();
  let flushTimer: NodeJS.Timeout | null = null;

  // Start periodic flush
  if (config.enabled) {
    flushTimer = setInterval(async () => {
      try {
        await flush();
      } catch {}
    }, 10000);
  }

  async function exportTraces(batch: Span[]): Promise<void> {
    if (batch.length === 0) return;

    switch (config.traceExporter) {
      case 'console':
        for (const span of batch) {
          console.log(JSON.stringify({ type: 'trace', span, service: serviceName }));
        }
        break;

      case 'otlp':
        if (config.otlpEndpoint) {
          try {
            await fetch(`${config.otlpEndpoint}/v1/traces`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resourceSpans: [
                  {
                    resource: { attributes: [{ key: 'service.name', value: { stringValue: serviceName } }] },
                    scopeSpans: [{ spans: batch.map(formatOTLPSpan) }],
                  },
                ],
              }),
            });
          } catch (error) {
            logger.warn({ error }, 'Failed to export traces to OTLP');
          }
        }
        break;

      case 'jaeger':
        if (config.jaegerEndpoint) {
          try {
            await fetch(`${config.jaegerEndpoint}/api/traces`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ batch: batch.map(formatJaegerSpan) }),
            });
          } catch (error) {
            logger.warn({ error }, 'Failed to export traces to Jaeger');
          }
        }
        break;

      case 'zipkin':
        if (config.zipkinEndpoint) {
          try {
            await fetch(`${config.zipkinEndpoint}/api/v2/spans`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(batch.map(formatZipkinSpan)),
            });
          } catch (error) {
            logger.warn({ error }, 'Failed to export traces to Zipkin');
          }
        }
        break;
    }
  }

  async function exportMetrics(batch: Metric[]): Promise<void> {
    if (batch.length === 0) return;

    switch (config.metricsExporter) {
      case 'console':
        for (const metric of batch) {
          console.log(JSON.stringify({ type: 'metric', metric, service: serviceName }));
        }
        break;

      case 'otlp':
        if (config.otlpEndpoint) {
          try {
            await fetch(`${config.otlpEndpoint}/v1/metrics`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resourceMetrics: [
                  {
                    resource: { attributes: [{ key: 'service.name', value: { stringValue: serviceName } }] },
                    scopeMetrics: [{ metrics: batch.map(formatOTLPMetric) }],
                  },
                ],
              }),
            });
          } catch (error) {
            logger.warn({ error }, 'Failed to export metrics to OTLP');
          }
        }
        break;
    }
  }

  function formatOTLPSpan(span: Span): unknown {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      startTimeUnixNano: span.startTime * 1000000,
      endTimeUnixNano: (span.endTime || Date.now()) * 1000000,
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? { stringValue: value } : { intValue: value },
      })),
      events: span.events.map((e) => ({
        name: e.name,
        timeUnixNano: e.timestamp * 1000000,
      })),
    };
  }

  function formatJaegerSpan(span: Span): unknown {
    return {
      traceIdHigh: span.traceId.slice(0, 16),
      traceIdLow: span.traceId.slice(16),
      spanId: span.spanId,
      operationName: span.name,
      startTime: span.startTime * 1000,
      duration: ((span.endTime || Date.now()) - span.startTime) * 1000,
      tags: Object.entries(span.attributes).map(([key, value]) => ({ key, value })),
    };
  }

  function formatZipkinSpan(span: Span): unknown {
    return {
      traceId: span.traceId,
      id: span.spanId,
      parentId: span.parentSpanId,
      name: span.name,
      timestamp: span.startTime * 1000,
      duration: ((span.endTime || Date.now()) - span.startTime) * 1000,
      localEndpoint: { serviceName },
      tags: span.attributes,
    };
  }

  function formatOTLPMetric(metric: Metric): unknown {
    return {
      name: metric.name,
      [metric.type]: {
        dataPoints: [
          {
            asDouble: metric.value,
            timeUnixNano: metric.timestamp * 1000000,
            attributes: Object.entries(metric.labels).map(([key, value]) => ({
              key,
              value: { stringValue: value },
            })),
          },
        ],
      },
    };
  }

  async function flush(): Promise<void> {
    const spanBatch = spans.splice(0, spans.length);
    const metricBatch = metrics.splice(0, metrics.length);
    await Promise.all([exportTraces(spanBatch), exportMetrics(metricBatch)]);
  }

  return {
    startSpan(name: string, attributes?: Record<string, string | number | boolean>): SpanContext {
      // Apply sampling
      if (Math.random() > sampleRate) {
        // Return no-op span context
        return {
          traceId: '',
          spanId: '',
          addEvent: () => {},
          setAttributes: () => {},
          setStatus: () => {},
          end: () => {},
        };
      }

      const span: Span = {
        name,
        traceId: generateId(32),
        spanId: generateId(16),
        startTime: Date.now(),
        attributes: attributes || {},
        events: [],
        status: 'unset',
      };

      return {
        traceId: span.traceId,
        spanId: span.spanId,

        addEvent(eventName: string, eventAttributes?: Record<string, unknown>) {
          span.events.push({
            name: eventName,
            timestamp: Date.now(),
            attributes: eventAttributes,
          });
        },

        setAttributes(newAttributes: Record<string, string | number | boolean>) {
          Object.assign(span.attributes, newAttributes);
        },

        setStatus(status: 'ok' | 'error', message?: string) {
          span.status = status;
          if (message) {
            span.attributes['error.message'] = message;
          }
        },

        end() {
          span.endTime = Date.now();
          if (spans.length >= MAX_BUFFERED_SPANS) {
            spans.splice(0, Math.floor(MAX_BUFFERED_SPANS / 2));
          }
          spans.push(span);
        },
      };
    },

    recordMetric(name: string, value: number, labels?: Record<string, string>) {
      if (metrics.length >= MAX_BUFFERED_METRICS) {
        metrics.splice(0, Math.floor(MAX_BUFFERED_METRICS / 2));
      }
      metrics.push({
        name,
        type: 'gauge',
        value,
        labels: labels || {},
        timestamp: Date.now(),
      });
    },

    incrementCounter(name: string, labels?: Record<string, string>) {
      const key = `${name}:${JSON.stringify(labels || {})}`;
      const current = counters.get(key) || 0;
      counters.set(key, current + 1);
      metrics.push({
        name,
        type: 'counter',
        value: current + 1,
        labels: labels || {},
        timestamp: Date.now(),
      });
    },

    setGauge(name: string, value: number, labels?: Record<string, string>) {
      const key = `${name}:${JSON.stringify(labels || {})}`;
      gauges.set(key, value);
      metrics.push({
        name,
        type: 'gauge',
        value,
        labels: labels || {},
        timestamp: Date.now(),
      });
    },

    recordHistogram(name: string, value: number, labels?: Record<string, string>) {
      metrics.push({
        name,
        type: 'histogram',
        value,
        labels: labels || {},
        timestamp: Date.now(),
      });
    },

    async flush() {
      await flush();
    },

    async shutdown() {
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
      await flush();
      logger.info('OTel extension shutdown');
    },
  };
}
