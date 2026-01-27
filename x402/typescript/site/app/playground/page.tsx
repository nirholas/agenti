"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Log {
  id: string;
  type: "info" | "success" | "error" | "payment";
  message: string;
  timestamp: number;
}

interface PaymentConfig {
  price: string;
  token: string;
  chain: string;
  recipient: string;
}

const DEMO_TOOLS = [
  {
    name: "get_crypto_price",
    description: "Get real-time cryptocurrency prices",
    price: "0.001",
    freeCallsLeft: 3,
  },
  {
    name: "analyze_wallet",
    description: "Deep analysis of any wallet address",
    price: "0.01",
    freeCallsLeft: 1,
  },
  {
    name: "generate_report",
    description: "Generate comprehensive market report",
    price: "0.05",
    freeCallsLeft: 0,
  },
];

const CODE_EXAMPLES = {
  client: `// x402 Client - Making a paid API call
import { createX402Client } from '@x402/core';

const client = createX402Client({
  wallet: yourWallet,
  chain: 'base',
});

// Call a paid endpoint - payment happens automatically
const response = await client.fetch(
  'https://api.example.com/premium/data',
  { method: 'GET' }
);

// If 402 Payment Required is returned,
// x402 automatically signs and sends payment,
// then retries the request with payment proof`,

  server: `// x402 Server - Protecting an endpoint
import { withX402 } from '@x402/next';

export const GET = withX402(
  async (req) => {
    // Your premium logic here
    const data = await expensiveComputation();
    return Response.json(data);
  },
  {
    price: '0.001',    // Cost per call
    token: 'USDC',     // Payment token
    chain: 'base',     // Blockchain
    recipient: '0x...', // Your wallet
  }
);`,

  middleware: `// x402 Middleware Pattern
import { X402Middleware } from '@x402/core';

const x402 = new X402Middleware({
  price: '0.001',
  token: 'USDC',
  chain: 'base',
  freeTier: {
    calls: 10,      // Free calls per hour
    period: 3600,   // Reset period (seconds)
  },
});

// Express middleware
app.use('/api/premium', x402.middleware());

// Or wrap individual handlers
const handler = x402.wrap(async (req, res) => {
  res.json({ premium: 'data' });
});`,
};

