/**
 * Config Tabs Component - Platform configuration snippets
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Copy,
  Check,
  ExternalLink,
  Terminal,
  FileJson,
  Bot,
  Zap,
  MessageCircle,
} from 'lucide-react';
import type { ConversionResult } from '@/types';
import { PLATFORMS } from '@/lib/constants';
import { CodeBlock } from '@/components/ui/code-block';

interface ConfigTabsProps {
  result: ConversionResult;
  onCopy: (text: string, id: string) => void;
  copied: string | null;
}

type Platform = 'claude' | 'cursor' | 'openai';

const PLATFORM_INFO: Record<Platform, { icon: typeof Bot; label: string; color: string }> = {
  claude: { icon: Bot, label: 'Claude Desktop', color: 'from-orange-500/20 to-orange-600/10' },
  cursor: { icon: Zap, label: 'Cursor', color: 'from-blue-500/20 to-blue-600/10' },
  openai: { icon: MessageCircle, label: 'ChatGPT', color: 'from-green-500/20 to-green-600/10' },
};

export default function ConfigTabs({ result, onCopy, copied }: ConfigTabsProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>('claude');
  const [codeLanguage, setCodeLanguage] = useState<'typescript' | 'python'>('typescript');

  const platforms: Platform[] = ['claude', 'cursor', 'openai'];

  const getConfigForPlatform = (platform: Platform): string => {
    if (codeLanguage === 'python' && result.claudePythonConfig) {
      return result.claudePythonConfig;
    }
    
    switch (platform) {
      case 'claude':
        return result.claudeConfig;
      case 'cursor':
        return result.cursorConfig;
      case 'openai':
        return result.openaiConfig || result.claudeConfig;
      default:
        return result.claudeConfig;
    }
  };

  const platformData = PLATFORMS[activePlatform];

  return (
    <div className="space-y-6">
      {/* Platform selector */}
      <div className="flex flex-wrap gap-3">
        {platforms.map((platform) => {
          const info = PLATFORM_INFO[platform];
          const Icon = info.icon;
          const isActive = activePlatform === platform;

          return (
            <button
              key={platform}
              onClick={() => setActivePlatform(platform)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-neutral-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {info.label}
            </button>
          );
        })}
      </div>

      {/* Language toggle for config */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">Language:</span>
        <button
          onClick={() => setCodeLanguage('typescript')}
          className={`px-3 py-1 rounded text-sm transition-all ${
            codeLanguage === 'typescript'
              ? 'bg-white/10 text-white'
              : 'text-neutral-500 hover:text-white'
          }`}
        >
          TypeScript
        </button>
        {result.pythonCode && (
          <button
            onClick={() => setCodeLanguage('python')}
            className={`px-3 py-1 rounded text-sm transition-all ${
              codeLanguage === 'python'
                ? 'bg-white/10 text-white'
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            Python
          </button>
        )}
      </div>

      {/* Config content */}
      <motion.div
        key={`${activePlatform}-${codeLanguage}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Platform info card */}
        <div className={`rounded-xl border border-neutral-800 p-4 bg-gradient-to-br ${PLATFORM_INFO[activePlatform].color}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                {PLATFORM_INFO[activePlatform].label} Configuration
              </h3>
              <p className="text-sm text-neutral-400">
                Add this to your {platformData?.name || activePlatform} config file
              </p>
            </div>
            {platformData?.docsUrl && (
              <a
                href={platformData.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-black/20 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Docs
              </a>
            )}
          </div>

          {platformData?.configPath && (
            <div className="mt-4 flex items-center gap-2">
              <FileJson className="w-4 h-4 text-neutral-500" />
              <code className="text-xs text-neutral-400 font-mono">
                {platformData.configPath}
              </code>
            </div>
          )}
        </div>

        {/* Config code block */}
        <div className="relative">
          <div className="absolute right-3 top-3 z-10">
            <button
              onClick={() => onCopy(getConfigForPlatform(activePlatform), `config-${activePlatform}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-neutral-300 hover:text-white"
            >
              {copied === `config-${activePlatform}` ? (
                <>
                  <Check className="w-3 h-3 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <CodeBlock
            code={getConfigForPlatform(activePlatform)}
            language="json"
            showLineNumbers={false}
            maxHeight="300px"
            showCopy={false}
          />
        </div>

        {/* Installation steps */}
        <div className="rounded-xl border border-neutral-800 p-4 bg-black/30">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Quick Setup
          </h4>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white flex-shrink-0">
                1
              </span>
              <div>
                <p className="text-sm text-neutral-300">Download the server code</p>
                <code className="text-xs text-neutral-500 font-mono">
                  {result.name}-mcp-server.{codeLanguage === 'typescript' ? 'ts' : 'py'}
                </code>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white flex-shrink-0">
                2
              </span>
              <div>
                <p className="text-sm text-neutral-300">Add config to your MCP client</p>
                <code className="text-xs text-neutral-500 font-mono">
                  {platformData?.configPath || 'config.json'}
                </code>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white flex-shrink-0">
                3
              </span>
              <div>
                <p className="text-sm text-neutral-300">Restart your MCP client</p>
                <p className="text-xs text-neutral-500">The tools will be available immediately</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
