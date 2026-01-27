/**
 * ToolList Component - Filterable and sortable tool display
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, ChevronRight, Code2, FileJson } from 'lucide-react';
import type { Tool, SourceType } from '@/types';
import ToolFilter, { type ToolFilterState, type SortOption, type SortDirection } from './ToolFilter';
import ToolCard from './convert/ToolCard';

interface ToolListProps {
  tools: Tool[];
  className?: string;
  showFilter?: boolean;
  defaultExpanded?: boolean;
}

export default function ToolList({
  tools,
  className = '',
  showFilter = true,
  defaultExpanded = false,
}: ToolListProps) {
  const [filterState, setFilterState] = useState<ToolFilterState>({
    searchQuery: '',
    selectedCategories: [],
    sortBy: 'alphabetical',
    sortDirection: 'asc',
  });
  const [expandedTools, setExpandedTools] = useState<Set<string>>(
    defaultExpanded ? new Set(tools.map(t => t.name)) : new Set()
  );

  // Get available categories from tools
  const availableCategories = useMemo(() => {
    const categories = new Set<SourceType>();
    tools.forEach(tool => {
      if (tool.source?.type) {
        categories.add(tool.source.type);
      }
    });
    return Array.from(categories);
  }, [tools]);

  // Filter and sort tools
  const filteredTools = useMemo(() => {
    let result = [...tools];

    // Apply search filter
    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase();
      result = result.filter(tool =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filterState.selectedCategories.length > 0) {
      result = result.filter(tool =>
        tool.source?.type && filterState.selectedCategories.includes(tool.source.type)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (filterState.sortBy) {
        case 'alphabetical':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'source':
          comparison = (a.source?.type || '').localeCompare(b.source?.type || '');
          break;
        case 'confidence':
          // For now, sort by whether the tool has required params (more required = higher confidence)
          const aRequired = a.inputSchema?.required?.length || 0;
          const bRequired = b.inputSchema?.required?.length || 0;
          comparison = bRequired - aRequired;
          break;
      }

      return filterState.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [tools, filterState]);

  // Group tools by source for grouped display
  const groupedTools = useMemo(() => {
    const groups: Record<string, Tool[]> = {};
    filteredTools.forEach(tool => {
      const source = tool.source?.type || 'unknown';
      if (!groups[source]) {
        groups[source] = [];
      }
      groups[source].push(tool);
    });
    return groups;
  }, [filteredTools]);

  const toggleToolExpansion = useCallback((toolName: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedTools(new Set(filteredTools.map(t => t.name)));
  }, [filteredTools]);

  const collapseAll = useCallback(() => {
    setExpandedTools(new Set());
  }, []);

  const SOURCE_LABELS: Record<string, { label: string; icon: typeof Package }> = {
    readme: { label: 'From README', icon: FileJson },
    code: { label: 'From Code', icon: Code2 },
    openapi: { label: 'From OpenAPI', icon: FileJson },
    graphql: { label: 'From GraphQL', icon: Code2 },
    'mcp-introspect': { label: 'From MCP', icon: Package },
    universal: { label: 'Universal Tools', icon: Package },
    'mcp-decorator': { label: 'From Decorators', icon: Code2 },
    'python-mcp': { label: 'From Python MCP', icon: Code2 },
    unknown: { label: 'Other', icon: Package },
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filter section */}
      {showFilter && (
        <ToolFilter
          onFilterChange={setFilterState}
          availableCategories={availableCategories}
          totalTools={tools.length}
          filteredCount={filteredTools.length}
        />
      )}

      {/* Expand/collapse all */}
      {filteredTools.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-neutral-500 hover:text-white transition-colors"
          >
            Expand all
          </button>
          <span className="text-neutral-700">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-neutral-500 hover:text-white transition-colors"
          >
            Collapse all
          </button>
        </div>
      )}

      {/* Tools list */}
      {filteredTools.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-400 mb-2">No tools found</h3>
          <p className="text-sm text-neutral-500">
            {filterState.searchQuery || filterState.selectedCategories.length > 0
              ? 'Try adjusting your filters'
              : 'No tools available'}
          </p>
        </div>
      ) : filterState.sortBy === 'source' ? (
        // Grouped view when sorting by source
        <div className="space-y-6">
          {Object.entries(groupedTools).map(([source, sourceTools]) => {
            const sourceInfo = SOURCE_LABELS[source] || SOURCE_LABELS.unknown;
            const Icon = sourceInfo.icon;

            return (
              <div key={source} className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{sourceInfo.label}</span>
                  <span className="text-neutral-600">({sourceTools.length})</span>
                </div>
                <div className="grid gap-3">
                  <AnimatePresence>
                    {sourceTools.map((tool, index) => (
                      <motion.div
                        key={tool.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <ToolItem
                          tool={tool}
                          isExpanded={expandedTools.has(tool.name)}
                          onToggle={() => toggleToolExpansion(tool.name)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Flat list view
        <div className="grid gap-3">
          <AnimatePresence>
            {filteredTools.map((tool, index) => (
              <motion.div
                key={tool.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.02 }}
              >
                <ToolItem
                  tool={tool}
                  isExpanded={expandedTools.has(tool.name)}
                  onToggle={() => toggleToolExpansion(tool.name)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Individual tool item component
interface ToolItemProps {
  tool: Tool;
  isExpanded: boolean;
  onToggle: () => void;
}

function ToolItem({ tool, isExpanded, onToggle }: ToolItemProps) {
  const SOURCE_COLORS: Record<string, string> = {
    readme: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    code: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    openapi: 'bg-green-500/10 text-green-400 border-green-500/20',
    graphql: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    'mcp-introspect': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    universal: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
    'mcp-decorator': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'python-mcp': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  };

  const sourceColor = SOURCE_COLORS[tool.source?.type || 'universal'] || SOURCE_COLORS.universal;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden hover:border-neutral-700 transition-colors">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start gap-4 text-left"
      >
        <div className="flex-shrink-0 mt-0.5">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-white truncate">{tool.name}</h4>
            {tool.source?.type && (
              <span className={`px-2 py-0.5 text-xs rounded-md border ${sourceColor}`}>
                {tool.source.type}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-400 line-clamp-2">{tool.description}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-xs text-neutral-500">
            {Object.keys(tool.inputSchema?.properties || {}).length} params
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-neutral-800 mt-0">
              <div className="pt-4">
                <h5 className="text-xs font-medium text-neutral-400 mb-2">Input Schema</h5>
                <pre className="p-3 bg-black/50 rounded-lg text-xs text-neutral-300 overflow-x-auto">
                  {JSON.stringify(tool.inputSchema, null, 2)}
                </pre>
                {tool.source?.file && (
                  <p className="mt-3 text-xs text-neutral-500">
                    Source: {tool.source.file}
                    {tool.source.line && ` (line ${tool.source.line})`}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
