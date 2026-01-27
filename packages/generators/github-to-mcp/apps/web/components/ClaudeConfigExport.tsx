/**
 * ClaudeConfigExport Component - Generate and copy Claude desktop config
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Terminal, FileJson, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { copyToClipboard, downloadAsFile } from '@/lib/utils';

interface ClaudeConfigExportProps {
  serverName: string;
  serverDescription: string;
  generatedFilePath?: string;
  className?: string;
}

type ConfigType = 'npx' | 'local' | 'python';

export default function ClaudeConfigExport({
  serverName,
  serverDescription,
  generatedFilePath,
  className = '',
}: ClaudeConfigExportProps) {
  const [copiedConfig, setCopiedConfig] = useState<ConfigType | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigType>('npx');

  // Generate the different config formats
  const configs = useMemo(() => {
    const safeName = serverName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    const npxConfig = {
      mcpServers: {
        [safeName]: {
          command: 'npx',
          args: ['-y', `@github-to-mcp/${safeName}`],
          env: {},
        },
      },
    };

    const localConfig = {
      mcpServers: {
        [safeName]: {
          command: 'node',
          args: [generatedFilePath || `./path/to/${safeName}-mcp-server.js`],
          env: {},
        },
      },
    };

    const pythonConfig = {
      mcpServers: {
        [safeName]: {
          command: 'python',
          args: ['-m', safeName.replace(/-/g, '_')],
          env: {},
        },
      },
    };

    return {
      npx: JSON.stringify(npxConfig, null, 2),
      local: JSON.stringify(localConfig, null, 2),
      python: JSON.stringify(pythonConfig, null, 2),
    };
  }, [serverName, generatedFilePath]);

  const configDescriptions: Record<ConfigType, { title: string; description: string; icon: typeof Terminal }> = {
    npx: {
      title: 'NPX (Recommended)',
      description: 'Run directly without installation using npx',
      icon: Terminal,
    },
    local: {
      title: 'Local File',
      description: 'Run from a local file path',
      icon: FileJson,
    },
    python: {
      title: 'Python',
      description: 'Run using Python module',
      icon: Terminal,
    },
  };

  const handleCopy = useCallback(async (configType: ConfigType) => {
    const success = await copyToClipboard(configs[configType]);
    if (success) {
      setCopiedConfig(configType);
      setTimeout(() => setCopiedConfig(null), 2000);
    }
  }, [configs]);

  const handleDownload = useCallback(() => {
    const fullConfig = {
      mcpServers: JSON.parse(configs[activeTab]).mcpServers,
    };
    downloadAsFile(
      JSON.stringify(fullConfig, null, 2),
      'claude_desktop_config.json',
      'application/json'
    );
  }, [configs, activeTab]);

  return (
    <div className={`rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-xl overflow-hidden ${className}`}>
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Claude Desktop Configuration</h3>
            <p className="text-sm text-neutral-400 mt-1">
              Add this to your <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">claude_desktop_config.json</code>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConfigType)} className="p-4">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          {(Object.keys(configs) as ConfigType[]).map((type) => {
            const config = configDescriptions[type];
            const Icon = config.icon;
            return (
              <TabsTrigger key={type} value={type} className="gap-2">
                <Icon className="w-3.5 h-3.5" />
                {type === 'npx' ? 'NPX' : type === 'local' ? 'Local' : 'Python'}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(configs) as ConfigType[]).map((type) => {
          const config = configDescriptions[type];
          const isCopied = copiedConfig === type;

          return (
            <TabsContent key={type} value={type}>
              <div className="space-y-3">
                <p className="text-sm text-neutral-400">{config.description}</p>
                
                <div className="relative group">
                  <pre className="p-4 bg-black/50 rounded-lg border border-neutral-800 overflow-x-auto text-sm text-neutral-300 font-mono">
                    {configs[type]}
                  </pre>
                  
                  {/* Copy button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(type)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    leftIcon={
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={isCopied ? 'check' : 'copy'}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          {isCopied ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </motion.div>
                      </AnimatePresence>
                    }
                  >
                    {isCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                {/* Instructions */}
                <div className="p-3 bg-white/5 rounded-lg border border-neutral-800">
                  <h4 className="text-xs font-medium text-neutral-300 mb-2">How to use:</h4>
                  <ol className="text-xs text-neutral-500 space-y-1 list-decimal list-inside">
                    {type === 'npx' && (
                      <>
                        <li>Open Claude Desktop settings</li>
                        <li>Navigate to MCP Servers configuration</li>
                        <li>Paste the config above into your configuration file</li>
                        <li>Restart Claude Desktop</li>
                      </>
                    )}
                    {type === 'local' && (
                      <>
                        <li>Download the generated server file</li>
                        <li>Update the path in the config to match your file location</li>
                        <li>Paste into your Claude Desktop config</li>
                        <li>Restart Claude Desktop</li>
                      </>
                    )}
                    {type === 'python' && (
                      <>
                        <li>Download the Python server file</li>
                        <li>Install dependencies: <code className="bg-white/10 px-1 rounded">pip install mcp</code></li>
                        <li>Paste the config into your Claude Desktop config</li>
                        <li>Restart Claude Desktop</li>
                      </>
                    )}
                  </ol>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
