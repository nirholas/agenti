/**
 * TransportConfigurator Component - Configure MCP transport settings
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Globe,
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Code2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  TransportConfig,
  TransportType,
  StdioTransportConfig,
  SseTransportConfig,
  StreamableHttpTransportConfig,
} from './types';

export interface TransportConfiguratorProps {
  /** Current transport configuration */
  value: TransportConfig | null;
  /** Callback when configuration changes */
  onChange: (config: TransportConfig) => void;
  /** Whether the configurator is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when test connection is requested */
  onTestConnection?: (config: TransportConfig) => void;
}

interface EnvVariable {
  key: string;
  value: string;
}

interface Header {
  key: string;
  value: string;
}

const TRANSPORT_OPTIONS: { type: TransportType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    type: 'stdio',
    label: 'STDIO',
    icon: <Terminal className="w-4 h-4" />,
    description: 'Run a local MCP server command',
  },
  {
    type: 'sse',
    label: 'SSE',
    icon: <Globe className="w-4 h-4" />,
    description: 'Connect to a Server-Sent Events endpoint',
  },
  {
    type: 'streamable-http',
    label: 'Streamable HTTP',
    icon: <Zap className="w-4 h-4" />,
    description: 'Connect to a Streamable HTTP endpoint',
  },
];

/**
 * TransportConfigurator - Configure MCP transport settings
 */
