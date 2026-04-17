export interface PricePoint {
  timestamp: number
  price: number
  volume?: number
}

export type AnomalyType =
  | 'spike_up'
  | 'spike_down'
  | 'volume_surge'
  | 'volatility'
  | 'trend_break'

export interface Anomaly {
  type: AnomalyType
  severity: 'low' | 'medium' | 'high'
  timestamp: number
  price: number
  score: number
  message: string
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function mad(values: number[], med: number): number {
  const deviations = values.map((v) => Math.abs(v - med))
  return median(deviations)
}

// Modified Z-Score (Iglewicz & Hoaglin, 1993).
// Uses MAD instead of std dev — more robust to outliers.
function modifiedZScore(value: number, values: number[]): number {
  if (values.length < 3) return 0
  const med = median(values)
  const m = mad(values, med)
  if (m === 0) return 0
  return (0.6745 * (value - med)) / m
}

function severity(absScore: number): 'low' | 'medium' | 'high' {
  if (absScore >= 5) return 'high'
  if (absScore >= 3.5) return 'medium'
  return 'low'
}

/**
 * Detect price anomalies using Modified Z-Score.
 * More robust than standard Z-Score because it uses median instead of mean.
 * Returns anomalies sorted by timestamp.
 */
export function detectAnomalies(
  prices: PricePoint[],
  options?: {
    threshold?: number
    windowSize?: number
    detectTypes?: AnomalyType[]
  },
): Anomaly[] {
  const threshold = options?.threshold ?? 3.5
  const windowSize = options?.windowSize ?? 20
  const detectTypes = new Set<AnomalyType>(options?.detectTypes ?? ['spike_up', 'spike_down', 'volume_surge', 'volatility', 'trend_break'])

  const anomalies: Anomaly[] = []

  for (let i = windowSize; i < prices.length; i++) {
    const window = prices.slice(i - windowSize, i)
    const current = prices[i]!
    const windowPrices = window.map((p) => p.price)
    const score = modifiedZScore(current.price, windowPrices)
    const absScore = Math.abs(score)

    if (absScore < threshold) continue

    if (score > 0 && detectTypes.has('spike_up')) {
      anomalies.push({
        type: 'spike_up',
        severity: severity(absScore),
        timestamp: current.timestamp,
        price: current.price,
        score: Math.round(absScore * 100) / 100,
        message: `Price spike up: ${current.price.toFixed(4)} (+${absScore.toFixed(1)}σ)`,
      })
    } else if (score < 0 && detectTypes.has('spike_down')) {
      anomalies.push({
        type: 'spike_down',
        severity: severity(absScore),
        timestamp: current.timestamp,
        price: current.price,
        score: Math.round(absScore * 100) / 100,
        message: `Price spike down: ${current.price.toFixed(4)} (-${absScore.toFixed(1)}σ)`,
      })
    }

    if (current.volume !== undefined && detectTypes.has('volume_surge') && i >= windowSize) {
      const windowVolumes = window.map((p) => p.volume ?? 0)
      if (windowVolumes.some((v) => v > 0)) {
        const volScore = modifiedZScore(current.volume, windowVolumes)
        if (volScore > threshold) {
          anomalies.push({
            type: 'volume_surge',
            severity: severity(Math.abs(volScore)),
            timestamp: current.timestamp,
            price: current.price,
            score: Math.round(Math.abs(volScore) * 100) / 100,
            message: `Volume surge: ${current.volume.toFixed(0)} (+${volScore.toFixed(1)}σ)`,
          })
        }
      }
    }
  }

  if (detectTypes.has('volatility') && prices.length >= windowSize + 1) {
    const logReturns = prices.slice(1).map((p, i) => {
      const prev = prices[i]!.price
      return prev > 0 ? Math.log(p.price / prev) : 0
    })

    for (let i = windowSize; i < logReturns.length; i++) {
      const window = logReturns.slice(i - windowSize, i)
      const current = logReturns[i]!
      const score = modifiedZScore(Math.abs(current), window.map(Math.abs))
      if (score > threshold) {
        const pt = prices[i + 1]!
        anomalies.push({
          type: 'volatility',
          severity: severity(score),
          timestamp: pt.timestamp,
          price: pt.price,
          score: Math.round(score * 100) / 100,
          message: `Volatility spike: log return ${(current * 100).toFixed(2)}% (+${score.toFixed(1)}σ)`,
        })
      }
    }
  }

  if (detectTypes.has('trend_break') && prices.length >= windowSize * 2) {
    const ewmaValues = ewma(prices.map((p) => p.price), 0.1)
    const ewmaReturns = ewmaValues.slice(1).map((v, i) => {
      const prev = ewmaValues[i]!
      return prev > 0 ? (v - prev) / prev : 0
    })

    for (let i = windowSize; i < ewmaReturns.length; i++) {
      const window = ewmaReturns.slice(i - windowSize, i)
      const current = ewmaReturns[i]!
      const score = modifiedZScore(current, window)
      if (Math.abs(score) > threshold) {
        const pt = prices[i + 1]!
        if (pt && !anomalies.some((a) => a.timestamp === pt.timestamp)) {
          anomalies.push({
            type: 'trend_break',
            severity: severity(Math.abs(score)),
            timestamp: pt.timestamp,
            price: pt.price,
            score: Math.round(Math.abs(score) * 100) / 100,
            message: `Trend break detected at ${pt.price.toFixed(4)} (${Math.abs(score).toFixed(1)}σ from EWMA trend)`,
          })
        }
      }
    }
  }

  return anomalies.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Exponentially weighted moving average (EWMA) with configurable decay.
 * Useful for smoothing noisy price data before anomaly detection.
 */
export function ewma(values: number[], alpha = 0.1): number[] {
  if (values.length === 0) return []
  const result: number[] = [values[0]!]
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i]! + (1 - alpha) * result[i - 1]!)
  }
  return result
}

/**
 * Get the current volatility (standard deviation of log returns) for a price series.
 */
export function getVolatility(prices: number[], windowSize?: number): number {
  const n = windowSize ? Math.min(windowSize, prices.length) : prices.length
  const slice = prices.slice(-n)
  if (slice.length < 2) return 0

  const logReturns: number[] = []
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1]!
    if (prev > 0) logReturns.push(Math.log(slice[i]! / prev))
  }

  if (logReturns.length === 0) return 0
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length
  const variance = logReturns.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (logReturns.length - 1)
  return Math.sqrt(variance)
}

/**
 * Calculate rolling Z-score for each point in the series.
 */
export function rollingZScore(values: number[], windowSize = 20): number[] {
  return values.map((v, i) => {
    if (i < 3) return 0
    const window = values.slice(Math.max(0, i - windowSize), i)
    return modifiedZScore(v, window)
  })
}
