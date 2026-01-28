'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
}

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  market_cap_rank: number;
  image: string;
}

// Support both Vite and Next.js environment variables
const GROQ_API_KEY = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_GROQ_API_KEY || (import.meta as any).env?.VITE_GROQ_API_KEY || '')
  : (process.env.NEXT_PUBLIC_GROQ_API_KEY || '');

const SYSTEM_PROMPT = `You are Agenti, a helpful AI assistant specialized in cryptocurrency data. You have access to real-time crypto prices via the Agenti MCP server.

When the user asks about crypto prices, you will receive live data from the CoinGecko API. Use this data to give accurate, helpful responses.

Keep responses concise (2-4 sentences max) since this is a mobile chat interface. Use emoji sparingly. Format prices nicely.

If asked about non-crypto topics, briefly answer but steer back to crypto if appropriate.`;

const SUGGESTED_PROMPTS = [
  "What's Bitcoin's price?",
  "Top 5 cryptos",
  "Compare BTC vs ETH",
];

export default function MiniChatApp() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'assistant', content: "Hi! I'm Agenti, powered by SperaxOS. Ask me anything about crypto - I fetch live prices!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Only scroll within the chat container, not the whole page
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    }
  };

  // Only auto-scroll after user interaction, not on initial mount
  const [hasInteracted, setHasInteracted] = useState(false);
  
  useEffect(() => {
    if (hasInteracted) {
      scrollToBottom();
    }
  }, [messages, hasInteracted]);

  const fetchCryptoData = async (): Promise<CoinData[]> => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const formatCryptoContext = (coins: CoinData[]): string => {
    return coins.slice(0, 15).map(c => {
      const price = c.current_price;
      const change = c.price_change_percentage_24h || 0;
      const mcap = c.market_cap / 1e9;
      return `#${c.market_cap_rank} ${c.name} (${c.symbol.toUpperCase()}): $${price >= 1 ? price.toLocaleString(undefined, {maximumFractionDigits: 2}) : price.toFixed(6)} | 24h: ${change >= 0 ? '+' : ''}${change.toFixed(2)}% | MCap: $${mcap.toFixed(1)}B`;
    }).join('\n');
  };

  const callGroq = async (userMessage: string, cryptoData: string): Promise<string> => {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'system', content: `Current live crypto data:\n${cryptoData}` },
            ...messages.filter(m => m.role !== 'tool').slice(-6).map(m => ({
              role: m.role,
              content: m.content
            })),
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "Sorry, I couldn't process that request.";
    } catch (error) {
      console.error('Groq error:', error);
      return "Connection error. Please try again.";
    }
  };

  const handleSend = async (text?: string) => {
    const query = text || input;
    if (!query.trim() || isTyping) return;

    setHasInteracted(true); // Enable auto-scroll after first interaction
    
    const userMsg: Message = { id: Date.now(), role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Show tool call
    await new Promise(r => setTimeout(r, 300));
    const toolMsg: Message = { 
      id: Date.now() + 1, 
      role: 'tool', 
      content: 'Fetching live data...', 
      toolName: 'crypto_prices' 
    };
    setMessages(prev => [...prev, toolMsg]);

    // Fetch real crypto data
    const coins = await fetchCryptoData();
    const cryptoContext = formatCryptoContext(coins);

    // Update tool message
    setMessages(prev => prev.map(m => 
      m.id === toolMsg.id ? { ...m, content: `${coins.length} coins loaded` } : m
    ));

    // Call Groq
    const response = await callGroq(query, cryptoContext);

    setIsTyping(false);
    const assistantMsg: Message = { id: Date.now() + 2, role: 'assistant', content: response };
    setMessages(prev => [...prev, assistantMsg]);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-medium text-white/80">Agenti MCP</span>
        <span className="text-[10px] text-white/40 ml-auto">SperaxOS</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'tool' ? (
                <div className="flex items-center gap-2 text-[10px] text-amber-400/80 bg-amber-400/10 px-2 py-1 rounded-full">
                  <span className="animate-spin">⚡</span>
                  <code>{msg.toolName}</code>
                  <span className="text-white/40">{msg.content}</span>
                </div>
              ) : (
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-white/20 to-white/10 text-white border border-white/10 rounded-br-sm'
                      : 'bg-white/10 text-white/90 rounded-bl-sm'
                  }`}
                >
                  <div className="leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-1 px-3 py-2 bg-white/10 rounded-2xl rounded-bl-sm w-fit"
          >
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length <= 2 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-2 border-t border-white/10">
        <div className="flex gap-2 items-center bg-white/5 rounded-full px-3 py-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about crypto..."
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="text-white/80 hover:text-white disabled:text-white/20 text-sm transition-colors"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
