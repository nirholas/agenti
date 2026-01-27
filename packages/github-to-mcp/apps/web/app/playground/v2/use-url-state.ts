/**
 * useUrlState Hook - Sync playground state with URL parameters
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { TransportConfig, McpTool, PlaygroundTab } from '@/hooks/types';

// ============================================================================
// Types
// ============================================================================

export interface UseUrlStateOptions {
  /** Current transport configuration */
  transportConfig: TransportConfig | null;
  /** Function to update transport config */
  setTransportConfig: (config: TransportConfig) => void;
  /** Current active tab */
  activeTab: PlaygroundTab;
  /** Function to update active tab */
  setActiveTab: (tab: PlaygroundTab) => void;
  /** Currently selected tool name */
  selectedToolName?: string;
  /** List of available tools (for lookup) */
  tools: McpTool[];
  /** Function to set selected tool */
  setSelectedTool: (tool: McpTool | null) => void;
}

// ============================================================================
// URL Parameter Keys
// ============================================================================

const URL_PARAMS = {
  TRANSPORT_TYPE: 'transport',
  TRANSPORT_URL: 'url',
  TRANSPORT_COMMAND: 'command',
  TRANSPORT_ARGS: 'args',
  ACTIVE_TAB: 'tab',
  SELECTED_TOOL: 'tool',
  HEADERS: 'headers',
} as const;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUrlState(options: UseUrlStateOptions): void {
  const {
    transportConfig,
    setTransportConfig,
    activeTab,
    setActiveTab,
    selectedToolName,
    tools,
    setSelectedTool,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Ref to track if we're initializing from URL
  const initializingRef = useRef(true);
  // Ref to track previous values to avoid unnecessary updates
  const prevValuesRef = useRef({
    transportConfig: null as TransportConfig | null,
    activeTab: '' as PlaygroundTab,
    selectedToolName: '' as string | undefined,
  });

  // ============================================================================
  // Initialize from URL on mount
  // ============================================================================

  useEffect(() => {
    if (!initializingRef.current) return;
    initializingRef.current = false;

    // Parse transport config from URL
    const transportType = searchParams.get(URL_PARAMS.TRANSPORT_TYPE);
    const transportUrl = searchParams.get(URL_PARAMS.TRANSPORT_URL);
    const transportCommand = searchParams.get(URL_PARAMS.TRANSPORT_COMMAND);
    const transportArgs = searchParams.get(URL_PARAMS.TRANSPORT_ARGS);
    const headersParam = searchParams.get(URL_PARAMS.HEADERS);

    if (transportType) {
      let config: TransportConfig | null = null;

      if (transportType === 'stdio' && transportCommand) {
        config = {
          type: 'stdio',
          command: transportCommand,
          args: transportArgs ? transportArgs.split(',') : undefined,
        };
      } else if ((transportType === 'sse' || transportType === 'http') && transportUrl) {
        let headers: Record<string, string> | undefined;
        if (headersParam) {
          try {
            headers = JSON.parse(decodeURIComponent(headersParam));
          } catch {
            // Ignore invalid headers
          }
        }
        config = {
          type: transportType as 'sse' | 'http',
          url: transportUrl,
          headers,
        };
      } else if (transportType === 'websocket' && transportUrl) {
        config = {
          type: 'websocket',
          url: transportUrl,
        };
      }

      if (config) {
        setTransportConfig(config);
      }
    }

    // Parse active tab from URL
    const tabParam = searchParams.get(URL_PARAMS.ACTIVE_TAB);
    if (tabParam && ['tools', 'resources', 'prompts'].includes(tabParam)) {
      setActiveTab(tabParam as PlaygroundTab);
    }

    // Store initial values
    prevValuesRef.current = {
      transportConfig,
      activeTab,
      selectedToolName,
    };
  }, [searchParams, setTransportConfig, setActiveTab, transportConfig, activeTab, selectedToolName]);

  // ============================================================================
  // Handle selected tool from URL when tools load
  // ============================================================================

  useEffect(() => {
    const toolParam = searchParams.get(URL_PARAMS.SELECTED_TOOL);
    if (toolParam && tools.length > 0) {
      const tool = tools.find((t) => t.name === toolParam);
      if (tool) {
        setSelectedTool(tool);
      }
    }
  }, [searchParams, tools, setSelectedTool]);

  // ============================================================================
  // Update URL when state changes
  // ============================================================================

  const updateUrl = useCallback(() => {
    // Skip if values haven't changed
    if (
      prevValuesRef.current.transportConfig === transportConfig &&
      prevValuesRef.current.activeTab === activeTab &&
      prevValuesRef.current.selectedToolName === selectedToolName
    ) {
      return;
    }

    prevValuesRef.current = {
      transportConfig,
      activeTab,
      selectedToolName,
    };

    const params = new URLSearchParams();

    // Add transport config
    if (transportConfig) {
      params.set(URL_PARAMS.TRANSPORT_TYPE, transportConfig.type);
      
      if (transportConfig.type === 'stdio') {
        params.set(URL_PARAMS.TRANSPORT_COMMAND, transportConfig.command);
        if (transportConfig.args?.length) {
          params.set(URL_PARAMS.TRANSPORT_ARGS, transportConfig.args.join(','));
        }
      } else if ('url' in transportConfig) {
        params.set(URL_PARAMS.TRANSPORT_URL, transportConfig.url);
        if ('headers' in transportConfig && transportConfig.headers) {
          params.set(URL_PARAMS.HEADERS, encodeURIComponent(JSON.stringify(transportConfig.headers)));
        }
      }
    }

    // Add active tab
    if (activeTab !== 'tools') {
      params.set(URL_PARAMS.ACTIVE_TAB, activeTab);
    }

    // Add selected tool
    if (selectedToolName) {
      params.set(URL_PARAMS.SELECTED_TOOL, selectedToolName);
    }

    // Update URL without navigation
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [transportConfig, activeTab, selectedToolName, pathname, router]);

  // Debounced URL update
  useEffect(() => {
    const timeoutId = setTimeout(updateUrl, 500);
    return () => clearTimeout(timeoutId);
  }, [updateUrl]);
}

// ============================================================================
// URL Generation Utilities
// ============================================================================

/**
 * Generate a shareable URL for the current playground state
 */
export function generateShareableUrl(options: {
  transportConfig: TransportConfig | null;
  activeTab?: PlaygroundTab;
  selectedToolName?: string;
  baseUrl?: string;
}): string {
  const { transportConfig, activeTab, selectedToolName, baseUrl = '' } = options;
  const params = new URLSearchParams();

  if (transportConfig) {
    params.set(URL_PARAMS.TRANSPORT_TYPE, transportConfig.type);
    
    if (transportConfig.type === 'stdio') {
      params.set(URL_PARAMS.TRANSPORT_COMMAND, transportConfig.command);
      if (transportConfig.args?.length) {
        params.set(URL_PARAMS.TRANSPORT_ARGS, transportConfig.args.join(','));
      }
    } else if ('url' in transportConfig) {
      params.set(URL_PARAMS.TRANSPORT_URL, transportConfig.url);
    }
  }

  if (activeTab && activeTab !== 'tools') {
    params.set(URL_PARAMS.ACTIVE_TAB, activeTab);
  }

  if (selectedToolName) {
    params.set(URL_PARAMS.SELECTED_TOOL, selectedToolName);
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}/playground/v2?${queryString}` : `${baseUrl}/playground/v2`;
}

/**
 * Parse a shareable URL into playground state
 */
export function parseShareableUrl(url: string): {
  transportConfig: TransportConfig | null;
  activeTab: PlaygroundTab;
  selectedToolName: string | null;
} {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    let transportConfig: TransportConfig | null = null;
    const transportType = params.get(URL_PARAMS.TRANSPORT_TYPE);
    const transportUrl = params.get(URL_PARAMS.TRANSPORT_URL);
    const transportCommand = params.get(URL_PARAMS.TRANSPORT_COMMAND);
    const transportArgs = params.get(URL_PARAMS.TRANSPORT_ARGS);

    if (transportType === 'stdio' && transportCommand) {
      transportConfig = {
        type: 'stdio',
        command: transportCommand,
        args: transportArgs ? transportArgs.split(',') : undefined,
      };
    } else if ((transportType === 'sse' || transportType === 'http') && transportUrl) {
      transportConfig = {
        type: transportType as 'sse' | 'http',
        url: transportUrl,
      };
    }

    const activeTab = (params.get(URL_PARAMS.ACTIVE_TAB) as PlaygroundTab) || 'tools';
    const selectedToolName = params.get(URL_PARAMS.SELECTED_TOOL);

    return { transportConfig, activeTab, selectedToolName };
  } catch {
    return { transportConfig: null, activeTab: 'tools', selectedToolName: null };
  }
}

export default useUrlState;
