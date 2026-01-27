/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Small steps lead to big achievements 🏔️
 */

/**
 * Template selector component for browsing and selecting contract templates
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Grid,
  List,
  Star,
  StarOff,
  Filter,
  ChevronDown,
  ChevronRight,
  FileCode,
} from 'lucide-react';
import {
  TemplateCategory,
  TemplateDifficulty,
  ViewMode,
  CATEGORY_INFO,
  DIFFICULTY_INFO,
  TemplatePreferences,
  DEFAULT_TEMPLATE_PREFERENCES,
} from '@/types/contracts';
import { contractTemplates, searchTemplates, ContractTemplate } from '@/utils/contractTemplates';

// Props interface for TemplateSelector - using the existing ContractTemplate type
interface TemplateSelectorProps {
  onTemplateSelect: (template: ContractTemplate) => void;
  selectedTemplate?: ContractTemplate | null;
  chainFilter?: string;
  categoryFilter?: TemplateCategory;
  className?: string;
  compact?: boolean;
}

// LocalStorage key for preferences
const PREFERENCES_KEY = 'lyra-template-preferences';

// Category mapping from existing template categories to new ones
const CATEGORY_MAP: Record<string, string> = {
  'token': 'tokens',
  'nft': 'nfts',
  'defi': 'defi',
  'dao': 'dao',
  'security': 'security',
  'bridge': 'utility',
  'other': 'utility',
  // Also support reverse mapping
  'tokens': 'tokens',
  'nfts': 'nfts',
  'basic': 'basic',
  'gaming': 'gaming',
  'utility': 'utility',
};

// Get category info with fallback
function getCategoryInfo(category: string) {
  const mappedCategory = CATEGORY_MAP[category] || category;
  return CATEGORY_INFO[mappedCategory as TemplateCategory] || {
    id: category,
    name: category.charAt(0).toUpperCase() + category.slice(1),
    description: '',
    icon: '📦',
  };
}

/**
 * Load preferences from localStorage
 */
function loadPreferences(): TemplatePreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      return { ...DEFAULT_TEMPLATE_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load template preferences:', e);
  }
  return DEFAULT_TEMPLATE_PREFERENCES;
}

/**
 * Save preferences to localStorage
 */
function savePreferences(prefs: TemplatePreferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save template preferences:', e);
  }
}

/**
 * TemplateSelector - Browse and select contract templates
 * 
 * Features:
 * - Search by name, tag, description
 * - Filter by category, difficulty, chain
 * - Grid and list view toggle
 * - Template preview cards
 * - Recently used templates
 * - Favoriting system (localStorage)
 */
