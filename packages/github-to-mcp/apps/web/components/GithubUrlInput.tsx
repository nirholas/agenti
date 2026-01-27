'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight, AlertCircle, X, Loader2, GitBranch, CheckCircle2, Lightbulb } from 'lucide-react'
import BranchSelector, { type GitRef } from './BranchSelector'

interface GithubUrlInputProps {
  onSubmit: (url: string, ref?: GitRef | null) => void
  disabled?: boolean
  initialValue?: string
  showBranchSelector?: boolean
}

interface ValidationResult {
  isValid: boolean
  error?: string
  suggestion?: string
  correctedUrl?: string
  hint?: string
}

/**
 * Comprehensive GitHub URL validation with auto-correction and helpful suggestions
 */
function validateGithubUrl(input: string): ValidationResult {
  const trimmed = input.trim()
  
  // Empty check
  if (!trimmed) {
    return { 
      isValid: false, 
      error: 'Please enter a GitHub URL',
      hint: 'Example: github.com/facebook/react'
    }
  }

  // Check for common non-GitHub URLs and provide specific guidance
  const nonGithubPatterns = [
    { pattern: /gitlab\.com/i, name: 'GitLab', suggestion: 'This tool only supports GitHub repositories. GitLab support coming soon!' },
    { pattern: /bitbucket\.org/i, name: 'Bitbucket', suggestion: 'This tool only supports GitHub repositories.' },
    { pattern: /npmjs\.com|npm\.im/i, name: 'npm', suggestion: 'Try entering the GitHub repository URL instead. Check the npm page for the repo link.' },
    { pattern: /pypi\.org/i, name: 'PyPI', suggestion: 'Try entering the GitHub repository URL instead. Check the PyPI page for the repo link.' },
    { pattern: /stackoverflow\.com|stackexchange\.com/i, name: 'Stack Overflow', suggestion: 'Please enter a GitHub repository URL, not a Q&A link.' },
    { pattern: /google\.com|bing\.com|duckduckgo\.com/i, name: 'Search engine', suggestion: 'Please enter a GitHub repository URL directly.' },
    { pattern: /youtube\.com|youtu\.be/i, name: 'YouTube', suggestion: 'Please enter a GitHub repository URL, not a video link.' },
    { pattern: /twitter\.com|x\.com/i, name: 'Twitter/X', suggestion: 'Please enter a GitHub repository URL, not a social media link.' },
    { pattern: /medium\.com|dev\.to/i, name: 'Blog', suggestion: 'Please enter a GitHub repository URL, not a blog post.' },
  ]

  for (const { pattern, name, suggestion } of nonGithubPatterns) {
    if (pattern.test(trimmed)) {
      return { 
        isValid: false, 
        error: `This looks like a ${name} URL`,
        suggestion,
        hint: 'Example: github.com/owner/repo'
      }
    }
  }

  // Try to normalize and parse the URL
  let normalizedUrl = trimmed
  
  // Auto-correct common mistakes
  const corrections: Array<{ pattern: RegExp; replacement: string; description: string }> = [
    // Fix github.com typos
    { pattern: /^(https?:\/\/)?(www\.)?githib\.com/i, replacement: 'https://github.com', description: 'Fixed typo: githib → github' },
    { pattern: /^(https?:\/\/)?(www\.)?gihub\.com/i, replacement: 'https://github.com', description: 'Fixed typo: gihub → github' },
    { pattern: /^(https?:\/\/)?(www\.)?guthub\.com/i, replacement: 'https://github.com', description: 'Fixed typo: guthub → github' },
    { pattern: /^(https?:\/\/)?(www\.)?githuub\.com/i, replacement: 'https://github.com', description: 'Fixed typo: githuub → github' },
    // Remove trailing .git
    { pattern: /\.git\/?$/i, replacement: '', description: 'Removed .git suffix' },
    // Fix double slashes (except after protocol)
    { pattern: /([^:])\/\//g, replacement: '$1/', description: 'Fixed double slashes' },
  ]

  let wasAutoCorreted = false
  let correctionDescription = ''
  
  for (const { pattern, replacement, description } of corrections) {
    if (pattern.test(normalizedUrl)) {
      normalizedUrl = normalizedUrl.replace(pattern, replacement)
      wasAutoCorreted = true
      correctionDescription = description
    }
  }

  // Add https:// if missing
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  // Try to parse as URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(normalizedUrl)
  } catch {
    return { 
      isValid: false, 
      error: 'Invalid URL format',
      hint: 'Try: github.com/owner/repo'
    }
  }

  // Check hostname
  const validHostnames = ['github.com', 'www.github.com']
  if (!validHostnames.includes(parsedUrl.hostname.toLowerCase())) {
    // Check if it might be a raw GitHub content URL
    if (parsedUrl.hostname === 'raw.githubusercontent.com') {
      const parts = parsedUrl.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        const correctedUrl = `https://github.com/${parts[0]}/${parts[1]}`
        return {
          isValid: false,
          error: 'This is a raw content URL',
          suggestion: 'Use the repository URL instead',
          correctedUrl,
          hint: `Did you mean: ${correctedUrl}?`
        }
      }
    }
    
    // Check for gist URLs
    if (parsedUrl.hostname === 'gist.github.com') {
      return {
        isValid: false,
        error: 'Gist URLs are not supported',
        suggestion: 'Please enter a GitHub repository URL, not a Gist.',
        hint: 'Example: github.com/owner/repo'
      }
    }

    return { 
      isValid: false, 
      error: 'Not a GitHub URL',
      suggestion: 'Enter a URL starting with github.com',
      hint: 'Example: github.com/owner/repo'
    }
  }

  // Parse path parts
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean)
  
  // Check for owner/repo pattern
  if (pathParts.length === 0) {
    return { 
      isValid: false, 
      error: 'Missing repository path',
      suggestion: 'Add the owner and repository name',
      hint: 'Format: github.com/owner/repo'
    }
  }

  if (pathParts.length === 1) {
    // Only owner provided
    return { 
      isValid: false, 
      error: 'Missing repository name',
      suggestion: `Add the repository name after ${pathParts[0]}`,
      hint: `Example: github.com/${pathParts[0]}/repository-name`
    }
  }

  const owner = pathParts[0]
  let repo = pathParts[1]

  // Validate owner format (GitHub usernames: alphanumeric and hyphens, can't start/end with hyphen)
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(owner) || owner.length > 39) {
    return { 
      isValid: false, 
      error: 'Invalid owner/organization name',
      hint: 'Owner names can only contain letters, numbers, and hyphens'
    }
  }

  // Validate repo format (can contain letters, numbers, hyphens, underscores, dots)
  // Remove any extra path parts (like /tree/main)
  repo = repo.replace(/\.git$/, '')
  if (!/^[a-zA-Z0-9._-]+$/.test(repo) || repo.length > 100) {
    return { 
      isValid: false, 
      error: 'Invalid repository name',
      hint: 'Repository names can only contain letters, numbers, dots, hyphens, and underscores'
    }
  }

  // Build the canonical URL
  const canonicalUrl = `https://github.com/${owner}/${repo}`

  // Success!
  if (wasAutoCorreted) {
    return {
      isValid: true,
      correctedUrl: canonicalUrl,
      suggestion: correctionDescription
    }
  }

  return { isValid: true, correctedUrl: canonicalUrl }
}

