'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Link2, X, AlertCircle } from 'lucide-react'

interface BatchInputProps {
  onUrlsSubmit: (urls: string[]) => void
  disabled?: boolean
}

export default function BatchInput({ onUrlsSubmit, disabled }: BatchInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseUrls = useCallback((text: string): string[] => {
    return text
      .split(/[\n,;]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0)
  }, [])

  const validateUrls = useCallback((urls: string[]): { valid: string[]; invalid: string[] } => {
    const valid: string[] = []
    const invalid: string[] = []

    for (const url of urls) {
      try {
        let normalizedUrl = url
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          normalizedUrl = `https://${normalizedUrl}`
        }
        new URL(normalizedUrl)
        valid.push(url)
      } catch {
        invalid.push(url)
      }
    }

    return { valid, invalid }
  }, [])

  const handleSubmit = useCallback(() => {
    const urls = parseUrls(inputValue)
    
    if (urls.length === 0) {
      setErrors(['Please enter at least one URL'])
      return
    }

    const { valid, invalid } = validateUrls(urls)

    if (invalid.length > 0) {
      setErrors(invalid.map(url => `Invalid URL: ${url}`))
    } else {
      setErrors([])
    }

    if (valid.length > 0) {
      onUrlsSubmit(valid)
    }
  }, [inputValue, parseUrls, validateUrls, onUrlsSubmit])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setInputValue(text)
      setErrors([])
    }
    reader.onerror = () => {
      setErrors(['Failed to read file'])
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleClear = useCallback(() => {
    setInputValue('')
    setErrors([])
  }, [])

  const urlCount = parseUrls(inputValue).length

  return (
    <div className="space-y-4">
      {/* Input Area */}
      <div className="relative">
        <textarea
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setErrors([])
          }}
          placeholder="Enter URLs, one per line:&#10;docs.anthropic.com&#10;docs.stripe.com&#10;api.openai.com"
          disabled={disabled}
          className="w-full h-48 p-4 bg-black border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:border-neutral-500 focus:outline-none font-mono text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        {inputValue && (
          <button
            onClick={handleClear}
            disabled={disabled}
            className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Clear input"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* File Upload */}
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv"
          onChange={handleFileUpload}
          disabled={disabled}
          className="hidden"
          id="url-file-input"
        />
        <label
          htmlFor="url-file-input"
          className={`flex items-center gap-2 px-4 py-2 text-sm border border-neutral-700 rounded-lg cursor-pointer transition-colors ${
            disabled 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:border-neutral-500 hover:bg-white/5'
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload .txt file
        </label>
        
        <span className="text-sm text-neutral-500">
          or paste URLs directly (one per line)
        </span>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-red-400">{error}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Link2 className="w-4 h-4" />
          <span>
            {urlCount === 0 
              ? 'No URLs entered'
              : `${urlCount} URL${urlCount === 1 ? '' : 's'} ready`
            }
          </span>
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={disabled || urlCount === 0}
          className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Batch Extraction
        </button>
      </div>
    </div>
  )
}
