/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your potential is limitless 🌌
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { LiveProvider, LivePreview, LiveError } from 'react-live';
import * as LucideIcons from 'lucide-react';
import {
  Code2,
  Eye,
  FileCode,
  FileText,
  Palette,
  Play,
  RefreshCw,
  Copy,
  Download,
  CheckCircle,
  Maximize2,
  Minimize2,
  Sparkles,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';

export interface PlaygroundFile {
  id: string;
  name: string;
  language: 'typescript' | 'javascript' | 'solidity' | 'css' | 'html' | 'json';
  code: string;
  icon?: 'react' | 'contract' | 'style' | 'config';
}

interface FullStackPlaygroundProps {
  title: string;
  description: string;
  files: PlaygroundFile[];
  scope?: Record<string, any>;
  previewStyles?: string;
}

const getFileIcon = (icon?: string, language?: string) => {
  if (icon === 'react' || language === 'typescript' || language === 'javascript') {
    return <FileCode className="w-4 h-4 text-blue-500" />;
  }
  if (icon === 'contract' || language === 'solidity') {
    return <FileText className="w-4 h-4 text-purple-500" />;
  }
  if (icon === 'style' || language === 'css') {
    return <Palette className="w-4 h-4 text-pink-500" />;
  }
  return <FileCode className="w-4 h-4 text-gray-500" />;
};

const getLanguageForMonaco = (language: string): string => {
  const map: Record<string, string> = {
    typescript: 'typescript',
    javascript: 'javascript',
    solidity: 'sol',
    css: 'css',
    html: 'html',
    json: 'json'
  };
  return map[language] || 'plaintext';
};

export default function FullStackPlayground({
  title,
  description,
  files: initialFiles,
  scope = {},
  previewStyles = ''
}: FullStackPlaygroundProps) {
  const { mode } = useThemeStore();
  const [files, setFiles] = useState<PlaygroundFile[]>(initialFiles);
  const [activeFileId, setActiveFileId] = useState(initialFiles[0]?.id || '');
  const [layout, setLayout] = useState<'split' | 'editor' | 'preview'>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const activeFile = files.find(f => f.id === activeFileId);
  
  // Find the main React component file for live preview
  const reactFile = files.find(f => 
    f.language === 'typescript' || f.language === 'javascript'
  );

  // Transform TypeScript/TSX to JavaScript for react-live
  const transformedCode = useMemo(() => {
    if (!reactFile) return '';
    
    let code = reactFile.code;
    
    // Remove TypeScript types and interfaces
    code = code
      // Remove import statements (we'll provide these via scope)
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
      // Remove export statements but keep the content
      .replace(/^export\s+default\s+/gm, '')
      .replace(/^export\s+/gm, '')
      // Remove TypeScript type annotations
      .replace(/:\s*\w+(\[\])?(\s*\|?\s*\w+)*(?=\s*[=,\)\}])/g, '')
      // Remove interface declarations
      .replace(/^interface\s+\w+\s*\{[\s\S]*?\}\s*$/gm, '')
      // Remove type declarations
      .replace(/^type\s+\w+\s*=[\s\S]*?;\s*$/gm, '')
      // Remove React.FC types
      .replace(/<\w+>/g, '')
      // Clean up empty lines
      .replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return code.trim();
  }, [reactFile?.code]);

  const handleCodeChange = (newCode: string | undefined) => {
    if (!activeFileId || !newCode) return;
    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, code: newCode } : f
    ));
  };

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const extensions: Record<string, string> = {
      typescript: 'tsx',
      javascript: 'jsx',
      solidity: 'sol',
      css: 'css',
      html: 'html',
      json: 'json'
    };
    const blob = new Blob([activeFile.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFile.name}.${extensions[activeFile.language] || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFiles(initialFiles);
    setPreviewKey(k => k + 1);
  };

  const handleRefreshPreview = () => {
    setPreviewKey(k => k + 1);
  };

  // Enhanced scope with common React and Web3 utilities
  const enhancedScope = {
    // React
    React,
    useState,
    useEffect,
    useMemo,
    useCallback,
    // Lucide icons (commonly used)
    Wallet: LucideIcons.Wallet,
    Check: LucideIcons.Check,
    X: LucideIcons.X,
    Loader: LucideIcons.Loader2,
    AlertCircle: LucideIcons.AlertCircle,
    CheckCircle: LucideIcons.CheckCircle,
    ExternalLink: LucideIcons.ExternalLink,
    Copy: LucideIcons.Copy,
    RefreshCw: LucideIcons.RefreshCw,
    // Custom scope from props
    ...scope
  };

  const containerClass = isFullscreen 
    ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4 overflow-auto'
    : '';

  return (
    <div className={`space-y-6 ${containerClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Layers className="w-6 h-6 text-primary-500" />
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Playground */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-lg">
        {/* Top Toolbar - File Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between px-2 py-1">
            {/* File Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {files.map(file => (
                <button
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    activeFileId === file.id
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-x border-blue-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {getFileIcon(file.icon, file.language)}
                  <span>{file.name}</span>
                  <span className="text-xs text-gray-400">.{file.language === 'typescript' ? 'tsx' : file.language}</span>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={handleCopy}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Copy code"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Reset all files"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1" />
              <button
                onClick={() => setLayout('editor')}
                className={`p-1.5 rounded ${layout === 'editor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                title="Editor only"
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout('split')}
                className={`p-1.5 rounded ${layout === 'split' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                title="Split view"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout('preview')}
                className={`p-1.5 rounded ${layout === 'preview' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                title="Preview only"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Editor & Preview */}
        <div className={`flex ${layout === 'split' ? 'flex-row' : 'flex-col'}`} style={{ height: isFullscreen ? 'calc(100vh - 200px)' : '600px' }}>
          {/* Editor Panel */}
          {layout !== 'preview' && (
            <div className={`${layout === 'split' ? 'w-1/2 border-r dark:border-gray-700' : 'w-full h-full'} flex flex-col`}>
              {/* File description */}
              {activeFile && (
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                  {activeFile.language === 'solidity' && '📝 Smart Contract - Compile and deploy to testnet'}
                  {activeFile.language === 'typescript' && '⚛️ React Component - Edit to see live changes'}
                  {activeFile.language === 'css' && '🎨 Styles - Customize the appearance'}
                </div>
              )}
              <div className="flex-1">
                <Editor
                  height="100%"
                  language={getLanguageForMonaco(activeFile?.language || 'typescript')}
                  value={activeFile?.code || ''}
                  onChange={handleCodeChange}
                  theme={mode === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    padding: { top: 16 }
                  }}
                />
              </div>
            </div>
          )}

          {/* Preview Panel */}
          {layout !== 'editor' && (
            <div className={`${layout === 'split' ? 'w-1/2' : 'w-full h-full'} flex flex-col bg-gray-50 dark:bg-gray-900`}>
              {/* Preview Header */}
              <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium text-sm">Live Preview</span>
                </div>
                <button
                  onClick={handleRefreshPreview}
                  className="p-1 hover:bg-white/20 rounded"
                  title="Refresh preview"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Injected Styles */}
              <style>{previewStyles}</style>
              
              {/* Live Preview Container */}
              <div className="flex-1 overflow-auto p-4">
                {reactFile ? (
                  <LiveProvider 
                    key={previewKey}
                    code={transformedCode} 
                    scope={enhancedScope}
                    noInline={true}
                  >
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-inner p-4 min-h-[200px]">
                      <LivePreview />
                    </div>
                    <LiveError className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm font-mono" />
                  </LiveProvider>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No React component to preview</p>
                      <p className="text-sm">Add a .tsx or .jsx file to see live preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Full-Stack Playground
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <FileCode className="w-4 h-4 text-blue-500 mt-0.5" />
            <div>
              <span className="font-medium">React Components</span>
              <p className="text-gray-600 dark:text-gray-400">Edit TSX/JSX with live preview</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-purple-500 mt-0.5" />
            <div>
              <span className="font-medium">Smart Contracts</span>
              <p className="text-gray-600 dark:text-gray-400">Solidity with syntax highlighting</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Palette className="w-4 h-4 text-pink-500 mt-0.5" />
            <div>
              <span className="font-medium">Styles</span>
              <p className="text-gray-600 dark:text-gray-400">CSS applied in real-time</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
