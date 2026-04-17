// Almgren-Chriss (2001) optimal execution.
//
// Solves the tradeoff between market impact cost and timing risk.
// The model balances two forces:
//   - Trade fast → minimize timing risk (price moves against you while waiting)
//   - Trade slow → minimize market impact (don't move the market yourself)
//
// Output: an optimal schedule of child orders that minimizes
//   E[cost] + λ * Var[cost]
//
// High λ (risk-averse) → front-loaded schedule (trade urgently).
// Low  λ (risk-tolerant) → back-loaded schedule (minimize impact, accept timing risk).
// λ = 0 → pure VWAP (equal slices), equivalent to pure impact minimization.

export interface ACParams {
  /** X: Total quantity to execute (human units — tokens, shares, etc.) */
  totalSize: number
  /** N: Number of time periods to divide the execution window into */
  numPeriods: number
  /** τ (seconds): Length of each period. Total window = numPeriods * periodSeconds */
  periodSeconds: number
  /**
   * σ: Per-period price volatility as a fraction.
   * If you have daily vol (e.g. 0.05 = 5%/day) and 5-min periods:
   *   periodVol = dailyVol * sqrt(periodSeconds / 86400)
   */
  periodVolatility: number
  /**
   * λ: Risk aversion coefficient.
   * Typical range: 1e-6 (very patient) to 1e-3 (very urgent).
   * At λ=0 → equal slices; at very high λ → execute everything immediately.
   */
  riskAversion: number
  /**
   * η: Temporary impact coefficient (bps per unit of trading rate v).
   * Temporary impact = η * v, where v = shares traded / (ADV * period).
   * Typical: 0.1 to 1.0 for liquid markets.
   */
  temporaryImpact?: number
  /**
   * γ: Permanent impact coefficient.
   * Less critical for scheduling (it's a sunk cost), but affects variance.
   * Typical: 0.1 for liquid, 1.0 for illiquid.
   */
  permanentImpact?: number
}

export interface ACPeriod {
  /** Period index (0 = first) */
  period: number
  /** Seconds from trade start when this period begins */
  startsAtSeconds: number
  /** Shares remaining in inventory at the START of this period */
  inventoryAtStart: number
  /** Shares to execute during this period */
  tradeSize: number
  /** Trading rate: tradeSize / periodSeconds */
  tradeRate: number
  /**
   * Fraction of total order this period represents.
   * Sum of all fractions = 1 (plus rounding error).
   */
  fraction: number
}

export interface ACSchedule {
  params: ACParams
  periods: ACPeriod[]
  /** κ: the key scheduling parameter. High κ → front-loaded. */
  kappa: number
  /** Estimated execution cost in price units (impact cost, not fees) */
  expectedCost: number
  /** Estimated cost variance */
  costVariance: number
  /** Equivalent annualized IR of this strategy vs. VWAP (rough estimate) */
  summary: {
    frontLoaded: boolean
    urgencyLabel: 'passive' | 'moderate' | 'aggressive' | 'urgent'
    totalWindowSeconds: number
  }
}

/**
 * Compute the Almgren-Chriss optimal execution schedule.
 *
 * The optimal trajectory is:
 *   x_j = X * sinh(κ(N−j)τ) / sinh(κNτ)
 *
 * where κ = sqrt(λσ² / η), the "urgency" parameter.
 *
 * Trade sizes n_j = x_{j-1} − x_j.
 */
