/**
 * PromptsPanel Component - Display and execute MCP prompts
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MessageSquare,
  Play,
  Loader2,
  AlertCircle,
  User,
  Bot,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { McpPrompt, PromptMessage, PromptArgument } from './types';

export interface PromptsPanelProps {
  /** List of available prompts */
  prompts: McpPrompt[];
  /** Currently selected prompt */
  selectedPrompt: McpPrompt | null;
  /** Callback when a prompt is selected */
  onSelectPrompt: (prompt: McpPrompt) => void;
  /** Callback when a prompt is executed */
  onExecute: (name: string, args?: Record<string, string>) => void;
  /** Whether a prompt execution is in progress */
  isExecuting?: boolean;
  /** Last execution messages */
  lastMessages?: PromptMessage[] | null;
  /** Last execution error */
  lastError?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get role icon
 */
function getRoleIcon(role: string): React.ReactNode {
  switch (role) {
    case 'user':
      return <User className="w-4 h-4" />;
    case 'assistant':
      return <Bot className="w-4 h-4" />;
    case 'system':
      return <Settings className="w-4 h-4" />;
    default:
      return <MessageSquare className="w-4 h-4" />;
  }
}

/**
 * Get role color
 */
function getRoleColor(role: string): string {
  switch (role) {
    case 'user':
      return 'text-blue-400';
    case 'assistant':
      return 'text-green-400';
    case 'system':
      return 'text-yellow-400';
    default:
      return 'text-neutral-400';
  }
}

/**
 * Extract text from message content
 */
function getMessageText(content: PromptMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  if (content.type === 'text') {
    return content.text;
  }
  if (content.type === 'image') {
    return '[Image content]';
  }
  if (content.type === 'resource') {
    return `[Resource: ${content.resource.uri}]`;
  }
  return '[Unknown content]';
}

/**
 * PromptsPanel - Browse and execute MCP prompts
 */
