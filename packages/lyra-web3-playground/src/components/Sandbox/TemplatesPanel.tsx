/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Templates Panel for Web Sandbox
 */

import { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Layers,
  Code2,
  Wallet,
  Layout,
  Globe,
  Gamepad2,
  Wrench,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react';
import { webTemplates, searchWebTemplates, WebTemplate } from '@/utils/webTemplates';
import { cn } from '@/utils/helpers';

interface TemplatesPanelProps {
  onSelectTemplate: (files: { id: string; name: string; language: string; content: string; isEntry?: boolean }[]) => void;
  onClose?: () => void;
}

const CATEGORIES = [
  { id: 'all', name: 'All', icon: Layers },
  { id: 'starter', name: 'Starter', icon: Code2 },
  { id: 'web3', name: 'Web3', icon: Wallet },
  { id: 'ui', name: 'UI', icon: Layout },
  { id: 'api', name: 'API', icon: Globe },
  { id: 'game', name: 'Games', icon: Gamepad2 },
  { id: 'utility', name: 'Utility', icon: Wrench },
] as const;

const DIFFICULTY_COLORS = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
};

export default function TemplatesPanel({ onSelectTemplate, onClose }: TemplatesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'ai'>('templates');

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let results = searchQuery ? searchWebTemplates(searchQuery) : webTemplates;
    if (selectedCategory !== 'all') {
      results = results.filter(t => t.category === selectedCategory);
    }
    return results;
  }, [searchQuery, selectedCategory]);

  // AI generation (matches closest template)
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    
    try {
      await new Promise(r => setTimeout(r, 1500)); // Simulate AI
      
      const matches = searchWebTemplates(aiPrompt);
      const template = matches[0] || webTemplates[0];
      
      const filesWithIds = template.files.map((f, i) => ({
        ...f,
        id: `${template.id}-${i}-${Date.now()}`
      }));
      
      onSelectTemplate(filesWithIds);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectTemplate = (template: WebTemplate) => {
    const filesWithIds = template.files.map((f, i) => ({
      ...f,
      id: `${template.id}-${i}-${Date.now()}`
    }));
    onSelectTemplate(filesWithIds);
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          Templates
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('templates')}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors",
            activeTab === 'templates'
              ? "text-primary-400 border-b-2 border-primary-500"
              : "text-gray-400 hover:text-white"
          )}
        >
          Templates
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2",
            activeTab === 'ai'
              ? "text-primary-400 border-b-2 border-primary-500"
              : "text-gray-400 hover:text-white"
          )}
        >
          <Sparkles className="w-4 h-4" />
          AI Builder
        </button>
      </div>

      {activeTab === 'ai' ? (
        /* AI Builder Tab */
        <div className="p-4 flex flex-col gap-4">
          <p className="text-sm text-gray-400">
            Describe what you want to build and AI will generate it.
          </p>
          
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., A crypto wallet dashboard with balance display..."
            className="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:border-primary-500"
          />
          
          <button
            onClick={handleAIGenerate}
            disabled={isGenerating || !aiPrompt.trim()}
            className="w-full py-3 bg-gradient-to-r from-primary-600 to-purple-600 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>

          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Try these:</p>
            <div className="flex flex-wrap gap-2">
              {['Wallet connect UI', 'NFT gallery', 'Todo app', 'Dashboard'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setAiPrompt(prompt)}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Templates Tab */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="px-3 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    selectedCategory === cat.id
                      ? "bg-primary-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Template List */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No templates found
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full p-4 bg-gray-900 hover:bg-gray-700 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate group-hover:text-primary-400 transition-colors">
                        {template.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-primary-400 flex-shrink-0 ml-2" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      DIFFICULTY_COLORS[template.difficulty]
                    )}>
                      {template.difficulty}
                    </span>
                    <span className="text-xs text-gray-600">
                      {template.files.length} files
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
