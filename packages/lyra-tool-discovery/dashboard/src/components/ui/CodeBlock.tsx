'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  title?: string;
}

function CodeBlock({
  code,
  language = 'json',
  showLineNumbers = false,
  className,
  title,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = code.split('\n');

  // Simple syntax highlighting for JSON
  const highlightLine = (line: string): React.ReactNode => {
    if (language === 'json') {
      // Match JSON patterns
      return line.split(/("(?:[^"\\]|\\.)*")/g).map((part, i) => {
        if (part.startsWith('"') && part.endsWith('"')) {
          // Check if it's a key (followed by :) or a string value
          if (line.includes(`${part}:`)) {
            return (
              <span key={i} className="syntax-property">
                {part}
              </span>
            );
          }
          return (
            <span key={i} className="syntax-string">
              {part}
            </span>
          );
        }
        // Highlight numbers
        return part.split(/(\b\d+\.?\d*\b)/g).map((numPart, j) => {
          if (/^\d+\.?\d*$/.test(numPart)) {
            return (
              <span key={`${i}-${j}`} className="syntax-number">
                {numPart}
              </span>
            );
          }
          // Highlight true/false/null
          return numPart.split(/(true|false|null)/g).map((boolPart, k) => {
            if (['true', 'false', 'null'].includes(boolPart)) {
              return (
                <span key={`${i}-${j}-${k}`} className="syntax-keyword">
                  {boolPart}
                </span>
              );
            }
            return (
              <span key={`${i}-${j}-${k}`} className="syntax-punctuation">
                {boolPart}
              </span>
            );
          });
        });
      });
    }

    if (language === 'bash' || language === 'shell') {
      // Simple bash highlighting
      if (line.startsWith('#')) {
        return <span className="syntax-comment">{line}</span>;
      }
      const parts = line.split(/(\s+)/);
      return parts.map((part, i) => {
        if (i === 0 || (i === 2 && parts[0] === '$')) {
          return (
            <span key={i} className="syntax-function">
              {part}
            </span>
          );
        }
        if (part.startsWith('--') || part.startsWith('-')) {
          return (
            <span key={i} className="syntax-keyword">
              {part}
            </span>
          );
        }
        if (part.startsWith('"') || part.startsWith("'")) {
          return (
            <span key={i} className="syntax-string">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    }

    return line;
  };

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden',
        'bg-[#0d1117] border border-white/10',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          {title && (
            <span className="ml-2 text-xs text-white/50 font-mono">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 font-mono uppercase">
            {language}
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'hover:bg-white/10',
              copied && 'text-green-400'
            )}
            aria-label={copied ? 'Copied!' : 'Copy code'}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Check size={14} />
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Copy size={14} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm font-mono">
          <code>
            {lines.map((line, index) => (
              <div key={index} className="flex">
                {showLineNumbers && (
                  <span className="select-none pr-4 text-white/20 text-right min-w-[2rem]">
                    {index + 1}
                  </span>
                )}
                <span className="flex-1">{highlightLine(line)}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

export { CodeBlock };
export type { CodeBlockProps };
