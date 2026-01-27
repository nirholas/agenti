'use client'

import { useState, useCallback, useRef } from 'react'
import type { ExtractionProgress, ExtractionResult } from '@/types'

export function useExtraction() {
  const [progress, setProgress] = useState<ExtractionProgress>({
    status: 'idle',
    message: '',
    progress: 0,
    logs: [],
  })
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const addLog = useCallback((message: string) => {
    setProgress(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`],
    }))
  }, [])

  const updateProgress = useCallback((
    status: ExtractionProgress['status'],
    message: string,
    progressValue: number
  ) => {
    setProgress(prev => ({
      ...prev,
      status,
      message,
      progress: progressValue,
    }))
    addLog(message)
  }, [addLog])

  const fetchExtraction = useCallback(async (url: string) => {
    try {
      updateProgress('fetching', 'Fetching documentation...', 30)
      
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Extraction failed')
      }
      
      updateProgress('processing', 'Processing documents...', 70)
      
      const data = await response.json() as ExtractionResult
      setResult(data)
      
      updateProgress('complete', `Extraction complete! Found ${data.documents.length} documents.`, 100)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed'
      setError(errorMessage)
      setProgress(prev => ({ 
        ...prev, 
        status: 'error', 
        message: errorMessage,
        logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Error: ${errorMessage}`]
      }))
    }
  }, [updateProgress])

  const extract = useCallback(async (url: string) => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setError(null)
    setResult(null)
    setProgress({
      status: 'analyzing',
      message: 'Starting extraction...',
      progress: 0,
      logs: [],
    })

    addLog(`Starting extraction for ${url}`)
    updateProgress('analyzing', 'Analyzing URL...', 10)

    // Try SSE first for streaming progress, fall back to POST
    try {
      const eventSource = new EventSource(`/api/extract?url=${encodeURIComponent(url)}`)
      eventSourceRef.current = eventSource
      
      let hasReceivedData = false
      const timeoutId = setTimeout(() => {
        if (!hasReceivedData) {
          eventSource.close()
          eventSourceRef.current = null
          // Fall back to POST request
          fetchExtraction(url)
        }
      }, 5000) // 5 second timeout for SSE

      eventSource.onmessage = (event) => {
        hasReceivedData = true
        clearTimeout(timeoutId)
        
        try {
          const data = JSON.parse(event.data)
          
          if (data.status === 'complete' && data.result) {
            setResult(data.result)
            setProgress(prev => ({
              ...prev,
              status: 'complete',
              message: 'Extraction complete!',
              progress: 100,
              logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] Extraction complete!`],
            }))
            eventSource.close()
            eventSourceRef.current = null
          } else if (data.status === 'error') {
            setError(data.message || 'Extraction failed')
            setProgress(prev => ({ 
              ...prev, 
              status: 'error', 
              message: data.message || 'Extraction failed'
            }))
            eventSource.close()
            eventSourceRef.current = null
          } else {
            setProgress(prev => ({
              ...prev,
              status: data.status || prev.status,
              message: data.message || prev.message,
              progress: data.progress ?? prev.progress,
              logs: data.message 
                ? [...prev.logs, `[${new Date().toLocaleTimeString()}] ${data.message}`]
                : prev.logs,
            }))
          }
        } catch {
          // Ignore parse errors
        }
      }

      eventSource.onerror = () => {
        clearTimeout(timeoutId)
        eventSource.close()
        eventSourceRef.current = null
        
        if (!hasReceivedData) {
          // Fall back to POST request if SSE fails
          fetchExtraction(url)
        }
      }

    } catch {
      // EventSource not supported or failed, fall back to POST
      await fetchExtraction(url)
    }
  }, [addLog, updateProgress, fetchExtraction])

  const reset = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    setProgress({ status: 'idle', message: '', progress: 0, logs: [] })
    setResult(null)
    setError(null)
  }, [])

  return { progress, result, error, extract, reset }
}
