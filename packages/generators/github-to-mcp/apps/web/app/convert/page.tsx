/**
 * Convert Page - GitHub to MCP Conversion Interface
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Github, Zap } from 'lucide-react';
import Link from 'next/link';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import GithubUrlInput from '@/components/GithubUrlInput';
import ConversionResult from '@/components/convert/ConversionResult';
import LoadingSteps from '@/components/convert/LoadingSteps';
import GenerationProgress from '@/components/GenerationProgress';
import { useConversion } from '@/hooks/use-conversion';
import { useStreamingConversion } from '@/hooks/use-streaming-conversion';
import { useGenerationProgress } from '@/hooks/use-generation-progress';
import type { GitRef } from '@/components/BranchSelector';

function ConvertContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlParam = searchParams.get('url');
  const [useStreaming, setUseStreaming] = useState(true);
  
  // Regular conversion hook (fallback)
  const regularConversion = useConversion();
  
  // Streaming conversion hook (enhanced experience)
  const streamingConversion = useStreamingConversion();
  
  // Use streaming by default, fallback to regular if needed
  const {
    status,
    result,
    error,
    convert: convertFn,
    reset,
  } = useStreaming ? streamingConversion : regularConversion;
  
  // Get history from regular conversion hook (not available in streaming)
  const { history } = regularConversion;
  
  // Streaming-specific state
  const { steps, currentStep, progress } = streamingConversion;

  // Auto-convert if URL is provided in query params
  useEffect(() => {
    if (urlParam && status === 'idle') {
      convertFn(urlParam);
    }
  }, [urlParam, status, convertFn]);

  const handleSubmit = (url: string, ref?: GitRef | null) => {
    // Build URL with optional ref parameter
    let convertUrl = url;
    if (ref && !ref.isDefault) {
      // Append ref to URL for the conversion
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      // GitHub URL format: /owner/repo/tree/branch for browsing
      // But for API, we'll pass as query param
      convertUrl = `${url}${url.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref.sha || ref.name)}`;
    }
    router.push(`/convert?url=${encodeURIComponent(url)}${ref && !ref.isDefault ? `&ref=${encodeURIComponent(ref.sha || ref.name)}` : ''}`);
    convertFn(convertUrl);
  };

  const handleReset = () => {
    reset();
    router.push('/convert');
  };

  return (
    <main id="main-content" className="relative min-h-screen">
      <ParticleBackground />
      <Header />
      
      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </motion.div>

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-neutral-800 mb-6">
            <Github className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-neutral-400">
              GitHub to <span className="text-white font-semibold">MCP Server</span>
            </span>
            {useStreaming && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Live
              </span>
            )}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Convert Repository
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Enter a GitHub repository URL to generate a ready-to-use MCP server
          </p>
        </motion.div>

        {/* Input section - always visible */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto mb-12"
        >
          <GithubUrlInput 
            onSubmit={handleSubmit} 
            disabled={status === 'loading'}
            initialValue={urlParam || ''}
            showBranchSelector={true}
          />
        </motion.div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          {status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <LoadingSteps 
                steps={useStreaming ? steps : undefined}
                currentStep={useStreaming ? currentStep : undefined}
                progress={useStreaming ? progress : undefined}
                isStreaming={useStreaming}
              />
            </motion.div>
          )}

          {status === 'error' && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-400 text-xl">!</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">
                      Conversion Failed
                    </h3>
                    <p className="text-neutral-300 mb-4">{error.error}</p>
                    {error.details && (
                      <p className="text-sm text-neutral-500 mb-4">{error.details}</p>
                    )}
                    {error.retryAfter && (
                      <p className="text-sm text-neutral-500">
                        Please try again in {error.retryAfter} seconds
                      </p>
                    )}
                    <button
                      onClick={handleReset}
                      className="mt-4 px-4 py-2 bg-white/10 border border-neutral-700 rounded-lg text-white hover:bg-white/20 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {status === 'success' && result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ConversionResult result={result} onReset={handleReset} />
            </motion.div>
          )}

          {status === 'idle' && !urlParam && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Recent history */}
              {history.length > 0 && (
                <div className="max-w-3xl mx-auto">
                  <h2 className="text-xl font-semibold text-white mb-6">Recent Conversions</h2>
                  <div className="grid gap-4">
                    {history.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSubmit(item.url)}
                        className="group flex items-center justify-between p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-600 hover:bg-neutral-900/80 transition-all text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-white/5 border border-neutral-800 flex items-center justify-center">
                            <Github className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-white group-hover:text-white transition-colors">
                              {item.name}
                            </div>
                            <div className="text-sm text-neutral-500">
                              {item.toolCount} tools • {item.classification}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-neutral-600">
                          {new Date(item.convertedAt).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </main>
  );
}

export default function ConvertPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
      </div>
    }>
      <ConvertContent />
    </Suspense>
  );
}
