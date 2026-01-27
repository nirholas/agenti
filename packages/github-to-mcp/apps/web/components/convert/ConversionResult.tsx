/**
 * Conversion Result Component - Displays MCP conversion output
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Download,
  Copy,
  RefreshCw,
  Github,
  Code2,
  FileJson,
  Terminal,
  Package,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
  Layers,
  Zap,
  FileArchive,
  File,
  Play,
} from 'lucide-react';
import type { ConversionResult as ConversionResultType } from '@/types';
import { CLASSIFICATION_LABELS, SOURCE_TYPE_LABELS } from '@/lib/constants';
import { copyToClipboard, downloadAsFile, downloadAsZip, formatRelativeTime } from '@/lib/utils';
import ToolCard from './ToolCard';
import ConfigTabs from './ConfigTabs';
import OneClickInstall from './OneClickInstall';
import TryInPlayground from './TryInPlayground';
import InlinePlayground from './InlinePlayground';
import { CodeBlock } from '@/components/ui/code-block';
import ClaudeConfigExport from '@/components/ClaudeConfigExport';
import ToolList from '@/components/ToolList';
import { DeployButton } from '@/components/deploy';

interface ConversionResultProps {
  result: ConversionResultType;
  onReset: () => void;
}

type TabType = 'install' | 'tools' | 'playground' | 'code' | 'config';

export default function ConversionResult({ result, onReset }: ConversionResultProps) {
  const [activeTab, setActiveTab] = useState<TabType>('install');
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [codeLanguage, setCodeLanguage] = useState<'typescript' | 'python'>('typescript');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const handleCopy = useCallback(async (text: string, id: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  const handleDownload = useCallback((content: string, filename: string) => {
    downloadAsFile(content, filename, 'text/plain');
    setShowDownloadMenu(false);
  }, []);

  // Generate Claude Desktop config JSON
  const claudeConfig = useMemo(() => {
    return JSON.stringify({
      mcpServers: {
        [result.name]: {
          command: 'npx',
          args: ['tsx', `${result.name}-mcp-server.ts`],
        },
      },
    }, null, 2);
  }, [result.name]);

  // Generate package.json
  const packageJson = useMemo(() => {
    return JSON.stringify({
      name: `${result.name}-mcp-server`,
      version: '1.0.0',
      description: result.description || `MCP server generated from ${result.name}`,
      main: 'index.ts',
      scripts: {
        start: 'npx tsx index.ts',
        build: 'tsc',
      },
      dependencies: {
        '@modelcontextprotocol/sdk': '^1.0.0',
        'zod': '^3.22.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        'tsx': '^4.0.0',
      },
    }, null, 2);
  }, [result.name, result.description]);

  // Download all files as ZIP
  const handleDownloadZip = useCallback(async () => {
    const files = [
      { name: `${result.name}-mcp-server.ts`, content: result.code },
      { name: 'package.json', content: packageJson },
      { name: 'claude_desktop_config.json', content: claudeConfig },
      { name: 'README.md', content: `# ${result.name} MCP Server\n\n${result.description || ''}\n\n## Tools\n\n${result.tools.map(t => `- **${t.name}**: ${t.description || 'No description'}`).join('\n')}\n\n## Installation\n\n\`\`\`bash\nnpm install\nnpx tsx ${result.name}-mcp-server.ts\n\`\`\`\n` },
    ];
    
    if (result.pythonCode) {
      files.push({ name: `${result.name}_mcp_server.py`, content: result.pythonCode });
    }
    
    await downloadAsZip(files, `${result.name}-mcp-server.zip`);
    setShowDownloadMenu(false);
  }, [result, packageJson, claudeConfig]);

  // Download options
  const downloadOptions = useMemo(() => [
    { 
      id: 'zip', 
      label: 'Download All (.zip)', 
      description: 'Server code, config, README, package.json',
      icon: FileArchive,
      action: handleDownloadZip,
      highlight: true,
    },
    { 
      id: 'ts', 
      label: 'TypeScript Server', 
      description: `${result.name}-mcp-server.ts`,
      icon: Terminal,
      action: () => handleDownload(result.code, `${result.name}-mcp-server.ts`),
    },
    ...(result.pythonCode ? [{
      id: 'py',
      label: 'Python Server',
      description: `${result.name}_mcp_server.py`,
      icon: Code2,
      action: () => handleDownload(result.pythonCode!, `${result.name}_mcp_server.py`),
    }] : []),
    { 
      id: 'config', 
      label: 'Claude Config', 
      description: 'claude_desktop_config.json',
      icon: FileJson,
      action: () => handleDownload(claudeConfig, 'claude_desktop_config.json'),
    },
    { 
      id: 'package', 
      label: 'package.json', 
      description: 'Node.js dependencies',
      icon: Package,
      action: () => handleDownload(packageJson, 'package.json'),
    },
    { 
      id: 'tools', 
      label: 'Tools JSON', 
      description: 'Tool definitions only',
      icon: Layers,
      action: () => handleDownload(JSON.stringify(result.tools, null, 2), `${result.name}-tools.json`),
    },
  ], [result, handleDownload, handleDownloadZip, claudeConfig, packageJson]);

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

  const classificationInfo = CLASSIFICATION_LABELS[result.classification?.type || 'unknown'];

  const tabs = [
    { id: 'install' as const, label: 'Quick Install', icon: Zap, highlight: true },
    { id: 'tools' as const, label: 'Tools', icon: Package, count: result.tools.length },
    { id: 'playground' as const, label: 'Try It', icon: Play, highlight: false },
    { id: 'code' as const, label: 'Server Code', icon: Code2 },
    { id: 'config' as const, label: 'Config', icon: FileJson },
  ];

  // Group tools by source type
  const toolsBySource = useMemo(() => {
    const grouped: Record<string, typeof result.tools> = {};
    result.tools.forEach(tool => {
      const sourceType = tool.source?.type || 'unknown';
      if (!grouped[sourceType]) {
        grouped[sourceType] = [];
      }
      grouped[sourceType].push(tool);
    });
    return grouped;
  }, [result.tools]);

  return (
    <div className="space-y-6">
      {/* Success header - FIRST: Shows the result summary with stats and actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-neutral-800 p-6 md:p-8 bg-neutral-900/50 backdrop-blur-xl"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center">
                <Check className="w-8 h-8 text-black" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-white">{result.name}</h2>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full bg-white/10 text-white`}>
                  {classificationInfo?.icon} {classificationInfo?.label}
                </span>
              </div>
              <p className="text-neutral-400 text-sm">
                Successfully extracted {result.tools.length} tools from repository
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2.5 text-sm bg-white/5 border border-neutral-700 rounded-lg hover:border-neutral-600 hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Convert Another
            </button>
            
            {/* Deploy to Cloud button */}
            <DeployButton result={result} />
            
            {/* Download dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm bg-white text-black rounded-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                Download
                <ChevronDown className={`w-4 h-4 transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showDownloadMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowDownloadMenu(false)}
                    />
                    
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-2">
                        {downloadOptions.map((option, index) => {
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.id}
                              onClick={option.action}
                              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                                option.highlight 
                                  ? 'bg-white/10 hover:bg-white/20' 
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                option.highlight ? 'bg-white/20' : 'bg-white/5'
                              }`}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white flex items-center gap-2">
                                  {option.label}
                                  {option.highlight && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500/20 text-green-400">
                                      RECOMMENDED
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-neutral-500 truncate">
                                  {option.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-neutral-800">
          <div className="p-4 bg-black/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-white" />
              <span className="text-xs text-neutral-500">Tools</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {result.tools.length}
            </div>
          </div>
          <div className="p-4 bg-black/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">Sources</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {result.sources?.length || Object.keys(toolsBySource).length}
            </div>
          </div>
          <div className="p-4 bg-black/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Code2 className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">Lines</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {result.code.split('\n').length.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-black/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">Generated</span>
            </div>
            <div className="text-lg font-medium text-white">
              {result.generatedAt ? formatRelativeTime(result.generatedAt) : 'Just now'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden">
        {/* Tab header */}
        <div className="flex items-center border-b border-neutral-800 p-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isHighlight = 'highlight' in tab && tab.highlight;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? isHighlight 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                      : 'bg-white text-black'
                    : isHighlight
                    ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10 border border-green-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1 px-1.5 py-0.5 text-xs rounded ${
                    isActive ? 'bg-black/10' : 'bg-white/10'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {isHighlight && !isActive && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                    NEW
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'install' && (
            <OneClickInstall 
              result={result} 
              onCopy={handleCopy}
              copied={copied}
            />
          )}

          {activeTab === 'tools' && (
            <ToolList 
              tools={result.tools}
              showFilter={result.tools.length > 5}
            />
          )}

          {activeTab === 'playground' && (
            <InlinePlayground
              tools={result.tools}
              generatedCode={result.code}
            />
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              {/* Language toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCodeLanguage('typescript')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    codeLanguage === 'typescript'
                      ? 'bg-white text-black'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  TypeScript
                </button>
                {result.pythonCode && (
                  <button
                    onClick={() => setCodeLanguage('python')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      codeLanguage === 'python'
                        ? 'bg-white text-black'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Code2 className="w-4 h-4" />
                    Python
                  </button>
                )}
              </div>

              <CodeBlock
                code={codeLanguage === 'typescript' ? result.code : (result.pythonCode || '')}
                language={codeLanguage}
                filename={`${result.name}-mcp-server.${codeLanguage === 'typescript' ? 'ts' : 'py'}`}
                showCopy
                showDownload
                maxHeight="600px"
              />
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-6">
              <ClaudeConfigExport 
                serverName={result.name}
                serverDescription={result.description}
              />
              <ConfigTabs
                result={result}
                onCopy={handleCopy}
                copied={copied}
              />
            </div>
          )}
        </div>
      </div>

      {/* Try in Playground CTA - After install/config options */}
      <TryInPlayground result={result} />
    </div>
  );
}