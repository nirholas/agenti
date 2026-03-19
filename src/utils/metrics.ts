/**
 * Lightweight Observability Metrics
 * @description In-memory metrics collection for tool calls, payments, and server health.
 *              Exposes a JSON /metrics endpoint — no external dependencies required.
 * @author nirholas
 */

import type { Request, Response } from "express"

// ============================================================================
// Types
// ============================================================================

interface ToolMetric {
  calls: number
  errors: number
  totalDurationMs: number
  minDurationMs: number
  maxDurationMs: number
  /** Sorted sample of recent durations for p95 approximation */
  recentDurations: number[]
}

interface PaymentMetric {
  count: number
  totalAmountUsd: number
}

// ============================================================================
// State
// ============================================================================

const toolMetrics = new Map<string, ToolMetric>()
const paymentMetrics = new Map<string, PaymentMetric>()
let activeSessions = 0
const startTime = Date.now()

/** Max recent durations to keep per tool for percentile estimation */
const MAX_RECENT_DURATIONS = 200

// ============================================================================
// Public API
// ============================================================================

/**
 * Record a tool call (success or error) with its duration.
 */
export function recordToolCall(
  toolName: string,
  durationMs: number,
  success: boolean
): void {
  let metric = toolMetrics.get(toolName)
  if (!metric) {
    metric = {
      calls: 0,
      errors: 0,
      totalDurationMs: 0,
      minDurationMs: Infinity,
      maxDurationMs: 0,
      recentDurations: [],
    }
    toolMetrics.set(toolName, metric)
  }

  metric.calls++
  if (!success) metric.errors++
  metric.totalDurationMs += durationMs
  if (durationMs < metric.minDurationMs) metric.minDurationMs = durationMs
  if (durationMs > metric.maxDurationMs) metric.maxDurationMs = durationMs

  metric.recentDurations.push(durationMs)
  if (metric.recentDurations.length > MAX_RECENT_DURATIONS) {
    metric.recentDurations.shift()
  }
}

/**
 * Record a payment event.
 */
export function recordPayment(chain: string, amountUsd: number): void {
  let metric = paymentMetrics.get(chain)
  if (!metric) {
    metric = { count: 0, totalAmountUsd: 0 }
    paymentMetrics.set(chain, metric)
  }
  metric.count++
  metric.totalAmountUsd += amountUsd
}

export function incrementSessions(): void {
  activeSessions++
}

export function decrementSessions(): void {
  activeSessions = Math.max(0, activeSessions - 1)
}

/**
 * Return all metrics as a JSON-serializable object.
 */
export function getMetrics(): Record<string, unknown> {
  const tools: Record<string, unknown> = {}
  for (const [name, m] of toolMetrics) {
    const sorted = [...m.recentDurations].sort((a, b) => a - b)
    const p95Index = Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1)
    tools[name] = {
      calls: m.calls,
      errors: m.errors,
      successRate: m.calls > 0 ? ((m.calls - m.errors) / m.calls * 100).toFixed(1) + "%" : "N/A",
      durationMs: {
        avg: m.calls > 0 ? Math.round(m.totalDurationMs / m.calls) : 0,
        min: m.minDurationMs === Infinity ? 0 : m.minDurationMs,
        max: m.maxDurationMs,
        p95: sorted.length > 0 ? sorted[p95Index] : 0,
      },
    }
  }

  const payments: Record<string, unknown> = {}
  for (const [chain, m] of paymentMetrics) {
    payments[chain] = {
      count: m.count,
      totalAmountUsd: parseFloat(m.totalAmountUsd.toFixed(6)),
    }
  }

  return {
    server: {
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      activeSessions,
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    tools,
    payments,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Express handler for GET /metrics
 */
export function metricsHandler(_req: Request, res: Response): void {
  res.json(getMetrics())
}

export default {
  recordToolCall,
  recordPayment,
  incrementSessions,
  decrementSessions,
  getMetrics,
  metricsHandler,
}
