'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, Eye, Code } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface PreviewProps {
  content: string
}

export default function Preview({ content }: PreviewProps) {
  const [view, setView] = useState<'preview' | 'source'>('preview')
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [content])

  return (
    <div className="border border-neutral-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('preview')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === 'preview'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setView('source')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === 'source'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Code className="w-4 h-4" />
            Source
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-auto">
        {view === 'preview' ? (
          <div className="prose prose-invert prose-neutral max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-white mb-4">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-semibold text-white mt-6 mb-3">{children}</h2>
                ),
                p: ({ children }) => (
                  <p className="text-neutral-300 mb-3">{children}</p>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-neutral-600 pl-4 italic text-neutral-400 my-4">
                    {children}
                  </blockquote>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 text-neutral-300 mb-4">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="text-neutral-300">{children}</li>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="text-sm text-neutral-300 font-mono whitespace-pre-wrap break-words">
            {content}
          </pre>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-white/5 border-t border-neutral-700 text-xs text-neutral-500">
        {content.length} characters • {content.split('\n').length} lines
      </div>
    </div>
  )
}
