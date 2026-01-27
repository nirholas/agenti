'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ExternalLink, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Brain, 
  Code, 
  BookOpen, 
  Cloud, 
  Layers,
  Loader2,
  WifiOff,
  Clock,
  FileText,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { SiteEntry, VerificationResult } from '@/data/sites'

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
  verification?: VerificationResult | null
  onVerify?: (siteId: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function StatusIndicator({ verification, isChecking }: { verification?: VerificationResult | null; isChecking?: boolean }) {
  if (isChecking) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Checking...</span>
      </div>
    )
  }

  if (!verification) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Clock className="w-3.5 h-3.5" />
        <span>Not checked</span>
      </div>
    )
  }

  switch (verification.status) {
    case 'online':
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-400" title={`Checked ${formatRelativeTime(verification.checkedAt)}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span>Online</span>
        </div>
      )
    case 'offline':
      return (
        <div className="flex items-center gap-1.5 text-xs text-red-400" title={verification.error || 'llms.txt not found'}>
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline</span>
        </div>
      )
    case 'error':
      return (
        <div className="flex items-center gap-1.5 text-xs text-yellow-400" title={verification.error}>
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Error</span>
        </div>
      )
    default:
      return (
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Unknown</span>
        </div>
      )
  }
}

export default function SiteCard({ site, index, verification: initialVerification, onVerify }: SiteCardProps) {
  const [verification, setVerification] = useState<VerificationResult | null>(initialVerification || null)
  const [isChecking, setIsChecking] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const CategoryIcon = CATEGORY_ICONS[site.category]
  const categoryColor = CATEGORY_COLORS[site.category]

  // Use llmsTxtUrl for extraction if available
  const extractBaseUrl = site.llmsTxtUrl || site.url
  const extractUrl = `/extract?url=${encodeURIComponent(extractBaseUrl)}`

  // Verify on mount if not already verified
  useEffect(() => {
    if (!verification && !isChecking) {
      handleVerify()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerify = async () => {
    setIsChecking(true)
    try {
      const response = await fetch(`/api/sites/verify?id=${site.id}`)
      if (response.ok) {
        const result = await response.json()
        setVerification(result)
      }
    } catch (error) {
      console.error('Verification failed:', error)
    } finally {
      setIsChecking(false)
    }
    onVerify?.(site.id)
  }

  const llmsInfo = verification?.llmsFullTxt || verification?.llmsTxt
  const hasInstallMd = verification?.installMd?.exists || site.hasInstallMd

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="group relative bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 hover:bg-neutral-900 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Favicon */}
          <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden">
            {/* Use Google's favicon service */}
            <img 
              src={`https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=64`}
              alt=""
              className="w-6 h-6"
              onError={(e) => {
                // Fallback to first letter
                e.currentTarget.style.display = 'none'
                e.currentTarget.parentElement!.innerHTML = `<span class="text-lg font-bold text-white">${site.name.charAt(0)}</span>`
              }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-white/90 transition-colors">
              {site.name}
            </h3>
            <span className="text-xs text-neutral-500">{new URL(site.url).hostname}</span>
          </div>
        </div>
        
        {/* Live Status */}
        <div className="flex items-center gap-2">
          <StatusIndicator verification={verification} isChecking={isChecking} />
          <button
            onClick={handleVerify}
            disabled={isChecking}
            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
            title="Re-check status"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-neutral-400 mb-3 line-clamp-2">
        {site.description}
      </p>

      {/* File info (when verified) */}
      {verification?.status === 'online' && llmsInfo && (
        <div 
          className="flex items-center gap-3 mb-3 text-xs text-neutral-500 cursor-pointer hover:text-neutral-400"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {llmsInfo.type === 'full' ? 'Full' : 'Standard'}
          </span>
          {llmsInfo.size && (
            <span>{formatBytes(llmsInfo.size)}</span>
          )}
          {verification.responseTime && (
            <span>{verification.responseTime}ms</span>
          )}
          {hasInstallMd && (
            <span className="text-blue-400">+ install.md</span>
          )}
        </div>
      )}

      {/* Expanded details */}
      {showDetails && verification?.status === 'online' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-3 p-2 bg-neutral-800/50 rounded-lg text-xs text-neutral-400 space-y-1"
        >
          {llmsInfo?.url && (
            <p className="truncate">
              <span className="text-neutral-500">URL:</span>{' '}
              <a href={llmsInfo.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                {llmsInfo.url}
              </a>
            </p>
          )}
          {verification.checkedAt && (
            <p>
              <span className="text-neutral-500">Checked:</span> {formatRelativeTime(verification.checkedAt)}
            </p>
          )}
        </motion.div>
      )}

      {/* Category and type badges */}
      <div className="flex items-center justify-between mb-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${categoryColor}`}
        >
          <CategoryIcon className="w-3 h-3" />
          {site.category === 'developer-tools' ? 'Dev Tools' : site.category.charAt(0).toUpperCase() + site.category.slice(1)}
        </span>
        <span className="text-xs text-neutral-600">
          {(llmsInfo?.type || site.llmsTxtType) === 'full' ? 'Full llms.txt' : 'Standard'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link
          href={extractUrl}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            verification?.status === 'online'
              ? 'bg-white text-black hover:bg-neutral-200'
              : verification?.status === 'offline'
              ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
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