export default function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<"demo" | "code">("demo");
  const [activeCodeTab, setActiveCodeTab] = useState<"client" | "server" | "middleware">("client");
  const [logs, setLogs] = useState<Log[]>([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [balance, setBalance] = useState("10.00");
  const [tools, setTools] = useState(DEMO_TOOLS);
  const [isProcessing, setIsProcessing] = useState(false);

  const addLog = (type: Log["type"], message: string) => {
    const log: Log = {
      id: Date.now().toString() + Math.random(),
      type,
      message,
      timestamp: Date.now(),
    };
    setLogs((prev) => [...prev, log]);
  };

  const connectWallet = () => {
    addLog("info", "🔗 Connecting wallet...");
    setTimeout(() => {
      setWalletConnected(true);
      addLog("success", "✅ Wallet connected: 0x1234...5678");
      addLog("info", `💰 Balance: ${balance} USDC`);
    }, 1000);
  };

  const callTool = async (toolIndex: number) => {
    const tool = tools[toolIndex];
    setIsProcessing(true);
    
    addLog("info", `📡 Calling ${tool.name}...`);
    
    await new Promise((r) => setTimeout(r, 500));
    
    if (tool.freeCallsLeft > 0) {
      // Free tier
      addLog("success", `✅ Free tier: ${tool.freeCallsLeft - 1} calls remaining`);
      setTools((prev) =>
        prev.map((t, i) =>
          i === toolIndex ? { ...t, freeCallsLeft: t.freeCallsLeft - 1 } : t
        )
      );
      await new Promise((r) => setTimeout(r, 300));
      addLog("success", `📦 Response: { "price": "$98,432.15", "change24h": "+2.4%" }`);
    } else {
      // Payment required
      addLog("payment", `💳 402 Payment Required: ${tool.price} USDC`);
      await new Promise((r) => setTimeout(r, 500));
      
      if (!walletConnected) {
        addLog("error", "❌ Wallet not connected. Connect wallet to pay.");
        setIsProcessing(false);
        return;
      }
      
      addLog("info", "🔐 Signing payment transaction...");
      await new Promise((r) => setTimeout(r, 800));
      addLog("success", `✅ Payment sent: ${tool.price} USDC`);
      
      const newBalance = (parseFloat(balance) - parseFloat(tool.price)).toFixed(3);
      setBalance(newBalance);
      
      await new Promise((r) => setTimeout(r, 300));
      addLog("info", "🔄 Retrying request with payment proof...");
      await new Promise((r) => setTimeout(r, 500));
      addLog("success", `📦 Response: { "price": "$98,432.15", "change24h": "+2.4%" }`);
    }
    
    setIsProcessing(false);
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                x402 Playground
              </h1>
              <p className="text-gray-400 mt-1">
                Test AI agent payments in your browser
              </p>
            </div>
            <div className="flex items-center gap-4">
              {walletConnected ? (
                <div className="flex items-center gap-3 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 font-mono">{balance} USDC</span>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("demo")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "demo"
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            🎮 Interactive Demo
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "code"
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            💻 Code Examples
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        {activeTab === "demo" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tools Panel */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                🛠️ MCP Tools
              </h2>
              <div className="space-y-3">
                {tools.map((tool, index) => (
                  <div
                    key={tool.name}
                    className="bg-black/30 border border-white/10 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-mono font-medium">
                          {tool.name}
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                          {tool.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-purple-400 text-sm">
                            💰 {tool.price} USDC
                          </span>
                          <span className="text-gray-500 text-sm">
                            {tool.freeCallsLeft > 0 ? (
                              <span className="text-green-400">
                                🎁 {tool.freeCallsLeft} free calls left
                              </span>
                            ) : (
                              <span className="text-orange-400">
                                Payment required
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => callTool(index)}
                        disabled={isProcessing}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          isProcessing
                            ? "bg-gray-600 cursor-not-allowed"
                            : "bg-purple-600 hover:bg-purple-500 hover:scale-105"
                        } text-white`}
                      >
                        {isProcessing ? "..." : "Call"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Console Panel */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  📟 Console
                </h2>
                <button
                  onClick={clearLogs}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Clear
                </button>
              </div>
              <div className="bg-black/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
                <AnimatePresence>
                  {logs.length === 0 ? (
                    <p className="text-gray-500">
                      Click "Call" on a tool to see x402 in action...
                    </p>
                  ) : (
                    logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`py-1 ${
                          log.type === "success"
                            ? "text-green-400"
                            : log.type === "error"
                            ? "text-red-400"
                            : log.type === "payment"
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }`}
                      >
                        <span className="text-gray-500 mr-2">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {log.message}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            {/* Code Tabs */}
            <div className="flex gap-2 mb-4">
              {(["client", "server", "middleware"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveCodeTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeCodeTab === tab
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {tab === "client" && "🔌 Client"}
                  {tab === "server" && "🖥️ Server"}
                  {tab === "middleware" && "⚙️ Middleware"}
                </button>
              ))}
            </div>

            {/* Code Block */}
            <div className="bg-black/50 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm font-mono">
                <code className="text-gray-300">
                  {CODE_EXAMPLES[activeCodeTab]}
                </code>
              </pre>
            </div>

            {/* Copy Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(CODE_EXAMPLES[activeCodeTab]);
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
              >
                📋 Copy Code
              </button>
            </div>
          </div>
        )}

        {/* How it Works */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <div className="text-4xl mb-4">1️⃣</div>
            <h3 className="text-white font-bold mb-2">Free Tier</h3>
            <p className="text-gray-400 text-sm">
              Every tool has free calls. Use them to test before paying.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <div className="text-4xl mb-4">2️⃣</div>
            <h3 className="text-white font-bold mb-2">402 Response</h3>
            <p className="text-gray-400 text-sm">
              When free tier runs out, server returns 402 Payment Required with price.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <div className="text-4xl mb-4">3️⃣</div>
            <h3 className="text-white font-bold mb-2">Auto-Pay & Retry</h3>
            <p className="text-gray-400 text-sm">
              x402 client auto-signs payment and retries. Seamless for the agent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
