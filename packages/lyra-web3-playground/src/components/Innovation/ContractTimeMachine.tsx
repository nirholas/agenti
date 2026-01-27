/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The journey of a thousand apps begins with a single line 🛤️
 */

import { useState, useEffect } from 'react';
import {
  History,
  Clock,
  GitBranch,
  Play,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Pause,
  Save,
  Upload,
  Download,
  Sparkles,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface TimelineSnapshot {
  id: string;
  timestamp: number;
  code: string;
  description: string;
  gasEstimate?: number;
  securityScore?: number;
  aiSuggestion?: string;
  type: 'manual' | 'auto' | 'ai' | 'fork';
}

interface SimulationResult {
  success: boolean;
  gasUsed: number;
  outcome: string;
  stateChanges: Record<string, any>;
  events: string[];
}

export default function ContractTimeMachine({
  currentCode,
  onCodeChange,
  onLog
}: {
  currentCode: string;
  onCodeChange: (code: string) => void;
  onLog: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}) {
  const [timeline, setTimeline] = useState<TimelineSnapshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [forkPoints, setForkPoints] = useState<string[]>([]);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [autoSave, setAutoSave] = useState(true);

  // Auto-save snapshots
  useEffect(() => {
    if (autoSave && currentCode) {
      const saveTimeout = setTimeout(() => {
        createSnapshot('auto');
      }, 5000); // Auto-save every 5 seconds

      return () => clearTimeout(saveTimeout);
    }
  }, [currentCode, autoSave]);

  const createSnapshot = (type: TimelineSnapshot['type'], description?: string) => {
    const snapshot: TimelineSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      code: currentCode,
      description: description || `${type} save`,
      gasEstimate: estimateGas(currentCode),
      securityScore: calculateSecurityScore(currentCode),
      type
    };

    setTimeline(prev => [...prev, snapshot]);
    setCurrentIndex(timeline.length);
    onLog('success', `📸 Snapshot created: ${snapshot.description}`);
  };

  const estimateGas = (code: string): number => {
    // Simplified gas estimation
    let gas = 21000; // Base transaction
    gas += code.length * 200; // Deployment cost
    gas += (code.match(/function/g) || []).length * 5000; // Function gas
    gas += (code.match(/storage/g) || []).length * 20000; // Storage operations
    return gas;
  };

  const calculateSecurityScore = (code: string): number => {
    let score = 100;
    
    // Deduct points for risky patterns
    if (code.includes('.call{value:') && !code.includes('ReentrancyGuard')) score -= 30;
    if (code.includes('tx.origin')) score -= 20;
    if (!code.includes('pragma solidity ^0.8')) score -= 15;
    if (!code.includes('require') && !code.includes('revert')) score -= 10;
    if (code.includes('selfdestruct')) score -= 25;
    
    return Math.max(0, score);
  };

  const travelToSnapshot = (index: number) => {
    if (index >= 0 && index < timeline.length) {
      const snapshot = timeline[index];
      onCodeChange(snapshot.code);
      setCurrentIndex(index);
      onLog('info', `⏰ Traveled to: ${snapshot.description} (${new Date(snapshot.timestamp).toLocaleTimeString()})`);
    }
  };

  const playTimeline = () => {
    setIsPlaying(true);
    let index = currentIndex + 1;

    const playInterval = setInterval(() => {
      if (index >= timeline.length) {
        setIsPlaying(false);
        clearInterval(playInterval);
        return;
      }

      travelToSnapshot(index);
      index++;
    }, 2000 / playbackSpeed);
  };

  const createFork = () => {
    const forkId = `fork-${Date.now()}`;
    setForkPoints(prev => [...prev, forkId]);
    
    const forkSnapshot: TimelineSnapshot = {
      id: forkId,
      timestamp: Date.now(),
      code: currentCode,
      description: `🔱 Alternative Reality #${forkPoints.length + 1}`,
      type: 'fork',
      aiSuggestion: 'Exploring different implementation approach'
    };

    setTimeline(prev => [...prev, forkSnapshot]);
    onLog('success', `🔱 Reality forked! Explore alternative implementations`);
  };

  const simulateFuture = async () => {
    onLog('info', '🔮 Simulating contract execution across multiple scenarios...');
    
    // Simulate different scenarios
    const scenarios = [
      { name: 'Normal Operation', successRate: 0.95 },
      { name: 'High Traffic', successRate: 0.7 },
      { name: 'Attack Scenario', successRate: 0.3 },
      { name: 'Edge Cases', successRate: 0.6 }
    ];

    const results: SimulationResult[] = [];

    for (const scenario of scenarios) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const success = Math.random() < scenario.successRate;
      const result: SimulationResult = {
        success,
        gasUsed: estimateGas(currentCode) * (Math.random() * 0.5 + 0.75),
        outcome: success ? '✅ Executed successfully' : '❌ Transaction reverted',
        stateChanges: {
          balance: success ? 'increased' : 'unchanged',
          storage: success ? 'updated' : 'reverted'
        },
        events: success ? ['Transfer', 'Approval'] : ['Revert']
      };

      results.push(result);
      onLog(success ? 'success' : 'error', `${scenario.name}: ${result.outcome}`);
    }

    setSimulationResults(results);
  };

  const exportTimeline = () => {
    const data = JSON.stringify(timeline, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline-${Date.now()}.json`;
    a.click();
    onLog('success', '💾 Timeline exported successfully');
  };

  const compareSnapshots = (index1: number, index2: number) => {
    if (index1 >= 0 && index2 >= 0 && index1 < timeline.length && index2 < timeline.length) {
      const snap1 = timeline[index1];
      const snap2 = timeline[index2];
      
      const gasDiff = (snap2.gasEstimate || 0) - (snap1.gasEstimate || 0);
      const securityDiff = (snap2.securityScore || 0) - (snap1.securityScore || 0);
      
      onLog('info', `📊 Comparison: Gas ${gasDiff > 0 ? '+' : ''}${gasDiff}, Security ${securityDiff > 0 ? '+' : ''}${securityDiff}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-indigo-900">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <History className="w-6 h-6" />
            <h3 className="font-bold text-lg">Contract Time Machine</h3>
            <span className="px-2 py-0.5 text-xs bg-amber-400/20 text-amber-200 rounded border border-amber-400/30">
              Concept Demo
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => createSnapshot('manual', 'Manual checkpoint')}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
              title="Create Snapshot"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={createFork}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
              title="Fork Reality"
            >
              <GitBranch className="w-4 h-4" />
            </button>
            <button
              onClick={exportTimeline}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
              title="Export Timeline"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => travelToSnapshot(0)}
              disabled={currentIndex <= 0}
              className="p-2 bg-white/20 hover:bg-white/30 rounded disabled:opacity-50 transition-all"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => travelToSnapshot(currentIndex - 1)}
              disabled={currentIndex <= 0}
              className="p-2 bg-white/20 hover:bg-white/30 rounded disabled:opacity-50 transition-all"
            >
              <Rewind className="w-4 h-4" />
            </button>
            <button
              onClick={isPlaying ? () => setIsPlaying(false) : playTimeline}
              className="p-2 bg-white/20 hover:bg-white/30 rounded transition-all"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => travelToSnapshot(currentIndex + 1)}
              disabled={currentIndex >= timeline.length - 1}
              className="p-2 bg-white/20 hover:bg-white/30 rounded disabled:opacity-50 transition-all"
            >
              <FastForward className="w-4 h-4" />
            </button>
            <button
              onClick={() => travelToSnapshot(timeline.length - 1)}
              disabled={currentIndex >= timeline.length - 1}
              className="p-2 bg-white/20 hover:bg-white/30 rounded disabled:opacity-50 transition-all"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="text-sm bg-white/20 rounded px-2 py-1 border-none text-white"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
            <label className="flex items-center space-x-1 text-xs">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="rounded"
              />
              <span>Auto</span>
            </label>
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 to-purple-300 dark:from-indigo-700 dark:to-purple-700" />

          {/* Snapshots */}
          <div className="space-y-4">
            {timeline.map((snapshot, index) => (
              <div
                key={snapshot.id}
                className={`relative ml-16 ${
                  index === currentIndex ? 'scale-105' : 'opacity-70 hover:opacity-100'
                } transition-all cursor-pointer`}
                onClick={() => travelToSnapshot(index)}
              >
                {/* Timeline Dot */}
                <div className={`absolute -left-[34px] top-3 w-4 h-4 rounded-full border-4 ${
                  index === currentIndex
                    ? 'bg-indigo-600 border-indigo-300 shadow-lg shadow-indigo-400'
                    : snapshot.type === 'fork'
                    ? 'bg-purple-600 border-purple-300'
                    : snapshot.type === 'ai'
                    ? 'bg-pink-600 border-pink-300'
                    : 'bg-gray-400 border-gray-200'
                }`} />

                {/* Snapshot Card */}
                <div className={`p-4 rounded-xl border-2 ${
                  index === currentIndex
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-600 shadow-lg'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        {snapshot.type === 'fork' && <GitBranch className="w-4 h-4 text-purple-600" />}
                        {snapshot.type === 'ai' && <Sparkles className="w-4 h-4 text-pink-600" />}
                        <h4 className="font-semibold text-sm">{snapshot.description}</h4>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(snapshot.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {index === currentIndex && (
                      <span className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-full">
                        Current
                      </span>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {snapshot.gasEstimate && (
                      <div className="flex items-center space-x-2 text-xs">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span>{(snapshot.gasEstimate / 1000).toFixed(1)}k gas</span>
                      </div>
                    )}
                    {snapshot.securityScore !== undefined && (
                      <div className="flex items-center space-x-2 text-xs">
                        <AlertTriangle className={`w-4 h-4 ${
                          snapshot.securityScore > 80 ? 'text-green-600' : 
                          snapshot.securityScore > 60 ? 'text-yellow-600' : 'text-red-600'
                        }`} />
                        <span>Security: {snapshot.securityScore}/100</span>
                      </div>
                    )}
                  </div>

                  {snapshot.aiSuggestion && (
                    <div className="mt-3 p-2 bg-pink-50 dark:bg-pink-900/20 rounded text-xs">
                      💡 {snapshot.aiSuggestion}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {timeline.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">No snapshots yet</p>
            <p className="text-xs mt-2">Your contract evolution will appear here</p>
          </div>
        )}
      </div>

      {/* Future Simulation Panel */}
      <div className="p-4 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 border-t border-indigo-200 dark:border-indigo-800">
        <button
          onClick={simulateFuture}
          className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
        >
          <Sparkles className="w-5 h-5 inline mr-2" />
          Simulate Future Executions
        </button>

        {simulationResults.length > 0 && (
          <div className="mt-3 text-xs space-y-1">
            <p className="font-semibold text-indigo-900 dark:text-indigo-100">Simulation Results:</p>
            {simulationResults.map((result, i) => (
              <div key={i} className={`flex items-center justify-between ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                <span>Scenario {i + 1}</span>
                <span>{(result.gasUsed / 1000).toFixed(1)}k gas</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>📸 {timeline.length} snapshots</span>
          <span>🔱 {forkPoints.length} realities</span>
        </div>
      </div>
    </div>
  );
}
