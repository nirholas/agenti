/**
 * Install Banner - Prominent CLI install command
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Terminal, Zap, ArrowRight } from 'lucide-react';

interface InstallBannerProps {
  variant?: 'hero' | 'inline' | 'minimal';
  repoUrl?: string;
}

export default function InstallBanner({ variant = 'hero', repoUrl }: InstallBannerProps) {
  const [copied, setCopied] = useState(false);

  const command = repoUrl 
    ? `npx @nirholas/github-to-mcp install ${repoUrl} --claude`
    : `npx @nirholas/github-to-mcp install <github-url> --claude`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2">
        <code className="text-sm text-green-400 font-mono bg-black/40 px-3 py-1.5 rounded-lg">
          npx @nirholas/github-to-mcp
        </code>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-white/10 rounded transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-neutral-400" />
          )}
        </button>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-3 bg-black/40 border border-neutral-800 rounded-xl"
      >
        <Terminal className="w-5 h-5 text-neutral-500 flex-shrink-0" />
        <code className="flex-1 text-sm text-green-400 font-mono overflow-x-auto whitespace-nowrap">
          {command}
        </code>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-neutral-400" />
          )}
        </button>
      </motion.div>
    );
  }

  // Hero variant (default)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900/80 to-black/80 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">One-Click Install</h3>
            <p className="text-xs text-neutral-400">Add to Claude Desktop instantly</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-medium bg-green-500/20 text-green-400 rounded-full">
          NEW
        </span>
      </div>

      {/* Command */}
      <div className="p-4">
        <div className="flex items-center gap-3 p-4 bg-black/60 border border-neutral-800 rounded-xl group">
          <span className="text-neutral-500 font-mono">$</span>
          <code className="flex-1 text-green-400 font-mono text-sm overflow-x-auto whitespace-nowrap scrollbar-thin">
            {command}
          </code>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-neutral-700 rounded-lg transition-all text-sm"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-300">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Features */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span>Auto-configures Claude Desktop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span>Installs dependencies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span>Works with Cursor too</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-t border-neutral-800">
        <p className="text-xs text-neutral-500">
          Supports <span className="text-neutral-400">--claude</span>, <span className="text-neutral-400">--cursor</span>, and <span className="text-neutral-400">--vscode</span> flags
        </p>
        <a
          href="https://github.com/nirholas/github-to-mcp#cli"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
        >
          View docs
          <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  );
}
