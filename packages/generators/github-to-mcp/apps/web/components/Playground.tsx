/**
 * Playground Component - Interactive MCP tool testing sandbox
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Code2,
  Play,
  ChevronRight,
  Package,
  FileJson,
  Terminal,
  AlertCircle,
  Sparkles,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PlaygroundToolTester from './PlaygroundToolTester';
import SplitView from './SplitView';
import ServerStatus from './playground/ServerStatus';
import ExecutionLog from './playground/ExecutionLog';
import type { Tool, ConversionResult } from '@/types';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useMcpExecution } from '@/hooks/use-mcp-execution';

interface PlaygroundProps {
  initialResult?: ConversionResult | null;
  className?: string;
}

// Demo tools for when no result is loaded
const DEMO_TOOLS: Tool[] = [
  {
    name: 'get_repository',
    description: 'Fetch information about a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo_url: {
          type: 'string',
          description: 'GitHub repository URL or owner/repo (e.g., "facebook/react" or "https://github.com/facebook/react")',
        },
        include_stats: {
          type: 'boolean',
          description: 'Include repository statistics',
          default: false,
        },
      },
      required: ['repo_url'],
    },
    source: { type: 'openapi', file: 'demo' },
  },
  {
    name: 'search_issues',
    description: 'Search for issues in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo_url: {
          type: 'string',
          description: 'GitHub repository URL or owner/repo',
        },
        query: {
          type: 'string',
          description: 'Search query',
        },
        state: {
          type: 'string',
          description: 'Issue state filter',
          enum: ['open', 'closed', 'all'],
          default: 'open',
        },
        labels: {
          type: 'array',
          description: 'Filter by labels',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
        },
      },
      required: ['repo_url', 'query'],
    },
    source: { type: 'code', file: 'demo' },
  },
  {
    name: 'create_comment',
    description: 'Add a comment to an issue or pull request',
    inputSchema: {
      type: 'object',
      properties: {
        repo_url: {
          type: 'string',
          description: 'GitHub repository URL or owner/repo',
        },
        issue_number: {
          type: 'number',
          description: 'Issue or PR number',
        },
        body: {
          type: 'string',
          description: 'Comment body (markdown supported)',
        },
      },
      required: ['repo_url', 'issue_number', 'body'],
    },
    source: { type: 'readme', file: 'demo' },
  },
];

export default function Playground({ initialResult, className = '' }: PlaygroundProps) {
  const [storedResult] = useLocalStorage<ConversionResult | null>('playground-result', null);
  const [storedCode, setStoredCode] = useLocalStorage<string | null>('playground-code', null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  // Use provided result, stored result, or demo tools
  const result = initialResult || storedResult;
  const generatedCode = result?.code || storedCode;
  const isDemo = !generatedCode;

  // MCP execution hook
  const {
    tools: serverTools,
    isConnected,
    isConnecting,
    isLoading,
    error: connectionError,
    sessionId,
    executionLogs,
    connect,
    disconnect,
    executeTool,
    clearLogs,
  } = useMcpExecution({
    generatedCode,
    onToolsLoaded: (loadedTools) => {
      // Auto-select first tool when tools are loaded
      if (loadedTools.length > 0 && !selectedTool) {
        setSelectedTool(loadedTools[0]);
      }
    },
  });

  // Use server tools when connected, otherwise use result tools or demo tools
  const tools = isConnected && serverTools.length > 0 ? serverTools : (result?.tools || DEMO_TOOLS);

  // Filter tools based on search
  const filteredTools = useMemo(() => {
    if (!searchQuery) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      tool =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  // Select first tool if none selected
  useEffect(() => {
    if (!selectedTool && filteredTools.length > 0) {
      setSelectedTool(filteredTools[0]);
    }
  }, [filteredTools, selectedTool]);

  // Handle tool execution
  const handleExecute = useCallback(async (tool: Tool, params: Record<string, unknown>) => {
    if (isConnected) {
      // Real execution via MCP server
      return await executeTool(tool.name, params);
    }

    // Mock execution for demo mode
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

    return {
      success: true,
      tool: tool.name,
      timestamp: new Date().toISOString(),
      params,
      response: {
        message: `[Demo] Mock response for ${tool.name}`,
        data: {
          id: Math.random().toString(36).substring(7),
          ...params,
        },
      },
    };
  }, [isConnected, executeTool]);

  // Handle loading code from file input
  const handleLoadCode = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const code = e.target?.result as string;
      setStoredCode(code);
    };
    reader.readAsText(file);
  }, [setStoredCode]);

  const SOURCE_COLORS: Record<string, string> = {
    readme: 'bg-blue-500/10 text-blue-400',
    code: 'bg-purple-500/10 text-purple-400',
    openapi: 'bg-green-500/10 text-green-400',
    graphql: 'bg-pink-500/10 text-pink-400',
    'mcp-introspect': 'bg-yellow-500/10 text-yellow-400',
    universal: 'bg-neutral-500/10 text-neutral-400',
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Server Status */}
      <ServerStatus
        isConnected={isConnected}
        isConnecting={isConnecting}
        sessionId={sessionId}
        error={connectionError}
        isDemoMode={isDemo}
        onConnect={generatedCode ? connect : undefined}
        onDisconnect={disconnect}
        className="mb-4"
      />

      {/* Demo notice with CTA */}
      {isDemo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-300 font-medium">
                Demo Mode - Not Connected to Real Server
              </p>
              <p className="text-sm text-yellow-300/70 mt-1">
                You&apos;re viewing sample tools.{' '}
                <a href="/convert" className="underline hover:text-white transition-colors">
                  Convert a repository
                </a>{' '}
                to test your own tools, or load existing code.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.location.href = '/convert'}
                  leftIcon={<Play className="w-4 h-4" />}
                >
                  Convert a Repo
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".ts,.js,.mcp"
                    onChange={handleLoadCode}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Upload className="w-4 h-4" />}
                    asChild
                  >
                    <span>Load Code</span>
                  </Button>
                </label>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Not connected notice (has code but not connected) */}
      {!isDemo && !isConnected && !isConnecting && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">
              Ready to connect. Click &quot;Connect&quot; to start the MCP server and test tools.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={connect}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Connect
          </Button>
        </motion.div>
      )}

      {/* Main content with split view */}
      <div className="flex-1 min-h-0">
        <SplitView
          left={
            <div className="flex flex-col h-full rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
              {/* Sidebar header */}
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
                  {isDemo && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">
                      Demo
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

              {/* Tool list */}
              <div className="flex-1 overflow-y-auto py-1">
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
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium truncate ${
                                isSelected ? 'text-white' : 'text-neutral-300'
                              }`}
                            >
                              {tool.name}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                            {tool.description}
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
          }
          right={
            <div className="flex flex-col h-full gap-4">
              {selectedTool ? (
                <>
                  <PlaygroundToolTester
                    tool={selectedTool}
                    onExecute={handleExecute}
                    isDemoMode={isDemo}
                    isExecuting={isLoading}
                    className="flex-1"
                  />
                  {/* Execution Log */}
                  <ExecutionLog
                    logs={executionLogs}
                    onClear={clearLogs}
                    defaultExpanded={false}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/50">
                  <div className="text-center">
                    <Terminal className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-400 mb-2">
                      Select a Tool
                    </h3>
                    <p className="text-sm text-neutral-500">
                      Choose a tool from the list to start testing
                    </p>
                  </div>
                </div>
              )}
            </div>
          }
          defaultSplit={30}
          minLeftWidth={250}
          minRightWidth={400}
        />
      </div>

      {/* Server info footer (when result is available) */}
      {result && (
        <div className="mt-4 p-4 rounded-xl border border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-400">Server:</span>
                <span className="text-sm font-medium text-white">{result.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-400">Version:</span>
                <span className="text-sm font-medium text-white">{result.version}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/convert'}
              leftIcon={<Play className="w-4 h-4" />}
            >
              Convert Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
