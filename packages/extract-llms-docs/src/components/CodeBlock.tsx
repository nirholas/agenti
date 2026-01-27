'use client'

import { useState, useCallback } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { Copy, Check, FileCode, Hash } from 'lucide-react'
import { motion } from 'framer-motion'

interface CodeBlockProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  filename?: string
}

// Custom dark theme matching site colors
const customTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#0a0a0a',
    margin: 0,
    padding: '1rem',
    fontSize: '0.875rem',
    lineHeight: '1.6',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
  },
}

export default function CodeBlock({ 
  code, 
  language = 'markdown', 
  showLineNumbers = false,
  filename 
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [code])

  // Detect language from filename if not provided
  const detectedLanguage = language || detectLanguage(filename || '')

  return (
    <div className="relative rounded-xl border border-neutral-800 overflow-hidden bg-[#0a0a0a]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/80 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-neutral-500" />
          {filename && (
            <span className="text-xs font-mono text-neutral-400">{filename}</span>
          )}
          {!filename && language && (
            <span className="text-xs font-mono text-neutral-500 uppercase">{language}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showLineNumbers && (
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <Hash className="w-3 h-3" />
              <span>{code.split('\n').length} lines</span>
            </div>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white/5 rounded-md hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label={copied ? 'Copied!' : 'Copy code'}
          >
            <motion.div
              initial={false}
              animate={{ scale: copied ? [1, 1.2, 1] : 1 }}
              transition={{ duration: 0.2 }}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
              )}
            </motion.div>
            <span className="text-neutral-400">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={detectedLanguage}
          style={customTheme}
          showLineNumbers={showLineNumbers}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: '#525252',
            borderRight: '1px solid #262626',
            marginRight: '1em',
            userSelect: 'none',
          }}
          wrapLines
          wrapLongLines
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: '#0a0a0a',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

// Helper to detect language from filename
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    'md': 'markdown',
    'markdown': 'markdown',
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sh': 'bash',
    'bash': 'bash',
    'txt': 'text',
  }
  return languageMap[ext || ''] || 'markdown'
}

// Inline code component for markdown rendering
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 bg-neutral-800 rounded text-white font-mono text-sm">
      {children}
    </code>
  )
}
