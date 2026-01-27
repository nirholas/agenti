/**
 * ShareButton Component - Generate and share playground URLs
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, Link2, Code2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TransportConfig, CapabilityTab } from './types';

export interface ShareButtonProps {
  /** Current transport configuration */
  transportConfig: TransportConfig | null;
  /** Current active tab */
  activeTab?: CapabilityTab;
  /** Currently selected tool name */
  selectedToolName?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Generate shareable URL from playground state
 */
function generateShareUrl(
  transportConfig: TransportConfig | null,
  activeTab?: CapabilityTab,
  selectedToolName?: string
): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams();

  if (transportConfig) {
    params.set('transport', transportConfig.type);

    if (transportConfig.type === 'stdio') {
      params.set('command', transportConfig.command);
      if (transportConfig.args?.length) {
        params.set('args', transportConfig.args.join(','));
      }
    } else if (transportConfig.type === 'sse' || transportConfig.type === 'streamable-http') {
      params.set('url', transportConfig.url);
      if (transportConfig.headers) {
        params.set('headers', encodeURIComponent(JSON.stringify(transportConfig.headers)));
      }
    }
  }

  if (activeTab && activeTab !== 'tools') {
    params.set('tab', activeTab);
  }

  if (selectedToolName) {
    params.set('tool', selectedToolName);
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}/playground/v2?${queryString}` : `${baseUrl}/playground/v2`;
}

/**
 * Generate embed code for the playground
 */
function generateEmbedCode(
  transportConfig: TransportConfig | null,
  activeTab?: CapabilityTab,
  selectedToolName?: string
): string {
  const url = generateShareUrl(transportConfig, activeTab, selectedToolName);
  return `<iframe
  src="${url}"
  width="100%"
  height="600"
  frameborder="0"
  allow="clipboard-write"
  style="border-radius: 12px; border: 1px solid #27272a;"
></iframe>`;
}

/**
 * ShareButton - Generate and share playground URLs
 */
export default function ShareButton({
  transportConfig,
  activeTab,
  selectedToolName,
  className = '',
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'url' | 'embed' | null>(null);

  const shareUrl = generateShareUrl(transportConfig, activeTab, selectedToolName);
  const embedCode = generateEmbedCode(transportConfig, activeTab, selectedToolName);

  const handleCopy = useCallback(async (text: string, type: 'url' | 'embed') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setCopiedType(null);
  }, []);

  // Check if there's anything to share
  const canShare = transportConfig !== null;

  if (!canShare) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn('gap-2', className)}
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="sm"
        className={cn('gap-2', className)}
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={handleClose}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 p-4 rounded-xl bg-neutral-900 border border-neutral-800 shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Share Playground
                </h3>
                <button
                  onClick={handleClose}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Share URL */}
              <div className="space-y-2 mb-4">
                <label className="text-xs text-neutral-500">Share URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2 text-sm bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 truncate"
                  />
                  <Button
                    onClick={() => handleCopy(shareUrl, 'url')}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    {copiedType === 'url' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Embed Code */}
              <div className="space-y-2">
                <label className="text-xs text-neutral-500 flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  Embed Code
                </label>
                <div className="relative">
                  <pre className="p-3 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-400 overflow-x-auto max-h-24 overflow-y-auto">
                    {embedCode}
                  </pre>
                  <Button
                    onClick={() => handleCopy(embedCode, 'embed')}
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                  >
                    {copiedType === 'embed' ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Info */}
              <p className="mt-4 text-xs text-neutral-600">
                Share this URL to let others use the same transport configuration.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
