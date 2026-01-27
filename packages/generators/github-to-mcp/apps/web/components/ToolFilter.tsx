/**
 * ToolFilter Component - Search and filter tools by name, description, and category
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, SlidersHorizontal, ArrowUpDown, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { SourceType } from '@/types';

export type SortOption = 'alphabetical' | 'source' | 'confidence';
export type SortDirection = 'asc' | 'desc';

export interface ToolFilterState {
  searchQuery: string;
  selectedCategories: SourceType[];
  sortBy: SortOption;
  sortDirection: SortDirection;
}

interface ToolFilterProps {
  onFilterChange: (filters: ToolFilterState) => void;
  availableCategories: SourceType[];
  totalTools: number;
  filteredCount: number;
  className?: string;
}

const CATEGORY_LABELS: Record<SourceType, { label: string; color: string }> = {
  readme: { label: 'README', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  code: { label: 'Code', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  openapi: { label: 'OpenAPI', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  graphql: { label: 'GraphQL', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  'mcp-introspect': { label: 'MCP', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  universal: { label: 'Universal', color: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30' },
  'mcp-decorator': { label: 'Decorator', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  'python-mcp': { label: 'Python MCP', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'source', label: 'By Source' },
  { value: 'confidence', label: 'By Confidence' },
];

export default function ToolFilter({
  onFilterChange,
  availableCategories,
  totalTools,
  filteredCount,
  className = '',
}: ToolFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<SourceType[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);

  const updateFilters = useCallback((updates: Partial<ToolFilterState>) => {
    const newState: ToolFilterState = {
      searchQuery: updates.searchQuery ?? searchQuery,
      selectedCategories: updates.selectedCategories ?? selectedCategories,
      sortBy: updates.sortBy ?? sortBy,
      sortDirection: updates.sortDirection ?? sortDirection,
    };
    onFilterChange(newState);
  }, [searchQuery, selectedCategories, sortBy, sortDirection, onFilterChange]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    updateFilters({ searchQuery: query });
  }, [updateFilters]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    updateFilters({ searchQuery: '' });
  }, [updateFilters]);

  const handleCategoryToggle = useCallback((category: SourceType) => {
    setSelectedCategories(prev => {
      const newCategories = prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category];
      updateFilters({ selectedCategories: newCategories });
      return newCategories;
    });
  }, [updateFilters]);

  const handleSortChange = useCallback((sort: SortOption) => {
    setSortBy(sort);
    updateFilters({ sortBy: sort });
  }, [updateFilters]);

  const handleSortDirectionToggle = useCallback(() => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    updateFilters({ sortDirection: newDirection });
  }, [sortDirection, updateFilters]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSortBy('alphabetical');
    setSortDirection('asc');
    onFilterChange({
      searchQuery: '',
      selectedCategories: [],
      sortBy: 'alphabetical',
      sortDirection: 'asc',
    });
  }, [onFilterChange]);

  const hasActiveFilters = searchQuery || selectedCategories.length > 0 || sortBy !== 'alphabetical';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search and filter toggle row */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search tools by name or description..."
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-white transition-colors rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter toggle button */}
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="default"
          onClick={() => setShowFilters(!showFilters)}
          leftIcon={<SlidersHorizontal className="w-4 h-4" />}
          className="relative"
        >
          Filters
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full" />
          )}
        </Button>
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-4">
              {/* Category chips */}
              <div>
                <label className="text-sm font-medium text-neutral-400 mb-2 block">
                  Filter by Source
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((category) => {
                    const isSelected = selectedCategories.includes(category);
                    const categoryInfo = CATEGORY_LABELS[category] || { label: category, color: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30' };
                    
                    return (
                      <button
                        key={category}
                        onClick={() => handleCategoryToggle(category)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          isSelected
                            ? categoryInfo.color
                            : 'bg-transparent border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                        }`}
                      >
                        {categoryInfo.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort options */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-neutral-400">Sort by:</label>
                  <div className="flex gap-1">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSortChange(option.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          sortBy === option.value
                            ? 'bg-white text-black'
                            : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSortDirectionToggle}
                    className="p-1.5 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                    title={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
                  >
                    <ArrowUpDown className={`w-4 h-4 transition-transform ${
                      sortDirection === 'desc' ? 'rotate-180' : ''
                    }`} />
                  </button>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-400">
          Showing <span className="text-white font-medium">{filteredCount}</span> of{' '}
          <span className="text-white font-medium">{totalTools}</span> tools
        </span>
        {hasActiveFilters && filteredCount < totalTools && (
          <button
            onClick={handleClearFilters}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