export default function PromptsPanel({
  prompts,
  selectedPrompt,
  onSelectPrompt,
  onExecute,
  isExecuting = false,
  lastMessages,
  lastError,
  className = '',
}: PromptsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [args, setArgs] = useState<Record<string, string>>({});

  // Filter prompts based on search
  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) return prompts;
    const query = searchQuery.toLowerCase();
    return prompts.filter(
      (prompt) =>
        prompt.name.toLowerCase().includes(query) ||
        prompt.description?.toLowerCase().includes(query)
    );
  }, [prompts, searchQuery]);

  // Reset args when prompt changes
  React.useEffect(() => {
    setArgs({});
  }, [selectedPrompt?.name]);

  // Handle prompt execution
  const handleExecute = useCallback(() => {
    if (!selectedPrompt) return;
    const argEntries = Object.entries(args).filter(([_, v]) => v.trim() !== '');
    const argsObj = argEntries.length > 0 ? Object.fromEntries(argEntries) : undefined;
    onExecute(selectedPrompt.name, argsObj);
  }, [selectedPrompt, args, onExecute]);

  // Handle argument change
  const handleArgChange = (name: string, value: string) => {
    setArgs((prev) => ({ ...prev, [name]: value }));
  };

  // Get arguments for selected prompt
  const promptArgs = selectedPrompt?.arguments || [];

  return (
    <div className={cn('flex h-full', className)}>
      {/* Prompts List */}
      <div className="w-72 flex-shrink-0 border-r border-neutral-800 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-neutral-800">
          <Input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-sm"
          />
        </div>

        {/* Prompt List */}
        <div className="flex-1 overflow-y-auto">
          {filteredPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageSquare className="w-8 h-8 text-neutral-600 mb-2" />
              <p className="text-sm text-neutral-500">
                {searchQuery
                  ? 'No prompts match your search'
                  : 'No prompts available'}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredPrompts.map((prompt) => {
                const isSelected = selectedPrompt?.name === prompt.name;
                const argCount = prompt.arguments?.length || 0;

                return (
                  <button
                    key={prompt.name}
                    onClick={() => onSelectPrompt(prompt)}
                    className={cn(
                      'w-full px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-white/10 border-l-2 border-white'
                        : 'hover:bg-white/5 border-l-2 border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare
                        className={cn(
                          'w-4 h-4 flex-shrink-0',
                          isSelected ? 'text-white' : 'text-neutral-500'
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm font-medium truncate',
                          isSelected ? 'text-white' : 'text-neutral-300'
                        )}
                      >
                        {prompt.name}
                      </span>
                      {argCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs px-1.5"
                        >
                          {argCount} args
                        </Badge>
                      )}
                    </div>
                    {prompt.description && (
                      <p
                        className={cn(
                          'mt-1 text-xs truncate',
                          isSelected ? 'text-neutral-400' : 'text-neutral-500'
                        )}
                      >
                        {prompt.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Prompt Count */}
        <div className="px-3 py-2 border-t border-neutral-800 text-xs text-neutral-500">
          {filteredPrompts.length} of {prompts.length} prompts
        </div>
      </div>

      {/* Prompt Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPrompt ? (
          <>
            {/* Prompt Header */}
            <div className="p-4 border-b border-neutral-800">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    {selectedPrompt.name}
                  </h3>
                  {selectedPrompt.description && (
                    <p className="mt-1 text-sm text-neutral-400">
                      {selectedPrompt.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Arguments Form */}
            {promptArgs.length > 0 && (
              <div className="p-4 border-b border-neutral-800">
                <h4 className="text-sm font-medium text-neutral-300 mb-3">
                  Arguments
                </h4>
                <div className="space-y-3">
                  {promptArgs.map((arg: PromptArgument) => (
                    <div key={arg.name} className="space-y-1.5">
                      <label className="block text-sm font-medium text-neutral-300">
                        {arg.name}
                        {arg.required && (
                          <span className="text-red-400 ml-1">*</span>
                        )}
                      </label>
                      {arg.description && (
                        <p className="text-xs text-neutral-500">
                          {arg.description}
                        </p>
                      )}
                      <Input
                        type="text"
                        value={args[arg.name] || ''}
                        onChange={(e) => handleArgChange(arg.name, e.target.value)}
                        disabled={isExecuting}
                        placeholder={`Enter ${arg.name}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execute Button */}
            <div className="p-4 border-b border-neutral-800">
              <Button
                onClick={handleExecute}
                disabled={isExecuting}
                loading={isExecuting}
                variant="secondary"
                leftIcon={!isExecuting && <Play className="w-4 h-4" />}
              >
                {isExecuting ? 'Getting Prompt...' : 'Get Prompt'}
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                {lastError ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
                  >
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Error getting prompt</span>
                    </div>
                    <p className="text-sm text-red-300">{lastError}</p>
                  </motion.div>
                ) : lastMessages && lastMessages.length > 0 ? (
                  <motion.div
                    key="messages"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <h4 className="text-sm font-medium text-neutral-300">
                      Messages ({lastMessages.length})
                    </h4>
                    {lastMessages.map((message, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50"
                      >
                        <div
                          className={cn(
                            'flex items-center gap-2 mb-2 text-sm font-medium',
                            getRoleColor(message.role)
                          )}
                        >
                          {getRoleIcon(message.role)}
                          <span className="capitalize">{message.role}</span>
                        </div>
                        <div className="text-sm text-neutral-300 whitespace-pre-wrap">
                          {getMessageText(message.content)}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <MessageSquare className="w-8 h-8 text-neutral-600 mb-3" />
                    <p className="text-sm text-neutral-500">
                      Click &quot;Get Prompt&quot; to view messages
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          /* No prompt selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare className="w-12 h-12 text-neutral-700 mb-4" />
            <h3 className="text-lg font-medium text-neutral-400 mb-2">
              No prompt selected
            </h3>
            <p className="text-sm text-neutral-500 max-w-xs">
              Select a prompt from the list to view its details and get its
              messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
