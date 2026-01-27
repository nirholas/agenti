/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Keep shining, keep coding 🌞
 */

/**
 * Lyra Chat Components
 * 
 * Self-contained chat components with Lyra branding.
 * Uses Tailwind CSS for styling - no external UI library dependencies.
 */

import React, { memo, useState, useCallback } from 'react';
import { LyraLogo } from './LyraBrand';

// =============================================================================
// LYRA AI AVATAR CONFIG
// =============================================================================

export const LYRA_AI_AVATAR = {
  emoji: '🎵',
  title: 'Lyra AI',
  bgColor: 'bg-indigo-500',
};

export const USER_AVATAR = {
  emoji: '👤',
  title: 'You',
  bgColor: 'bg-emerald-500',
};

// =============================================================================
// LYRA CHAT MESSAGE
// =============================================================================

export interface LyraChatMessageProps {
  content: string;
  isAI?: boolean;
  loading?: boolean;
  timestamp?: string;
}

/**
 * Pre-styled chat message with Lyra/User defaults
 */
export const LyraChatMessage = memo<LyraChatMessageProps>(({ 
  content,
  isAI = false, 
  loading = false,
  timestamp,
}) => {
  const avatar = isAI ? LYRA_AI_AVATAR : USER_AVATAR;
  
  return (
    <div className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 ${avatar.bgColor}`}>
        {avatar.emoji}
      </div>
      
      {/* Message bubble */}
      <div className={`max-w-[70%] ${isAI ? '' : 'text-right'}`}>
        <div className={`px-4 py-2 rounded-2xl ${
          isAI 
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100' 
            : 'bg-indigo-500 text-white'
        }`}>
          {loading ? (
            <span className="inline-flex gap-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
              <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
            </span>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          )}
        </div>
        {timestamp && (
          <span className="text-xs text-gray-400 mt-1 block">{timestamp}</span>
        )}
      </div>
    </div>
  );
});

LyraChatMessage.displayName = 'LyraChatMessage';

// =============================================================================
// LYRA CHAT PANEL
// =============================================================================

export interface LyraChatPanelProps {
  messages?: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant';
  }>;
  onSend?: (message: string) => void;
  loading?: boolean;
  placeholder?: string;
  title?: string;
  className?: string;
}

/**
 * Complete chat panel with header, messages, and input
 */
export const LyraChatPanel = memo<LyraChatPanelProps>(({
  messages = [],
  onSend,
  loading = false,
  placeholder = 'Ask Lyra anything...',
  title = 'AI Assistant',
  className = '',
}) => {
  const [input, setInput] = useState('');

  const handleSend = useCallback(() => {
    if (input.trim() && onSend) {
      onSend(input.trim());
      setInput('');
    }
  }, [input, onSend]);

  return (
    <div className={`flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <LyraLogo size={24} />
        <span className="font-medium text-gray-900 dark:text-white">{title}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full text-gray-400">
            <p>Start a conversation with Lyra AI</p>
          </div>
        ) : (
          messages.map((msg) => (
            <LyraChatMessage
              key={msg.id}
              isAI={msg.role === 'assistant'}
              content={msg.content}
              loading={loading && msg.role === 'assistant' && msg === messages[messages.length - 1]}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-5 py-2 rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
});

LyraChatPanel.displayName = 'LyraChatPanel';
