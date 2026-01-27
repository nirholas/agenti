/**
 * CapabilityTabs Component - Tab navigation for MCP capabilities
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Wrench, FileText, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CapabilityTab, McpCapabilities } from './types';

export interface CapabilityTabsProps {
  /** Currently active tab */
  activeTab: CapabilityTab;
  /** Callback when tab changes */
  onTabChange: (tab: CapabilityTab) => void;
  /** Server capabilities - determines which tabs are enabled */
  capabilities?: McpCapabilities | null;
  /** Counts for each capability */
  counts?: { tools: number; resources: number; prompts: number };
  /** Additional CSS classes */
  className?: string;
}

interface TabConfig {
  id: CapabilityTab;
  label: string;
  icon: React.ReactNode;
  capabilityKey: keyof McpCapabilities;
}

const TABS: TabConfig[] = [
  {
    id: 'tools',
    label: 'Tools',
    icon: <Wrench className="w-4 h-4" />,
    capabilityKey: 'tools',
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: <FileText className="w-4 h-4" />,
    capabilityKey: 'resources',
  },
  {
    id: 'prompts',
    label: 'Prompts',
    icon: <MessageSquare className="w-4 h-4" />,
    capabilityKey: 'prompts',
  },
];

/**
 * CapabilityTabs - Tab navigation for MCP server capabilities
 */
export default function CapabilityTabs({
  activeTab,
  onTabChange,
  capabilities,
  counts,
  className = '',
}: CapabilityTabsProps) {
  // Check if a capability is available
  const isCapabilityAvailable = (capKey: keyof McpCapabilities): boolean => {
    if (!capabilities) return true; // If no capabilities info, assume all available
    const value = capabilities[capKey];
    return value === true || (typeof value === 'object' && value !== null);
  };

  // Get count for a tab
  const getCount = (tabId: CapabilityTab): number | undefined => {
    if (!counts) return undefined;
    return counts[tabId];
  };

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-900/50 border border-neutral-800">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isEnabled = isCapabilityAvailable(tab.capabilityKey);
          const count = getCount(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => isEnabled && onTabChange(tab.id)}
              disabled={!isEnabled}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'text-white'
                  : isEnabled
                  ? 'text-neutral-400 hover:text-neutral-300'
                  : 'text-neutral-600 cursor-not-allowed'
              )}
            >
              {/* Active tab background */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white/10 rounded-md"
                  transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
                />
              )}

              {/* Tab content */}
              <span className="relative flex items-center gap-2">
                {tab.icon}
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={cn(
                      'min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-xs font-medium',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-neutral-800 text-neutral-400'
                    )}
                  >
                    {count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Disabled capability hint */}
      {capabilities && (
        <div className="mt-2 flex items-center gap-2">
          {TABS.filter((tab) => !isCapabilityAvailable(tab.capabilityKey)).map(
            (tab) => (
              <span
                key={tab.id}
                className="text-xs text-neutral-600 flex items-center gap-1"
              >
                {tab.icon}
                {tab.label} not supported
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}
