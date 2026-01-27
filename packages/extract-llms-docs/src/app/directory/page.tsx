'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Plus, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X, 
  ArrowUpDown,
  Activity,
  WifiOff,
  RefreshCw,
} from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SearchBar, CategoryFilter, SiteGrid } from '@/components/directory'
import { KNOWN_SITES, CATEGORIES, CategoryId, SiteEntry } from '@/data/sites'

type SortOption = 'name-asc' | 'name-desc' | 'category' | 'type'

interface HealthSummary {
  online: number
  offline: number
  checking: number
  total: number
}

export default function DirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all')
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  const [healthSummary, setHealthSummary] = useState<HealthSummary>({
    online: 0,
    offline: 0,
    checking: KNOWN_SITES.length,
    total: KNOWN_SITES.length,
  })
  const [isLoadingHealth, setIsLoadingHealth] = useState(false)

  // Fetch health summary on mount
  useEffect(() => {
    fetchHealthSummary()
  }, [])

  const fetchHealthSummary = async () => {
    setIsLoadingHealth(true)
    try {
      const response = await fetch('/api/sites/health')
      if (response.ok) {
        const data = await response.json()
        setHealthSummary({
          online: data.online,
          offline: data.offline + data.errors,
          checking: 0,
          total: data.totalSites,
        })
      }
    } catch (error) {
      console.error('Failed to fetch health summary:', error)
    } finally {
      setIsLoadingHealth(false)
    }
  }

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryId, number> = {
      all: KNOWN_SITES.length,
      ai: 0,
      'developer-tools': 0,
      documentation: 0,
      cloud: 0,
      other: 0,
    }

    KNOWN_SITES.forEach((site) => {
      counts[site.category]++
    })

    return counts
  }, [])

  // Filter and sort sites
  const filteredSites = useMemo(() => {
    let sites = KNOWN_SITES.filter((site) => {
      const matchesCategory =
        selectedCategory === 'all' || site.category === selectedCategory
      const matchesSearch =
        searchQuery === '' ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.url.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesCategory && matchesSearch
    })

    // Sort sites
    switch (sortBy) {
      case 'name-asc':
        sites = [...sites].sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        sites = [...sites].sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'category':
        sites = [...sites].sort((a, b) => a.category.localeCompare(b.category))
        break
      case 'type':
        sites = [...sites].sort((a, b) => {
          if (a.llmsTxtType === 'full' && b.llmsTxtType !== 'full') return -1
          if (a.llmsTxtType !== 'full' && b.llmsTxtType === 'full') return 1
          return 0
        })
        break
    }

    return sites
  }, [searchQuery, selectedCategory, sortBy])

  return (
    <main className="min-h-screen bg-black">
      <Header />

      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-headline text-white mb-4">Site Directory</h1>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Discover sites that support llms.txt and extract their documentation
              with one click.
            </p>
          </motion.div>

          {/* Health Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 p-4 rounded-xl bg-neutral-900/50 border border-neutral-800"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <Link 
                  href="/directory/health"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Activity className="w-5 h-5 text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-300">Live Status</span>
                </Link>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-green-400">{healthSummary.online} online</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span className="text-red-400">{healthSummary.offline} offline</span>
                  </span>
                  {healthSummary.checking > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
                      <span className="text-neutral-400">{healthSummary.checking} checking</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/directory/health"
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  View Dashboard
                </Link>
                <button
                  onClick={fetchHealthSummary}
                  disabled={isLoadingHealth}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingHealth ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </motion.div>

          {/* Search and filters */}
          <div className="space-y-4 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by name, description, or URL..."
              />
              
              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none px-4 py-3 pr-10 bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-xl hover:bg-neutral-800 hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="category">Category</option>
                  <option value="type">Full llms.txt first</option>
                </select>
                <ArrowUpDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              </div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowSuggestModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-xl hover:bg-neutral-800 hover:text-white transition-all whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Suggest a site
              </motion.button>
            </div>

            <CategoryFilter
              selected={selectedCategory}
              onChange={setSelectedCategory}
              counts={categoryCounts}
            />
          </div>

          {/* Results count */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-neutral-500 mb-6"
          >
            Showing {filteredSites.length} of {KNOWN_SITES.length} sites
          </motion.p>

          {/* Site grid */}
          <SiteGrid sites={filteredSites} />

          {/* CTA section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-16 text-center"
          >
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
              <h2 className="text-xl font-semibold text-white mb-2">
                Know a site with llms.txt?
              </h2>
              <p className="text-neutral-400 mb-6">
                Help us grow the directory by suggesting sites that support the
                llms.txt standard.
              </p>
              <button
                onClick={() => setShowSuggestModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Suggest a site
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Suggest site modal */}
      {showSuggestModal && (
        <SuggestSiteModal onClose={() => setShowSuggestModal(false)} />
      )}

      <Footer />
    </main>
  )
}

