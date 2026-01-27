'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock,
  Zap,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

interface HealthResult {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'error' | 'slow'
  responseTime: number
  llmsTxtFound: boolean
  llmsFullTxtFound: boolean
  foundAt?: string
  error?: string
}

interface HealthReport {
  timestamp: string
  totalSites: number
  online: number
  offline: number
  errors: number
  slow: number
  averageResponseTime: number
  results: HealthResult[]
  cached?: boolean
  cacheAge?: number
}

const STATUS_CONFIG = {
  online: {
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    label: 'Online',
  },
  offline: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    label: 'Offline',
  },
  error: {
    icon: AlertCircle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/20',
    label: 'Error',
  },
  slow: {
    icon: Clock,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    label: 'Slow',
  },
}

export default function HealthDashboard() {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'online' | 'offline' | 'error' | 'slow'>('all')

  const fetchHealth = async (refresh = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (refresh) params.set('refresh', 'true')

      const response = await fetch(`/api/sites/health?${params}`)
      if (!response.ok) throw new Error('Failed to fetch health report')

      const data: HealthReport = await response.json()
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  const filteredResults = report?.results.filter(r => {
    if (filter === 'all') return true
    return r.status === filter
  }) || []

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <main className="min-h-screen bg-black">
      <Header />

      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back link */}
          <Link
            href="/directory"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </Link>

          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Health Dashboard</h1>
                <p className="text-neutral-400">
                  Real-time status of all llms.txt endpoints
                </p>
              </div>
              <button
                onClick={() => fetchHealth(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Checking...' : 'Refresh All'}
              </button>
            </div>
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400"
            >
              {error}
            </motion.div>
          )}

          {report && (
            <>
              {/* Summary cards */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
              >
                <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
                  <div className="text-sm text-neutral-400 mb-1">Total Sites</div>
                  <div className="text-2xl font-bold text-white">{report.totalSites}</div>
                </div>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="text-sm text-green-400 mb-1">Online</div>
                  <div className="text-2xl font-bold text-green-400">{report.online}</div>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="text-sm text-red-400 mb-1">Offline</div>
                  <div className="text-2xl font-bold text-red-400">{report.offline}</div>
                </div>
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-sm text-yellow-400 mb-1">Errors</div>
                  <div className="text-2xl font-bold text-yellow-400">{report.errors}</div>
                </div>
                <div className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
                  <div className="text-sm text-neutral-400 mb-1">Avg Response</div>
                  <div className="text-2xl font-bold text-white">{formatTime(report.averageResponseTime)}</div>
                </div>
              </motion.div>

              {/* Cache info */}
              {report.cached && (
                <div className="mb-4 text-sm text-neutral-500">
                  Showing cached results from {report.cacheAge}s ago
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {(['all', 'online', 'offline', 'error', 'slow'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      filter === f
                        ? 'bg-white text-black'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== 'all' && (
                      <span className="ml-2 text-xs opacity-75">
                        ({report.results.filter(r => r.status === f).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Results table */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-neutral-800 overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Site
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Files Found
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Response Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {filteredResults.map((result) => {
                        const config = STATUS_CONFIG[result.status]
                        const StatusIcon = config.icon

                        return (
                          <tr key={result.id} className="hover:bg-neutral-900/30 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}&sz=32`}
                                  alt=""
                                  className="w-5 h-5 rounded"
                                />
                                <div>
                                  <div className="font-medium text-white">{result.name}</div>
                                  <div className="text-xs text-neutral-500">{new URL(result.url).hostname}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.borderColor} border ${config.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {config.label}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2 text-sm">
                                {result.llmsTxtFound && (
                                  <span className="text-green-400">llms.txt</span>
                                )}
                                {result.llmsFullTxtFound && (
                                  <span className="text-blue-400">llms-full.txt</span>
                                )}
                                {!result.llmsTxtFound && !result.llmsFullTxtFound && (
                                  <span className="text-neutral-500">None</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`text-sm ${result.responseTime > 3000 ? 'text-orange-400' : 'text-neutral-400'}`}>
                                {formatTime(result.responseTime)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/extract?url=${encodeURIComponent(result.url)}`}
                                  className="p-2 text-neutral-400 hover:text-white transition-colors"
                                  title="Extract"
                                >
                                  <Zap className="w-4 h-4" />
                                </Link>
                                <a
                                  href={result.foundAt || result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-neutral-400 hover:text-white transition-colors"
                                  title="Visit"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* Last updated */}
              <div className="mt-4 text-sm text-neutral-500 text-center">
                Last checked: {new Date(report.timestamp).toLocaleString()}
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />
    </main>
  )
}
