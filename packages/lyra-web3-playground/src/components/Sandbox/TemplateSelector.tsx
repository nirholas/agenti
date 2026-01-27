/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Make it work, make it right, make it beautiful ✨
 */

import { useState, useMemo } from 'react';
import { X, FileCode, Zap, Code2, Layers } from 'lucide-react';
import { sandboxTemplates, SandboxTemplate } from '@/utils/sandboxTemplates';
import { contractTemplates, ContractTemplate } from '@/utils/contractTemplates';

// Union type for both template types
type AnyTemplate = SandboxTemplate | (ContractTemplate & { _type: 'contract' });

interface TemplateSelectorProps {
  onClose: () => void;
  onSelect: (template: SandboxTemplate) => void;
  onContractSelect?: (template: ContractTemplate) => void;
  showContractTemplates?: boolean;
}

export default function TemplateSelector({ 
  onClose, 
  onSelect, 
  onContractSelect,
  showContractTemplates = true 
}: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [templateType, setTemplateType] = useState<'all' | 'workspace' | 'contract'>('all');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'basic', label: 'Basic' },
    { id: 'token', label: 'Tokens' },
    { id: 'nft', label: 'NFTs' },
    { id: 'defi', label: 'DeFi' },
    { id: 'dao', label: 'DAO' },
    { id: 'security', label: 'Security' },
    { id: 'other', label: 'Utilities' },
  ];

  // Combine templates with type markers
  const allTemplates = useMemo(() => {
    const workspace = sandboxTemplates.map(t => ({ ...t, _type: 'workspace' as const }));
    const contracts = showContractTemplates 
      ? contractTemplates.map(t => ({ ...t, _type: 'contract' as const }))
      : [];
    return [...workspace, ...contracts];
  }, [showContractTemplates]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(template => {
      // Type filter
      if (templateType !== 'all' && template._type !== templateType) {
        return false;
      }
      
      // Category filter
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      
      // Search filter
      const matchesSearch = !search || 
        template.name.toLowerCase().includes(search.toLowerCase()) ||
        template.description.toLowerCase().includes(search.toLowerCase());
      
      return matchesCategory && matchesSearch;
    });
  }, [allTemplates, templateType, selectedCategory, search]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 dark:text-green-400';
      case 'intermediate': return 'text-yellow-600 dark:text-yellow-400';
      case 'advanced': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const handleSelect = (template: typeof allTemplates[number]) => {
    if (template._type === 'contract' && onContractSelect) {
      // Extract the contract template without the _type marker
      const { _type, ...contractTemplate } = template as ContractTemplate & { _type: 'contract' };
      onContractSelect(contractTemplate as ContractTemplate);
    } else if (template._type === 'workspace') {
      const { _type, ...sandboxTemplate } = template as SandboxTemplate & { _type: 'workspace' };
      onSelect(sandboxTemplate as SandboxTemplate);
    }
  };

  // Stats
  const workspaceCount = sandboxTemplates.length;
  const contractCount = showContractTemplates ? contractTemplates.length : 0;
  const totalCount = workspaceCount + contractCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Choose a Template
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {totalCount} templates available ({workspaceCount} workspace, {contractCount} contracts)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Toggle + Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Type Toggle */}
          {showContractTemplates && (
            <div className="flex gap-2">
              <button
                onClick={() => setTemplateType('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  templateType === 'all'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Layers className="w-4 h-4" />
                All ({totalCount})
              </button>
              <button
                onClick={() => setTemplateType('workspace')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  templateType === 'workspace'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <FileCode className="w-4 h-4" />
                Workspace ({workspaceCount})
              </button>
              <button
                onClick={() => setTemplateType('contract')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  templateType === 'contract'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Code2 className="w-4 h-4" />
                Contracts ({contractCount})
              </button>
            </div>
          )}
          
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Categories */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="flex gap-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileCode className="w-16 h-16 mb-4 opacity-50" />
              <p>No templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <button
                  key={`${template._type}-${template.id}`}
                  onClick={() => handleSelect(template)}
                  className="text-left p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {template._type === 'contract' ? (
                          <Code2 className="w-4 h-4 text-purple-500" />
                        ) : (
                          <FileCode className="w-4 h-4 text-blue-500" />
                        )}
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 text-sm">
                          {template.name}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs mt-3 flex-wrap">
                    <span className={`font-medium capitalize ${getDifficultyColor(template.difficulty)}`}>
                      {template.difficulty}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {template._type === 'contract' 
                        ? ('blockchain' in template ? template.blockchain : 'ethereum')
                        : `${(template as SandboxTemplate).files.length} files`
                      }
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-600 dark:text-gray-400 capitalize">
                      {template.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            {filteredTemplates.length} templates shown • Select a template to start coding
          </p>
        </div>
      </div>
    </div>
  );
}
