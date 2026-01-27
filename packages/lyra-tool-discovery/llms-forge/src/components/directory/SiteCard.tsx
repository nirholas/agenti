'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Zap, CheckCircle, AlertCircle, Brain, Code, BookOpen, Cloud, Layers } from 'lucide-react'
import Link from 'next/link'
import { SiteEntry } from '@/data/sites'

const CATEGORY_ICONS = {
  ai: Brain,
  'developer-tools': Code,
  documentation: BookOpen,
  cloud: Cloud,
  other: Layers,
}

const CATEGORY_COLORS = {
  ai: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'developer-tools': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  documentation: 'bg-green-500/10 text-green-400 border-green-500/20',
  cloud: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  other: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
}

interface SiteCardProps {
  site: SiteEntry
  index: number
}

export default function SiteCard({ site, index }: SiteCardProps) {
  const CategoryIcon = CATEGORY_ICONS[site.category]
  const categoryColor = CATEGORY_COLORS[site.category]

  const extractUrl = `/extract?url=${encodeURIComponent(site.url)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 hover:bg-neutral-900 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Favicon placeholder */}
          <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center">
            {site.favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.favicon} alt="" className="w-6 h-6" />
            ) : (
              <span className="text-lg font-bold text-white">
                {site.name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-white/90 transition-colors">
              {site.name}
            </h3>
            <span className="text-xs text-neutral-500">{new URL(site.url).hostname}</span>
          </div>
        </div>
        {/* Verified badge */}
        {site.verified ? (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Verified</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Unverified</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-neutral-400 mb-4 line-clamp-2">
        {site.description}
      </p>

      {/* Category badge */}
      <div className="flex items-center justify-between mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${categoryColor}`}
        >
          <CategoryIcon className="w-3 h-3" />
          {site.category === 'developer-tools' ? 'Dev Tools' : site.category.charAt(0).toUpperCase() + site.category.slice(1)}
        </span>
        <span className="text-xs text-neutral-600">
          {site.llmsTxtType === 'full' ? 'Full llms.txt' : 'Standard'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link
          href={extractUrl}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <Zap className="w-4 h-4" />
          Extract
        </Link>
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center p-2.5 bg-neutral-800 text-neutral-400 rounded-lg hover:bg-neutral-700 hover:text-white transition-colors"
          title="Visit site"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </motion.div>
  )
}