export default function TransportConfigurator({
  value,
  onChange,
  disabled = false,
  className = '',
  onTestConnection,
}: TransportConfiguratorProps) {
  // Local state for form inputs
  const [transportType, setTransportType] = useState<TransportType>(value?.type || 'stdio');
  const [command, setCommand] = useState<string>(
    value?.type === 'stdio' ? value.command : ''
  );
  const [args, setArgs] = useState<string>(
    value?.type === 'stdio' && value.args ? value.args.join(' ') : ''
  );
  const [envVars, setEnvVars] = useState<EnvVariable[]>(() => {
    if (value?.type === 'stdio' && value.env) {
      return Object.entries(value.env).map(([key, val]) => ({ key, value: val }));
    }
    return [];
  });
  const [url, setUrl] = useState<string>(
    value?.type === 'sse' || value?.type === 'streamable-http' ? value.url : ''
  );
  const [headers, setHeaders] = useState<Header[]>(() => {
    if ((value?.type === 'sse' || value?.type === 'streamable-http') && value.headers) {
      return Object.entries(value.headers).map(([key, val]) => ({ key, value: val }));
    }
    return [];
  });
  const [generatedCode, setGeneratedCode] = useState<string>(
    value?.type === 'stdio' && value.generatedCode ? value.generatedCode : ''
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showCodeInput, setShowCodeInput] = useState<boolean>(
    value?.type === 'stdio' && !!value.generatedCode
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Build config from current form state
  const buildConfig = useCallback((): TransportConfig | null => {
    if (transportType === 'stdio') {
      if (showCodeInput) {
        if (!generatedCode.trim()) {
          setValidationError('Generated code is required');
          return null;
        }
        return {
          type: 'stdio',
          command: 'npx',
          args: ['tsx'],
          generatedCode: generatedCode.trim(),
        };
      } else {
        if (!command.trim()) {
          setValidationError('Command is required');
          return null;
        }
        const config: StdioTransportConfig = {
          type: 'stdio',
          command: command.trim(),
        };
        if (args.trim()) {
          config.args = args.split(/\s+/).filter(Boolean);
        }
        if (envVars.length > 0) {
          const env: Record<string, string> = {};
          for (const { key, value } of envVars) {
            if (key.trim()) {
              env[key.trim()] = value;
            }
          }
          if (Object.keys(env).length > 0) {
            config.env = env;
          }
        }
        return config;
      }
    } else {
      if (!url.trim()) {
        setValidationError('URL is required');
        return null;
      }
      try {
        new URL(url.trim());
      } catch {
        setValidationError('Invalid URL format');
        return null;
      }
      const config: SseTransportConfig | StreamableHttpTransportConfig = {
        type: transportType,
        url: url.trim(),
      };
      if (headers.length > 0) {
        const hdrs: Record<string, string> = {};
        for (const { key, value } of headers) {
          if (key.trim()) {
            hdrs[key.trim()] = value;
          }
        }
        if (Object.keys(hdrs).length > 0) {
          config.headers = hdrs;
        }
      }
      return config;
    }
  }, [transportType, command, args, envVars, url, headers, generatedCode, showCodeInput]);

  // Emit changes when form state updates
  useEffect(() => {
    setValidationError(null);
    const config = buildConfig();
    if (config) {
      onChange(config);
    }
  }, [transportType, command, args, envVars, url, headers, generatedCode, showCodeInput]);

  // Handlers for environment variables
  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', val: string) => {
    const newVars = [...envVars];
    newVars[index] = { ...newVars[index], [field]: val };
    setEnvVars(newVars);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  // Handlers for headers
  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [field]: val };
    setHeaders(newHeaders);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  // Handle test connection
  const handleTestConnection = () => {
    setValidationError(null);
    const config = buildConfig();
    if (config && onTestConnection) {
      onTestConnection(config);
    }
  };

  return (
    <div className={cn('rounded-xl border border-neutral-800 bg-neutral-900/50 p-4', className)}>
      {/* Transport Type Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Transport Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TRANSPORT_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              disabled={disabled}
              onClick={() => setTransportType(option.type)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all',
                transportType === option.type
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {option.icon}
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {TRANSPORT_OPTIONS.find((o) => o.type === transportType)?.description}
        </p>
      </div>

      {/* STDIO Configuration */}
      {transportType === 'stdio' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          {/* Toggle between command and code */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowCodeInput(false)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-lg transition-colors',
                !showCodeInput
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-neutral-300'
              )}
            >
              Command
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowCodeInput(true)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5',
                showCodeInput
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-neutral-300'
              )}
            >
              <Code2 className="w-3 h-3" />
              Generated Code
            </button>
          </div>

          {showCodeInput ? (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                MCP Server Code
              </label>
              <textarea
                value={generatedCode}
                onChange={(e) => setGeneratedCode(e.target.value)}
                disabled={disabled}
                placeholder="Paste your generated MCP server code here..."
                className={cn(
                  'w-full h-40 px-3 py-2 text-sm font-mono rounded-lg border bg-black text-white',
                  'placeholder:text-neutral-500 resize-y',
                  'focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-neutral-600',
                  disabled && 'opacity-50 cursor-not-allowed',
                  'border-neutral-700'
                )}
              />
              <p className="mt-1 text-xs text-neutral-500">
                The code will be executed with tsx. Make sure it&apos;s a valid MCP server.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Command
                </label>
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g., npx, node, python"
                  leftIcon={<Terminal className="w-4 h-4" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Arguments
                </label>
                <Input
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  disabled={disabled}
                  placeholder="e.g., @modelcontextprotocol/server-everything"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Space-separated arguments to pass to the command
                </p>
              </div>
            </>
          )}

          {/* Advanced: Environment Variables */}
          {!showCodeInput && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
              >
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Environment Variables
                {envVars.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {envVars.length}
                  </Badge>
                )}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 space-y-2"
                  >
                    {envVars.map((envVar, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={envVar.key}
                          onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                          disabled={disabled}
                          placeholder="KEY"
                          className="flex-1 font-mono text-xs"
                        />
                        <span className="text-neutral-500">=</span>
                        <Input
                          value={envVar.value}
                          onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                          disabled={disabled}
                          placeholder="value"
                          className="flex-1 font-mono text-xs"
                          type="password"
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeEnvVar(index)}
                          disabled={disabled}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addEnvVar}
                      disabled={disabled}
                      leftIcon={<Plus className="w-3 h-3" />}
                    >
                      Add Variable
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}

      {/* SSE / Streamable HTTP Configuration */}
      {(transportType === 'sse' || transportType === 'streamable-http') && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Server URL
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={disabled}
              placeholder={
                transportType === 'sse'
                  ? 'https://example.com/sse'
                  : 'https://example.com/mcp'
              }
              leftIcon={<Globe className="w-4 h-4" />}
            />
          </div>

          {/* Headers */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
            >
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              HTTP Headers
              {headers.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {headers.length}
                </Badge>
              )}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-2"
                >
                  {headers.map((header, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={header.key}
                        onChange={(e) => updateHeader(index, 'key', e.target.value)}
                        disabled={disabled}
                        placeholder="Header-Name"
                        className="flex-1 font-mono text-xs"
                      />
                      <span className="text-neutral-500">:</span>
                      <Input
                        value={header.value}
                        onChange={(e) => updateHeader(index, 'value', e.target.value)}
                        disabled={disabled}
                        placeholder="value"
                        className="flex-1 font-mono text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeHeader(index)}
                        disabled={disabled}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addHeader}
                    disabled={disabled}
                    leftIcon={<Plus className="w-3 h-3" />}
                  >
                    Add Header
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Validation Error */}
      <AnimatePresence>
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 flex items-center gap-2 text-sm text-red-400"
          >
            <AlertCircle className="w-4 h-4" />
            {validationError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Connection Button */}
      {onTestConnection && (
        <div className="mt-4 pt-4 border-t border-neutral-800">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={disabled}
          >
            Test Connection
          </Button>
        </div>
      )}
    </div>
  );
}
