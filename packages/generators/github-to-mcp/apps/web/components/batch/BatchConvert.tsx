/**
 * Batch Convert Component - Convert multiple GitHub repos to MCP servers
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  X,
  Check,
  Loader2,
  AlertCircle,
  Download,
  Github,
  Package,
  GripVertical,
  Upload,
  FileText,
  Archive,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Zap,
  Clock,
} from 'lucide-react';
import type { BatchConversionItem, BatchConversionState, ConversionResult, ApiError } from '@/types';

interface BatchConvertProps {
  onBatchComplete?: (results: Array<{ url: string; result?: ConversionResult; error?: string }>) => void;
  maxConcurrent?: number;
}

const EXAMPLE_REPOS = [
  'https://github.com/langchain-ai/langchain',
  'https://github.com/anthropics/anthropic-sdk-python',
  'https://github.com/openai/openai-python',
  'https://github.com/vercel/ai',
  'https://github.com/microsoft/autogen',
];

const isValidGithubUrl = (url: string): boolean => {
  const pattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/i;
  return pattern.test(url.trim());
};

const extractRepoInfo = (url: string): { owner: string; repo: string } | null => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }
  return null;
};

export default function BatchConvert({
  onBatchComplete,
  maxConcurrent = 3,
}: BatchConvertProps) {
  const [items, setItems] = useState<BatchConversionItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [state, setState] = useState<BatchConversionState>('idle');
  const [showImport, setShowImport] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Computed stats
  const stats = useMemo(() => {
    const pending = items.filter(i => i.status === 'pending').length;
    const converting = items.filter(i => i.status === 'converting').length;
    const success = items.filter(i => i.status === 'success').length;
    const error = items.filter(i => i.status === 'error').length;
    const total = items.length;
    const progress = total > 0 ? ((success + error) / total) * 100 : 0;
    const totalTools = items.reduce((sum, item) => sum + (item.result?.tools.length || 0), 0);
    
    return { pending, converting, success, error, total, progress, totalTools };
  }, [items]);

  // Add single URL
  const addUrl = useCallback((url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !isValidGithubUrl(trimmedUrl)) return false;
    
    // Check for duplicates
    if (items.some(item => item.url.toLowerCase() === trimmedUrl.toLowerCase())) {
      return false;
    }
    
    const newItem: BatchConversionItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      url: trimmedUrl,
      status: 'pending',
    };
    
    setItems(prev => [...prev, newItem]);
    return true;
  }, [items]);

  // Handle input submission
  const handleInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (addUrl(inputValue)) {
      setInputValue('');
    }
  }, [inputValue, addUrl]);

  // Add multiple URLs from text
  const importUrls = useCallback((text: string) => {
    const urls = text
      .split(/[\n,;]+/)
      .map(u => u.trim())
      .filter(u => isValidGithubUrl(u));
    
    let added = 0;
    urls.forEach(url => {
      if (addUrl(url)) added++;
    });
    
    return added;
  }, [addUrl]);

  // Handle file import
  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      importUrls(text);
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [importUrls]);

  // Remove item
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setItems([]);
    setState('idle');
  }, []);

  // Clear completed
  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(item => item.status !== 'success'));
  }, []);

  // Retry failed
  const retryFailed = useCallback(() => {
    setItems(prev => prev.map(item => 
      item.status === 'error' 
        ? { ...item, status: 'pending', error: undefined, progress: 0 }
        : item
    ));
  }, []);

  // Convert single item
  const convertItem = useCallback(async (item: BatchConversionItem, signal: AbortSignal) => {
    // Update to converting status
    setItems(prev => prev.map(i => 
      i.id === item.id ? { ...i, status: 'converting', progress: 10 } : i
    ));

    try {
      // Simulate progress updates (in real app, would use SSE)
      const progressInterval = setInterval(() => {
        setItems(prev => prev.map(i => 
          i.id === item.id && i.status === 'converting'
            ? { ...i, progress: Math.min((i.progress || 10) + Math.random() * 20, 90) }
            : i
        ));
      }, 500);

      // Make API call
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url }),
        signal,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json() as ApiError;
        throw new Error(errorData.error || 'Conversion failed');
      }

      const result = await response.json() as ConversionResult;
      
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, status: 'success', result, progress: 100 }
          : i
      ));
      
      return result;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setItems(prev => prev.map(i => 
          i.id === item.id 
            ? { ...i, status: 'pending', progress: 0 }
            : i
        ));
        return null;
      }
      
      setItems(prev => prev.map(i => 
        i.id === item.id 
          ? { ...i, status: 'error' as const, error: { error: err.message, code: 'CONVERSION_FAILED' }, progress: 0 }
          : i
      ));
      return null;
    }
  }, []);

  // Start batch conversion
  const startBatch = useCallback(async () => {
    if (state === 'running') return;
    
    setState('running');
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const pendingItems = items.filter(i => i.status === 'pending');
    const queue = [...pendingItems];
    const running: Promise<any>[] = [];

    while ((queue.length > 0 || running.length > 0) && !signal.aborted) {
      // Fill up to maxConcurrent
      while (queue.length > 0 && running.length < maxConcurrent) {
        const item = queue.shift()!;
        const promise = convertItem(item, signal).finally(() => {
          running.splice(running.indexOf(promise), 1);
        });
        running.push(promise);
      }

      // Wait for at least one to complete
      if (running.length > 0) {
        await Promise.race(running);
      }
    }

    // Wait for remaining
    await Promise.all(running);

    if (!signal.aborted) {
      setState('complete');
      onBatchComplete?.(items.map(i => ({
        url: i.url,
        result: i.result,
        error: i.error?.error,
      })));
    }
  }, [items, state, maxConcurrent, convertItem, onBatchComplete]);

  // Pause batch
  const pauseBatch = useCallback(() => {
    abortControllerRef.current?.abort();
    setState('paused');
  }, []);

  // Resume batch
  const resumeBatch = useCallback(() => {
    startBatch();
  }, [startBatch]);

  // Download all results
  const downloadAllResults = useCallback(() => {
    const successItems = items.filter(i => i.status === 'success' && i.result);
    
    const combined = {
      timestamp: new Date().toISOString(),
      totalRepos: successItems.length,
      totalTools: stats.totalTools,
      results: successItems.map(i => ({
        url: i.url,
        repository: i.result!.repository,
        tools: i.result!.tools,
      })),
    };
    
    const blob = new Blob([JSON.stringify(combined, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-conversion-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [items, stats.totalTools]);

  const copyUrl = useCallback(async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }, []);

  const getStatusColor = (status: BatchConversionItem['status']) => {
    switch (status) {
      case 'pending': return 'text-neutral-400';
      case 'converting': return 'text-blue-400';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
    }
  };

  const getStatusIcon = (status: BatchConversionItem['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'converting': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'success': return <Check className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Archive className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Batch Convert</h2>
            <p className="text-sm text-neutral-400">
              Convert multiple repositories in parallel
            </p>
          </div>
        </div>

        {stats.total > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-neutral-400">
              <Package className="w-4 h-4" />
              <span>{stats.totalTools} tools</span>
            </div>
            <div className="flex items-center gap-1 text-green-400">
              <Check className="w-4 h-4" />
              <span>{stats.success}/{stats.total}</span>
            </div>
            {stats.error > 0 && (
              <div className="flex items-center gap-1 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>{stats.error} failed</span>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Input section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl p-4"
      >
        <form onSubmit={handleInputSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Github className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full pl-12 pr-4 py-3 bg-black border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-white/50 transition-colors"
              disabled={state === 'running'}
            />
          </div>
          <button
            type="submit"
            disabled={!isValidGithubUrl(inputValue) || state === 'running'}
            className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </form>

        {/* Import options */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => setShowImport(!showImport)}
            className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <Upload className="w-4 h-4" />
            Import URLs
            {showImport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <span className="text-neutral-600">|</span>
          <button
            onClick={() => EXAMPLE_REPOS.forEach(url => addUrl(url))}
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Add example repos
          </button>
        </div>

        {/* Import panel */}
        <AnimatePresence>
          {showImport && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 space-y-3 overflow-hidden"
            >
              <textarea
                placeholder="Paste multiple GitHub URLs (one per line, comma, or semicolon separated)"
                className="w-full h-32 p-3 bg-black border border-neutral-700 rounded-xl text-white placeholder-neutral-500 resize-none focus:outline-none focus:border-white/50"
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    importUrls(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileImport}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Import from file
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Progress bar (when running) */}
      <AnimatePresence>
        {state === 'running' && stats.total > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Converting...</span>
              <span className="text-sm text-white">{Math.round(stats.progress)}%</span>
            </div>
            <div className="h-2 bg-black/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${stats.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
              <span>{stats.converting} converting</span>
              <span>{stats.pending} pending</span>
              <span>{stats.success} complete</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* URL list */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden"
        >
          <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
            <span className="text-sm font-medium text-white">{stats.total} Repositories</span>
            <div className="flex items-center gap-2">
              {stats.error > 0 && state !== 'running' && (
                <button
                  onClick={retryFailed}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry failed
                </button>
              )}
              {stats.success > 0 && (
                <button
                  onClick={clearCompleted}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Clear completed
                </button>
              )}
              <button
                onClick={clearAll}
                className="text-xs text-neutral-400 hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>

          <Reorder.Group
            axis="y"
            values={items}
            onReorder={setItems}
            className="divide-y divide-neutral-800"
          >
            <AnimatePresence mode="popLayout">
              {items.map((item) => {
                const repoInfo = extractRepoInfo(item.url);
                const isExpanded = expandedItem === item.id;
                
                return (
                  <Reorder.Item
                    key={item.id}
                    value={item}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-neutral-900/50"
                  >
                    <div className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        
                        <div className={`flex-shrink-0 ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white truncate">
                              {repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : item.url}
                            </span>
                            {item.result && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                {item.result.tools.length} tools
                              </span>
                            )}
                          </div>
                          {item.status === 'converting' && typeof item.progress === 'number' && (
                            <div className="mt-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                          {item.error && (
                            <p className="text-xs text-red-400 mt-1 truncate">
                              {item.error.error}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {item.result && (
                            <button
                              onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                              className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
                              title="View details"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                          <button
                            onClick={() => copyUrl(item.url)}
                            className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
                            title="Copy URL"
                          >
                            {copiedUrl === item.url ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
                            title="Open on GitHub"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          {state !== 'running' && (
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && item.result && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-3 pt-3 border-t border-neutral-800 overflow-hidden"
                          >
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <div className="text-neutral-500">Tools</div>
                                <div className="text-white font-medium">{item.result.tools.length}</div>
                              </div>
                              <div>
                                <div className="text-neutral-500">Language</div>
                                <div className="text-white font-medium">{item.result.repository.language || 'Unknown'}</div>
                              </div>
                              <div>
                                <div className="text-neutral-500">Stars</div>
                                <div className="text-white font-medium">{item.result.repository.stars?.toLocaleString() || '-'}</div>
                              </div>
                              <div>
                                <div className="text-neutral-500">Last Updated</div>
                                <div className="text-white font-medium">
                                  {item.result.repository.lastUpdated 
                                    ? new Date(item.result.repository.lastUpdated).toLocaleDateString()
                                    : '-'
                                  }
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.result.tools.slice(0, 6).map((tool, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 rounded bg-white/5 border border-neutral-700 text-neutral-300 font-mono"
                                >
                                  {tool.name}
                                </span>
                              ))}
                              {item.result.tools.length > 6 && (
                                <span className="text-xs px-2 py-1 text-neutral-500">
                                  +{item.result.tools.length - 6} more
                                </span>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>
        </motion.div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-neutral-700 p-8 text-center"
        >
          <Archive className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No repositories added</h3>
          <p className="text-neutral-400 text-sm mb-4">
            Add GitHub repository URLs to convert them to MCP servers in batch
          </p>
          <button
            onClick={() => EXAMPLE_REPOS.forEach(url => addUrl(url))}
            className="text-sm text-white underline hover:no-underline"
          >
            Add example repositories
          </button>
        </motion.div>
      )}

      {/* Action buttons */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            {state === 'idle' || state === 'complete' || state === 'paused' ? (
              <button
                onClick={startBatch}
                disabled={stats.pending === 0}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Zap className="w-5 h-5" />
                {state === 'paused' ? 'Resume' : stats.pending < stats.total ? 'Continue' : 'Start Batch'}
              </button>
            ) : (
              <button
                onClick={pauseBatch}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            )}

            {stats.success > 0 && (
              <button
                onClick={downloadAllResults}
                className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
              >
                <Download className="w-5 h-5" />
                Download All ({stats.success})
              </button>
            )}
          </div>

          <div className="text-sm text-neutral-500">
            Max {maxConcurrent} concurrent conversions
          </div>
        </motion.div>
      )}

      {/* Completion message */}
      <AnimatePresence>
        {state === 'complete' && stats.success > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Batch Conversion Complete!</h3>
            <p className="text-neutral-400 mb-4">
              Successfully converted {stats.success} repositories with {stats.totalTools} total tools.
              {stats.error > 0 && ` (${stats.error} failed)`}
            </p>
            <button
              onClick={downloadAllResults}
              className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 transition-colors mx-auto"
            >
              <Download className="w-5 h-5" />
              Download All Results
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
