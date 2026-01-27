'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { VerificationResult, SiteEntry } from '@/data/sites'

interface UseVerificationOptions {
  /** Auto-verify on mount */
  autoVerify?: boolean
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtl?: number
  /** Polling interval in milliseconds (0 = disabled) */
  pollingInterval?: number
}

interface VerificationState {
  status: 'idle' | 'loading' | 'success' | 'error'
  result: VerificationResult | null
  error: string | null
  lastChecked: Date | null
}

// Client-side cache for verification results
const clientCache = new Map<string, { result: VerificationResult; timestamp: number }>()

/**
 * Hook for verifying a single site's llms.txt availability
 */
export function useSiteVerification(
  site: SiteEntry | null,
  options: UseVerificationOptions = {}
) {
  const { autoVerify = false, cacheTtl = 5 * 60 * 1000, pollingInterval = 0 } = options

  const [state, setState] = useState<VerificationState>({
    status: 'idle',
    result: null,
    error: null,
    lastChecked: null,
  })

  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const verify = useCallback(async (noCache = false) => {
    if (!site) return

    const cacheKey = site.llmsTxtUrl || site.url

    // Check client cache first
    if (!noCache) {
      const cached = clientCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < cacheTtl) {
        setState({
          status: 'success',
          result: cached.result,
          error: null,
          lastChecked: new Date(cached.timestamp),
        })
        return cached.result
      }
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    setState(prev => ({ ...prev, status: 'loading' }))

    try {
      const params = new URLSearchParams({ id: site.id })
      if (noCache) params.set('nocache', 'true')

      const response = await fetch(`/api/sites/verify?${params}`, {
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status}`)
      }

      const result: VerificationResult = await response.json()

      // Update client cache
      clientCache.set(cacheKey, { result, timestamp: Date.now() })

      setState({
        status: 'success',
        result,
        error: null,
        lastChecked: new Date(),
      })

      return result
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      setState({
        status: 'error',
        result: null,
        error: error instanceof Error ? error.message : 'Verification failed',
        lastChecked: new Date(),
      })
    }
  }, [site, cacheTtl])

  // Auto-verify on mount
  useEffect(() => {
    if (autoVerify && site) {
      verify()
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [autoVerify, site?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling
  useEffect(() => {
    if (pollingInterval > 0 && site) {
      pollingRef.current = setInterval(() => {
        verify(true) // Force refresh for polling
      }, pollingInterval)

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
        }
      }
    }
  }, [pollingInterval, site?.id, verify])

  return {
    ...state,
    verify,
    refresh: () => verify(true),
    isOnline: state.result?.status === 'online',
    isOffline: state.result?.status === 'offline',
    hasLlmsTxt: !!state.result?.llmsTxt?.exists || !!state.result?.llmsFullTxt?.exists,
  }
}

/**
 * Hook for batch verification of multiple sites
 */
export function useBatchVerification(
  sites: SiteEntry[],
  options: UseVerificationOptions = {}
) {
  const { autoVerify = false, cacheTtl = 5 * 60 * 1000 } = options

  const [results, setResults] = useState<Map<string, VerificationResult>>(new Map())
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [progress, setProgress] = useState({ completed: 0, total: 0 })

  const verify = useCallback(async (noCache = false) => {
    if (sites.length === 0) return

    setStatus('loading')
    setProgress({ completed: 0, total: sites.length })

    try {
      const siteIds = sites.map(s => s.id)

      const response = await fetch('/api/sites/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteIds, noCache }),
      })

      if (!response.ok) {
        throw new Error(`Batch verification failed: ${response.status}`)
      }

      const data = await response.json()
      const newResults = new Map<string, VerificationResult>()

      for (const [key, result] of Object.entries(data.results)) {
        newResults.set(key, result as VerificationResult)
        
        // Update client cache
        const site = sites.find(s => s.id === key)
        if (site) {
          const cacheKey = site.llmsTxtUrl || site.url
          clientCache.set(cacheKey, { result: result as VerificationResult, timestamp: Date.now() })
        }
      }

      setResults(newResults)
      setProgress({ completed: sites.length, total: sites.length })
      setStatus('success')

      return newResults
    } catch (error) {
      setStatus('error')
      throw error
    }
  }, [sites])

  // Auto-verify on mount
  useEffect(() => {
    if (autoVerify && sites.length > 0) {
      verify()
    }
  }, [autoVerify]) // eslint-disable-line react-hooks/exhaustive-deps

  const getResult = useCallback((siteId: string) => {
    return results.get(siteId)
  }, [results])

  const onlineCount = Array.from(results.values()).filter(r => r.status === 'online').length
  const offlineCount = Array.from(results.values()).filter(r => r.status === 'offline').length

  return {
    results,
    status,
    progress,
    verify,
    refresh: () => verify(true),
    getResult,
    onlineCount,
    offlineCount,
    totalChecked: results.size,
  }
}

/**
 * Hook for fetching the health report
 */
export function useHealthReport(options: { autoFetch?: boolean; refreshInterval?: number } = {}) {
  const { autoFetch = false, refreshInterval = 0 } = options

  const [report, setReport] = useState<{
    timestamp: string
    totalSites: number
    online: number
    offline: number
    errors: number
    slow: number
    averageResponseTime: number
    results: Array<{
      id: string
      name: string
      status: 'online' | 'offline' | 'error' | 'slow'
      responseTime: number
    }>
  } | null>(null)

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const fetchReport = useCallback(async (refresh = false) => {
    setStatus('loading')

    try {
      const params = new URLSearchParams()
      if (refresh) params.set('refresh', 'true')

      const response = await fetch(`/api/sites/health?${params}`)
      if (!response.ok) throw new Error('Failed to fetch health report')

      const data = await response.json()
      setReport(data)
      setStatus('success')
      return data
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (autoFetch) {
      fetchReport()
    }
  }, [autoFetch, fetchReport])

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => fetchReport(true), refreshInterval)
      return () => clearInterval(interval)
    }
  }, [refreshInterval, fetchReport])

  return {
    report,
    status,
    fetch: fetchReport,
    refresh: () => fetchReport(true),
  }
}
