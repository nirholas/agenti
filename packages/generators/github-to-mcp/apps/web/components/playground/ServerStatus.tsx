/**
 * ServerStatus Component - Shows MCP server connection status
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { motion } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Power,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ServerStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  error: string | null;
  isDemoMode?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

export default function ServerStatus({
  isConnected,
  isConnecting,
  sessionId,
  error,
  isDemoMode = false,
  onConnect,
  onDisconnect,
  className = '',
}: ServerStatusProps) {
  // Demo mode display
  if (isDemoMode) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <WifiOff className="w-4 h-4 text-yellow-400" />
          </div>
          <span className="text-sm font-medium text-yellow-300">Demo Mode</span>
        </div>
        <span className="text-xs text-yellow-400/70">Not connected to real server</span>
      </div>
    );
  }

  // Error state
  if (error && !isConnecting) {
    return (
      <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 ${className}`}>
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm font-medium text-red-300 truncate">{error}</span>
        </div>
        {onConnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onConnect}
            leftIcon={<RefreshCw className="w-3 h-3" />}
            className="flex-shrink-0 text-red-300 hover:text-red-200"
          >
            Retry
          </Button>
        )}
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 ${className}`}>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-sm font-medium text-blue-300">Connecting to MCP server...</span>
        </div>
      </div>
    );
  }

  // Connected state
  if (isConnected) {
    return (
      <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative"
            >
              <Wifi className="w-4 h-4 text-green-400" />
              <motion.div
                className="absolute inset-0 rounded-full bg-green-400/30"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
            <span className="text-sm font-medium text-green-300">Connected</span>
          </div>
          {sessionId && (
            <span className="text-xs text-green-400/70 font-mono hidden sm:inline">
              Session: {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>
        {onDisconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            leftIcon={<Power className="w-3 h-3" />}
            className="flex-shrink-0 text-green-300 hover:text-red-300"
          >
            Disconnect
          </Button>
        )}
      </div>
    );
  }

  // Disconnected state
  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-neutral-700 bg-neutral-800/50 ${className}`}>
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-neutral-500" />
        <span className="text-sm font-medium text-neutral-400">Not connected</span>
      </div>
      {onConnect && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onConnect}
          leftIcon={<Wifi className="w-3 h-3" />}
        >
          Connect
        </Button>
      )}
    </div>
  );
}
