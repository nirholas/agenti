'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Layers, RefreshCw, Zap } from 'lucide-react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { BatchInput, BatchProgress, BatchResults } from '@/components/batch'
import type { BatchResult, BatchResponse } from '@/types'

type BatchState = 'input' | 'processing' | 'complete'

interface ProgressItem {
  url: string
  status: 'pending' | 'processing' | 'success' | 'error'
  error?: string
}

export default function BatchPage() {
  const [state, setState] = useState<BatchState>('input')
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([])
  const [results, setResults] = useState<BatchResult[]>([])
  const [stats, setStats] = useState<{ total: number; successful: number; failed: number; totalTokens: number }>({
    total: 0,
    successful: 0,
    failed: 0,
    totalTokens: 0,
  })
  const [startTime, setStartTime] = useState<number>(0)
  const [endTime, setEndTime] = useState<number>(0)

  const handleUrlsSubmit = useCallback(async (urls: string[]) => {
    setState('processing')
    setStartTime(Date.now())
    
    // Initialize progress items
    const initialItems: ProgressItem[] = urls.map(url => ({
      url,
      status: 'pending',
    }))
    setProgressItems(initialItems)

    try {
      // For simpler UX, we'll process all at once via the API
      // Update all to processing
      setProgressItems(urls.map(url => ({ url, status: 'processing' })))

      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Batch processing failed')
      }

      const data: BatchResponse = await response.json()
      
      // Update progress items with results
      const updatedItems: ProgressItem[] = data.results.map(result => ({
        url: result.url,
        status: result.success ? 'success' : 'error',
        error: result.error,
      }))
      
      setProgressItems(updatedItems)
      setResults(data.results)
      setStats(data.stats)
      setEndTime(Date.now())
      setState('complete')
      
    } catch (error) {
      console.error('Batch processing error:', error)
      
      // Mark all as failed
      setProgressItems(urls.map(url => ({
        url,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })))
      
      setEndTime(Date.now())
      setState('complete')
    }
  }, [])

  const handleReset = useCallback(() => {
    setState('input')
    setProgressItems([])
    setResults([])
    setStats({ total: 0, successful: 0, failed: 0, totalTokens: 0 })
    setStartTime(0)
    setEndTime(0)
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center">
              <Layers className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Batch Processing</h1>
              <p className="text-neutral-400">
                Extract documentation from multiple sites at once
              </p>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Input State */}
            {state === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-2xl border border-neutral-800 p-8 bg-neutral-900/50"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="w-5 h-5 text-white" />
                  <h2 className="text-lg font-semibold">Enter URLs</h2>
                </div>
                
                <BatchInput onUrlsSubmit={handleUrlsSubmit} />
                
                {/* Tips */}
                <div className="mt-6 p-4 bg-white/5 border border-neutral-700 rounded-xl">
                  <h3 className="text-sm font-medium text-white mb-2">Tips</h3>
                  <ul className="text-sm text-neutral-400 space-y-1">
                    <li>Enter one URL per line</li>
                    <li>You can paste up to 50 URLs at once</li>
                    <li>URLs will be processed in parallel for speed</li>
                    <li>Only sites with llms.txt support will succeed</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {/* Processing State */}
            {state === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-2xl border border-neutral-800 p-8 bg-neutral-900/50"
              >
                <div className="flex items-center gap-3 mb-6">
                  <RefreshCw className="w-5 h-5 text-white animate-spin" />
                  <h2 className="text-lg font-semibold">Processing URLs</h2>
                </div>
                
                <BatchProgress 
                  items={progressItems}
                  currentIndex={progressItems.findIndex(i => i.status === 'processing')}
                  startTime={startTime}
                />
              </motion.div>
            )}

            {/* Complete State */}
            {state === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <BatchResults 
                  results={results}
                  stats={stats}
                  processingTime={endTime - startTime}
                />
                
                {/* Reset Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-neutral-700 rounded-xl hover:border-neutral-500 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Process More URLs
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  )
}
