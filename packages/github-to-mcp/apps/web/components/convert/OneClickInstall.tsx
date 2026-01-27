/**
 * One-Click Install Component - Quick installation commands for MCP servers
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, Terminal, Zap, ExternalLink, ChevronDown } from 'lucide-react';
import type { ConversionResult } from '@/types';

interface OneClickInstallProps {
  result: ConversionResult;
  onCopy?: (text: string, id: string) => void;
  copied?: string | null;
}

const PLATFORMS = {
  claude: {
    name: 'Claude Desktop',
    icon: Terminal,
    color: 'from-orange-500 to-red-600',
    configPath: {
      mac: '~/Library/Application Support/Claude/claude_desktop_config.json',
      win: '%APPDATA%\\Claude\\claude_desktop_config.json',
      linux: '~/.config/Claude/claude_desktop_config.json',
    },
    docsUrl: 'https://docs.anthropic.com/claude/docs/claude-desktop',
  },
  cursor: {
    name: 'Cursor',
    icon: Terminal,
    color: 'from-blue-500 to-cyan-600',
    configPath: {
      mac: '~/Library/Application Support/Cursor/config.json',
      win: '%APPDATA%\\Cursor\\config.json',
      linux: '~/.config/Cursor/config.json',
    },
    docsUrl: 'https://cursor.sh/docs/mcp',
  },
  vscode: {
    name: 'VS Code',
    icon: Terminal,
    color: 'from-blue-600 to-purple-600',
    configPath: {
      mac: '~/Library/Application Support/Code/User/settings.json',
      win: '%APPDATA%\\Code\\User\\settings.json',
      linux: '~/.config/Code/User/settings.json',
    },
    docsUrl: 'https://code.visualstudio.com/docs',
  },
};

export default function OneClickInstall({ result, onCopy, copied }: OneClickInstallProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof PLATFORMS>('claude');
  const [internalCopied, setInternalCopied] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const displayCopied = copied !== undefined ? copied : internalCopied;

  const handleCopy = useCallback(async (text: string, id: string) => {
    if (onCopy) {
      onCopy(text, id);
    } else {
      await navigator.clipboard.writeText(text);
      setInternalCopied(id);
      setTimeout(() => setInternalCopied(null), 2000);
    }
  }, [onCopy]);

  const getInstallCommand = (platform: keyof typeof PLATFORMS) => {
    const serverName = result.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `npx @nirholas/github-to-mcp install ${result.repository.url} --${platform}`;
  };

  const getManualConfig = (platform: keyof typeof PLATFORMS) => {
    const serverName = result.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `{
  "mcpServers": {
    "${serverName}": {
      "command": "node",
      "args": ["path/to/${serverName}-server.js"]
    }
  }
}`;
  };

  const platformInfo = PLATFORMS[selectedPlatform];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">One-Click Install</h3>
            <p className="text-sm text-neutral-400">Add to your MCP client instantly</p>
          </div>
        </div>
      </div>

      {/* Platform selector */}
      <div className="p-4 border-b border-neutral-800 bg-black/20">
        <div className="flex gap-2">
          {(Object.keys(PLATFORMS) as Array<keyof typeof PLATFORMS>).map((platform) => {
            const info = PLATFORMS[platform];
            const Icon = info.icon;
            return (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  selectedPlatform === platform
                    ? `bg-gradient-to-r ${info.color} text-white shadow-lg`
                    : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {info.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Install command */}
      <div className="p-6 space-y-4">
        {/* One-click install */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              CLI Install Command
            </label>
            <span className="text-xs text-neutral-500">Recommended</span>
          </div>

          <div className="relative group">
            <div className="flex items-center gap-2 p-4 bg-black/40 border border-neutral-800 rounded-xl font-mono text-sm">
              <span className="text-neutral-500">$</span>
              <code className="flex-1 text-green-400 overflow-x-auto whitespace-nowrap scrollbar-thin">
                {getInstallCommand(selectedPlatform)}
              </code>
              <button
                onClick={() => handleCopy(getInstallCommand(selectedPlatform), 'install-cmd')}
                className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy command"
              >
                {displayCopied === 'install-cmd' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-neutral-400" />
                )}
              </button>
            </div>
          </div>

          <p className="mt-2 text-xs text-neutral-500">
            This command will download and configure the MCP server automatically
          </p>
        </div>

        {/* Manual config option */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-neutral-800 relative z-10">
          <button
            onClick={() => setShowManual(!showManual)}
            className="flex items-center justify-between w-full text-sm text-neutral-300 hover:text-white transition-colors"
          >
            <span className="font-medium">Manual Configuration</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showManual ? 'rotate-180' : ''}`} />
          </button>

          {showManual && (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-neutral-500 mb-2">Config file location:</div>
                <code className="block p-2 bg-black/40 rounded text-xs text-neutral-300 overflow-x-auto">
                  {platformInfo.configPath.mac}
                </code>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-neutral-500">Configuration:</div>
                  <button
                    onClick={() => handleCopy(getManualConfig(selectedPlatform), 'manual-config')}
                    className="text-xs text-white/60 hover:text-white transition-colors flex items-center gap-1"
                  >
                    {displayCopied === 'manual-config' ? (
                      <>
                        <Check className="w-3 h-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-black/40 rounded text-xs text-neutral-300 overflow-x-auto">
                  {getManualConfig(selectedPlatform)}
                </pre>
              </div>

              <a
                href={platformInfo.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View {platformInfo.name} documentation
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
