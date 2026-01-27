/**
 * ConnectionStatus Component - Display MCP connection state
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  Loader2,
  Power,
  AlertTriangle,
  Copy,
  Check,
  X,
  Server,
  Wrench,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConnectionStatus as ConnectionStatusType, McpCapabilities, ServerInfo } from './types';

export interface ConnectionStatusProps {
  /** Current connection status */
  status: ConnectionStatusType;
  /** Session ID when connected */
  sessionId?: string | null;
  /** Server information when connected */
  serverInfo?: ServerInfo | null;
  /** Server capabilities when connected */
  capabilities?: McpCapabilities | null;
  /** Error message if in error state */
  error?: string | null;
  /** Callback to initiate connection */
  onConnect?: () => void;
  /** Callback to disconnect */
  onDisconnect?: () => void;
  /** Callback to dismiss error */
  onDismissError?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const STATUS_CONFIG: Record<ConnectionStatusType, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  label: string;
}> = {
  disconnected: {
    color: 'text-neutral-400',
    bgColor: 'bg-neutral-500/10',
    borderColor: 'border-neutral-700',
    icon: <WifiOff className="w-4 h-4" />,
    label: 'Disconnected',
  },
  connecting: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    label: 'Connecting...',
  },
  connected: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    icon: <Wifi className="w-4 h-4" />,
    label: 'Connected',
  },
  error: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Error',
  },
};

/**
 * ConnectionStatus - Display MCP connection state with actions
 */
export default function ConnectionStatus({
  status,
  sessionId,
  serverInfo,
  capabilities,
  error,
  onConnect,
  onDisconnect,
  onDismissError,
  className = '',
}: ConnectionStatusProps) {
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const config = STATUS_CONFIG[status];

  // Copy session ID to clipboard
  const copySessionId = useCallback(async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopiedSessionId(true);
      setTimeout(() => setCopiedSessionId(false), 2000);
    } catch {
      // Ignore copy errors
    }
  }, [sessionId]);

  // Truncate session ID for display
  const displaySessionId = sessionId
    ? `${sessionId.substring(0, 8)}...${sessionId.substring(sessionId.length - 4)}`
    : null;

  // Check if a capability is available
  const hasCapability = (cap: keyof McpCapabilities): boolean => {
    if (!capabilities) return false;
    const value = capabilities[cap];
    return value === true || (typeof value === 'object' && value !== null);
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Status Indicator */}
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-2', config.color)}>
            {config.icon}
            <span className="text-sm font-medium">{config.label}</span>
          </div>

          {/* Server Info */}
          <AnimatePresence>
            {status === 'connected' && serverInfo && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2"
              >
                <Server className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-sm text-neutral-400">
                  {serverInfo.name}
                  <span className="text-neutral-600 ml-1">v{serverInfo.version}</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Session ID */}
          <AnimatePresence>
            {status === 'connected' && displaySessionId && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={copySessionId}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
                title="Click to copy session ID"
              >
                <span className="font-mono">{displaySessionId}</span>
                {copiedSessionId ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Capability Badges */}
          <AnimatePresence>
            {status === 'connected' && capabilities && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="hidden sm:flex items-center gap-1.5"
              >
                {hasCapability('tools') && (
                  <Badge variant="secondary" className="gap-1">
                    <Wrench className="w-3 h-3" />
                    Tools
                  </Badge>
                )}
                {hasCapability('resources') && (
                  <Badge variant="secondary" className="gap-1">
                    <FileText className="w-3 h-3" />
                    Resources
                  </Badge>
                )}
                {hasCapability('prompts') && (
                  <Badge variant="secondary" className="gap-1">
                    <MessageSquare className="w-3 h-3" />
                    Prompts
                  </Badge>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Connect/Disconnect Button */}
          {status === 'disconnected' && onConnect && (
            <Button
              variant="success"
              size="sm"
              onClick={onConnect}
              leftIcon={<Power className="w-3.5 h-3.5" />}
            >
              Connect
            </Button>
          )}

          {status === 'connecting' && (
            <Button variant="secondary" size="sm" disabled>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Connecting
            </Button>
          )}

          {status === 'connected' && onDisconnect && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              leftIcon={<Power className="w-3.5 h-3.5" />}
            >
              Disconnect
            </Button>
          )}

          {status === 'error' && onConnect && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onConnect}
              leftIcon={<Power className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {status === 'error' && error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-red-500/20"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-red-300 flex-1">{error}</p>
              {onDismissError && (
                <button
                  onClick={onDismissError}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capabilities detail on mobile */}
      <AnimatePresence>
        {status === 'connected' && capabilities && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-green-500/20 sm:hidden"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-neutral-500 mr-1">Capabilities:</span>
              {hasCapability('tools') && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Wrench className="w-2.5 h-2.5" />
                  Tools
                </Badge>
              )}
              {hasCapability('resources') && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <FileText className="w-2.5 h-2.5" />
                  Resources
                </Badge>
              )}
              {hasCapability('prompts') && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <MessageSquare className="w-2.5 h-2.5" />
                  Prompts
                </Badge>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
