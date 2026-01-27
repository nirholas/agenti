/**
 * Playground V2 Error Boundary - Error display with retry option
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PlaygroundV2ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PlaygroundV2Error({ error, reset }: PlaygroundV2ErrorProps) {
  useEffect(() => {
    // Log error to console
    console.error('[Playground V2 Error]', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });

    // Optional: Send to error reporting service
    // Example: Sentry, LogRocket, etc.
    // reportError(error);
  }, [error]);

  const handleReset = () => {
    // Clear any cached state that might cause issues
    if (typeof window !== 'undefined') {
      try {
        // Clear potentially corrupted localStorage data
        const keysToPreserve = ['mcp-playground-v2-visited'];
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mcp-playground') && !keysToPreserve.includes(key)) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.warn('Failed to clear localStorage:', e);
      }
    }
    
    reset();
  };

  const isNetworkError = error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('fetch');
  
  const isConnectionError = error.message.toLowerCase().includes('connection') ||
    error.message.toLowerCase().includes('connect');

  return (
    <main className="relative min-h-screen flex flex-col bg-black">
      {/* Header placeholder */}
      <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/80 border-b border-neutral-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-white font-bold">
              github-to-mcp
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-24 pb-8 flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-neutral-400 mb-6">
            {isNetworkError
              ? 'Unable to connect to the server. Please check your network connection.'
              : isConnectionError
              ? 'Failed to connect to the MCP server. Please verify your configuration.'
              : 'An unexpected error occurred in the playground.'}
          </p>

          {/* Error Details (collapsible) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-400 transition-colors">
                Show error details
              </summary>
              <div className="mt-3 p-4 rounded-lg bg-neutral-900 border border-neutral-800 overflow-x-auto">
                <p className="text-xs text-red-400 font-mono break-all">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="text-xs text-neutral-500 mt-2">
                    Digest: {error.digest}
                  </p>
                )}
                {error.stack && (
                  <pre className="text-xs text-neutral-500 mt-2 whitespace-pre-wrap">
                    {error.stack.split('\n').slice(0, 5).join('\n')}
                  </pre>
                )}
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleReset}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button
              variant="outline"
              asChild
            >
              <Link href="/" className="gap-2">
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </Button>
          </div>

          {/* Help Text */}
          <p className="mt-8 text-xs text-neutral-600">
            If this problem persists, please{' '}
            <a
              href="https://github.com/nirholas/github-to-mcp/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-400 underline inline-flex items-center gap-1"
            >
              report an issue
              <Bug className="w-3 h-3" />
            </a>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
