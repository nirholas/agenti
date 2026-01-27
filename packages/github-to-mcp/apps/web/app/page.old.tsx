/**
 * GitHub to MCP Converter - Main Page
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Github,
  Zap,
  Download,
  Copy,
  Check,
  Loader2,
  Server,
  Box,
  ExternalLink,
  Star,
  Clock,
  FileCode,
  ChevronDown,
  ChevronRight,
  Trash2,
  History,
  Settings,
  AlertCircle,
  CheckCircle,
  Search,
  X,
  ArrowRight,
  ArrowLeft,
  Code2,
  FileJson,
  Terminal,
  Cpu,
  Package,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';
import { copyToClipboard, downloadAsFile, formatRelativeTime, isValidGitHubUrl, parseGitHubUrl, truncate } from '@/lib/utils';
import { EXAMPLE_REPOS, CLASSIFICATION_LABELS, SOURCE_TYPE_LABELS, PLATFORMS, APP_NAME, GITHUB_URL } from '@/lib/constants';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { ConversionResult, Tool, ConversionHistory, ApiError, ConversionStatus } from '@/types';

// Loading steps
const LOADING_STEPS = [
  { id: 'fetch', label: 'Fetching repository', icon: Github },
  { id: 'analyze', label: 'Analyzing codebase', icon: Code2 },
  { id: 'extract', label: 'Extracting tools', icon: Package },
  { id: 'generate', label: 'Generating server', icon: Terminal },
];

// Features for landing
const FEATURES = [
  {
    icon: Code2,
    title: 'Smart Extraction',
    description: 'Extracts tools from README, source code, OpenAPI specs, and GraphQL schemas',
  },
  {
    icon: FileJson,
    title: 'Ready-to-Use Config',
    description: 'Generate configs for Claude Desktop, Cursor, and other MCP clients',
  },
  {
    icon: Terminal,
    title: 'TypeScript & Python',
    description: 'Get production-ready MCP server code in both languages',
  },
  {
    icon: Cpu,
    title: 'Auto Classification',
    description: 'Detects repo type: API SDK, CLI tool, library, MCP server',
  },
];

export default function HomePage() {
  // State
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState('claude');
  const [history, setHistory] = useLocalStorage<ConversionHistory[]>('conversion-history', []);
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Loading step animation
  useEffect(() => {
    if (status === 'loading') {
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Convert handler
  const handleConvert = useCallback(async () => {
    if (!url.trim()) return;
    
    if (!isValidGitHubUrl(url.trim())) {
      setError({
        error: 'Invalid GitHub URL',
        code: 'INVALID_URL',
        details: 'Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)',
      });
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError({
          error: data.error || 'Conversion failed',
          code: data.code || 'UNKNOWN_ERROR',
          details: data.details,
          retryAfter: response.status === 429 ? parseInt(response.headers.get('Retry-After') || '60') : undefined,
        });
        setStatus('error');
        return;
      }

      setResult(data);
      setStatus('success');

      // Add to history
      const parsed = parseGitHubUrl(url.trim());
      if (parsed) {
        const entry: ConversionHistory = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url: url.trim(),
          name: data.name,
          toolCount: data.tools?.length || 0,
          classification: data.classification?.type || 'unknown',
          convertedAt: new Date().toISOString(),
        };
        setHistory(prev => [entry, ...prev.filter(h => h.url !== url.trim())].slice(0, 50));
      }
    } catch (err) {
      setError({
        error: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
        details: 'Failed to connect to the server. Please check your internet connection.',
      });
      setStatus('error');
    }
  }, [url, setHistory]);

  // Copy handler
  const handleCopy = useCallback(async (text: string, id: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedItem(id);
      setTimeout(() => setCopiedItem(null), 2000);
    }
  }, []);

  // Download handler
  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadAsFile(result.code, `${result.name}-mcp-server.ts`, 'text/typescript');
  }, [result]);

  // Toggle tool expansion
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

  // Filter tools
  const filteredTools = result?.tools.filter(tool =>
    !searchFilter || 
    tool.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchFilter.toLowerCase())
  ) || [];

  // Classification info
  const classificationInfo = result?.classification 
    ? CLASSIFICATION_LABELS[result.classification.type] || CLASSIFICATION_LABELS.unknown
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-dots opacity-30" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <a href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
                <Zap className="h-5 w-5 text-background" />
              </div>
              <span className="text-lg font-bold">{APP_NAME}</span>
            </a>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowHistory(!showHistory)}
                className="relative"
              >
                <History className="h-4 w-4" />
                {history.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                    {history.length > 9 ? '9+' : history.length}
                  </span>
                )}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                  <Github className="h-4 w-4" />
                  <span className="hidden sm:inline">GitHub</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        {/* Hero Section */}
        <section className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Free & Open Source
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Convert GitHub repos to
            <span className="block text-muted-foreground">MCP servers</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Extract tools from any GitHub repository and generate ready-to-use MCP servers for Claude, Cursor, and other AI assistants.
          </p>
        </section>

        {/* Input Section */}
        <div className="rounded-2xl border border-border bg-card p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                leftIcon={<Github className="h-4 w-4" />}
                rightIcon={
                  url ? (
                    <button onClick={() => setUrl('')} className="hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  ) : null
                }
                onKeyDown={(e) => e.key === 'Enter' && handleConvert()}
                disabled={status === 'loading'}
                className="h-12 text-base"
              />
            </div>
            <Button
              onClick={handleConvert}
              disabled={status === 'loading' || !url.trim()}
              size="lg"
              className="h-12 min-w-[140px]"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  Extract
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* Example Repos */}
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">Try:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_REPOS.map((repo) => (
                <button
                  key={repo.url}
                  onClick={() => setUrl(repo.url)}
                  className="px-3 py-1.5 text-sm bg-muted border border-border rounded-lg hover:border-muted-foreground/50 hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground"
                  disabled={status === 'loading'}
                >
                  {repo.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {status === 'error' && error && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                <AlertCircle className="h-4 w-4 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-red-500">{error.error}</h3>
                {error.details && (
                  <p className="mt-1 text-sm text-muted-foreground">{error.details}</p>
                )}
                {error.retryAfter && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Rate limited. Try again in {error.retryAfter}s.
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setStatus('idle'); setError(null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {status === 'loading' && (
          <div className="mb-8 rounded-2xl border border-border bg-card p-8">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-4">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-1">Converting Repository</h3>
              <p className="text-sm text-muted-foreground">This usually takes 10-30 seconds</p>
            </div>
            
            <div className="max-w-md mx-auto space-y-3">
              {LOADING_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === loadingStep;
                const isComplete = index < loadingStep;
                
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
                      isActive && 'bg-muted',
                      isComplete && 'opacity-60'
                    )}
                  >
                    <div className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
                      isActive && 'bg-foreground text-background',
                      isComplete && 'bg-emerald-500/20 text-emerald-600',
                      !isActive && !isComplete && 'bg-muted text-muted-foreground'
                    )}>
                      {isComplete ? (
                        <Check className="h-4 w-4" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span className={cn(
                      'text-sm font-medium',
                      isActive && 'text-foreground',
                      !isActive && 'text-muted-foreground'
                    )}>
                      {step.label}
                    </span>
                    {isActive && (
                      <div className="ml-auto flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Features - Show when idle */}
        {status === 'idle' && !result && (
          <section className="mb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((feature) => {
                const FeatureIcon = feature.icon;
                return (
                  <div key={feature.title} className="group rounded-xl border border-border p-5 bg-card hover:border-muted-foreground/30 transition-colors card-lift">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-3 group-hover:bg-muted/80 transition-colors">
                      <FeatureIcon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                );
              })}
            </div>
            
            {/* How it works */}
            <div className="mt-12 text-center">
              <h3 className="text-lg font-semibold mb-6">How it works</h3>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-bold">1</div>
                  <span className="text-sm text-muted-foreground">Paste a GitHub URL</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-bold">2</div>
                  <span className="text-sm text-muted-foreground">We analyze the repo</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-bold">3</div>
                  <span className="text-sm text-muted-foreground">Get your MCP server</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Results */}
        {status === 'success' && result && (
          <div className="space-y-6">
            {/* Success Banner */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-emerald-600 dark:text-emerald-400">Conversion Complete!</h3>
                <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70">
                  Successfully extracted {result.tools.length} tools from {result.name}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setStatus('idle'); setResult(null); }}>
                Convert Another
              </Button>
            </div>

            {/* Summary Card */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold">{result.name}</h3>
                    {result.repository?.url && (
                      <a
                        href={result.repository.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {classificationInfo && (
                      <Badge>
                        {classificationInfo.icon} {classificationInfo.label}
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {Math.round((result.classification?.confidence || 0) * 100)}% confidence
                    </Badge>
                    {result.repository?.stars && (
                      <Badge variant="secondary">
                        <Star className="mr-1 h-3 w-3" />
                        {result.repository.stars.toLocaleString()}
                      </Badge>
                    )}
                    {result.repository?.language && (
                      <Badge variant="secondary">{result.repository.language}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                    <span className="text-2xl font-bold">{result.tools.length}</span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">Tools</div>
                    <div className="text-xs text-muted-foreground">extracted</div>
                  </div>
                </div>
              </div>
              
              {/* Source Breakdown */}
              {result.sources && result.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                  {result.sources.map((source) => {
                    const sourceInfo = SOURCE_TYPE_LABELS[source.type] || { label: source.type, color: 'gray' };
                    return (
                      <Badge key={source.type} variant="secondary">
                        {sourceInfo.label}: {source.count}
                      </Badge>
                    );
                  })}
                </div>
              )}

              {result.description && (
                <p className="text-muted-foreground mt-4 pt-4 border-t border-border">{result.description}</p>
              )}
            </div>

            {/* Tools List */}
            <div className="rounded-2xl border border-border bg-card">
              <div className="p-6 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Extracted Tools</h3>
                    <Badge variant="secondary">{filteredTools.length}</Badge>
                  </div>
                  {result.tools.length > 5 && (
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Filter tools..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm transition-colors focus:border-foreground focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="max-h-[500px] space-y-2 overflow-y-auto pr-2">
                  {filteredTools.map((tool, i) => (
                    <ToolCard
                      key={`${tool.name}-${i}`}
                      tool={tool}
                      expanded={expandedTools.has(tool.name)}
                      onToggle={() => toggleToolExpansion(tool.name)}
                    />
                  ))}
                  {filteredTools.length === 0 && searchFilter && (
                    <div className="py-8 text-center text-muted-foreground">
                      No tools match "{searchFilter}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Configuration Tabs */}
            <div className="rounded-2xl border border-border bg-card">
              <div className="p-6 border-b border-border">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Configuration
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Copy the configuration for your AI assistant
                </p>
              </div>
              <div className="p-6">
                <Tabs value={activeConfigTab} onValueChange={setActiveConfigTab}>
                  <TabsList className="mb-4 w-full sm:w-auto">
                    {Object.entries(PLATFORMS).map(([key, platform]) => (
                      <TabsTrigger key={key} value={key}>
                        {platform.icon} {platform.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="claude">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Add to: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {PLATFORMS.claude.configPath}
                        </code>
                      </p>
                      <CodeBlock
                        code={result.claudeConfig || '{}'}
                        language="json"
                        filename="claude_desktop_config.json"
                        showDownload
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="cursor">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Add to: <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {PLATFORMS.cursor.configPath}
                        </code>
                      </p>
                      <CodeBlock
                        code={result.cursorConfig || '{}'}
                        language="json"
                        filename="mcp.json"
                        showDownload
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="openai">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Configuration for OpenAI-compatible clients
                      </p>
                      <CodeBlock
                        code={result.openaiConfig || result.claudeConfig || '{}'}
                        language="json"
                        filename="openai-mcp-config.json"
                        showDownload
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Generated Code */}
            <div className="rounded-2xl border border-border bg-card">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      Generated Server
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ready-to-run MCP server implementation
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(result.code, 'code')}
                    >
                      {copiedItem === 'code' ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button size="sm" onClick={handleDownload}>
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <Tabs defaultValue="typescript" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="typescript">TypeScript</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                  </TabsList>
                  <TabsContent value="typescript">
                    <CodeBlock
                      code={result.code}
                      language="typescript"
                      filename={`${result.name}-mcp-server.ts`}
                      maxHeight="400px"
                      showDownload
                    />
                  </TabsContent>
                  <TabsContent value="python">
                    <CodeBlock
                      code={result.pythonCode || '# Python code generation not available'}
                      language="python"
                      filename={`${result.name}_mcp_server.py`}
                      maxHeight="400px"
                      showDownload
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}

        {/* History Panel */}
        {showHistory && (
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-hidden bg-background border-l border-border shadow-2xl sm:w-80">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4" />
                History
              </h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              {history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No conversion history yet</p>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-red-500 hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => setHistory([])}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Clear History
                  </Button>
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setUrl(item.url);
                        setShowHistory(false);
                      }}
                      className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-muted-foreground/50"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="truncate text-sm font-medium">{item.name}</span>
                        <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                          {item.toolCount} tools
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(item.convertedAt)}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* History Overlay */}
        {showHistory && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
                <Zap className="h-4 w-4 text-background" />
              </div>
              <span className="text-sm text-muted-foreground">
                Built by{' '}
                <a
                  href="https://github.com/nirholas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline"
                >
                  nirholas
                </a>
              </span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href={`${GITHUB_URL}#readme`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Docs
              </a>
              <a
                href={`${GITHUB_URL}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Issues
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Tool Card Component
function ToolCard({
  tool,
  expanded,
  onToggle,
}: {
  tool: Tool;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sourceInfo = SOURCE_TYPE_LABELS[tool.source.type] || { label: tool.source.type, color: 'gray' };
  const hasSchema = tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-muted-foreground/30">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between p-4 text-left transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <code className="font-mono text-sm font-medium">
              {tool.name}
            </code>
            <Badge variant="secondary" className="text-[10px]">
              {sourceInfo.label}
            </Badge>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {tool.description}
          </p>
        </div>
        <div className="ml-4 shrink-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && hasSchema && (
        <div className="border-t border-border bg-muted/30 p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Parameters</h4>
          <div className="space-y-2">
            {Object.entries(tool.inputSchema.properties || {}).map(([name, prop]: [string, any]) => (
              <div key={name} className="flex flex-wrap items-center gap-2 text-sm">
                <code className="font-mono text-xs">
                  {name}
                </code>
                <Badge variant="outline" className="text-[10px]">
                  {prop.type}
                </Badge>
                {tool.inputSchema.required?.includes(name) && (
                  <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-500">
                    required
                  </Badge>
                )}
                {prop.description && (
                  <span className="text-xs text-muted-foreground">{prop.description}</span>
                )}
              </div>
            ))}
          </div>
          {tool.source.file && (
            <p className="mt-4 text-xs text-muted-foreground">
              Source: {tool.source.file}
              {tool.source.line && `:${tool.source.line}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
