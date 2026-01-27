/**
 * In-memory analytics tracking for llms.txt extractions
 * Tracks usage patterns, popular sites, and performance metrics
 */

export interface ExtractionEvent {
  url: string
  host: string
  timestamp: number
  success: boolean
  documentCount?: number
  totalTokens?: number
  processingTime?: number
  cached?: boolean
}

export interface AggregatedStats {
  totalExtractions: number
  successfulExtractions: number
  failedExtractions: number
  successRate: number
  avgProcessingTime: number
  totalTokensProcessed: number
  popularSites: { host: string; count: number }[]
  extractionsToday: number
  extractionsThisHour: number
}

interface SiteStats {
  host: string
  count: number
  lastExtracted: number
  totalTokens: number
  avgProcessingTime: number
}

// In-memory storage
const events: ExtractionEvent[] = []
const siteStats: Map<string, SiteStats> = new Map()

// Configuration
const MAX_EVENTS = 10000 // Maximum events to store
const CLEANUP_THRESHOLD = 12000 // Trigger cleanup at this count
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days retention

/**
 * Record an extraction event
 */
export function recordExtraction(event: ExtractionEvent): void {
  // Add to events array
  events.push(event)

  // Update site stats
  const existing = siteStats.get(event.host)
  if (existing) {
    existing.count++
    existing.lastExtracted = event.timestamp
    if (event.totalTokens) {
      existing.totalTokens += event.totalTokens
    }
    if (event.processingTime) {
      // Running average
      existing.avgProcessingTime =
        (existing.avgProcessingTime * (existing.count - 1) + event.processingTime) /
        existing.count
    }
  } else {
    siteStats.set(event.host, {
      host: event.host,
      count: 1,
      lastExtracted: event.timestamp,
      totalTokens: event.totalTokens || 0,
      avgProcessingTime: event.processingTime || 0,
    })
  }

  // Cleanup old events if needed
  if (events.length > CLEANUP_THRESHOLD) {
    cleanupOldEvents()
  }
}

/**
 * Remove events older than retention period
 */
function cleanupOldEvents(): void {
  const cutoff = Date.now() - RETENTION_MS
  
  // Remove old events
  let i = 0
  while (i < events.length && events[i].timestamp < cutoff) {
    i++
  }
  
  if (i > 0) {
    events.splice(0, i)
  }

  // If still over max, remove oldest
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS)
  }
}

/**
 * Get aggregated statistics
 */
export function getStats(): AggregatedStats {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  const oneHourAgo = now - 60 * 60 * 1000

  // Calculate basic stats
  const totalExtractions = events.length
  const successfulExtractions = events.filter((e) => e.success).length
  const failedExtractions = totalExtractions - successfulExtractions

  // Calculate success rate
  const successRate =
    totalExtractions > 0
      ? Math.round((successfulExtractions / totalExtractions) * 100)
      : 0

  // Calculate average processing time
  const timings = events
    .filter((e) => e.processingTime !== undefined)
    .map((e) => e.processingTime!)
  const avgProcessingTime =
    timings.length > 0
      ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)
      : 0

  // Calculate total tokens
  const totalTokensProcessed = events
    .filter((e) => e.totalTokens !== undefined)
    .reduce((sum, e) => sum + (e.totalTokens || 0), 0)

  // Get popular sites from aggregated stats
  const popularSites = Array.from(siteStats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ host, count }) => ({ host, count }))

  // Count extractions in time windows
  const extractionsToday = events.filter((e) => e.timestamp > oneDayAgo).length
  const extractionsThisHour = events.filter((e) => e.timestamp > oneHourAgo).length

  return {
    totalExtractions,
    successfulExtractions,
    failedExtractions,
    successRate,
    avgProcessingTime,
    totalTokensProcessed,
    popularSites,
    extractionsToday,
    extractionsThisHour,
  }
}

/**
 * Get stats for a specific site
 */
export function getSiteStats(host: string): SiteStats | null {
  return siteStats.get(host) || null
}

/**
 * Get recent extraction events
 */
export function getRecentEvents(limit: number = 50): ExtractionEvent[] {
  return events.slice(-limit).reverse()
}

/**
 * Reset all analytics (for testing)
 */
export function resetAnalytics(): void {
  events.length = 0
  siteStats.clear()
}

/**
 * Get raw event count (for monitoring)
 */
export function getEventCount(): number {
  return events.length
}
