/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Building the future of AI-assisted development 🤖
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, Send, Sparkles, Copy, Check, Trash2 } from 'lucide-react';
import { generateLyraResponse, getSuggestedPrompts, getWelcomeMessage, ChatMessage } from '@/services/lyraAI';
import { copyToClipboard } from '@/utils/helpers';
import DOMPurify from 'dompurify';

/**
 * AI Chat Assistant Example
 * 
 * Demonstrates how to build a smart coding assistant using pattern matching.
 * No API key required - works entirely in the browser!
 */
export default function AIChatAssistant() {
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([getWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Refs for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get suggested prompts
  const suggestedPrompts = getSuggestedPrompts();
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle sending a message
  const handleSend = useCallback(async (messageText?: string) => {
    const content = messageText || input.trim();
    if (!content || loading) return;
    
    // Clear input
    setInput('');
    
    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    
    try {
      // Get AI response
      const response = await generateLyraResponse(content);
      
      // Add AI message
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        role: 'assistant',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      // Add error message
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I encountered an issue. Please try asking about smart contracts, Solidity, or Web3!",
        role: 'assistant',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);
  
  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Copy message to clipboard
  const handleCopy = async (content: string, id: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };
  
  // Clear chat
  const handleClear = () => {
    setMessages([getWelcomeMessage()]);
  };
  
  // Extract code blocks from message
  const renderMessage = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        // Code block
        const lines = part.slice(3, -3).split('\n');
        const language = lines[0] || 'solidity';
        const code = lines.slice(1).join('\n');
        
        return (
          <div key={index} className="my-3 relative group">
            <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-gray-500">{language}</span>
              <button
                onClick={() => handleCopy(code, `code-${index}`)}
                className="p-1 hover:bg-gray-700 rounded"
                title="Copy code"
              >
                {copiedId === `code-${index}` ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
            <pre className="p-4 bg-gray-900 rounded-lg overflow-x-auto">
              <code className="text-sm text-green-400 font-mono">{code}</code>
            </pre>
          </div>
        );
      }
      
      // Regular text with markdown-style formatting
      return (
        <div key={index} className="whitespace-pre-wrap">
          {part.split('\n').map((line, lineIndex) => {
            // Bold text
            let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            // Inline code
            processed = processed.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-gray-700 rounded text-indigo-300">$1</code>');
            // Bullet points
            if (line.startsWith('• ') || line.startsWith('* ')) {
              return (
                <div key={lineIndex} className="flex gap-2 ml-2">
                  <span>•</span>
                  <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processed.slice(2)) }} />
                </div>
              );
            }
            
            return line ? (
              <p key={lineIndex} className="my-1" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processed) }} />
            ) : (
              <br key={lineIndex} />
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-500/20 rounded-full mb-4">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className="text-indigo-300 text-sm font-medium">No API Key Required</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 flex items-center justify-center gap-3">
            <span className="text-4xl">🎵</span>
            Lyra AI Chat Assistant
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            A smart coding assistant built with pattern matching. Ask about Solidity, smart contracts, DeFi, and Web3 development!
          </p>
        </div>
        
        {/* Suggested Prompts */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 text-center mb-3">Try asking:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedPrompts.slice(0, 4).map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
        
        {/* Chat Panel */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold">Lyra AI</h2>
                <p className="text-xs text-gray-400">Web3 Coding Assistant</p>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* Messages */}
          <div className="h-[450px] overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'assistant' ? 'bg-indigo-500' : 'bg-emerald-500'
                }`}>
                  {msg.role === 'assistant' ? '🎵' : '👤'}
                </div>
                
                {/* Message Bubble */}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`px-4 py-3 rounded-2xl ${
                    msg.role === 'assistant'
                      ? 'bg-gray-700/50 text-gray-100'
                      : 'bg-indigo-500 text-white'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="text-sm">{renderMessage(msg.content)}</div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                  {msg.timestamp && (
                    <p className="text-xs text-gray-500 mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                  🎵
                </div>
                <div className="px-4 py-3 bg-gray-700/50 rounded-2xl">
                  <span className="inline-flex gap-1 text-gray-400">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                  </span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <div className="p-4 border-t border-gray-700 bg-gray-800/80">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Solidity, smart contracts, DeFi..."
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-600 rounded-xl font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Info Section */}
        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl mb-2">🆓</div>
            <h3 className="font-semibold mb-1">Free Forever</h3>
            <p className="text-sm text-gray-400">No API costs - uses pattern matching</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-semibold mb-1">Instant Responses</h3>
            <p className="text-sm text-gray-400">No network latency - runs in browser</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="text-2xl mb-2">🔒</div>
            <h3 className="font-semibold mb-1">100% Private</h3>
            <p className="text-sm text-gray-400">Your data stays in your browser</p>
          </div>
        </div>
        
        {/* How It Works */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">How It Works</h3>
          <div className="grid sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">
                1
              </div>
              <p className="text-sm text-gray-300">You ask a question</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">
                2
              </div>
              <p className="text-sm text-gray-300">Pattern matching finds related knowledge</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">
                3
              </div>
              <p className="text-sm text-gray-300">Response is formatted with examples</p>
            </div>
            <div>
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">
                4
              </div>
              <p className="text-sm text-gray-300">You get helpful, accurate answers!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
