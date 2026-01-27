'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Terminal, Sparkles, ExternalLink, Github, Globe, FileEdit, Download, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { InstallMdWizard, GitHubTab, UrlTab, Preview } from '@/components/install-generator'

type TabType = 'github' | 'url' | 'manual'

const tabs: { id: TabType; label: string; icon: typeof Github; description: string }[] = [
  { id: 'github', label: 'From GitHub', icon: Github, description: 'Generate from any GitHub repository' },
  { id: 'url', label: 'From URL', icon: Globe, description: 'Extract from documentation pages' },
  { id: 'manual', label: 'Manual', icon: FileEdit, description: 'Build your install.md from scratch' },
]

export default function InstallGeneratorPage() {
  const [activeTab, setActiveTab] = useState<TabType>('github')
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  
  const handleGenerated = useCallback((content: string) => {
    setGeneratedContent(content)
  }, [])
  
  const handleDownload = useCallback(() => {
    if (!generatedContent) return
    const blob = new Blob([generatedContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'install.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [generatedContent])
  
  const handleCopy = useCallback(async () => {
    if (!generatedContent) return
    await navigator.clipboard.writeText(generatedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedContent])
  
  const handleManualComplete = useCallback((content: string) => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'install.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])
  
  const handleReset = useCallback(() => {
    setGeneratedContent(null)
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
              <Terminal className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">install.md Generator</h1>
              <p className="text-neutral-400">
                Create LLM-executable installation instructions
              </p>
            </div>
          </div>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-4 bg-white/5 border border-neutral-700 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="font-medium text-white mb-1">What is install.md?</h2>
              <p className="text-sm text-neutral-400 mb-3">
                The <code className="px-1.5 py-0.5 bg-white/10 rounded text-white">install.md</code> standard 
                provides LLM-executable installation instructions. Unlike traditional docs written for humans, 
                install.md is designed for AI agents to autonomously install your software.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://installmd.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  installmd.org
                </a>
                <a
                  href="https://github.com/mintlify/install-md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Usage Example */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8 p-4 bg-neutral-900 border border-neutral-700 rounded-xl"
        >
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Usage</h3>
          <p className="text-sm text-neutral-400 mb-3">
            Users can pipe your install.md directly to an AI agent:
          </p>
          <div className="bg-black rounded-lg p-3 font-mono text-sm text-green-400">
            curl -fsSL https://yourdocs.com/install.md | claude
          </div>
        </motion.div>

        {/* Main Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          {/* Generated Content Display */}
          <AnimatePresence mode="wait">
            {generatedContent ? (
              <motion.div
                key="generated"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Success Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">install.md Generated!</h2>
                      <p className="text-sm text-neutral-400">Your LLM-executable installation guide is ready</p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    Generate Another
                  </button>
                </div>
                
                {/* Preview */}
                <div className="bg-white/5 border border-neutral-700 rounded-xl overflow-hidden">
                  <div className="border-b border-neutral-700 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-300">install.md</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className="p-2 text-neutral-400 hover:text-white transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    <pre className="p-4 text-sm text-neutral-300 font-mono whitespace-pre-wrap">
                      {generatedContent}
                    </pre>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-white/5 border border-neutral-700 rounded-xl">
                    <h3 className="font-medium text-white mb-2">Next Steps</h3>
                    <ul className="text-sm text-neutral-400 space-y-1.5">
                      <li>• Add install.md to your repository root</li>
                      <li>• Host at <code className="text-white">yourdomain.com/install.md</code></li>
                      <li>• Link from your README for AI agents</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-white/5 border border-neutral-700 rounded-xl">
                    <h3 className="font-medium text-white mb-2">Test It</h3>
                    <p className="text-sm text-neutral-400 mb-2">
                      Once hosted, users can run:
                    </p>
                    <code className="text-sm text-green-400 font-mono">
                      curl -fsSL yoururl.com/install.md | claude
                    </code>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="tabs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {/* Tab Navigation */}
                <div className="flex border-b border-neutral-700 mb-6">
                  {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
                          isActive 
                            ? 'text-white' 
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                        {isActive && (
                          <motion.div
                            layoutId="activeTab"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
                
                {/* Tab Description */}
                <p className="text-sm text-neutral-400 mb-6">
                  {tabs.find(t => t.id === activeTab)?.description}
                </p>

                {/* Tab Content */}
                <div className="bg-white/5 border border-neutral-700 rounded-xl p-6">
                  <AnimatePresence mode="wait">
                    {activeTab === 'github' && (
                      <motion.div
                        key="github"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <GitHubTab onGenerated={handleGenerated} />
                      </motion.div>
                    )}
                    {activeTab === 'url' && (
                      <motion.div
                        key="url"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <UrlTab onGenerated={handleGenerated} />
                      </motion.div>
                    )}
                    {activeTab === 'manual' && (
                      <motion.div
                        key="manual"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <InstallMdWizard onComplete={handleManualComplete} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Format Reference */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-12 max-w-4xl mx-auto"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Format Reference</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-white/5 border border-neutral-700 rounded-xl">
              <h3 className="font-medium text-white mb-2">Required Elements</h3>
              <ul className="text-sm text-neutral-400 space-y-1.5">
                <li>• <code className="text-white">H1</code> - Product name (lowercase-hyphenated)</li>
                <li>• <code className="text-white">OBJECTIVE:</code> - Installation goal</li>
                <li>• <code className="text-white">DONE WHEN:</code> - Success criteria</li>
                <li>• <code className="text-white">## TODO</code> - Checkbox list</li>
                <li>• <code className="text-white">EXECUTE NOW:</code> - Final call-to-action</li>
              </ul>
            </div>
            <div className="p-4 bg-white/5 border border-neutral-700 rounded-xl">
              <h3 className="font-medium text-white mb-2">Optional Elements</h3>
              <ul className="text-sm text-neutral-400 space-y-1.5">
                <li>• <code className="text-white">&gt;</code> - Blockquote description</li>
                <li>• Step sections with code blocks</li>
                <li>• Multiple package manager options</li>
                <li>• Platform-specific instructions</li>
                <li>• Link to llms.txt for troubleshooting</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  )
}
