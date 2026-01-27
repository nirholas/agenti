'use client'

import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'

interface ProgressItem {
  url: string
  status: 'pending' | 'processing' | 'success' | 'error'
  error?: string
}

interface BatchProgressProps {
  items: ProgressItem[]
  currentIndex: number
  startTime?: number
}

export default function BatchProgress({ items, currentIndex, startTime }: BatchProgressProps) {
  const completedCount = items.filter(i => i.status === 'success' || i.status === 'error').length
  const successCount = items.filter(i => i.status === 'success').length
  const errorCount = items.filter(i => i.status === 'error').length
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0
  
  const elapsedTime = startTime ? Math.round((Date.now() - startTime) / 1000) : 0

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">
            Processing {completedCount} of {items.length} URLs
          </span>
          <div className="flex items-center gap-4 text-neutral-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {elapsedTime}s
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
        
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-white rounded-full"
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl text-center">
          <div className="text-2xl font-bold text-white mb-1">{items.length}</div>
          <div className="text-xs text-neutral-500">Total</div>
        </div>
        <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl text-center">
          <div className="text-2xl font-bold text-white mb-1">{successCount}</div>
          <div className="text-xs text-neutral-500">Success</div>
        </div>
        <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl text-center">
          <div className="text-2xl font-bold text-white mb-1">{errorCount}</div>
          <div className="text-xs text-neutral-500">Failed</div>
        </div>
      </div>

      {/* Item List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((item, index) => (
          <motion.div
            key={item.url}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              item.status === 'processing'
                ? 'bg-white/5 border-white/20'
                : item.status === 'success'
                ? 'bg-neutral-900/30 border-neutral-800'
                : item.status === 'error'
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-neutral-900/30 border-neutral-800'
            }`}
          >
            {/* Status Icon */}
            <div className="flex-shrink-0">
              {item.status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-neutral-600" />
              )}
              {item.status === 'processing' && (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              )}
              {item.status === 'success' && (
                <CheckCircle2 className="w-5 h-5 text-white" />
              )}
              {item.status === 'error' && (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>

            {/* URL */}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm text-white truncate">{item.url}</div>
              {item.error && (
                <div className="text-xs text-red-400 truncate mt-0.5">{item.error}</div>
              )}
            </div>

            {/* Index */}
            <div className="flex-shrink-0 text-xs text-neutral-500 font-mono">
              #{index + 1}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