function parseGithubUrl(urlString: string): { owner: string; repo: string } | null {
  const result = validateGithubUrl(urlString)
  if (!result.isValid || !result.correctedUrl) return null
  
  try {
    const url = new URL(result.correctedUrl)
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts.length >= 2) {
      return { owner: pathParts[0], repo: pathParts[1].replace(/\.git$/, '') }
    }
  } catch {
    // ignore
  }
  return null
}

export default function GithubUrlInput({ onSubmit, disabled = false, initialValue = '', showBranchSelector = false }: GithubUrlInputProps) {
  const [url, setUrl] = useState(initialValue)
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [correctedUrl, setCorrectedUrl] = useState<string | null>(null)
  const [selectedRef, setSelectedRef] = useState<GitRef | null>(null)

  // Parse owner/repo from URL for BranchSelector
  const repoInfo = useMemo(() => parseGithubUrl(url), [url])

  // Live validation as user types (debounced feel with useMemo)
  const liveValidation = useMemo(() => {
    if (!url.trim()) return null
    return validateGithubUrl(url)
  }, [url])

  // Update url when initialValue changes
  useEffect(() => {
    if (initialValue) {
      setUrl(initialValue)
    }
  }, [initialValue])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    
    const validation = validateGithubUrl(url)
    
    if (!validation.isValid) {
      setError(validation.error || 'Invalid URL')
      setSuggestion(validation.suggestion || null)
      setHint(validation.hint || null)
      setCorrectedUrl(validation.correctedUrl || null)
      return
    }
    
    // Clear errors and submit with the corrected URL
    setError(null)
    setSuggestion(null)
    setHint(null)
    setCorrectedUrl(null)
    onSubmit(validation.correctedUrl || url.trim(), selectedRef)
  }, [url, onSubmit, selectedRef])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
    // Clear errors on change
    if (error) {
      setError(null)
      setSuggestion(null)
      setHint(null)
      setCorrectedUrl(null)
    }
  }, [error])

  const handleClear = useCallback(() => {
    setUrl('')
    setError(null)
    setSuggestion(null)
    setHint(null)
    setCorrectedUrl(null)
    setSelectedRef(null)
  }, [])

  const handleUseCorrectedUrl = useCallback(() => {
    if (correctedUrl) {
      setUrl(correctedUrl)
      setError(null)
      setSuggestion(null)
      setHint(null)
      setCorrectedUrl(null)
    }
  }, [correctedUrl])

  // Show valid indicator
  const showValidIndicator = liveValidation?.isValid && url.trim().length > 0

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
              placeholder="Enter GitHub repo URL (e.g., github.com/owner/repo)"
              aria-label="GitHub Repository URL"
              aria-describedby={error ? 'url-error' : undefined}
              aria-invalid={error ? 'true' : 'false'}
              disabled={disabled}
              className={`w-full pl-12 pr-12 sm:pr-36 py-4 bg-black border rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 transition-all text-base sm:text-lg min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed ${
                error 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                  : showValidIndicator
                    ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                    : 'border-neutral-700 focus:border-neutral-500 focus:ring-white/10'
              }`}
            />
            {/* Valid indicator / Clear button container */}
            <div className="absolute right-3 sm:right-28 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* Valid indicator */}
              {showValidIndicator && !error && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="p-1 text-green-500"
                  title="Valid GitHub URL"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </motion.div>
              )}
              {/* Clear button */}
              {url && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-white/20"
                  aria-label="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Desktop submit button (inside input) */}
            <button
              type="submit"
              disabled={!url.trim() || disabled}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-white rounded-lg font-semibold text-black items-center gap-2 hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/50 min-h-[44px]"
            >
              {disabled ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Converting...
                </>
              ) : (
                <>
                  Convert
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
          
          {/* Mobile submit button (separate, full width) */}
          <button
            type="submit"
            disabled={!url.trim() || disabled}
            className="sm:hidden flex items-center justify-center gap-2 w-full px-6 py-4 bg-white rounded-xl font-semibold text-black hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/50 min-h-[56px] text-base"
          >
            {disabled ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                Converting...
              </>
            ) : (
              <>
                Convert to MCP
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>

        {/* Branch selector */}
        {showBranchSelector && repoInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2"
          >
            <GitBranch className="w-4 h-4 text-neutral-500" />
            <span className="text-sm text-neutral-500">Branch/Tag:</span>
            <BranchSelector
              owner={repoInfo.owner}
              repo={repoInfo.repo}
              selectedRef={selectedRef}
              onRefChange={setSelectedRef}
              disabled={disabled}
            />
          </motion.div>
        )}
        
        {/* Enhanced error message with suggestions */}
        <AnimatePresence>
          {(error || suggestion || hint || correctedUrl) && (
            <motion.div
              id="url-error"
              role="alert"
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 p-3 bg-neutral-900 border border-neutral-800 rounded-lg"
            >
              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium">{error}</span>
                </div>
              )}
              
              {/* Suggestion */}
              {suggestion && (
                <p className="mt-1.5 text-neutral-400 text-sm pl-6">
                  {suggestion}
                </p>
              )}
              
              {/* Hint with example */}
              {hint && (
                <div className="mt-2 pl-6 flex items-center gap-2 text-neutral-500 text-sm">
                  <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 text-yellow-500/70" />
                  <span>{hint}</span>
                </div>
              )}
              
              {/* Corrected URL suggestion button */}
              {correctedUrl && (
                <button
                  type="button"
                  onClick={handleUseCorrectedUrl}
                  className="mt-2 ml-6 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-md transition-colors flex items-center gap-2"
                >
                  <span>Use: </span>
                  <code className="text-green-400">{correctedUrl}</code>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live validation hint (when typing, before submit) */}
        <AnimatePresence>
          {!error && liveValidation?.correctedUrl && liveValidation.correctedUrl !== url && url.trim().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-2 text-neutral-500 text-xs pl-1"
            >
              Will convert as: <span className="text-neutral-400">{liveValidation.correctedUrl}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  )
}
