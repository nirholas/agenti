'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Loader2, AlertCircle, CheckCircle2, Package, Terminal, Star, GitBranch, ExternalLink } from 'lucide-react'

interface GitHubAnalysis {
  owner: string
  repo: string
  description: string
  language: string | null
  projectType: string
  hasCli: boolean
  installMethods: Array<{
    method: string
    command: string
    packageManager?: string
  }>
  latestVersion?: string
  stars: number
  topics: string[]
  homepage: string | null
}

interface GitHubTabProps {
  onGenerated: (content: string) => void
}

export default function GitHubTab({ onGenerated }: GitHubTabProps) {
  const [url, setUrl] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [analysis, setAnalysis] = useState<GitHubAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a GitHub URL')
      return
    }
    
    setIsAnalyzing(true)
    setError(null)
    setAnalysis(null)
    
    try {
      const params = new URLSearchParams({ url: url.trim(), type: 'github' })
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
      setError('Please enter a GitHub URL')
      return
    }
    
    setIsGenerating(true)
    setError(null)
    
    try {
      const response = await fetch('/api/generate-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          type: 'github',
          githubToken: githubToken.trim() || undefined,
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
  }, [url, githubToken, onGenerated])
  
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
  
  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div>
        <label htmlFor="github-url" className="block text-sm font-medium text-neutral-300 mb-2">
          GitHub Repository URL
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              id="github-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setAnalysis(null)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="github.com/owner/repo or owner/repo"
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
          Supports: github.com/owner/repo, owner/repo, or full GitHub URLs
        </p>
      </div>
      
      {/* Optional GitHub Token */}
      <div>
        <button
          onClick={() => setShowToken(!showToken)}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          {showToken ? '− Hide' : '+ Add'} GitHub token (optional, for private repos)
        </button>
        
        <AnimatePresence>
          {showToken && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full px-4 py-2 bg-black border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white transition-colors text-sm"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Token is sent securely and not stored. Needed for private repos or to avoid rate limits.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
                  <h3 className="font-semibold text-white">
                    {analysis.owner}/{analysis.repo}
                  </h3>
                  {analysis.description && (
                    <p className="text-sm text-neutral-400 mt-0.5">{analysis.description}</p>
                  )}
                </div>
              </div>
              {analysis.homepage && (
                <a
                  href={analysis.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            
            {/* Stats Row */}
            <div className="flex flex-wrap gap-4 text-sm">
              {analysis.language && (
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  {analysis.language}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-neutral-400">
                <Star className="w-4 h-4" />
                {analysis.stars.toLocaleString()}
              </div>
              {analysis.latestVersion && (
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <GitBranch className="w-4 h-4" />
                  {analysis.latestVersion}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-neutral-400">
                <Package className="w-4 h-4" />
                {analysis.projectType}
              </div>
              {analysis.hasCli && (
                <div className="flex items-center gap-1.5 text-green-400">
                  <Terminal className="w-4 h-4" />
                  CLI
                </div>
              )}
            </div>
            
            {/* Topics */}
            {analysis.topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {analysis.topics.slice(0, 8).map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
            
            {/* Install Methods */}
            {analysis.installMethods.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-neutral-300 mb-2">
                  Detected Install Methods
                </h4>
                <div className="space-y-2">
                  {analysis.installMethods.slice(0, 4).map((method, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-neutral-500">{method.method}:</span>
                      <code className="px-2 py-0.5 bg-black rounded text-green-400 font-mono text-xs">
                        {method.command}
                      </code>
                    </div>
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
                  <Terminal className="w-4 h-4" />
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
          <Github className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">
            Enter a GitHub repository URL to analyze and generate install.md
          </p>
          <p className="text-xs mt-2 text-neutral-600">
            We'll extract README, package.json, workflows, and releases
          </p>
        </div>
      )}
    </div>
  )
}
