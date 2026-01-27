/**
 * Tool Card Component - Displays individual tool information
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Code2,
  FileText,
} from 'lucide-react';
import type { Tool } from '@/types';
import { SOURCE_TYPE_LABELS } from '@/lib/constants';

interface ToolCardProps {
  tool: Tool;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string, id: string) => void;
  copied: string | null;
}

export default function ToolCard({ tool, isExpanded, onToggle, onCopy, copied }: ToolCardProps) {
  const sourceInfo = SOURCE_TYPE_LABELS[tool.source?.type || 'unknown'] || { label: 'Unknown', color: 'gray' };
  
  const hasParams = tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0;
  const requiredParams = tool.inputSchema?.required || [];

  return (
    <motion.div
      layout
      className="rounded-xl border border-neutral-800 bg-black/30 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-neutral-700 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium text-white">{tool.name}</span>
              {hasParams && (
                <span className="text-xs text-neutral-500">
                  ({Object.keys(tool.inputSchema.properties || {}).length} params)
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-400 line-clamp-1 mt-0.5">
              {tool.description}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs rounded bg-white/5 text-neutral-400`}>
            {sourceInfo.label}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {/* Description */}
              <div className="p-3 bg-neutral-900/50 rounded-lg border border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-neutral-500" />
                  <span className="text-xs font-medium text-neutral-400">Description</span>
                </div>
                <p className="text-sm text-neutral-300">{tool.description}</p>
              </div>

              {/* Parameters */}
              {hasParams && (
                <div className="p-3 bg-neutral-900/50 rounded-lg border border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-neutral-500" />
                      <span className="text-xs font-medium text-neutral-400">Parameters</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopy(JSON.stringify(tool.inputSchema, null, 2), `schema-${tool.name}`);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                      {copied === `schema-${tool.name}` ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Schema</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {Object.entries(tool.inputSchema.properties || {}).map(([key, value]) => {
                      const isRequired = requiredParams.includes(key);
                      const paramValue = value as { type: string; description?: string; enum?: string[]; default?: unknown };
                      
                      return (
                        <div
                          key={key}
                          className="flex items-start gap-3 p-2 rounded bg-black/30"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono text-white">{key}</code>
                              <span className="text-xs text-neutral-500">{paramValue.type}</span>
                              {isRequired && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">
                                  required
                                </span>
                              )}
                            </div>
                            {paramValue.description && (
                              <p className="text-xs text-neutral-400 mt-1">{paramValue.description}</p>
                            )}
                            {paramValue.enum && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {paramValue.enum.map((val) => (
                                  <span
                                    key={val}
                                    className="px-1.5 py-0.5 text-[10px] bg-white/5 text-neutral-400 rounded font-mono"
                                  >
                                    {val}
                                  </span>
                                ))}
                              </div>
                            )}
                            {paramValue.default !== undefined && (
                              <p className="text-xs text-neutral-500 mt-1">
                                Default: <code className="text-neutral-400">{JSON.stringify(paramValue.default)}</code>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Source info */}
              {tool.source?.file && (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span>Source:</span>
                  <code className="px-1.5 py-0.5 bg-white/5 rounded">
                    {tool.source.file}
                    {tool.source.line && `:${tool.source.line}`}
                  </code>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
