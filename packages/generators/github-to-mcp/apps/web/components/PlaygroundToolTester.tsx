/**
 * PlaygroundToolTester Component - Test individual tools with dynamic input forms
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2, AlertCircle, Check, Copy, ChevronDown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Tool } from '@/types';
import { copyToClipboard } from '@/lib/utils';
import type { ExecuteToolResult } from '@/hooks/use-mcp-execution';

interface PlaygroundToolTesterProps {
  tool: Tool;
  /** Handler for executing the tool. If not provided, mock execution is used in demo mode */
  onExecute?: (tool: Tool, params: Record<string, unknown>) => Promise<ExecuteToolResult | unknown>;
  /** Whether we're in demo mode (not connected to real server) */
  isDemoMode?: boolean;
  /** Whether an execution is currently in progress */
  isExecuting?: boolean;
  className?: string;
}

type InputFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

interface SchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: { type: string };
}

export default function PlaygroundToolTester({
  tool,
  onExecute,
  isDemoMode = false,
  isExecuting: externalIsExecuting,
  className = '',
}: PlaygroundToolTesterProps) {
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [internalIsExecuting, setInternalIsExecuting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSchema, setShowSchema] = useState(false);

  // Use external executing state if provided, otherwise use internal
  const isExecuting = externalIsExecuting ?? internalIsExecuting;

  // Get properties from input schema
  const properties = useMemo(() => {
    return tool.inputSchema?.properties || {};
  }, [tool]);

  const requiredFields = useMemo(() => {
    return new Set(tool.inputSchema?.required || []);
  }, [tool]);

  // Initialize default values
  const initializeParams = useCallback(() => {
    const initial: Record<string, unknown> = {};
    Object.entries(properties).forEach(([key, prop]) => {
      const property = prop as SchemaProperty;
      if (property.default !== undefined) {
        initial[key] = property.default;
      } else if (property.enum && property.enum.length > 0) {
        initial[key] = property.enum[0];
      }
    });
    setParams(initial);
  }, [properties]);

  const handleParamChange = useCallback((key: string, value: unknown) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleExecute = useCallback(async () => {
    setInternalIsExecuting(true);
    setError(null);
    setResult(null);
    setExecutionTime(null);

    const startTime = Date.now();

    try {
      if (!onExecute || isDemoMode) {
        // Mock execution for demo mode
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
        
        const mockResult = {
          success: true,
          tool: tool.name,
          params: params,
          response: {
            message: `[Demo] Successfully executed ${tool.name}`,
            timestamp: new Date().toISOString(),
            data: Object.keys(params).length > 0 ? params : { example: 'result' },
          },
        };
        setResult(mockResult);
        setExecutionTime(Date.now() - startTime);
      } else {
        // Real execution via the provided handler
        const response = await onExecute(tool, params);
        
        // Handle ExecuteToolResult type
        if (response && typeof response === 'object' && 'success' in response) {
          const execResult = response as ExecuteToolResult;
          if (!execResult.success && execResult.error) {
            setError(execResult.error);
          } else {
            setResult(execResult.result ?? execResult);
          }
          setExecutionTime(execResult.executionTime || (Date.now() - startTime));
        } else {
          setResult(response);
          setExecutionTime(Date.now() - startTime);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
      setExecutionTime(Date.now() - startTime);
    } finally {
      setInternalIsExecuting(false);
    }
  }, [tool, params, onExecute, isDemoMode]);

  const handleCopyResult = useCallback(async () => {
    if (result) {
      const success = await copyToClipboard(JSON.stringify(result, null, 2));
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [result]);

  const handleReset = useCallback(() => {
    setParams({});
    setResult(null);
    setError(null);
    setExecutionTime(null);
    initializeParams();
  }, [initializeParams]);

  // Validate required fields
  const isValid = useMemo(() => {
    for (const field of requiredFields) {
      const value = params[field];
      if (value === undefined || value === '' || value === null) {
        return false;
      }
    }
    return true;
  }, [params, requiredFields]);

  const renderField = useCallback((key: string, prop: SchemaProperty) => {
    const isRequired = requiredFields.has(key);
    const value = params[key];

    // Enum field - render as select
    if (prop.enum && prop.enum.length > 0) {
      return (
        <div key={key} className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-300 flex items-center gap-1">
            {key}
            {isRequired && <span className="text-red-400">*</span>}
          </label>
          {prop.description && (
            <p className="text-xs text-neutral-500">{prop.description}</p>
          )}
          <select
            value={value as string || ''}
            onChange={(e) => handleParamChange(key, e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-neutral-700 bg-black text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/10"
          >
            <option value="">Select...</option>
            {prop.enum.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }

    // Boolean field - render as checkbox
    if (prop.type === 'boolean') {
      return (
        <div key={key} className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean || false}
              onChange={(e) => handleParamChange(key, e.target.checked)}
              className="w-4 h-4 rounded border-neutral-700 bg-black text-white focus:ring-white/20"
            />
            <span className="text-sm font-medium text-neutral-300">
              {key}
              {isRequired && <span className="text-red-400 ml-1">*</span>}
            </span>
          </label>
          {prop.description && (
            <p className="text-xs text-neutral-500 ml-6">{prop.description}</p>
          )}
        </div>
      );
    }

    // Number field
    if (prop.type === 'number' || prop.type === 'integer') {
      return (
        <div key={key} className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-300 flex items-center gap-1">
            {key}
            {isRequired && <span className="text-red-400">*</span>}
          </label>
          {prop.description && (
            <p className="text-xs text-neutral-500">{prop.description}</p>
          )}
          <Input
            type="number"
            value={value as number || ''}
            onChange={(e) => handleParamChange(key, e.target.value ? Number(e.target.value) : undefined)}
            placeholder={`Enter ${key}...`}
          />
        </div>
      );
    }

    // Array or object field - render as textarea
    if (prop.type === 'array' || prop.type === 'object') {
      return (
        <div key={key} className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-300 flex items-center gap-1">
            {key}
            {isRequired && <span className="text-red-400">*</span>}
            <span className="text-xs text-neutral-500 font-normal">({prop.type})</span>
          </label>
          {prop.description && (
            <p className="text-xs text-neutral-500">{prop.description}</p>
          )}
          <textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : (value as string || '')}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleParamChange(key, parsed);
              } catch {
                handleParamChange(key, e.target.value);
              }
            }}
            placeholder={`Enter ${prop.type === 'array' ? '["item1", "item2"]' : '{"key": "value"}'}`}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-neutral-700 bg-black text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/10 resize-y"
          />
        </div>
      );
    }

    // Default string field
    return (
      <div key={key} className="space-y-1.5">
        <label className="text-sm font-medium text-neutral-300 flex items-center gap-1">
          {key}
          {isRequired && <span className="text-red-400">*</span>}
        </label>
        {prop.description && (
          <p className="text-xs text-neutral-500">{prop.description}</p>
        )}
        <Input
          type="text"
          value={value as string || ''}
          onChange={(e) => handleParamChange(key, e.target.value)}
          placeholder={`Enter ${key}...`}
        />
      </div>
    );
  }, [params, requiredFields, handleParamChange]);

  return (
    <div className={`rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden ${className}`}>
      {/* Tool header */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">{tool.name}</h3>
            <p className="text-sm text-neutral-400 mt-1">{tool.description}</p>
          </div>
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white transition-colors"
          >
            Schema
            <ChevronDown className={`w-3 h-3 transition-transform ${showSchema ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <AnimatePresence>
          {showSchema && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <pre className="mt-3 p-3 bg-black/50 rounded-lg text-xs text-neutral-400 overflow-x-auto">
                {JSON.stringify(tool.inputSchema, null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input form */}
      <div className="p-4 space-y-4">
        {Object.keys(properties).length === 0 ? (
          <p className="text-sm text-neutral-500 italic">This tool has no input parameters</p>
        ) : (
          Object.entries(properties).map(([key, prop]) =>
            renderField(key, prop as SchemaProperty)
          )
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-neutral-800 flex items-center gap-3">
        <Button
          onClick={handleExecute}
          disabled={!isValid || isExecuting}
          loading={isExecuting}
          leftIcon={<Play className="w-4 h-4" />}
        >
          {isExecuting ? 'Executing...' : 'Execute'}
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isExecuting}
        >
          Reset
        </Button>
      </div>

      {/* Result/Error */}
      <AnimatePresence>
        {(result || error) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`p-4 border-t ${error ? 'border-red-500/30 bg-red-500/10' : 'border-green-500/30 bg-green-500/10'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {error ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">Error</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-green-400">Success</span>
                    </>
                  )}
                  {executionTime !== null && (
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                      <Clock className="w-3 h-3" />
                      {executionTime}ms
                    </span>
                  )}
                  {isDemoMode && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">
                      Demo
                    </span>
                  )}
                </div>
                {result !== null && result !== undefined && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyResult}
                    leftIcon={copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                )}
              </div>
              <pre className="p-3 bg-black/30 rounded-lg text-xs overflow-x-auto">
                {error ? (
                  <span className="text-red-300">{error}</span>
                ) : (
                  <span className="text-neutral-300">{JSON.stringify(result, null, 2)}</span>
                )}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
