/**
 * ExecutionLogV2 Component - Display execution logs with filtering
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LogEntry } from './types';

export interface ExecutionLogV2Props {
  /** Log entries to display */
  entries: LogEntry[];
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Callback to clear logs */
  onClear?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const LOG_TYPE_CONFIG: Record<
  LogEntry['type'],
  { color: string; bgColor: string; icon: React.ReactNode; label: string }
> = {
  info: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: <Info className="w-3.5 h-3.5" />,
    label: 'Info',
  },
  request: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    icon: <ArrowRight className="w-3.5 h-3.5" />,
    label: 'Request',
  },
  response: {
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    icon: <ArrowLeft className="w-3.5 h-3.5" />,
    label: 'Response',
  },
  error: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    label: 'Error',
  },
  success: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    label: 'Success',
  },
  stdout: {
    color: 'text-neutral-300',
    bgColor: 'bg-neutral-500/10',
    icon: <Terminal className="w-3.5 h-3.5" />,
    label: 'stdout',
  },
  stderr: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    icon: <Terminal className="w-3.5 h-3.5" />,
    label: 'stderr',
  },
};

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

/**
 * Single log entry component
 */
function LogEntryItem({
  entry,
  onCopy,
}: {
  entry: LogEntry;
  onCopy: (text: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const config = LOG_TYPE_CONFIG[entry.type];
  const hasData = entry.data !== undefined;

  const handleCopy = async () => {
    const text = hasData
      ? `${entry.message}\n${JSON.stringify(entry.data, null, 2)}`
      : entry.message;
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'group px-3 py-2 border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors',
        config.bgColor
      )}
    >
      <div className="flex items-start gap-2">
        {/* Timestamp */}
        <span className="text-xs text-neutral-600 font-mono flex-shrink-0 mt-0.5">
          {formatTimestamp(entry.timestamp)}
        </span>

        {/* Type icon */}
        <span className={cn('flex-shrink-0 mt-0.5', config.color)}>
          {config.icon}
        </span>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm break-words', config.color)}>
            {entry.message}
          </p>

          {/* Expandable data */}
          {hasData && (
            <div className="mt-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {isExpanded ? 'Hide data' : 'Show data'}
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.pre
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-2 rounded bg-neutral-950 text-xs text-neutral-400 font-mono overflow-x-auto max-h-[200px] overflow-y-auto"
                  >
                    {JSON.stringify(entry.data, null, 2)}
                  </motion.pre>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-400 transition-all"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * ExecutionLogV2 - Display execution logs with filtering and auto-scroll
 */
export default function ExecutionLogV2({
  entries,
  maxHeight = 300,
  onClear,
  className = '',
}: ExecutionLogV2Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<LogEntry['type'] | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Copy to clipboard
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore copy errors
    }
  }, []);

  // Filter entries
  const filteredEntries =
    filter === 'all' ? entries : entries.filter((e) => e.type === filter);

  // Count by type
  const typeCounts = entries.reduce(
    (acc, entry) => {
      acc[entry.type] = (acc[entry.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/80">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-medium text-white">Execution Log</span>
          <Badge variant="secondary" className="text-xs">
            {filteredEntries.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* Filter toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && 'bg-white/10')}
            title="Filter logs"
          >
            <Filter className="w-3.5 h-3.5" />
          </Button>

          {/* Clear button */}
          {onClear && entries.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClear}
              title="Clear logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 border-b border-neutral-800 bg-neutral-900/50"
          >
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  filter === 'all'
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:text-neutral-300'
                )}
              >
                All ({entries.length})
              </button>
              {Object.entries(LOG_TYPE_CONFIG).map(([type, config]) => {
                const count = typeCounts[type] || 0;
                if (count === 0) return null;
                return (
                  <button
                    key={type}
                    onClick={() => setFilter(type as LogEntry['type'])}
                    className={cn(
                      'px-2 py-1 text-xs rounded transition-colors flex items-center gap-1',
                      filter === type
                        ? 'bg-white/10 text-white'
                        : 'text-neutral-400 hover:text-neutral-300'
                    )}
                  >
                    <span className={config.color}>{config.icon}</span>
                    {config.label} ({count})
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ maxHeight }}
        className="overflow-y-auto"
      >
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Terminal className="w-8 h-8 text-neutral-700 mb-2" />
            <p className="text-sm text-neutral-500">
              {entries.length === 0
                ? 'No logs yet'
                : 'No logs match the filter'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <LogEntryItem key={entry.id} entry={entry} onCopy={handleCopy} />
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {entries.length > 0 && !autoScroll && (
        <div className="px-3 py-1.5 border-t border-neutral-800 bg-neutral-900/80">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
          >
            ↓ Scroll to bottom
          </button>
        </div>
      )}
    </div>
  );
}
