/**
 * Try In Playground Component - CTA to test generated tools
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Terminal,
  Sparkles,
  ChevronRight,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConversionResult, Tool } from '@/types';
import { usePlaygroundNavigation, usePlaygroundSharing } from '@/hooks/use-playground-store';

interface TryInPlaygroundProps {
  /** Conversion result containing generated code and tools */
  result: ConversionResult;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show a compact version */
  compact?: boolean;
}

export default function TryInPlayground({ 
  result, 
  className = '',
  compact = false,
}: TryInPlaygroundProps) {
  const router = useRouter();
  const { navigateToPlayground } = usePlaygroundNavigation();
  const { copyShareLink } = usePlaygroundSharing();
  
  const [copied, setCopied] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Get preview of tools (first 3)
  const previewTools = useMemo(() => {
    return result.tools.slice(0, 3);
  }, [result.tools]);

  const remainingCount = result.tools.length - previewTools.length;

  const handleOpenPlayground = useCallback(() => {
    setIsNavigating(true);
    navigateToPlayground(result);
  }, [navigateToPlayground, result]);

  const handleCopyShareLink = useCallback(async () => {
    // First store the result, then copy
    navigateToPlayground(result);
    const success = await copyShareLink();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    // Navigate back - the state is preserved
    router.back();
  }, [navigateToPlayground, result, copyShareLink, router]);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-3 ${className}`}
      >
        <Button
          onClick={handleOpenPlayground}
          disabled={isNavigating}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium"
        >
          {isNavigating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Try in Playground
        </Button>
        
        <span className="text-sm text-neutral-400">
          {result.tools.length} tool{result.tools.length !== 1 ? 's' : ''} available
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Terminal className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              Test Your Tools
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                Interactive
              </span>
            </h3>
            <p className="text-sm text-neutral-400">
              Try out generated tools in the playground
            </p>
          </div>
        </div>

        <Sparkles className="w-5 h-5 text-green-400 animate-pulse" />
      </div>

      {/* Tool Preview */}
      {previewTools.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
            Available Tools
          </div>
          <div className="space-y-2">
            {previewTools.map((tool) => (
              <ToolPreviewItem key={tool.name} tool={tool} />
            ))}
            
            {remainingCount > 0 && (
              <div className="flex items-center gap-2 py-2 px-3 text-sm text-neutral-400">
                <Package className="w-4 h-4" />
                <span>+ {remainingCount} more tool{remainingCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleOpenPlayground}
          disabled={isNavigating}
          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium py-3"
          size="lg"
        >
          {isNavigating ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Play className="w-5 h-5 mr-2" />
          )}
          Open in Playground
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>

        <Button
          onClick={handleCopyShareLink}
          variant="outline"
          className="sm:flex-initial"
          size="lg"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2 text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </>
          )}
        </Button>
      </div>

      {/* Features list */}
      <div className="mt-6 pt-6 border-t border-neutral-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <FeatureItem
            icon={<Terminal className="w-4 h-4" />}
            text="Execute tools live"
          />
          <FeatureItem
            icon={<ExternalLink className="w-4 h-4" />}
            text="View JSON responses"
          />
          <FeatureItem
            icon={<Share2 className="w-4 h-4" />}
            text="Share with others"
          />
        </div>
      </div>
    </motion.div>
  );
}

// ===== Sub-components =====

function ToolPreviewItem({ tool }: { tool: Tool }) {
  const paramCount = Object.keys(tool.inputSchema?.properties || {}).length;
  
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
        <Terminal className="w-4 h-4 text-neutral-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm truncate">
          {tool.name}
        </div>
        <div className="text-xs text-neutral-500 truncate">
          {tool.description || 'No description'}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="px-1.5 py-0.5 rounded bg-neutral-800">
          {paramCount} param{paramCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-neutral-400">
      <span className="text-green-400">{icon}</span>
      {text}
    </div>
  );
}
