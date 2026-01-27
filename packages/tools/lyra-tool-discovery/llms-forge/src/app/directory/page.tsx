'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SearchBar, CategoryFilter, SiteGrid } from '@/components/directory'
import { KNOWN_SITES, CATEGORIES, CategoryId, SiteEntry } from '@/data/sites'

export default function DirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all')
  const [showSuggestModal, setShowSuggestModal] = useState(false)

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

  // Filter sites based on search and category
  const filteredSites = useMemo(() => {
    return KNOWN_SITES.filter((site) => {
      const matchesCategory =
        selectedCategory === 'all' || site.category === selectedCategory
      const matchesSearch =
        searchQuery === '' ||
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.url.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesCategory && matchesSearch
    })
  }, [searchQuery, selectedCategory])

  return (
    <main className="min-h-screen bg-black">
      <Header />

      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-headline text-white mb-4">Site Directory</h1>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Discover sites that support llms.txt and extract their documentation
              with one click.
            </p>
          </motion.div>

          {/* Search and filters */}
          <div className="space-y-4 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by name, description, or URL..."
              />
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

function SuggestSiteModal({ onClose }: SuggestSiteModalProps) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/sites/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name, description }),
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
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.example.com"
                required
                className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-neutral-600"
              />
            </div>

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

            {status === 'error' && (
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
                disabled={status === 'loading'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking...
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