export default function TemplateSelector({
  onTemplateSelect,
  selectedTemplate,
  chainFilter,
  categoryFilter,
  className = '',
  compact = false,
}: TemplateSelectorProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>(
    categoryFilter || 'all'
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<TemplateDifficulty | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [preferences, setPreferences] = useState<TemplatePreferences>(loadPreferences);
  const [showFilters, setShowFilters] = useState(!compact);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']));

  // Save preferences when they change
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  // Update view mode from preferences
  useEffect(() => {
    setViewMode(preferences.viewMode);
  }, [preferences.viewMode]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = contractTemplates;

    // Search filter
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      templates = templates.filter((t) => t.category === selectedCategory);
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all') {
      templates = templates.filter((t) => t.difficulty === selectedDifficulty);
    }

    // Chain filter - using blockchain field from existing templates
    if (chainFilter) {
      templates = templates.filter(
        (t) => t.blockchain === chainFilter || t.blockchain === 'multi'
      );
    }

    return templates;
  }, [searchQuery, selectedCategory, selectedDifficulty, chainFilter]);

  // Get recently used templates
  const recentTemplates = useMemo(() => {
    return preferences.recentlyUsed
      .slice(0, 5)
      .map((id) => contractTemplates.find((t) => t.id === id))
      .filter(Boolean) as ContractTemplate[];
  }, [preferences.recentlyUsed]);

  // Get favorite templates
  const favoriteTemplates = useMemo(() => {
    return preferences.favorites
      .map((id) => contractTemplates.find((t) => t.id === id))
      .filter(Boolean) as ContractTemplate[];
  }, [preferences.favorites]);

  // Toggle favorite
  const toggleFavorite = (templateId: string) => {
    setPreferences((prev) => {
      const favorites = prev.favorites.includes(templateId)
        ? prev.favorites.filter((id) => id !== templateId)
        : [...prev.favorites, templateId];
      return { ...prev, favorites };
    });
  };

  // Handle template selection
  const handleSelectTemplate = (template: ContractTemplate) => {
    // Add to recently used
    setPreferences((prev) => {
      const recentlyUsed = [
        template.id,
        ...prev.recentlyUsed.filter((id) => id !== template.id),
      ].slice(0, 10);
      return { ...prev, recentlyUsed };
    });

    onTemplateSelect(template);
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const groups: Record<string, ContractTemplate[]> = {};
    filteredTemplates.forEach((template) => {
      if (!groups[template.category]) {
        groups[template.category] = [];
      }
      groups[template.category].push(template);
    });
    return groups;
  }, [filteredTemplates]);

  // Categories with counts
  const categoriesWithCounts = useMemo(() => {
    return Object.entries(CATEGORY_INFO).map(([key, info]) => ({
      ...info,
      count: contractTemplates.filter((t) => t.category === key).length,
      filteredCount: filteredTemplates.filter((t) => t.category === key).length,
    }));
  }, [filteredTemplates]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* View toggle and filter button */}
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-primary-600"
          >
            <Filter className="w-3 h-3" />
            Filters
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setViewMode('grid');
                setPreferences((prev) => ({ ...prev, viewMode: 'grid' }));
              }}
              className={`p-1.5 rounded ${
                viewMode === 'grid'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setViewMode('list');
                setPreferences((prev) => ({ ...prev, viewMode: 'list' }));
              }}
              className={`p-1.5 rounded ${
                viewMode === 'list'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 space-y-2">
            {/* Category filter */}
            <div className="flex flex-wrap gap-1">
              <FilterChip
                label="All"
                isActive={selectedCategory === 'all'}
                onClick={() => setSelectedCategory('all')}
                count={contractTemplates.length}
              />
              {categoriesWithCounts.map((cat) => (
                <FilterChip
                  key={cat.id}
                  label={`${cat.icon} ${cat.name}`}
                  isActive={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  count={cat.count}
                />
              ))}
            </div>

            {/* Difficulty filter */}
            <div className="flex flex-wrap gap-1">
              <FilterChip
                label="Any Difficulty"
                isActive={selectedDifficulty === 'all'}
                onClick={() => setSelectedDifficulty('all')}
              />
              {Object.values(DIFFICULTY_INFO).map((diff) => (
                <FilterChip
                  key={diff.id}
                  label={diff.name}
                  isActive={selectedDifficulty === diff.id}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  colorClass={diff.bgClass}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Templates Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Favorites Section */}
        {favoriteTemplates.length > 0 && !searchQuery && (
          <TemplateSection
            title="⭐ Favorites"
            templates={favoriteTemplates}
            viewMode={viewMode}
            selectedTemplate={selectedTemplate}
            favorites={preferences.favorites}
            onSelect={handleSelectTemplate}
            onToggleFavorite={toggleFavorite}
            defaultExpanded
          />
        )}

        {/* Recently Used Section */}
        {recentTemplates.length > 0 && !searchQuery && (
          <TemplateSection
            title="🕐 Recently Used"
            templates={recentTemplates}
            viewMode={viewMode}
            selectedTemplate={selectedTemplate}
            favorites={preferences.favorites}
            onSelect={handleSelectTemplate}
            onToggleFavorite={toggleFavorite}
            defaultExpanded
          />
        )}

        {/* All Templates or Filtered Results */}
        {searchQuery ? (
          <TemplateSection
            title={`🔍 Search Results (${filteredTemplates.length})`}
            templates={filteredTemplates}
            viewMode={viewMode}
            selectedTemplate={selectedTemplate}
            favorites={preferences.favorites}
            onSelect={handleSelectTemplate}
            onToggleFavorite={toggleFavorite}
            defaultExpanded
          />
        ) : (
          Object.entries(templatesByCategory).map(([category, templates]) => {
            const categoryInfo = getCategoryInfo(category);
            return (
            <TemplateSection
              key={category}
              title={`${categoryInfo.icon} ${categoryInfo.name}`}
              templates={templates}
              viewMode={viewMode}
              selectedTemplate={selectedTemplate}
              favorites={preferences.favorites}
              onSelect={handleSelectTemplate}
              onToggleFavorite={toggleFavorite}
              defaultExpanded={expandedCategories.has(category) || expandedCategories.has('all')}
              onToggleExpand={() => toggleCategory(category)}
            />
          );})
        )}

        {/* No results */}
        {filteredTemplates.length === 0 && (
          <div className="p-8 text-center">
            <FileCode className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">No templates found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Filter chip component
 */
interface FilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  colorClass?: string;
}

function FilterChip({ label, isActive, onClick, count, colorClass }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2 py-1 text-xs rounded-full transition-colors
        ${isActive
          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
          : colorClass || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
        }
      `}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 opacity-60">({count})</span>
      )}
    </button>
  );
}

/**
 * Template section with header and grid/list of templates
 */
interface TemplateSectionProps {
  title: string;
  templates: ContractTemplate[];
  viewMode: ViewMode;
  selectedTemplate?: ContractTemplate | null;
  favorites: string[];
  onSelect: (template: ContractTemplate) => void;
  onToggleFavorite: (templateId: string) => void;
  defaultExpanded?: boolean;
  onToggleExpand?: () => void;
}

function TemplateSection({
  title,
  templates,
  viewMode,
  selectedTemplate,
  favorites,
  onSelect,
  onToggleFavorite,
  defaultExpanded = true,
  onToggleExpand,
}: TemplateSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggleExpand?.();
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      {/* Section header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{templates.length}</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Templates */}
      {isExpanded && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 pt-0'
              : 'space-y-1 p-3 pt-0'
          }
        >
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              viewMode={viewMode}
              isSelected={selectedTemplate?.id === template.id}
              isFavorite={favorites.includes(template.id)}
              onSelect={() => onSelect(template)}
              onToggleFavorite={() => onToggleFavorite(template.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual template card
 */
interface TemplateCardProps {
  template: ContractTemplate;
  viewMode: ViewMode;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function TemplateCard({
  template,
  viewMode,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: TemplateCardProps) {
  const difficultyInfo = DIFFICULTY_INFO[template.difficulty];

  if (viewMode === 'list') {
    return (
      <div
        onClick={onSelect}
        className={`
          flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
          ${isSelected
            ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-500'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
          }
        `}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{template.name}</span>
          </div>
          <p className="text-xs text-gray-500 truncate">{template.description}</p>
        </div>

        <span className={`text-xs px-2 py-0.5 rounded ${difficultyInfo.bgClass} ${difficultyInfo.colorClass}`}>
          {difficultyInfo.name}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
        >
          {isFavorite ? (
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          ) : (
            <StarOff className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={onSelect}
      className={`
        p-3 rounded-lg cursor-pointer transition-all border-2
        ${isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md'
          : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getCategoryInfo(template.category).icon}</span>
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
            {template.name}
          </h4>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded -mr-1 -mt-1"
        >
          {isFavorite ? (
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          ) : (
            <StarOff className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
        {template.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className={`text-xs px-2 py-0.5 rounded ${difficultyInfo.bgClass} ${difficultyInfo.colorClass}`}>
            {difficultyInfo.name}
          </span>
        </div>

        {/* Chain/Blockchain badge */}
        <div className="flex items-center gap-0.5">
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {template.blockchain}
          </span>
        </div>
      </div>

      {/* Example prompts as tags */}
      {template.examplePrompts && template.examplePrompts.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {template.examplePrompts.slice(0, 2).map((prompt, idx) => (
            <span
              key={idx}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 truncate max-w-[120px]"
              title={prompt}
            >
              {prompt.substring(0, 20)}...
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
