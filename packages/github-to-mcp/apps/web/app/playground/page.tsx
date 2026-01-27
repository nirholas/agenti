/**
 * Playground Page - Interactive MCP tool testing
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Terminal, ArrowLeft, AlertCircle, RefreshCw, Share2, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import Playground from '@/components/Playground';
import { Button } from '@/components/ui/button';
import { usePlaygroundState, usePlaygroundErrors, usePlaygroundSharing } from '@/hooks/use-playground-store';

// V2 Banner Component
function V2Banner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Link
        href="/playground/v2"
        className="block p-4 rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full">
              NEW
            </span>
            <p className="text-white font-medium">
              Try the new Playground v2 with enhanced MCP support
            </p>
          </div>
          <span className="text-green-400 group-hover:translate-x-1 transition-transform">
            →
          </span>
        </div>
        <p className="mt-2 text-sm text-neutral-400 ml-14">
          Connect to any MCP server using STDIO, SSE, or Streamable HTTP transport.
        </p>
      </Link>
    </motion.div>
  );
}

function PlaygroundContent() {
  const searchParams = useSearchParams();
  const {
    generatedCode,
    tools,
    repoName,
    isLoading,
    conversionResult,
    loadFromUrl,
  } = usePlaygroundState();
  
  const {
    error,
    hasError,
    isRecoverable,
    retryCount,
    clearError,
    incrementRetry,
  } = usePlaygroundErrors();

  const {
    canShare,
    copyShareLink,
  } = usePlaygroundSharing();

  const [shareCopied, setShareCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Load from URL params on mount
  useEffect(() => {
    const hasUrlParams = searchParams.has('code') || searchParams.has('gist');
    if (hasUrlParams) {
      loadFromUrl(searchParams);
    }
  }, [searchParams, loadFromUrl]);

  // Handle share button click
  const handleShare = async () => {
    const success = await copyShareLink();
    if (success) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  // Handle retry
  const handleRetry = async () => {
    setIsRetrying(true);
    incrementRetry();
    
    // Try to reload from URL params
    const hasUrlParams = searchParams.has('code') || searchParams.has('gist');
    if (hasUrlParams) {
      await loadFromUrl(searchParams);
    }
    
    clearError();
    setIsRetrying(false);
  };

  // Determine if we have content to show
  const hasContent = !!generatedCode || tools.length > 0;

  return (
    <main id="main-content" className="relative min-h-screen flex flex-col">
      <ParticleBackground />
      <Header />

      <div className="container mx-auto px-4 pt-24 pb-8 flex-1 flex flex-col">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          {/* Share button */}
          {canShare && (
            <Button
              onClick={handleShare}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {shareCopied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Share
                </>
              )}
            </Button>
          )}
        </motion.div>

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {/* V2 Banner */}
          <V2Banner />

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-neutral-800 mb-6">
            <Terminal className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-neutral-400">
              Interactive <span className="text-white font-semibold">Playground</span>
            </span>
            {repoName && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-white/10 text-white rounded-full">
                {repoName}
              </span>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Test Your MCP Tools
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            {hasContent
              ? `Execute ${tools.length} tool${tools.length !== 1 ? 's' : ''} with an interactive testing interface.`
              : 'Try out generated tools with an interactive testing interface. Execute tools, view responses, and explore schemas.'
            }
          </p>
        </motion.div>

        {/* Loading state */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
              <p className="text-neutral-400">Loading playground...</p>
            </div>
          </motion.div>
        )}

        {/* Error state */}
        {hasError && error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-8"
          >
            <div className={`rounded-xl border p-6 ${
              error.type === 'syntax' 
                ? 'border-yellow-500/30 bg-yellow-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  error.type === 'syntax'
                    ? 'bg-yellow-500/20'
                    : 'bg-red-500/20'
                }`}>
                  <AlertCircle className={`w-5 h-5 ${
                    error.type === 'syntax' ? 'text-yellow-400' : 'text-red-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold mb-2 ${
                    error.type === 'syntax' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {error.type === 'syntax' && 'Syntax Error'}
                    {error.type === 'server' && 'Server Error'}
                    {error.type === 'execution' && 'Execution Error'}
                    {error.type === 'network' && 'Network Error'}
                    {error.type === 'unknown' && 'Error'}
                  </h3>
                  <p className="text-neutral-300 mb-2">{error.message}</p>
                  {error.details && (
                    <pre className="text-sm text-neutral-500 bg-black/30 rounded-lg p-3 overflow-x-auto mb-4 font-mono">
                      {error.details}
                    </pre>
                  )}
                  
                  <div className="flex items-center gap-3">
                    {isRecoverable && (
                      <Button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        variant="outline"
                        size="sm"
                      >
                        {isRetrying ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        {retryCount > 0 ? `Retry (${retryCount})` : 'Retry'}
                      </Button>
                    )}
                    <Button
                      onClick={clearError}
                      variant="ghost"
                      size="sm"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Playground component */}
        {!isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 min-h-[600px]"
          >
            <Playground initialResult={conversionResult} />
          </motion.div>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
        </div>
      }
    >
      <PlaygroundContent />
    </Suspense>
  );
}
