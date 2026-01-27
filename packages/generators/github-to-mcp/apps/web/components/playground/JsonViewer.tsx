/**
 * JsonViewer Component - Display JSON with syntax highlighting
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Search,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface JsonViewerProps {
  /** Data to display */
  data: unknown;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Start collapsed */
  collapsed?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  depth: number;
  collapsed: boolean;
  searchQuery: string;
  path: string;
}

/**
 * Determine the type of a value for display
 */
function getValueType(
  value: unknown
): 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
}

/**
 * Get color for value type
 */
function getTypeColor(type: ReturnType<typeof getValueType>): string {
  switch (type) {
    case 'string':
      return 'text-green-400';
    case 'number':
      return 'text-blue-400';
    case 'boolean':
      return 'text-yellow-400';
    case 'null':
      return 'text-neutral-500';
    case 'array':
    case 'object':
      return 'text-neutral-300';
    default:
      return 'text-neutral-400';
  }
}

/**
 * Format a primitive value for display
 */
function formatValue(value: unknown, type: ReturnType<typeof getValueType>): string {
  if (type === 'string') {
    // Truncate long strings
    const str = value as string;
    if (str.length > 100) {
      return `"${str.substring(0, 100)}..."`;
    }
    return `"${str}"`;
  }
  if (type === 'null') return 'null';
  return String(value);
}

/**
 * Check if a string matches the search query
 */
function matchesSearch(text: string, query: string): boolean {
  if (!query) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Recursive JSON node renderer
 */
function JsonNode({
  keyName,
  value,
  depth,
  collapsed: initialCollapsed,
  searchQuery,
  path,
}: JsonNodeProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed && depth > 0);
  const type = getValueType(value);
  const isExpandable = type === 'object' || type === 'array';
  const indent = depth * 16;

  // Highlight matching text
  const highlightMatch = (text: string): React.ReactNode => {
    if (!searchQuery) return text;
    const index = text.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (index === -1) return text;
    return (
      <>
        {text.substring(0, index)}
        <span className="bg-yellow-500/30 text-yellow-300">
          {text.substring(index, index + searchQuery.length)}
        </span>
        {text.substring(index + searchQuery.length)}
      </>
    );
  };

  // Check if this node or its children match the search
  const hasMatch = useMemo(() => {
    if (!searchQuery) return false;
    if (keyName && matchesSearch(keyName, searchQuery)) return true;
    if (type === 'string' && matchesSearch(value as string, searchQuery)) return true;
    if (type === 'object' || type === 'array') {
      const check = (v: unknown): boolean => {
        if (typeof v === 'string' && matchesSearch(v, searchQuery)) return true;
        if (Array.isArray(v)) return v.some(check);
        if (typeof v === 'object' && v !== null) {
          return Object.entries(v).some(
            ([k, val]) => matchesSearch(k, searchQuery) || check(val)
          );
        }
        return false;
      };
      return check(value);
    }
    return false;
  }, [keyName, value, type, searchQuery]);

  // Auto-expand if matches search
  React.useEffect(() => {
    if (hasMatch && isCollapsed) {
      setIsCollapsed(false);
    }
  }, [hasMatch, searchQuery]);

  // Render primitive value
  if (!isExpandable) {
    const formattedValue = formatValue(value, type);
    const keyMatches = keyName && matchesSearch(keyName, searchQuery);
    const valueMatches = type === 'string' && matchesSearch(value as string, searchQuery);

    return (
      <div
        style={{ paddingLeft: indent }}
        className={cn(
          'flex items-baseline gap-1 py-0.5 hover:bg-white/5 transition-colors',
          (keyMatches || valueMatches) && 'bg-yellow-500/10'
        )}
      >
        {keyName && (
          <>
            <span className="text-purple-400">
              {searchQuery ? highlightMatch(keyName) : keyName}
            </span>
            <span className="text-neutral-500">:</span>
          </>
        )}
        <span className={getTypeColor(type)}>
          {type === 'string' && searchQuery
            ? highlightMatch(formattedValue)
            : formattedValue}
        </span>
      </div>
    );
  }

  // Render object/array
  const entries = type === 'array' ? (value as unknown[]) : Object.entries(value as object);
  const bracketOpen = type === 'array' ? '[' : '{';
  const bracketClose = type === 'array' ? ']' : '}';
  const isEmpty = entries.length === 0;
  const keyMatches = keyName && matchesSearch(keyName, searchQuery);

  return (
    <div>
      <div
        style={{ paddingLeft: indent }}
        className={cn(
          'flex items-baseline gap-1 py-0.5 hover:bg-white/5 transition-colors cursor-pointer',
          keyMatches && 'bg-yellow-500/10'
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {/* Expand/collapse icon */}
        <span className="text-neutral-500 w-4 flex-shrink-0">
          {!isEmpty &&
            (isCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            ))}
        </span>

        {/* Key name */}
        {keyName && (
          <>
            <span className="text-purple-400">
              {searchQuery ? highlightMatch(keyName) : keyName}
            </span>
            <span className="text-neutral-500">:</span>
          </>
        )}

        {/* Opening bracket */}
        <span className="text-neutral-300">{bracketOpen}</span>

        {/* Collapsed preview */}
        {isCollapsed && !isEmpty && (
          <span className="text-neutral-500 text-xs">
            {type === 'array' ? `${entries.length} items` : `${entries.length} keys`}
          </span>
        )}

        {/* Closing bracket for empty or collapsed */}
        {(isEmpty || isCollapsed) && (
          <span className="text-neutral-300">{bracketClose}</span>
        )}
      </div>

      {/* Children */}
      {!isCollapsed && !isEmpty && (
        <>
          {type === 'array'
            ? (entries as unknown[]).map((item, index) => (
                <JsonNode
                  key={index}
                  keyName={String(index)}
                  value={item}
                  depth={depth + 1}
                  collapsed={initialCollapsed}
                  searchQuery={searchQuery}
                  path={`${path}[${index}]`}
                />
              ))
            : (entries as [string, unknown][]).map(([key, val]) => (
                <JsonNode
                  key={key}
                  keyName={key}
                  value={val}
                  depth={depth + 1}
                  collapsed={initialCollapsed}
                  searchQuery={searchQuery}
                  path={`${path}.${key}`}
                />
              ))}
          <div
            style={{ paddingLeft: indent }}
            className="text-neutral-300 py-0.5"
          >
            {bracketClose}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * JsonViewer - Display JSON with syntax highlighting and interactive features
 */
export default function JsonViewer({
  data,
  maxHeight = 400,
  collapsed = false,
  className = '',
}: JsonViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  }, [data]);

  // Handle null/undefined
  if (data === undefined) {
    return (
      <div className={cn('text-sm text-neutral-500 italic', className)}>
        undefined
      </div>
    );
  }

  const effectiveMaxHeight = isExpanded ? undefined : maxHeight;

  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-3.5 h-3.5" />}
            className="h-7 text-xs"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{ maxHeight: effectiveMaxHeight }}
        className="overflow-auto p-3 font-mono text-xs"
      >
        <JsonNode
          value={data}
          depth={0}
          collapsed={collapsed}
          searchQuery={searchQuery}
          path="$"
        />
      </div>
    </div>
  );
}
