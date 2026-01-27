/**
 * BranchSelector Component - Select branch, tag, or commit SHA
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Tag, Hash, ChevronDown, Loader2, Check, RefreshCw, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type RefType = 'branch' | 'tag' | 'commit';

export interface GitRef {
  name: string;
  type: RefType;
  sha?: string;
  isDefault?: boolean;
}

interface BranchSelectorProps {
  owner: string;
  repo: string;
  selectedRef: GitRef | null;
  onRefChange: (ref: GitRef | null) => void;
  className?: string;
  disabled?: boolean;
}

const REF_TYPE_ICONS: Record<RefType, typeof GitBranch> = {
  branch: GitBranch,
  tag: Tag,
  commit: Hash,
};

const REF_TYPE_COLORS: Record<RefType, string> = {
  branch: 'text-green-400',
  tag: 'text-blue-400',
  commit: 'text-orange-400',
};

export default function BranchSelector({
  owner,
  repo,
  selectedRef,
  onRefChange,
  className = '',
  disabled = false,
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RefType>('branch');
  const [branches, setBranches] = useState<GitRef[]>([]);
  const [tags, setTags] = useState<GitRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch branches and tags from GitHub API
  const fetchRefs = useCallback(async () => {
    if (!owner || !repo) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch branches
      const branchesRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`
      );
      
      if (!branchesRes.ok) {
        throw new Error('Failed to fetch branches');
      }
      
      const branchesData = await branchesRes.json();
      
      // Fetch default branch info
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      const repoData = repoRes.ok ? await repoRes.json() : { default_branch: 'main' };
      const defaultBranch = repoData.default_branch;

      const branchRefs: GitRef[] = branchesData.map((b: { name: string; commit: { sha: string } }) => ({
        name: b.name,
        type: 'branch' as RefType,
        sha: b.commit.sha,
        isDefault: b.name === defaultBranch,
      }));

      // Sort to put default branch first
      branchRefs.sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });

      setBranches(branchRefs);

      // Set default branch as selected if nothing selected
      if (!selectedRef) {
        const defaultRef = branchRefs.find(b => b.isDefault) || branchRefs[0];
        if (defaultRef) {
          onRefChange(defaultRef);
        }
      }

      // Fetch tags
      const tagsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`
      );
      
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        const tagRefs: GitRef[] = tagsData.map((t: { name: string; commit: { sha: string } }) => ({
          name: t.name,
          type: 'tag' as RefType,
          sha: t.commit.sha,
        }));
        setTags(tagRefs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch refs');
    } finally {
      setIsLoading(false);
    }
  }, [owner, repo, selectedRef, onRefChange]);

  // Fetch refs when owner/repo changes
  useEffect(() => {
    if (owner && repo) {
      fetchRefs();
    }
  }, [owner, repo, fetchRefs]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRefSelect = useCallback((ref: GitRef) => {
    onRefChange(ref);
    setIsOpen(false);
    setSearchQuery('');
  }, [onRefChange]);

  const handleCommitSubmit = useCallback(() => {
    if (commitSha.trim()) {
      onRefChange({
        name: commitSha.trim().substring(0, 7),
        type: 'commit',
        sha: commitSha.trim(),
      });
      setIsOpen(false);
      setCommitSha('');
    }
  }, [commitSha, onRefChange]);

  const handleClear = useCallback(() => {
    onRefChange(null);
    const defaultBranch = branches.find(b => b.isDefault);
    if (defaultBranch) {
      onRefChange(defaultBranch);
    }
  }, [branches, onRefChange]);

  // Filter refs based on search
  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: 'branch' as RefType, label: 'Branches', count: branches.length },
    { id: 'tag' as RefType, label: 'Tags', count: tags.length },
    { id: 'commit' as RefType, label: 'Commit' },
  ];

  if (!owner || !repo) {
    return null;
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all ${
          isOpen
            ? 'border-neutral-600 bg-white/10 text-white'
            : 'border-neutral-700 bg-black/50 text-neutral-300 hover:border-neutral-600 hover:text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : selectedRef ? (
          <>
            {(() => {
              const Icon = REF_TYPE_ICONS[selectedRef.type];
              return <Icon className={`w-4 h-4 ${REF_TYPE_COLORS[selectedRef.type]}`} />;
            })()}
            <span className="max-w-[120px] truncate">{selectedRef.name}</span>
            {selectedRef.isDefault && (
              <span className="text-xs text-neutral-500">(default)</span>
            )}
          </>
        ) : (
          <>
            <GitBranch className="w-4 h-4" />
            <span>Select ref</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 mt-2 w-72 rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex border-b border-neutral-800">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-white bg-white/5 border-b-2 border-white'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1 text-neutral-500">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            {activeTab !== 'commit' && (
              <div className="p-2 border-b border-neutral-800">
                <Input
                  type="text"
                  placeholder={`Search ${activeTab}s...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Content */}
            <div className="max-h-64 overflow-y-auto">
              {activeTab === 'branch' && (
                <div className="py-1">
                  {filteredBranches.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-neutral-500">
                      {searchQuery ? 'No matching branches' : 'No branches found'}
                    </div>
                  ) : (
                    filteredBranches.map((branch) => (
                      <RefItem
                        key={branch.name}
                        ref={branch}
                        isSelected={selectedRef?.name === branch.name && selectedRef?.type === 'branch'}
                        onSelect={() => handleRefSelect(branch)}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'tag' && (
                <div className="py-1">
                  {filteredTags.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-neutral-500">
                      {searchQuery ? 'No matching tags' : 'No tags found'}
                    </div>
                  ) : (
                    filteredTags.map((tag) => (
                      <RefItem
                        key={tag.name}
                        ref={tag}
                        isSelected={selectedRef?.name === tag.name && selectedRef?.type === 'tag'}
                        onSelect={() => handleRefSelect(tag)}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'commit' && (
                <div className="p-3 space-y-3">
                  <p className="text-xs text-neutral-400">
                    Enter a specific commit SHA to use
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Enter commit SHA..."
                      value={commitSha}
                      onChange={(e) => setCommitSha(e.target.value)}
                      className="h-9 text-sm font-mono"
                      maxLength={40}
                    />
                    <Button
                      size="sm"
                      onClick={handleCommitSubmit}
                      disabled={!commitSha.trim()}
                    >
                      Use
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {error && (
              <div className="px-3 py-2 border-t border-neutral-800 bg-red-500/10">
                <p className="text-xs text-red-400 flex items-center gap-2">
                  <X className="w-3 h-3" />
                  {error}
                </p>
              </div>
            )}

            <div className="px-3 py-2 border-t border-neutral-800 flex items-center justify-between">
              <button
                onClick={fetchRefs}
                className="text-xs text-neutral-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
              {selectedRef && !selectedRef.isDefault && (
                <button
                  onClick={handleClear}
                  className="text-xs text-neutral-500 hover:text-white transition-colors"
                >
                  Reset to default
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Individual ref item component
interface RefItemProps {
  ref: GitRef;
  isSelected: boolean;
  onSelect: () => void;
}

function RefItem({ ref, isSelected, onSelect }: RefItemProps) {
  const Icon = REF_TYPE_ICONS[ref.type];

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
        isSelected
          ? 'bg-white/10 text-white'
          : 'text-neutral-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${REF_TYPE_COLORS[ref.type]}`} />
      <span className="flex-1 text-left truncate">{ref.name}</span>
      {ref.isDefault && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
          default
        </span>
      )}
      {isSelected && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
    </button>
  );
}
