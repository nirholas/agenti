/**
 * ExecutionLog Component - Real-time output display for MCP server
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  Trash2,
  Download,
  Copy,
  Check,
  ArrowRight,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExecutionLog as ExecutionLogType } from '@/hooks/use-mcp-execution';
import { copyToClipboard } from '@/lib/utils';

export interface ExecutionLogProps {
  logs: ExecutionLogType[];
  onClear?: () => void;
  defaultExpanded?: boolean;
  maxHeight?: number;
  className?: string;
}

const LOG_TYPE_STYLES: Record<ExecutionLogType['type'], string> = {
  stdout: 'text-neutral-300',
  stderr: 'text-orange-400',
  info: 'text-blue-400',
  error: 'text-red-400',
  success: 'text-green-400',
};

const LOG_TYPE_ICONS: Record<ExecutionLogType['type'], React.ReactNode> = {
  stdout: <ArrowRight className="w-3 h-3" />,
  stderr: <AlertTriangle className="w-3 h-3" />,
  info: <Info className="w-3 h-3" />,
  error: <XCircle className="w-3 h-3" />,
  success: <CheckCircle className="w-3 h-3" />,
};

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

export default function ExecutionLog({
  logs,
  onClear,
  defaultExpanded = false,
  maxHeight = 300,
  className = '',
}: ExecutionLogProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isExpanded]);

  // Expand when first log arrives
  useEffect(() => {
    if (logs.length === 1 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [logs.length, isExpanded]);

  const handleCopyLogs = useCallback(async () => {
    const logText = logs
      .map(log => `[${formatTimestamp(log.timestamp)}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n');
    
    const success = await copyToClipboard(logText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [logs]);

  const handleDownloadLogs = useCallback(() => {
    const logText = logs
      .map(log => `[${formatTimestamp(log.timestamp)}] [${log.type.toUpperCase()}] ${log.toolName ? `[${log.toolName}] ` : ''}${log.message}`)
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-execution-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // If user scrolls up more than 50px from bottom, disable auto-scroll
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  }, []);

  const recentLogs = logs.slice(-100); // Limit display to last 100 logs
  const hasLogs = logs.length > 0;

  return (
    <div className={`rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-medium text-white">Execution Log</span>
          {hasLogs && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-neutral-700 text-neutral-300">
              {logs.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasLogs && isExpanded && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLogs();
                }}
                title="Copy logs"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadLogs();
                }}
                title="Download logs"
              >
                <Download className="w-3 h-3" />
              </Button>
              {onClear && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  title="Clear logs"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </div>
      </button>

      {/* Log content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="border-t border-neutral-800 bg-black/50 font-mono text-xs overflow-y-auto"
              style={{ maxHeight }}
            >
              {!hasLogs ? (
                <div className="p-4 text-center text-neutral-500">
                  No logs yet. Connect to a server and execute a tool to see output.
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {recentLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 py-0.5 hover:bg-white/5 rounded px-1"
                    >
                      <span className="text-neutral-600 flex-shrink-0 select-none">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className={`flex-shrink-0 ${LOG_TYPE_STYLES[log.type]}`}>
                        {LOG_TYPE_ICONS[log.type]}
                      </span>
                      {log.toolName && (
                        <span className="text-purple-400 flex-shrink-0">
                          [{log.toolName}]
                        </span>
                      )}
                      <span className={LOG_TYPE_STYLES[log.type]}>
                        {log.message}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Auto-scroll indicator */}
            {hasLogs && !autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                  }
                }}
                className="w-full py-1 text-xs text-center text-blue-400 hover:text-blue-300 bg-blue-500/10 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronDown className="w-3 h-3" /> Scroll to bottom (auto-scroll paused)
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