export function computeACSchedule(params: ACParams): ACSchedule {
  const {
    totalSize: X,
    numPeriods: N,
    periodSeconds: tau,
    periodVolatility: sigma,
    riskAversion: lambda,
    temporaryImpact: eta = 0.5,
    permanentImpact: gamma = 0.1,
  } = params

  if (X <= 0 || N <= 0 || tau <= 0) throw new Error('ACParams: totalSize, numPeriods, periodSeconds must be positive')

  // κ = sqrt(λσ²/η). When λ→0, κ→0 and the schedule degenerates to VWAP.
  const kappa = lambda > 0 ? Math.sqrt((lambda * sigma * sigma) / eta) : 0

  // Inventory trajectory: x_j = X * sinh(κ(N-j)τ) / sinh(κNτ)
  // For κ → 0 use l'Hôpital: x_j = X * (N-j)/N (uniform)
  function inventory(j: number): number {
    if (kappa < 1e-10) return X * (N - j) / N
    const denom = Math.sinh(kappa * N * tau)
    if (denom < 1e-15) return X * (N - j) / N
    return X * Math.sinh(kappa * (N - j) * tau) / denom
  }

  const periods: ACPeriod[] = []
  for (let j = 0; j < N; j++) {
    const invBefore = inventory(j)
    const invAfter  = inventory(j + 1)
    const tradeSize = Math.max(0, invBefore - invAfter)

    periods.push({
      period: j,
      startsAtSeconds: j * tau,
      inventoryAtStart: invBefore,
      tradeSize,
      tradeRate: tau > 0 ? tradeSize / tau : 0,
      fraction: X > 0 ? tradeSize / X : 0,
    })
  }

  // Normalize fractions to sum to 1 (floating point safety)
  const totalFraction = periods.reduce((s, p) => s + p.fraction, 0)
  if (totalFraction > 0) {
    for (const p of periods) p.fraction /= totalFraction
    // Re-scale tradeSizes to sum to X exactly
    for (const p of periods) p.tradeSize = p.fraction * X
  }

  // Expected cost (impact cost in price × shares units)
  // E[cost] ≈ γ/2 * X² + η * Σ n_j²/τ  (simplified; ignores higher order terms)
  const impactCost = periods.reduce((s, p) => s + eta * (p.tradeSize ** 2) / tau, 0)
  const permanentCost = 0.5 * gamma * X * X
  const expectedCost = permanentCost + impactCost

  // Variance: Var[cost] = σ² * Σ x_j² * τ
  const costVariance = periods.reduce((s, p, j) => s + (sigma ** 2) * (inventory(j) ** 2) * tau, 0)

  // Characterize urgency from kappa * T
  const kappaT = kappa * N * tau
  const urgencyLabel = kappaT < 0.5 ? 'passive' : kappaT < 1.5 ? 'moderate' : kappaT < 3 ? 'aggressive' : 'urgent'

  return {
    params,
    periods,
    kappa,
    expectedCost,
    costVariance,
    summary: {
      frontLoaded: kappa > 0.01,
      urgencyLabel,
      totalWindowSeconds: N * tau,
    },
  }
}

/**
 * Convenience: given a target execution window and daily volatility,
 * compute a reasonable risk aversion λ that targets a specific urgency level.
 *
 * This calibrates λ such that kappa * T matches the desired urgency.
 */
export function calibrateRiskAversion(
  targetUrgency: 'passive' | 'moderate' | 'aggressive' | 'urgent',
  totalWindowSeconds: number,
  dailyVolatility: number,
  periodsPerDay = 288,                // 5-min periods
  temporaryImpact = 0.5,
): number {
  const kappaTargets: Record<string, number> = {
    passive: 0.2,
    moderate: 1.0,
    aggressive: 2.0,
    urgent: 4.0,
  }
  const kappaT = kappaTargets[targetUrgency] ?? 1.0
  const kappa = kappaT / totalWindowSeconds

  // κ = sqrt(λσ²/η) → λ = κ²η/σ²
  const periodSeconds = 86_400 / periodsPerDay
  const periodVol = dailyVolatility * Math.sqrt(periodSeconds / 86_400)

  return (kappa ** 2 * temporaryImpact) / (periodVol ** 2)
}

/**
 * Format schedule for display / logging.
 */
export function formatACSchedule(schedule: ACSchedule): string {
  const { params, periods, kappa, summary } = schedule
  const lines: string[] = [
    `Almgren-Chriss Schedule (${summary.urgencyLabel}, κ=${kappa.toFixed(4)})`,
    `  Total: ${params.totalSize.toFixed(4)} | ${params.numPeriods} periods × ${params.periodSeconds}s`,
    `  Expected cost: ${schedule.expectedCost.toFixed(6)} | Variance: ${schedule.costVariance.toFixed(6)}`,
    '',
    '  Period  StartsAt   TradeSize  Fraction',
  ]
  for (const p of periods) {
    lines.push(
      `  ${String(p.period).padStart(6)}  ${String(p.startsAtSeconds).padStart(9)}s  ${p.tradeSize.toFixed(4).padStart(9)}  ${(p.fraction * 100).toFixed(1)}%`
    )
  }
  return lines.join('\n')
}
