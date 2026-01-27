/**
 * Playground V2 Page - Full-featured MCP playground with transport configuration
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { Suspense, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  ArrowLeft,
  History,
  Settings,
  X,
} from 'lucide-react';
import Link from 'next/link';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import { Button } from '@/components/ui/button';

// Playground components
import {
  TransportConfigurator,
  ConnectionStatusV2 as ConnectionStatus,
  CapabilityTabs,
  ToolsPanel,
  ResourcesPanel,
  PromptsPanel,
  ExecutionLogV2 as ExecutionLog,
  EmptyStates,
  FirstTimeGuide,
  ShareButton,
} from '@/components/playground';

// Hooks
import { usePlayground, useExecutionHistory } from '@/hooks';
import type { TransportConfig as HooksTransportConfig, McpTool, McpResource, McpPrompt, PlaygroundTab } from '@/hooks/types';
import type { TransportConfig as ComponentTransportConfig, LogEntry } from '@/components/playground/types';

// Local hooks
import { useUrlState } from './use-url-state';
import { useShortcuts } from './use-shortcuts';

// ============================================================================
// Type Definitions for Playground
// We use 'any' assertions to bridge the gap between hook types and component types
// since they are structurally compatible but TypeScript sees them as different
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyTool = any;
type AnyResource = any;
type AnyPrompt = any;
type AnyCapabilities = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================================
// Type Adapters
// ============================================================================

/**
 * Convert hook TransportConfig to component TransportConfig
 */
function toComponentTransport(config: HooksTransportConfig | null): ComponentTransportConfig | null {
  if (!config) return null;
  
  switch (config.type) {
    case 'stdio':
      return {
        type: 'stdio',
        command: config.command,
        args: config.args,
        env: config.env,
      };
    case 'sse':
    case 'http':
      return {
        type: 'sse',
        url: config.url,
        headers: config.headers,
      };
    case 'websocket':
      return {
        type: 'streamable-http',
        url: config.url,
        headers: config.headers,
      };
    default:
      return null;
  }
}

/**
 * Convert component TransportConfig to hook TransportConfig
 */
function toHooksTransport(config: ComponentTransportConfig): HooksTransportConfig {
  switch (config.type) {
    case 'stdio':
      return {
        type: 'stdio',
        command: config.command,
        args: config.args,
        env: config.env,
      };
    case 'sse':
      return {
        type: 'sse',
        url: config.url,
        headers: config.headers,
      };
    case 'streamable-http':
      return {
        type: 'http',
        url: config.url,
        headers: config.headers,
      };
  }
}

// ============================================================================
// Main Page Component
// ============================================================================

