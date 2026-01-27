'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Loader2, Check, Globe, FileText, Scissors, Files
} from 'lucide-react'

const STAGES = [
  { id: 'connect', label: 'Connecting to site', icon: Globe, duration: 800 },
  { id: 'fetch', label: 'Fetching llms.txt', icon: FileText, duration: 1200 },
  { id: 'parse', label: 'Parsing sections', icon: Scissors, duration: 1500 },
  { id: 'generate', label: 'Generating documents', icon: Files, duration: 1000 },
]

const TERMINAL_LOGS = [
  '> Initializing extraction...',
  '> Connecting to documentation site',
  '> Looking for llms-full.txt',
  '> Falling back to llms.txt',
  '> File found, fetching content',
  '> Parsing markdown structure',
  '> Identifying section headers',
  '> Splitting into documents',
  '> Generating llms-full.md',
  '> Creating AGENT-GUIDE.md',
  '> Preparing download bundle',
  '> Extraction complete',
]

export default function ExtractionProcess() {
  const [currentStage, setCurrentStage] = useState(0)
  const [terminalLines, setTerminalLines] = useState<string[]>([])
  const [metrics, setMetrics] = useState({
    tokens: 0,
    chunks: 0,
    nodes: 0,
    requests: 0,
  })
  const terminalRef = useRef<HTMLDivElement>(null)

  // Progress through stages
  useEffect(() => {
    if (currentStage < STAGES.length) {
      const timer = setTimeout(() => {
        setCurrentStage(prev => prev + 1)
      }, STAGES[currentStage].duration)
      return () => clearTimeout(timer)
    }
  }, [currentStage])

  // Add terminal lines
  useEffect(() => {
    const lineIndex = Math.min(
      Math.floor((currentStage / STAGES.length) * TERMINAL_LOGS.length),
      TERMINAL_LOGS.length - 1
    )
    
    const interval = setInterval(() => {
      setTerminalLines(prev => {
        if (prev.length < Math.min(lineIndex + 3, TERMINAL_LOGS.length)) {
          return [...prev, TERMINAL_LOGS[prev.length]]
        }
        return prev
      })
    }, 150)

    return () => clearInterval(interval)
  }, [currentStage])

  // Update metrics
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        tokens: Math.min(prev.tokens + Math.floor(Math.random() * 5000), 847293),
        chunks: Math.min(prev.chunks + Math.floor(Math.random() * 10), 492),
        nodes: Math.min(prev.nodes + Math.floor(Math.random() * 20), 1847),
        requests: Math.min(prev.requests + Math.floor(Math.random() * 5), 156),
      }))
    }, 100)

    return () => clearInterval(interval)
  }, [])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  const progress = (currentStage / STAGES.length) * 100

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="space-y-6"
    >
      {/* Main progress card */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-neutral-800 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-white">Extracting Documentation</h2>
              <p className="text-xs text-neutral-500">Fetching and parsing llms.txt</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white font-mono">
              {progress.toFixed(0)}%
            </div>
            <div className="text-xs text-neutral-500">Complete</div>
          </div>
        </div>

        <div className="p-6">
          {/* Progress bar */}
          <div className="relative h-2 bg-black rounded-full overflow-hidden mb-6">
            <motion.div
              className="absolute inset-y-0 left-0 bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Stages */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {STAGES.map((stage, index) => {
              const isComplete = index < currentStage
              const isCurrent = index === currentStage
              const Icon = stage.icon

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                    isComplete
                      ? 'bg-white/5 border-neutral-700'
                      : isCurrent
                      ? 'bg-white/10 border-neutral-600'
                      : 'bg-neutral-900/50 border-neutral-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                    isComplete
                      ? 'bg-white text-black'
                      : isCurrent
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}>
                    {isComplete ? (
                      <Check className="w-3 h-3" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                  </div>
                  <span className={`text-xs font-medium truncate ${
                    isComplete
                      ? 'text-neutral-300'
                      : isCurrent
                      ? 'text-white'
                      : 'text-neutral-500'
                  }`}>
                </span>
              </motion.div>
            )
          })}
        </div>
        </div>
      </div>

      {/* Metrics and Terminal */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Live metrics */}
        <div className="rounded-xl border border-neutral-800 p-6 bg-neutral-900/80 backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-neutral-400 mb-4">
            Live Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Tokens', value: metrics.tokens.toLocaleString() },
              { label: 'Chunks', value: metrics.chunks.toLocaleString() },
              { label: 'Nodes', value: metrics.nodes.toLocaleString() },
              { label: 'Models', value: metrics.requests.toLocaleString() },
            ].map((metric) => (
              <div key={metric.label} className="p-3 bg-black/50 rounded-lg border border-neutral-800">
                <div className="text-2xl font-bold font-mono text-white">
                  {metric.value}
                </div>
                <div className="text-xs text-neutral-500">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal */}
        <div className="rounded-xl border border-neutral-800 overflow-hidden bg-black/80 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-neutral-600" />
              <div className="w-3 h-3 rounded-full bg-neutral-600" />
              <div className="w-3 h-3 rounded-full bg-neutral-600" />
            </div>
            <span className="text-xs text-neutral-500 font-mono ml-2">extraction.log</span>
          </div>
          <div 
            ref={terminalRef}
            className="terminal h-48 overflow-y-auto p-4"
          >
            {terminalLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`terminal-line ${
                  line.includes('complete') ? 'text-white' : 'text-neutral-400'
                }`}
              >
                {line}
              </motion.div>
            ))}
            <span className="inline-block w-2 h-4 bg-white animate-pulse" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
