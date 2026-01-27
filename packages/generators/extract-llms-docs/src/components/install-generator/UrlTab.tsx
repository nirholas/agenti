'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Loader2, AlertCircle, CheckCircle2, Code, FileText, Link2, ExternalLink } from 'lucide-react'

interface DocsAnalysis {
  title: string
  description: string
  platform: string | null
  installCommands: Array<{
    command: string
    packageManager?: string
    label?: string
  }>
  prerequisites: string[]
  codeBlockCount: number
  sectionCount: number
  relatedUrls: Array<{
    url: string
    text: string
    type: string
  }>
}

interface UrlTabProps {
  onGenerated: (content: string) => void
}

export default function UrlTab({ onGenerated }: UrlTabProps) {
  const [url, setUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [analysis, setAnalysis] = useState<DocsAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a documentation URL')
      return
    }
    
    // Basic URL validation
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }
    
    try {
      new URL(normalizedUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }
    
    setIsAnalyzing(true)
    setError(null)
    setAnalysis(null)
    
    try {
      const params = new URLSearchParams({ url: normalizedUrl, type: 'docs' })
      const response = await fetch(`/api/generate-install?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }
      
      setAnalysis(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [url])
  
  const handleGenerate = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a documentation URL')
      return
    }
    
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }
    
    setIsGenerating(true)
    setError(null)
    
    try {
      const response = await fetch('/api/generate-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizedUrl,
          type: 'docs',
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Generation failed')
      }
      
      if (data.installMd) {
        onGenerated(data.installMd)
      } else {
        throw new Error('No install.md content returned')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }, [url, onGenerated])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (analysis) {
        handleGenerate()
      } else {
        handleAnalyze()
      }
    }
  }, [analysis, handleAnalyze, handleGenerate])
  
  const platformColors: Record<string, string> = {
    mintlify: 'bg-green-500/20 text-green-300',
    docusaurus: 'bg-green-500/20 text-green-300',
    gitbook: 'bg-blue-500/20 text-blue-300',
    readme: 'bg-purple-500/20 text-purple-300',
    vitepress: 'bg-emerald-500/20 text-emerald-300',
    mkdocs: 'bg-cyan-500/20 text-cyan-300',
    sphinx: 'bg-orange-500/20 text-orange-300',
    nextra: 'bg-indigo-500/20 text-indigo-300',
  }
  
  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div>
        <label htmlFor="docs-url" className="block text-sm font-medium text-neutral-300 mb-2">
          Documentation URL
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              id="docs-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setAnalysis(null)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="docs.example.com/getting-started"
              className="w-full pl-10 pr-4 py-3 bg-black border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white transition-colors"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !url.trim()}
            className="px-4 py-3 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze'
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Enter any documentation page URL - we'll extract installation instructions
        </p>
      </div>
      
      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Analysis Results */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-4 bg-white/5 border border-neutral-700 rounded-xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <h3 className="font-semibold text-white">{analysis.title}</h3>
                  {analysis.description && (
                    <p className="text-sm text-neutral-400 mt-0.5 line-clamp-2">
                      {analysis.description}
                    </p>
                  )}
                </div>
              </div>
              <a
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            
            {/* Stats Row */}
            <div className="flex flex-wrap gap-4 text-sm">
              {analysis.platform && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${platformColors[analysis.platform] || 'bg-neutral-500/20 text-neutral-300'}`}>
                  {analysis.platform}
                </span>
              )}
              <div className="flex items-center gap-1.5 text-neutral-400">
                <Code className="w-4 h-4" />
                {analysis.codeBlockCount} code blocks
              </div>
              <div className="flex items-center gap-1.5 text-neutral-400">
                <FileText className="w-4 h-4" />
                {analysis.sectionCount} sections
              </div>
            </div>
            
            {/* Prerequisites */}
            {analysis.prerequisites.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-neutral-300 mb-2">
                  Prerequisites Detected
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.prerequisites.map((prereq, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded"
                    >
                      {prereq}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Install Commands */}
            {analysis.installCommands.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-neutral-300 mb-2">
                  Install Commands Found
                </h4>
                <div className="space-y-2">
                  {analysis.installCommands.slice(0, 5).map((cmd, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      {cmd.packageManager && (
                        <span className="text-neutral-500 text-xs min-w-[60px]">
                          {cmd.packageManager}
                        </span>
                      )}
                      <code className="px-2 py-0.5 bg-black rounded text-green-400 font-mono text-xs flex-1 overflow-x-auto">
                        {cmd.command}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Related URLs */}
            {analysis.relatedUrls.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-neutral-300 mb-2">
                  Related Documentation
                </h4>
                <div className="space-y-1">
                  {analysis.relatedUrls.slice(0, 4).map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      <Link2 className="w-3 h-3" />
                      <span className="truncate">{link.text}</span>
                      <span className="text-xs text-neutral-600">({link.type})</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating install.md with AI...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate install.md
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Instructions when no analysis */}
      {!analysis && !error && !isAnalyzing && (
        <div className="text-center py-8 text-neutral-500">
          <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">
            Enter any documentation URL to analyze and generate install.md
          </p>
          <p className="text-xs mt-2 text-neutral-600">
            Works with Mintlify, Docusaurus, GitBook, ReadMe, and more
          </p>
        </div>
      )}
    </div>
  )
}
