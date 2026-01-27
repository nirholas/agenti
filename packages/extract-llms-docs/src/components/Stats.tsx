'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Globe, Zap, TrendingUp, Clock, BarChart3, CheckCircle } from 'lucide-react'
import { AggregatedStats } from '@/types'

interface StatItemProps {
  icon: React.ElementType
  value: string | number
  label: string
  index: number
}

function StatItem({ icon: Icon, value, label, index }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="text-center"
    >
      <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 border border-neutral-800 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-neutral-400">{label}</div>
    </motion.div>
  )
}

export default function Stats() {
  const [stats, setStats] = useState<AggregatedStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/analytics')
        if (response.ok) {
          const data = await response.json()
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  // Show placeholder stats while loading or if no real data yet
  const displayStats = stats && stats.totalExtractions > 0

  return (
    <section className="py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-neutral-800 p-8 bg-neutral-900/50 backdrop-blur-xl"
      >
        {displayStats ? (
          <>
            {/* Real stats when available */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <StatItem
                icon={BarChart3}
                value={stats.extractionsToday}
                label="Extractions today"
                index={0}
              />
              <StatItem
                icon={CheckCircle}
                value={`${stats.successRate}%`}
                label="Success rate"
                index={1}
              />
              <StatItem
                icon={Clock}
                value={stats.avgProcessingTime > 0 ? `${(stats.avgProcessingTime / 1000).toFixed(1)}s` : '-'}
                label="Avg processing time"
                index={2}
              />
              <StatItem
                icon={TrendingUp}
                value={stats.totalTokensProcessed > 1000000 
                  ? `${(stats.totalTokensProcessed / 1000000).toFixed(1)}M` 
                  : stats.totalTokensProcessed > 1000 
                    ? `${(stats.totalTokensProcessed / 1000).toFixed(0)}K`
                    : stats.totalTokensProcessed}
                label="Tokens processed"
                index={3}
              />
            </div>
            {/* Popular sites */}
            {stats.popularSites && stats.popularSites.length > 0 && (
              <div className="mt-8 pt-8 border-t border-neutral-800">
                <h4 className="text-sm font-medium text-neutral-400 mb-4">Most extracted sites</h4>
                <div className="flex flex-wrap gap-2">
                  {stats.popularSites.slice(0, 5).map((site, index) => (
                    <span
                      key={site.host}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 rounded-full text-sm text-neutral-300"
                    >
                      <span className="text-neutral-500">{index + 1}.</span>
                      {site.host}
                      <span className="text-neutral-500">({site.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Placeholder highlights when no stats available */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem
              icon={Globe}
              value="Any site"
              label="Works with any llms.txt site"
              index={0}
            />
            <StatItem
              icon={Zap}
              value="100%"
              label="Free to use"
              index={1}
            />
            <StatItem
              icon={TrendingUp}
              value="Open"
              label="Open Source"
              index={2}
            />
            <StatItem
              icon={CheckCircle}
              value="No login"
              label="No account required"
              index={3}
            />
          </div>
        )}
      </motion.div>
    </section>
  )
}
