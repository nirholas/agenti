'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight, AlertCircle, X } from 'lucide-react'

interface UrlInputProps {
  onSubmit: (url: string) => void
}

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string.startsWith('http') ? string : `https://${string}`)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export default function UrlInput({ onSubmit }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmedUrl = url.trim()
    
    if (!trimmedUrl) {
      setError('Please enter a URL')
      return
    }
    
    if (!isValidUrl(trimmedUrl)) {
      setError('Please enter a valid URL (e.g., docs.example.com)')
      return
    }
    
    setError(null)
    onSubmit(trimmedUrl)
  }, [url, onSubmit])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    if (error) setError(null)
  }, [error])

  const handleClear = useCallback(() => {
    setUrl('')
    setError(null)
  }, [])

  return (
    <div className="relative">
      {/* Glow effect */}
      <div 
        className={`absolute -inset-2 bg-white/10 rounded-2xl blur-xl transition-opacity duration-500 ${isFocused ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
      
      <form onSubmit={handleSubmit} className="relative">
        {/* Mobile-first layout: stacked on small screens, inline on larger */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 relative">
          {/* Input container */}
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search className="w-5 h-5 text-neutral-500" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={url}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter any domain (e.g., stripe.com, lighter.xyz)"
              aria-label="Website URL"
              aria-describedby={error ? 'url-error' : undefined}
              aria-invalid={error ? 'true' : 'false'}
              className={`w-full pl-12 pr-10 sm:pr-32 py-4 bg-black border rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 transition-all text-base sm:text-lg min-h-[56px] ${
                error 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                  : 'border-neutral-700 focus:border-neutral-500 focus:ring-white/10'
              }`}
            />
            {/* Clear button */}
            {url && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 sm:right-28 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-white transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Desktop submit button (inside input) */}
            <button
              type="submit"
              disabled={!url.trim()}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-white rounded-lg font-semibold text-black items-center gap-2 hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/50 min-h-[44px]"
            >
              Extract
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          
          {/* Mobile submit button (separate, full width) */}
          <button
            type="submit"
            disabled={!url.trim()}
            className="sm:hidden flex items-center justify-center gap-2 w-full px-6 py-4 bg-white rounded-xl font-semibold text-black hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/50 min-h-[56px] text-base"
          >
            Extract Documentation
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        
        {/* Error message with animation */}
        <AnimatePresence>
          {error && (
            <motion.div
              id="url-error"
              role="alert"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="absolute -bottom-8 sm:-bottom-7 left-0 right-0 sm:right-auto flex items-center gap-1.5 text-red-400 text-sm px-1"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  )
}
