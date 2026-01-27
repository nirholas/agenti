'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Download, CheckCircle2, XCircle, Archive, 
  ExternalLink, FileText, Hash, Clock
} from 'lucide-react'
import type { BatchResult, ExportFormat } from '@/types'
import { exportToFormat, getFilenameForFormat, EXPORT_FORMATS } from '@/lib/exporters'
import JSZip from 'jszip'

interface BatchResultsProps {
  results: BatchResult[]
  stats: {
    total: number
    successful: number
    failed: number
    totalTokens: number
  }
  processingTime: number
}

export default function BatchResults({ results, stats, processingTime }: BatchResultsProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown')
  const [downloading, setDownloading] = useState<string | null>(null)

  const successfulResults = results.filter(r => r.success && r.data)

  const downloadSingle = async (result: BatchResult) => {
    if (!result.data) return
    
    setDownloading(result.url)
    
    try {
      const content = exportToFormat(result.data, exportFormat)
      const siteName = new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`).hostname.replace('www.', '').split('.')[0]
      const filename = getFilenameForFormat(siteName, exportFormat)
      
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  const downloadAllAsZip = async () => {
    setDownloading('all')
    
    try {
      const zip = new JSZip()
      const folder = zip.folder('batch-extraction')
      
      if (!folder) throw new Error('Failed to create ZIP folder')
      
      for (const result of successfulResults) {
        if (!result.data) continue
        
        const siteName = new URL(
          result.url.startsWith('http') ? result.url : `https://${result.url}`
        ).hostname.replace('www.', '').split('.')[0]
        
        const content = exportToFormat(result.data, exportFormat)
        const filename = getFilenameForFormat(siteName, exportFormat)
        
        folder.file(filename, content)
      }
      
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch-docs-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Batch Complete</h2>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Clock className="w-4 h-4" />
            {(processingTime / 1000).toFixed(1)}s total
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-black/50 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">Total URLs</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">{stats.total}</div>
          </div>
          
          <div className="p-4 bg-black/50 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span className="text-xs text-neutral-500">Successful</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">{stats.successful}</div>
          </div>
          
          <div className="p-4 bg-black/50 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-neutral-500">Failed</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">{stats.failed}</div>
          </div>
          
          <div className="p-4 bg-black/50 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">Total Tokens</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats.totalTokens.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Download Section */}
      {successfulResults.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Download Results</h3>
            
            {/* Format Selector */}
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="px-3 py-2 bg-black border border-neutral-700 rounded-lg text-sm text-white focus:border-neutral-500 focus:outline-none"
            >
              {EXPORT_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label} ({format.extension})
                </option>
              ))}
            </select>
          </div>

          {/* Download All Button */}
          <button
            onClick={downloadAllAsZip}
            disabled={downloading === 'all'}
            className="w-full mb-4 flex items-center justify-between p-4 bg-white text-black rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <Archive className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">
                  {downloading === 'all' ? 'Creating ZIP...' : 'Download All (ZIP)'}
                </div>
                <div className="text-sm opacity-70">
                  {successfulResults.length} files as {exportFormat.toUpperCase()}
                </div>
              </div>
            </div>
            <Download className="w-5 h-5" />
          </button>

          {/* Individual Results */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.map((result, index) => (
              <motion.div
                key={result.url}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  result.success
                    ? 'bg-black/50 border-neutral-800 hover:border-neutral-600'
                    : 'bg-red-500/5 border-red-500/20'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-white truncate">{result.url}</div>
                    {result.error && (
                      <div className="text-xs text-red-400 truncate">{result.error}</div>
                    )}
                    {result.data && (
                      <div className="text-xs text-neutral-500">
                        {result.data.stats.documentCount} sections • {result.data.stats.totalTokens.toLocaleString()} tokens
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {result.success && result.data && (
                    <button
                      onClick={() => downloadSingle(result)}
                      disabled={downloading === result.url}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                      aria-label={`Download ${result.url}`}
                    >
                      <Download className="w-4 h-4 text-neutral-400 hover:text-white" />
                    </button>
                  )}
                  
                  <a
                    href={result.url.startsWith('http') ? result.url : `https://${result.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label={`Visit ${result.url}`}
                  >
                    <ExternalLink className="w-4 h-4 text-neutral-400 hover:text-white" />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
