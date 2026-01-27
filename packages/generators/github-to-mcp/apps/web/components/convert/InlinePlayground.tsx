/**
 * InlinePlayground Component - Test tools inline in the conversion result
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Loader2,
  AlertCircle,
  Check,
  ChevronRight,
  Package,
  Search,
  Zap,
  Terminal,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PlaygroundToolTester from '@/components/PlaygroundToolTester';
import type { Tool } from '@/types';
import { useMcpExecution } from '@/hooks/use-mcp-execution';

interface InlinePlaygroundProps {
  tools: Tool[];
  generatedCode: string;
  className?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  readme: 'bg-blue-500/10 text-blue-400',
  code: 'bg-purple-500/10 text-purple-400',
  openapi: 'bg-green-500/10 text-green-400',
  graphql: 'bg-pink-500/10 text-pink-400',
  'mcp-introspect': 'bg-yellow-500/10 text-yellow-400',
  universal: 'bg-neutral-500/10 text-neutral-400',
};

export default function InlinePlayground({
  tools,
  generatedCode,
  className = '',
}: InlinePlaygroundProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(tools[0] || null);

  // MCP execution hook
  const {
    isConnected,
    isConnecting,
    isLoading,
    error: connectionError,
    connect,
    disconnect,
    executeTool,
  } = useMcpExecution({
    generatedCode,
    onToolsLoaded: (loadedTools) => {
      if (loadedTools.length > 0 && !selectedTool) {
        setSelectedTool(loadedTools[0]);
      }
    },
  });

  // Filter tools based on search
  const filteredTools = useMemo(() => {
    if (!searchQuery) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      tool =>
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  // Handle tool execution
  const handleExecute = useCallback(async (tool: Tool, params: Record<string, unknown>) => {
    if (isConnected) {
      return await executeTool(tool.name, params);
    }

    // Mock execution when not connected
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));

    return {
      success: true,
      tool: tool.name,
      timestamp: new Date().toISOString(),
      params,
      response: {
        message: `Demo response for ${tool.name}`,
        note: 'Connect to server for real execution',
        data: {
          id: Math.random().toString(36).substring(7),
          ...params,
        },
      },
    };
  }, [isConnected, executeTool]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection status bar */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-neutral-800">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-neutral-500'}`} />
          <span className="text-sm text-neutral-300">
            {isConnecting
              ? 'Connecting...'
              : isConnected
              ? 'Connected to MCP Server'
              : 'Demo Mode (not connected)'}
          </span>
          {!isConnected && (
            <span className="text-xs text-neutral-500">
              Results will be simulated
            </span>
          )}
        </div>

        <Button
          onClick={isConnected ? disconnect : connect}
          disabled={isConnecting}
          variant={isConnected ? 'outline' : 'default'}
          size="sm"
          className="gap-2"
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isConnected ? (
            <Check className="w-4 h-4" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
        </Button>
      </div>

      {connectionError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 inline-block mr-2" />
          {connectionError}
        </div>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tool list - left sidebar */}
        <div className="lg:col-span-1 rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          <div className="p-3 border-b border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-neutral-400" />
              <span className="text-sm font-medium text-white">
                Tools ({tools.length})
              </span>
              {isConnected && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                  Live
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {filteredTools.length === 0 ? (
              <div className="p-4 text-center">
                <AlertCircle className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No tools found</p>
              </div>
            ) : (
              filteredTools.map((tool) => {
                const isSelected = selectedTool?.name === tool.name;
                const sourceColor = SOURCE_COLORS[tool.source?.type || 'universal'] || SOURCE_COLORS.universal;

                return (
                  <button
                    key={tool.name}
                    onClick={() => setSelectedTool(tool)}
                    className={`w-full p-3 flex items-start gap-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-white/10 border-l-2 border-white'
                        : 'hover:bg-white/5 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          isSelected ? 'text-white rotate-90' : 'text-neutral-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`font-medium truncate block ${
                          isSelected ? 'text-white' : 'text-neutral-300'
                        }`}
                      >
                        {tool.name}
                      </span>
                      <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                        {tool.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-1.5 py-0.5 text-xs rounded ${sourceColor}`}>
                          {tool.source?.type || 'unknown'}
                        </span>
                        <span className="text-xs text-neutral-600">
                          {Object.keys(tool.inputSchema?.properties || {}).length} params
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Tool tester - right panel */}
        <div className="lg:col-span-2">
          {selectedTool ? (
            <PlaygroundToolTester
              tool={selectedTool}
              onExecute={handleExecute}
              isDemoMode={!isConnected}
              isExecuting={isLoading}
            />
          ) : (
            <div className="h-full flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/50 p-8">
              <div className="text-center">
                <Terminal className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-400 mb-2">
                  Select a Tool
                </h3>
                <p className="text-sm text-neutral-500">
                  Choose a tool from the list to test it
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
