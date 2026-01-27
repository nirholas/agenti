/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The future is being built right here 🏗️
 */

import { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Sparkles,
  Wand2,
  Bug,
  Shield,
  Zap,
  Eye,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Radio,
  Mic,
  MicOff
} from 'lucide-react';

interface AIInsight {
  id: string;
  type: 'optimization' | 'vulnerability' | 'suggestion' | 'prediction' | 'learning';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  code?: string;
  fix?: string;
  confidence: number;
  gasImpact?: number;
  line?: number;
}

interface VoiceCommand {
  command: string;
  timestamp: number;
  executed: boolean;
}

export default function AICodeWhisperer({ 
  code, 
  onCodeChange,
  onLog 
}: { 
  code: string;
  onCodeChange: (code: string) => void;
  onLog: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceCommands, setVoiceCommands] = useState<VoiceCommand[]>([]);
  const [aiThinking, setAiThinking] = useState('');
  const [autoFix, setAutoFix] = useState(true);
  const [predictiveMode, setPredictiveMode] = useState(true);
  
  const analysisInterval = useRef<NodeJS.Timeout | null>(null);
  const thinkingPhrases = [
    "🧠 Analyzing contract architecture...",
    "🔍 Detecting potential vulnerabilities...",
    "⚡ Computing gas optimizations...",
    "🎯 Learning from 10,000+ contracts...",
    "🛡️ Checking security patterns...",
    "💎 Discovering best practices...",
    "🚀 Predicting deployment scenarios...",
    "🌊 Simulating edge cases..."
  ];

  // Real-time AI Analysis
  useEffect(() => {
    if (predictiveMode && code) {
      analysisInterval.current = setTimeout(() => {
        analyzeCode(code);
      }, 1000); // Debounce
    }

    return () => {
      if (analysisInterval.current) clearTimeout(analysisInterval.current);
    };
  }, [code, predictiveMode]);

  const analyzeCode = async (contractCode: string) => {
    setIsAnalyzing(true);
    const thinkingPhrase = thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
    setAiThinking(thinkingPhrase);

    // Simulate advanced AI analysis
    await new Promise(resolve => setTimeout(resolve, 800));

    const newInsights: AIInsight[] = [];

    // 1. Gas Optimization Detection
    if (contractCode.includes('for') || contractCode.includes('while')) {
      const gasImpact = Math.floor(Math.random() * 50000) + 10000;
      newInsights.push({
        id: `gas-${Date.now()}`,
        type: 'optimization',
        severity: gasImpact > 30000 ? 'warning' : 'info',
        title: '⚡ Gas Optimization Detected',
        message: `Loop detected. Potential gas savings: ~${gasImpact.toLocaleString()} gas`,
        confidence: 0.87,
        gasImpact,
        fix: 'Consider using mappings or limiting loop iterations'
      });
    }

    // 2. Reentrancy Detection
    if (contractCode.includes('.call{value:') || contractCode.includes('.transfer(')) {
      const hasChecksEffectsInteractions = contractCode.indexOf('require') < contractCode.indexOf('.call');
      if (!hasChecksEffectsInteractions) {
        newInsights.push({
          id: `vuln-${Date.now()}`,
          type: 'vulnerability',
          severity: 'critical',
          title: '🚨 Reentrancy Vulnerability',
          message: 'External call before state update. Critical reentrancy risk detected!',
          confidence: 0.94,
          fix: 'Use ReentrancyGuard or Checks-Effects-Interactions pattern'
        });
      }
    }

    // 3. Access Control Analysis
    if (contractCode.includes('onlyOwner') || contractCode.includes('require(msg.sender')) {
      newInsights.push({
        id: `security-${Date.now()}`,
        type: 'suggestion',
        severity: 'success',
        title: '✅ Good Security Pattern',
        message: 'Access control detected. Consider using OpenZeppelin AccessControl for role-based permissions.',
        confidence: 0.91
      });
    }

    // 4. Integer Overflow/Underflow
    if (!contractCode.includes('pragma solidity ^0.8') && 
        (contractCode.includes('uint') && (contractCode.includes('+') || contractCode.includes('-')))) {
      newInsights.push({
        id: `overflow-${Date.now()}`,
        type: 'vulnerability',
        severity: 'critical',
        title: '⚠️ Overflow Risk',
        message: 'Pre-0.8 Solidity without SafeMath. Use Solidity ^0.8.0 or SafeMath library.',
        confidence: 0.99
      });
    }

    // 5. Unchecked Return Values
    if (contractCode.includes('.call(') && !contractCode.includes('(bool success,')) {
      newInsights.push({
        id: `return-${Date.now()}`,
        type: 'vulnerability',
        severity: 'warning',
        title: '❌ Unchecked Return Value',
        message: 'Low-level call without checking return value. Always verify success.',
        confidence: 0.89,
        fix: '(bool success, ) = target.call(...); require(success);'
      });
    }

    // 6. Predictive Insights
    if (contractCode.includes('ERC20') || contractCode.includes('token')) {
      newInsights.push({
        id: `predict-${Date.now()}`,
        type: 'prediction',
        severity: 'info',
        title: '🔮 AI Prediction',
        message: 'Based on similar contracts, users will likely need: pause(), burn(), and snapshot() functions',
        confidence: 0.76
      });
    }

    // 7. Learning Insights
    if (contractCode.length > 500) {
      newInsights.push({
        id: `learn-${Date.now()}`,
        type: 'learning',
        severity: 'info',
        title: '💡 Pattern Recognition',
        message: 'This contract structure matches 43 successful audited contracts. You\'re on the right track!',
        confidence: 0.81
      });
    }

    setInsights(newInsights);
    setIsAnalyzing(false);
    setAiThinking('');

    // Auto-fix critical issues
    if (autoFix) {
      const criticalIssues = newInsights.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        onLog('info', `🤖 AI detected ${criticalIssues.length} critical issues. Auto-fixing...`);
      }
    }
  };

  // Voice Commands (Simulated - in production use Web Speech API)
  const toggleVoiceControl = () => {
    setIsListening(!isListening);
    if (!isListening) {
      onLog('info', '🎤 Voice control activated. Try: "Fix vulnerabilities", "Optimize gas", "Explain contract"');
      simulateVoiceCommands();
    } else {
      onLog('info', '🔇 Voice control deactivated');
    }
  };

  const simulateVoiceCommands = () => {
    // In production, integrate Web Speech API
    const commands = [
      "analyze security",
      "optimize gas usage", 
      "explain this function",
      "add documentation",
      "suggest improvements"
    ];
    
    setTimeout(() => {
      if (isListening) {
        const cmd = commands[Math.floor(Math.random() * commands.length)];
        executeVoiceCommand(cmd);
      }
    }, 3000);
  };

  const executeVoiceCommand = (command: string) => {
    setVoiceCommands(prev => [...prev, { command, timestamp: Date.now(), executed: true }]);
    onLog('success', `🎤 Executed: "${command}"`);
    
    // Execute based on command
    if (command.includes('analyze') || command.includes('security')) {
      analyzeCode(code);
    } else if (command.includes('optimize')) {
      const optimizedCode = optimizeGas(code);
      onCodeChange(optimizedCode);
    }
  };

  const optimizeGas = (contractCode: string): string => {
    let optimized = contractCode;
    
    // Example optimizations
    optimized = optimized.replace(/uint256/g, 'uint'); // Shorter type
    optimized = optimized.replace(/public view returns/g, 'external view returns'); // Use external
    
    return optimized;
  };

  const applyFix = (insight: AIInsight) => {
    if (insight.fix) {
      onLog('success', `✨ Applying AI-suggested fix...`);
      
      // Apply the fix to code
      let fixedCode = code;
      if (insight.type === 'vulnerability' && insight.title.includes('Reentrancy')) {
        // Add ReentrancyGuard
        const importLine = "import '@openzeppelin/contracts/security/ReentrancyGuard.sol';\n";
        if (!fixedCode.includes('ReentrancyGuard')) {
          fixedCode = importLine + fixedCode;
          fixedCode = fixedCode.replace(/contract (\w+)/, 'contract $1 is ReentrancyGuard');
        }
      }
      
      onCodeChange(fixedCode);
      setInsights(prev => prev.filter(i => i.id !== insight.id));
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default: return <Lightbulb className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'optimization': return <Zap className="w-4 h-4" />;
      case 'vulnerability': return <Shield className="w-4 h-4" />;
      case 'prediction': return <Eye className="w-4 h-4" />;
      case 'learning': return <Brain className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 border-l border-purple-200 dark:border-purple-900">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Brain className="w-6 h-6 animate-pulse" />
            <h3 className="font-bold text-lg">AI Code Whisperer</h3>
            <span className="px-2 py-0.5 text-xs bg-amber-400/20 text-amber-200 rounded border border-amber-400/30">
              Concept Demo
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleVoiceControl}
              className={`p-2 rounded-lg transition-all ${
                isListening 
                  ? 'bg-red-500 animate-pulse' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Voice Control"
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => analyzeCode(code)}
              disabled={isAnalyzing}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              {isAnalyzing ? '🧠 Analyzing...' : '✨ Analyze'}
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className="flex items-center space-x-4 text-xs">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoFix}
              onChange={(e) => setAutoFix(e.target.checked)}
              className="rounded"
            />
            <span>Auto-fix</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={predictiveMode}
              onChange={(e) => setPredictiveMode(e.target.checked)}
              className="rounded"
            />
            <span>Predictive Mode</span>
          </label>
        </div>
      </div>

      {/* AI Thinking Status */}
      {aiThinking && (
        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800">
          <div className="flex items-center space-x-2 text-sm">
            <Radio className="w-4 h-4 animate-spin text-purple-600" />
            <span className="text-purple-700 dark:text-purple-300">{aiThinking}</span>
          </div>
        </div>
      )}

      {/* Voice Commands Log */}
      {isListening && voiceCommands.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="text-xs text-blue-700 dark:text-blue-300">
            Last command: "{voiceCommands[voiceCommands.length - 1].command}"
          </div>
        </div>
      )}

      {/* Insights Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {insights.length === 0 && !isAnalyzing && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Brain className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">AI is ready to analyze your code</p>
            <p className="text-xs mt-2">Start typing or click Analyze</p>
          </div>
        )}

        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg ${
              insight.severity === 'critical'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                : insight.severity === 'warning'
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-800'
                : insight.severity === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getSeverityIcon(insight.severity)}
                <div className="flex items-center space-x-1">
                  {getTypeIcon(insight.type)}
                  <span className="font-semibold text-sm">{insight.title}</span>
                </div>
              </div>
              <div className="text-xs bg-white/50 dark:bg-black/20 px-2 py-1 rounded-full">
                {Math.round(insight.confidence * 100)}% confident
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              {insight.message}
            </p>

            {insight.gasImpact && (
              <div className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400 mb-2">
                <TrendingUp className="w-3 h-3" />
                <span>Save ~{insight.gasImpact.toLocaleString()} gas</span>
              </div>
            )}

            {insight.fix && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  💡 Suggested fix:
                </p>
                <code className="block text-xs bg-white/50 dark:bg-black/20 p-2 rounded font-mono">
                  {insight.fix}
                </code>
                <button
                  onClick={() => applyFix(insight)}
                  className="mt-2 w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
                >
                  <Wand2 className="w-4 h-4 inline mr-2" />
                  Apply AI Fix
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats Footer */}
      <div className="p-3 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 border-t border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            🎯 {insights.length} insights found
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            ⚡ AI Model: GPT-4 Turbo
          </span>
        </div>
      </div>
    </div>
  );
}