function PlaygroundV2Content() {
  // Initialize playground hook
  const playground = usePlayground();
  
  // Execution history
  const executionHistory = useExecutionHistory({ persist: true });
  
  // URL state sync
  useUrlState({
    transportConfig: playground.transportConfig,
    setTransportConfig: playground.setTransportConfig,
    activeTab: playground.activeTab,
    setActiveTab: playground.setActiveTab,
    selectedToolName: playground.selectedTool?.name,
    tools: playground.tools.tools,
    setSelectedTool: playground.setSelectedTool,
  });
  
  // Local state
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showFirstTimeGuide, setShowFirstTimeGuide] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Check if first time user
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasVisited = localStorage.getItem('mcp-playground-v2-visited');
      if (!hasVisited) {
        setShowFirstTimeGuide(true);
        localStorage.setItem('mcp-playground-v2-visited', 'true');
      }
    }
  }, []);

  // Keyboard shortcuts
  const executeSelectedTool = useCallback(() => {
    if (playground.selectedTool && playground.activeTab === 'tools') {
      // Trigger execute via the ToolsPanel
      // This is handled by the panel itself
    }
  }, [playground.selectedTool, playground.activeTab]);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const clearSelection = useCallback(() => {
    playground.setSelectedTool(null);
    playground.setSelectedResource(null);
    playground.setSelectedPrompt(null);
  }, [playground]);

  const copyLastResult = useCallback(() => {
    const lastEntry = executionHistory.history[0];
    if (lastEntry?.result) {
      navigator.clipboard.writeText(JSON.stringify(lastEntry.result, null, 2));
    }
  }, [executionHistory.history]);

  useShortcuts({
    onExecute: executeSelectedTool,
    onFocusSearch: focusSearch,
    onSwitchToTab: (tab: 1 | 2 | 3) => {
      if (tab === 1) playground.setActiveTab('tools');
      else if (tab === 2) playground.setActiveTab('resources');
      else if (tab === 3) playground.setActiveTab('prompts');
    },
    onClearSelection: clearSelection,
    onCopyLastResult: copyLastResult,
    enabled: true,
  });

  // Connection handlers
  const handleConnect = useCallback(() => {
    if (playground.transportConfig) {
      playground.connection.connect(toHooksTransport(playground.transportConfig as unknown as ComponentTransportConfig));
    }
  }, [playground.transportConfig, playground.connection]);

  const handleDisconnect = useCallback(() => {
    playground.connection.disconnect();
  }, [playground.connection]);

  // Transport config change handler
  const handleTransportChange = useCallback((config: ComponentTransportConfig) => {
    playground.setTransportConfig(toHooksTransport(config));
  }, [playground]);

  // Tool execution handler - uses tool name to avoid type incompatibility
  const handleToolExecute = useCallback((toolName: string, params: Record<string, unknown>) => {
    playground.tools.executeTool(toolName, params);
  }, [playground.tools]);

  // Wrapper for ToolsPanel that adapts the type
  const handleToolsPanelExecute = useCallback((tool: { name: string }, params: Record<string, unknown>) => {
    handleToolExecute(tool.name, params);
  }, [handleToolExecute]);

  // Resource read handler
  const handleResourceRead = useCallback((uri: string) => {
    playground.resources.readResource(uri);
  }, [playground.resources]);

  // Prompt execute handler
  const handlePromptExecute = useCallback((name: string, args?: Record<string, string>) => {
    playground.prompts.getPrompt(name, args);
  }, [playground.prompts]);

  // Convert execution history to log entries
  const logEntries = useMemo((): LogEntry[] => {
    return executionHistory.history.map((entry, index) => ({
      id: entry.id || `log-${index}`,
      type: entry.success ? 'success' as const : 'error' as const,
      message: `${entry.type}: ${entry.name}`,
      timestamp: entry.timestamp,
      data: entry.result || entry.error,
    }));
  }, [executionHistory.history]);

  // Counts for capability tabs
  const counts = useMemo(() => ({
    tools: playground.tools.tools.length,
    resources: playground.resources.resources.length,
    prompts: playground.prompts.prompts.length,
  }), [playground.tools.tools.length, playground.resources.resources.length, playground.prompts.prompts.length]);

  // Last tool execution
  const lastToolExecution = playground.tools.executions[0];
  const toolLastResult = lastToolExecution?.result;
  const toolLastError = lastToolExecution?.error;
  const isToolExecuting = lastToolExecution?.status === 'pending' || lastToolExecution?.status === 'running';

  // Last resource read
  const lastResourceRead = playground.resources.reads[0];
  const resourceLastContents = lastResourceRead?.contents;
  const resourceLastError = lastResourceRead?.error;
  const isResourceReading = lastResourceRead?.status === 'pending' || lastResourceRead?.status === 'loading';

  // Last prompt execution
  const lastPromptExecution = playground.prompts.executions[0];
  const promptLastMessages = lastPromptExecution?.messages;
  const promptLastError = lastPromptExecution?.error;
  const isPromptExecuting = lastPromptExecution?.status === 'pending' || lastPromptExecution?.status === 'loading';

  // Determine page state
  const isConnected = playground.connection.status === 'connected';
  const isConnecting = playground.connection.status === 'connecting';
  const hasError = playground.connection.status === 'error';

  return (
    <main id="main-content" className="relative min-h-screen flex flex-col bg-black">
      <ParticleBackground />
      <Header />

      <div className="container mx-auto px-4 pt-24 pb-8 flex-1 flex flex-col">
        {/* Back link and actions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowHistory(!showHistory)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
            <ShareButton 
              transportConfig={toComponentTransport(playground.transportConfig)}
              activeTab={playground.activeTab}
              selectedToolName={playground.selectedTool?.name}
            />
          </div>
        </motion.div>

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-neutral-800 mb-6">
            <Terminal className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-neutral-400">
              MCP <span className="text-white font-semibold">Playground</span>
            </span>
            <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
              v2
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Interactive MCP Testing
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Connect to any MCP server and test tools, resources, and prompts interactively.
          </p>
        </motion.div>

        {/* First time guide modal */}
        <AnimatePresence>
          {showFirstTimeGuide && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowFirstTimeGuide(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative max-w-2xl w-full max-h-[80vh] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowFirstTimeGuide(false)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <FirstTimeGuide onGetStarted={() => setShowFirstTimeGuide(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area with optional sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6">
          {/* Main panel */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            {/* Connection Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 md:p-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl"
            >
              <div className="flex flex-col gap-4">
                <TransportConfigurator
                  value={toComponentTransport(playground.transportConfig)}
                  onChange={handleTransportChange}
                  disabled={isConnected || isConnecting}
                />
                <ConnectionStatus
                  status={playground.connection.status}
                  sessionId={playground.connection.sessionId}
                  serverInfo={playground.connection.serverInfo}
                  capabilities={playground.connection.capabilities as AnyCapabilities}
                  error={playground.connection.error}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onDismissError={playground.connection.clearError}
                />
              </div>
            </motion.section>

            {/* Capabilities Section */}
            {isConnected ? (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 flex flex-col min-h-[400px] md:min-h-[500px] rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden"
              >
                {/* Tabs */}
                <div className="p-3 md:p-4 border-b border-neutral-800">
                  <CapabilityTabs
                    activeTab={playground.activeTab}
                    onTabChange={playground.setActiveTab}
                    capabilities={playground.connection.capabilities as AnyCapabilities}
                    counts={counts}
                  />
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden">
                  <AnimatePresence mode="wait">
                    {playground.activeTab === 'tools' && (
                      <motion.div
                        key="tools"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="h-full"
                      >
                        {playground.tools.tools.length > 0 ? (
                          <ToolsPanel
                            tools={playground.tools.tools as AnyTool[]}
                            selectedTool={playground.selectedTool as AnyTool}
                            onSelectTool={(tool: AnyTool) => playground.setSelectedTool(tool)}
                            onExecute={handleToolsPanelExecute}
                            isExecuting={isToolExecuting}
                            lastResult={toolLastResult}
                            lastError={toolLastError}
                          />
                        ) : (
                          <EmptyStates type="no-tools" />
                        )}
                      </motion.div>
                    )}

                    {playground.activeTab === 'resources' && (
                      <motion.div
                        key="resources"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="h-full"
                      >
                        {playground.resources.resources.length > 0 ? (
                          <ResourcesPanel
                            resources={playground.resources.resources as AnyResource[]}
                            selectedResource={playground.selectedResource as AnyResource}
                            onSelectResource={(res: AnyResource) => playground.setSelectedResource(res)}
                            onRead={handleResourceRead}
                            isReading={isResourceReading}
                            lastContents={resourceLastContents as any}
                            lastError={resourceLastError}
                          />
                        ) : (
                          <EmptyStates type="no-resources" />
                        )}
                      </motion.div>
                    )}

                    {playground.activeTab === 'prompts' && (
                      <motion.div
                        key="prompts"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="h-full"
                      >
                        {playground.prompts.prompts.length > 0 ? (
                          <PromptsPanel
                            prompts={playground.prompts.prompts as AnyPrompt[]}
                            selectedPrompt={playground.selectedPrompt as AnyPrompt}
                            onSelectPrompt={(prompt: AnyPrompt) => playground.setSelectedPrompt(prompt)}
                            onExecute={handlePromptExecute}
                            isExecuting={isPromptExecuting}
                            lastMessages={promptLastMessages as any}
                            lastError={promptLastError}
                          />
                        ) : (
                          <EmptyStates type="no-prompts" />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.section>
            ) : (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 flex items-center justify-center min-h-[400px] rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl"
              >
                <EmptyStates
                  type="not-connected"
                  onAction={playground.transportConfig ? handleConnect : undefined}
                />
              </motion.section>
            )}
          </div>

          {/* History sidebar - desktop */}
          <AnimatePresence>
            {showHistory && (
              <motion.aside
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="hidden lg:block w-80 flex-shrink-0"
              >
                <div className="sticky top-24 rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden">
                  <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Execution History
                    </h3>
                    <Button
                      onClick={executionHistory.clear}
                      variant="ghost"
                      size="sm"
                      className="text-neutral-400 hover:text-white"
                    >
                      Clear
                    </Button>
                  </div>
                  <ExecutionLog
                    entries={logEntries}
                    maxHeight={500}
                    onClear={executionHistory.clear}
                  />
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile history panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="lg:hidden mt-6"
            >
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden">
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Execution History
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={executionHistory.clear}
                      variant="ghost"
                      size="sm"
                      className="text-neutral-400 hover:text-white"
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={() => setShowHistory(false)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <ExecutionLog
                  entries={logEntries}
                  maxHeight={300}
                  onClear={executionHistory.clear}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </main>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function PlaygroundV2Page() {
  return (
    <Suspense fallback={<PlaygroundSkeleton />}>
      <PlaygroundV2Content />
    </Suspense>
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

function PlaygroundSkeleton() {
  return (
    <main className="relative min-h-screen flex flex-col bg-black">
      <div className="container mx-auto px-4 pt-24 pb-8 flex-1">
        {/* Header skeleton */}
        <div className="text-center mb-8">
          <div className="h-8 w-48 bg-neutral-800 rounded-full mx-auto mb-6 animate-pulse" />
          <div className="h-12 w-96 bg-neutral-800 rounded mx-auto mb-4 animate-pulse" />
          <div className="h-6 w-80 bg-neutral-800 rounded mx-auto animate-pulse" />
        </div>

        {/* Connection section skeleton */}
        <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="h-10 bg-neutral-800 rounded animate-pulse" />
              <div className="h-10 bg-neutral-800 rounded animate-pulse" />
            </div>
            <div className="lg:w-80 h-32 bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="min-h-[500px] rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
          <div className="h-10 w-64 bg-neutral-800 rounded mb-6 animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-neutral-800 rounded animate-pulse" />
            <div className="h-24 bg-neutral-800 rounded animate-pulse" />
            <div className="h-24 bg-neutral-800 rounded animate-pulse" />
            <div className="h-24 bg-neutral-800 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}
