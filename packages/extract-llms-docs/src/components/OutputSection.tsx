'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, Copy, Check, ExternalLink, RefreshCw,
  FileText, Archive, Eye, Files, Lightbulb, Clock, Hash,
  ChevronDown, List, ChevronRight
} from 'lucide-react'
import type { ExtractionResult, Document, ExportFormat } from '@/types'
import { downloadFile, downloadZip, copyToClipboard, getHostname, calculateTotalSize } from '@/lib/download'
import { exportToFormat, getFilenameForFormat, getExtensionForFormat, EXPORT_FORMATS } from '@/lib/exporters'
import CodeBlock from './CodeBlock'

interface OutputSectionProps {
  result: ExtractionResult
  onReset: () => void
}

type TabType = 'documents' | 'preview' | 'download'

interface TOCItem {
  id: string
  title: string
  level: number
}

// Extract TOC from markdown content
function extractTOC(content: string): TOCItem[] {
  const lines = content.split('\n')
  const toc: TOCItem[] = []
  
  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,3})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const title = match[2].trim()
      const id = `heading-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      toc.push({ id, title, level })
    }
  })
  
  return toc
}

export default function OutputSection({ result, onReset }: OutputSectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>('documents')
  const [copied, setCopied] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document>(result.fullDocument)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [showTOC, setShowTOC] = useState(false)
  const [showLineNumbers, setShowLineNumbers] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown')
  const previewRef = useRef<HTMLDivElement>(null)

  // Memoize TOC extraction
  const toc = useMemo(() => extractTOC(selectedDocument.content), [selectedDocument.content])

  const handleCopy = useCallback(async (text: string, id: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    }
  }, [])

  const handleDownloadFile = useCallback((doc: Document) => {
    downloadFile(doc.content, doc.filename)
  }, [])

  // Download in selected format
  const handleDownloadFormatted = useCallback(() => {
    const content = exportToFormat(result, exportFormat)
    const siteName = getHostname(result.url).replace('www.', '').split('.')[0]
    const filename = getFilenameForFormat(siteName, exportFormat)
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [result, exportFormat])

  const handleDownloadZip = useCallback(async () => {
    setIsDownloadingZip(true)
    try {
      await downloadZip(
        result.documents,
        result.fullDocument,
        result.agentGuide,
        getHostname(result.url)
      )
    } catch (error) {
      console.error('Failed to download ZIP:', error)
    } finally {
      setIsDownloadingZip(false)
    }
  }, [result])

  // Scroll to section handler
  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id)
    if (element && previewRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const tabs = [
    { id: 'documents' as const, label: 'Documents', icon: Files },
    { id: 'preview' as const, label: 'Preview', icon: Eye },
    { id: 'download' as const, label: 'Download', icon: Archive },
  ]

  // All documents including full and agent guide
  const allDocuments = useMemo(() => 
    [result.fullDocument, result.agentGuide, ...result.documents],
    [result]
  )
  const totalFileCount = allDocuments.length

  // Keyboard navigation for tabs
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, tabId: TabType) => {
    const tabIds: TabType[] = ['documents', 'preview', 'download']
    const currentIndex = tabIds.indexOf(tabId)
    
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (currentIndex + 1) % tabIds.length
      setActiveTab(tabIds[nextIndex])
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length
      setActiveTab(tabIds[prevIndex])
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-4 md:space-y-6"
    >
      {/* Success header */}
      <div className="rounded-xl md:rounded-2xl border border-neutral-800 p-4 md:p-8 bg-neutral-900/50 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white flex items-center justify-center">
                <Check className="w-6 h-6 md:w-8 md:h-8 text-black" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-white">Extraction Complete</h2>
              <p className="text-neutral-400 text-xs md:text-sm mt-1">
                Found {result.documents.length} sections from{' '}
                <span className="text-white font-mono break-all">{getHostname(result.url)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 px-4 py-2.5 md:py-2 text-sm bg-white/5 border border-neutral-700 rounded-lg hover:border-neutral-600 transition-colors min-h-[44px] w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="Extract another URL"
          >
            <RefreshCw className="w-4 h-4" />
            Extract Another
          </button>
        </div>

        {/* Stats grid - responsive */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="p-3 md:p-4 bg-black/50 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-1.5 md:mb-2">
              <Files className="w-4 h-4 text-white" />
              <span className="text-[10px] md:text-xs text-neutral-500">Documents</span>
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-white">
              {totalFileCount}
            </div>
          </div>
          <div className="p-3 md:p-4 bg-black/50 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-1.5 md:mb-2">
              <Hash className="w-4 h-4 text-neutral-400" />
              <span className="text-[10px] md:text-xs text-neutral-500">Tokens</span>
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-white">
              {result.stats.totalTokens.toLocaleString()}
            </div>
          </div>
          <div className="p-3 md:p-4 bg-black/50 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-1.5 md:mb-2">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span className="text-[10px] md:text-xs text-neutral-500">Time</span>
            </div>
            <div className="text-xl md:text-2xl font-bold font-mono text-white">
              {result.stats.processingTime}ms
            </div>
          </div>
          <div className="p-3 md:p-4 bg-black/50 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-1.5 md:mb-2">
              <ExternalLink className="w-4 h-4 text-neutral-400" />
              <span className="text-[10px] md:text-xs text-neutral-500">Source</span>
            </div>
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs md:text-sm font-mono text-white hover:underline truncate block focus:outline-none focus:ring-2 focus:ring-white/20 rounded"
            >
              {result.sourceUrl.split('/').pop()}
            </a>
          </div>
        </div>
        
        {/* Linked Sources Info - show when docs were fetched from multiple llms.txt files */}
        {result.linkedSources && result.linkedSources.length > 0 && (
          <div className="mt-4 p-3 md:p-4 bg-white/5 rounded-xl border border-neutral-700">
            <div className="flex items-center gap-2 mb-2">
              <Files className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">
                Content from {result.linkedSources.length + 1} documentation sources
              </span>
            </div>
            <div className="text-xs text-neutral-400 mb-3">
              This site uses multiple llms.txt files. All content has been merged for you.
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={result.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg text-xs text-neutral-300 hover:bg-white/20 transition-colors"
              >
                <span className="truncate max-w-[120px]">Main</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              {result.linkedSources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg text-xs text-neutral-300 hover:bg-white/20 transition-colors"
                  title={source.description || source.name}
                >
                  <span className="truncate max-w-[120px]">{source.name}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-xl md:rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-900/50 backdrop-blur-xl">
        {/* Tab buttons - stack on mobile */}
        <div 
          className="flex flex-col sm:flex-row border-b border-neutral-800"
          role="tablist"
          aria-label="Output sections"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`flex items-center justify-center sm:justify-start gap-2 px-4 md:px-6 py-3 md:py-4 text-sm font-medium transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/20 ${
                activeTab === tab.id
                  ? 'text-white border-b-2 sm:border-b-2 border-white bg-white/5'
                  : 'text-neutral-400 hover:text-white border-b sm:border-b-0 border-neutral-800 sm:border-none'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                role="tabpanel"
                id="tabpanel-documents"
                aria-labelledby="tab-documents"
                className="space-y-4"
              >
                {/* Featured documents */}
                <div className="grid md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                  <button
                    onClick={() => handleDownloadFile(result.fullDocument)}
                    className="flex items-center justify-between p-3 md:p-4 bg-white/5 border border-neutral-700 rounded-xl hover:border-neutral-500 transition-all group min-h-[64px] focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label={`Download ${result.fullDocument.filename}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-semibold text-white text-sm md:text-base truncate">{result.fullDocument.filename}</div>
                        <div className="text-[10px] md:text-xs text-neutral-400">Complete - {result.fullDocument.tokens.toLocaleString()} tokens</div>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-white group-hover:scale-110 transition-transform flex-shrink-0" />
                  </button>

                  <button
                    onClick={() => handleDownloadFile(result.agentGuide)}
                    className="flex items-center justify-between p-3 md:p-4 bg-white/5 border border-neutral-700 rounded-xl hover:border-neutral-500 transition-all group min-h-[64px] focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label={`Download ${result.agentGuide.filename}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-semibold text-white text-sm md:text-base truncate">{result.agentGuide.filename}</div>
                        <div className="text-[10px] md:text-xs text-neutral-400">AI guide - {result.agentGuide.tokens.toLocaleString()} tokens</div>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-white group-hover:scale-110 transition-transform flex-shrink-0" />
                  </button>
                </div>

                {/* Document list */}
                {result.documents.length > 0 && (
                  <>
                    <h3 className="text-sm font-medium text-neutral-400 mb-3">Individual Sections</h3>
                    <div className="space-y-2 max-h-64 md:max-h-80 overflow-y-auto scrollbar-thin">
                      {result.documents.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2.5 md:p-3 bg-black/50 border border-neutral-800 rounded-lg hover:border-neutral-700 transition-all group"
                        >
                          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                            <FileText className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-xs md:text-sm text-white truncate">{doc.filename}</div>
                              <div className="text-[10px] md:text-xs text-neutral-500 truncate">{doc.title}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                            <span className="text-[10px] md:text-xs text-neutral-500 font-mono hidden sm:inline">
                              {doc.tokens.toLocaleString()} tokens
                            </span>
                            <button
                              onClick={() => handleDownloadFile(doc)}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/20"
                              aria-label={`Download ${doc.filename}`}
                            >
                              <Download className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Preview Tab */}
            {activeTab === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                role="tabpanel"
                id="tabpanel-preview"
                aria-labelledby="tab-preview"
                className="space-y-4"
              >
                {/* Controls bar */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  {/* Document selector */}
                  <div className="relative flex-1 max-w-xs">
                    <select
                      value={allDocuments.findIndex(d => d.filename === selectedDocument.filename)}
                      onChange={(e) => setSelectedDocument(allDocuments[parseInt(e.target.value)])}
                      className="w-full appearance-none px-3 py-2.5 pr-10 bg-black border border-neutral-700 rounded-lg text-sm text-white focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 min-h-[44px]"
                      aria-label="Select document to preview"
                    >
                      {allDocuments.map((doc, index) => (
                        <option key={index} value={index}>
                          {doc.filename} ({doc.tokens.toLocaleString()} tokens)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {/* TOC toggle */}
                    {toc.length > 0 && (
                      <button
                        onClick={() => setShowTOC(!showTOC)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors min-h-[40px] focus:outline-none focus:ring-2 focus:ring-white/20 ${
                          showTOC ? 'bg-white/10 text-white' : 'bg-white/5 text-neutral-400 hover:text-white'
                        }`}
                        aria-expanded={showTOC}
                        aria-controls="toc-panel"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">TOC</span>
                      </button>
                    )}
                    
                    {/* Line numbers toggle */}
                    <button
                      onClick={() => setShowLineNumbers(!showLineNumbers)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors min-h-[40px] focus:outline-none focus:ring-2 focus:ring-white/20 ${
                        showLineNumbers ? 'bg-white/10 text-white' : 'bg-white/5 text-neutral-400 hover:text-white'
                      }`}
                      aria-pressed={showLineNumbers}
                    >
                      <Hash className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Lines</span>
                    </button>

                    {/* Copy button */}
                    <button
                      onClick={() => handleCopy(selectedDocument.content, 'preview')}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white/5 rounded-lg hover:bg-white/10 transition-colors min-h-[40px] focus:outline-none focus:ring-2 focus:ring-white/20"
                      aria-label={copied === 'preview' ? 'Copied to clipboard' : 'Copy to clipboard'}
                    >
                      {copied === 'preview' ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copied === 'preview' ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Content area with optional TOC */}
                <div className="flex gap-4">
                  {/* TOC sidebar */}
                  <AnimatePresence>
                    {showTOC && toc.length > 0 && (
                      <motion.div
                        id="toc-panel"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="hidden md:block flex-shrink-0 overflow-hidden"
                      >
                        <div className="w-48 p-3 bg-black/50 rounded-xl border border-neutral-800 sticky top-4">
                          <h4 className="text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wider">
                            Contents
                          </h4>
                          <nav className="space-y-1 max-h-72 overflow-y-auto" aria-label="Table of contents">
                            {toc.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => scrollToSection(item.id)}
                                className={`block w-full text-left text-xs text-neutral-400 hover:text-white transition-colors py-1 truncate focus:outline-none focus:text-white ${
                                  item.level === 2 ? 'pl-3' : item.level === 3 ? 'pl-6' : ''
                                }`}
                              >
                                <span className="flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{item.title}</span>
                                </span>
                              </button>
                            ))}
                          </nav>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Preview content */}
                  <div className="flex-1 min-w-0" ref={previewRef}>
                    <div className="max-h-[60vh] md:max-h-96 overflow-y-auto rounded-xl">
                      <CodeBlock
                        code={selectedDocument.content}
                        language="markdown"
                        showLineNumbers={showLineNumbers}
                        filename={selectedDocument.filename}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Download Tab */}
            {activeTab === 'download' && (
              <motion.div
                key="download"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                role="tabpanel"
                id="tabpanel-download"
                aria-labelledby="tab-download"
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 mx-auto rounded-2xl bg-white/10 border border-neutral-700 flex items-center justify-center mb-4">
                    <Archive className="w-7 h-7 md:w-8 md:h-8 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2">Download Everything</h3>
                  <p className="text-neutral-400 text-xs md:text-sm max-w-md mx-auto">
                    Get all {totalFileCount} documents in a single ZIP file, including the complete documentation and AI agent guide.
                  </p>
                </div>

                {/* Format Selector */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 bg-black/50 border border-neutral-800 rounded-xl">
                  <label htmlFor="export-format" className="text-sm text-neutral-400">
                    Export format:
                  </label>
                  <select
                    id="export-format"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                    className="px-4 py-2 bg-black border border-neutral-700 rounded-lg text-white text-sm focus:border-neutral-500 focus:outline-none min-w-[160px]"
                  >
                    {EXPORT_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label} ({format.extension})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleDownloadFormatted}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-neutral-700 rounded-lg text-white text-sm hover:bg-white/20 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download {exportFormat.toUpperCase()}
                  </button>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={handleDownloadZip}
                    disabled={isDownloadingZip}
                    className="flex items-center justify-center gap-3 w-full sm:w-auto px-6 md:px-8 py-3.5 md:py-4 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px] focus:outline-none focus:ring-2 focus:ring-white/50"
                    aria-busy={isDownloadingZip}
                  >
                    {isDownloadingZip ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Generating ZIP...
                      </>
                    ) : (
                      <>
                        <Archive className="w-5 h-5" />
                        Download All as ZIP
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm text-neutral-500">
                    <span className="flex items-center gap-2">
                      <Files className="w-4 h-4" />
                      {totalFileCount} files
                    </span>
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {calculateTotalSize(result.documents, result.fullDocument, result.agentGuide)}
                    </span>
                  </div>
                </div>

                {/* Quick download buttons */}
                <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-neutral-800">
                  <button
                    onClick={() => handleDownloadFile(result.fullDocument)}
                    className="flex items-center justify-between p-3 bg-black/50 border border-neutral-800 rounded-lg hover:border-neutral-600 transition-all min-h-[48px] focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="Download full documentation"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-white" />
                      <span className="text-sm text-white">llms-full.md</span>
                    </div>
                    <Download className="w-4 h-4 text-neutral-400" />
                  </button>
                  <button
                    onClick={() => handleDownloadFile(result.agentGuide)}
                    className="flex items-center justify-between p-3 bg-black/50 border border-neutral-800 rounded-lg hover:border-neutral-600 transition-all min-h-[48px] focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="Download agent guide"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-white" />
                      <span className="text-sm text-white">AGENT-GUIDE.md</span>
                    </div>
                    <Download className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pro tip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-3 md:p-4 bg-white/5 border border-neutral-700 rounded-xl"
      >
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-white text-sm md:text-base">Pro tip</h4>
            <p className="text-xs md:text-sm text-neutral-400 mt-1">
              You can usually access this content directly by adding{' '}
              <code className="px-1.5 py-0.5 bg-neutral-800 rounded text-white font-mono text-[10px] md:text-xs">
                /llms-full.txt
              </code>{' '}
              to the end of most documentation URLs.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
