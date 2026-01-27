/**
 * ToolsPanel Component - Display and execute MCP tools
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Wrench,
  Play,
  Loader2,
  AlertCircle,
  ChevronRight,
  Code2,
  FileJson,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import SchemaForm from './SchemaForm';
import JsonViewer from './JsonViewer';
import type { McpTool, JsonSchema } from './types';

export interface ToolsPanelProps {
  /** List of available tools */
  tools: McpTool[];
  /** Currently selected tool */
  selectedTool: McpTool | null;
  /** Callback when a tool is selected */
  onSelectTool: (tool: McpTool) => void;
  /** Callback when a tool is executed */
  onExecute: (tool: McpTool, params: Record<string, unknown>) => void;
  /** Whether a tool execution is in progress */
  isExecuting?: boolean;
  /** Last execution result */
  lastResult?: unknown;
  /** Last execution error */
  lastError?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ToolsPanel - Browse and execute MCP tools
 */
export default function ToolsPanel({
  tools,
  selectedTool,
  onSelectTool,
  onExecute,
  isExecuting = false,
  lastResult,
  lastError,
  className = '',
}: ToolsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [showSchema, setShowSchema] = useState(false);

  // Filter tools based on search
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  // Reset params when tool changes
  React.useEffect(() => {
    setParams({});
  }, [selectedTool?.name]);

  // Handle tool execution
  const handleExecute = useCallback(() => {
    if (!selectedTool) return;
    onExecute(selectedTool, params);
  }, [selectedTool, params, onExecute]);

  // Get schema for selected tool
  const schema = selectedTool?.inputSchema || {
    type: 'object',
    properties: {},
  };

  return (
    <div className={cn('flex h-full', className)}>
      {/* Tools List */}
      <div className="w-72 flex-shrink-0 border-r border-neutral-800 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-neutral-800">
          <Input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-sm"
          />
        </div>

        {/* Tool List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTools.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Wrench className="w-8 h-8 text-neutral-600 mb-2" />
              <p className="text-sm text-neutral-500">
                {searchQuery ? 'No tools match your search' : 'No tools available'}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredTools.map((tool) => {
                const isSelected = selectedTool?.name === tool.name;
                const paramCount = Object.keys(
                  tool.inputSchema?.properties || {}
                ).length;

                return (
                  <button
                    key={tool.name}
                    onClick={() => onSelectTool(tool)}
                    className={cn(
                      'w-full px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-white/10 border-l-2 border-white'
                        : 'hover:bg-white/5 border-l-2 border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Wrench
                        className={cn(
                          'w-4 h-4 flex-shrink-0',
                          isSelected ? 'text-white' : 'text-neutral-500'
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm font-medium truncate',
                          isSelected ? 'text-white' : 'text-neutral-300'
                        )}
                      >
                        {tool.name}
                      </span>
                      {paramCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs px-1.5"
                        >
                          {paramCount}
                        </Badge>
                      )}
                    </div>
                    {tool.description && (
                      <p
                        className={cn(
                          'mt-1 text-xs truncate',
                          isSelected ? 'text-neutral-400' : 'text-neutral-500'
                        )}
                      >
                        {tool.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tool Count */}
        <div className="px-3 py-2 border-t border-neutral-800 text-xs text-neutral-500">
          {filteredTools.length} of {tools.length} tools
        </div>
      </div>

      {/* Tool Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTool ? (
          <>
            {/* Tool Header */}
            <div className="p-4 border-b border-neutral-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate">
                    {selectedTool.name}
                  </h3>
                  {selectedTool.description && (
                    <p className="mt-1 text-sm text-neutral-400">
                      {selectedTool.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSchema(!showSchema)}
                  leftIcon={<FileJson className="w-3.5 h-3.5" />}
                  className={cn(showSchema && 'bg-white/10')}
                >
                  Schema
                </Button>
              </div>

              {/* Schema viewer */}
              <AnimatePresence>
                {showSchema && selectedTool.inputSchema && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                      <pre className="text-xs text-neutral-400 overflow-x-auto">
                        {JSON.stringify(selectedTool.inputSchema, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Parameters Form */}
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                Parameters
              </h4>
              <SchemaForm
                schema={schema}
                value={params}
                onChange={setParams}
                disabled={isExecuting}
              />
            </div>

            {/* Execute Button */}
            <div className="p-4 border-t border-neutral-800">
              <Button
                onClick={handleExecute}
                disabled={isExecuting}
                loading={isExecuting}
                className="w-full"
                leftIcon={!isExecuting && <Play className="w-4 h-4" />}
              >
                {isExecuting ? 'Executing...' : 'Execute'}
              </Button>
            </div>

            {/* Result/Error */}
            <AnimatePresence>
              {(lastResult !== undefined || lastError) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-neutral-800"
                >
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
                      {lastError ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-red-400">Error</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-4 h-4 text-green-400" />
                          <span className="text-green-400">Result</span>
                        </>
                      )}
                    </h4>
                    {lastError ? (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="text-sm text-red-300">{lastError}</p>
                      </div>
                    ) : (
                      <JsonViewer data={lastResult} maxHeight={200} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* No tool selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Wrench className="w-12 h-12 text-neutral-700 mb-4" />
            <h3 className="text-lg font-medium text-neutral-400 mb-2">
              No tool selected
            </h3>
            <p className="text-sm text-neutral-500 max-w-xs">
              Select a tool from the list to view its details and execute it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