interface SuggestSiteModalProps {
  onClose: () => void
}

interface VerificationPreview {
  status: 'online' | 'offline' | 'error'
  llmsTxtUrl?: string
  llmsFullTxtUrl?: string
  size?: number
  type?: 'full' | 'standard'
}

function SuggestSiteModal({ onClose }: SuggestSiteModalProps) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [verification, setVerification] = useState<VerificationPreview | null>(null)

  // Auto-verify when URL changes
  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl)
    setVerification(null)
    setErrorMessage('')

    if (!newUrl || !newUrl.startsWith('http')) return

    try {
      new URL(newUrl) // Validate URL
    } catch {
      return
    }

    setStatus('verifying')

    try {
      const response = await fetch(`/api/sites/verify?url=${encodeURIComponent(newUrl)}`)
      if (response.ok) {
        const result = await response.json()
        setVerification({
          status: result.status,
          llmsTxtUrl: result.llmsTxt?.url,
          llmsFullTxtUrl: result.llmsFullTxt?.url,
          size: result.llmsFullTxt?.size || result.llmsTxt?.size,
          type: result.llmsFullTxt?.type || result.llmsTxt?.type,
        })
        setStatus(result.status === 'online' ? 'verified' : 'idle')
        
        if (result.status !== 'online') {
          setErrorMessage('No llms.txt found at this URL. The site may not support the llms.txt standard.')
        }
      }
    } catch {
      setStatus('idle')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/sites/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          name, 
          description,
          verification: verification,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit suggestion')
      }

      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Suggest a Site</h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Thank you!</h3>
            <p className="text-neutral-400 mb-6">
              Your suggestion has been submitted for review.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Site URL <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://docs.example.com"
                  required
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-neutral-600"
                />
                {status === 'verifying' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                  </div>
                )}
                {status === 'verified' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Verification result */}
            {verification && verification.status === 'online' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
              >
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-2">
                  <CheckCircle className="w-4 h-4" />
                  llms.txt found!
                </div>
                <div className="text-xs text-neutral-400 space-y-1">
                  {verification.llmsFullTxtUrl && (
                    <p>✓ llms-full.txt available</p>
                  )}
                  {verification.llmsTxtUrl && !verification.llmsFullTxtUrl && (
                    <p>✓ llms.txt available</p>
                  )}
                  {verification.size && (
                    <p>Size: {(verification.size / 1024).toFixed(1)} KB</p>
                  )}
                  {verification.type && (
                    <p>Type: {verification.type === 'full' ? 'Full documentation' : 'Standard'}</p>
                  )}
                </div>
              </motion.div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Site Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example Docs"
                required
                className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-neutral-600"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of the site..."
                rows={3}
                className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-neutral-600 resize-none"
              />
            </div>

            {(status === 'error' || (errorMessage && status === 'idle')) && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-neutral-800 text-neutral-300 font-medium rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'loading' || status === 'verifying'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : status === 'verifying' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
