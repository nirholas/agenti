/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Keep shining, keep coding 🌞
 */

import { useState, useEffect } from 'react';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  DollarSign,
  Clock,
  BarChart3,
  CheckCircle,
  Sparkles,
  Database,
  Cpu,
  Network
} from 'lucide-react';

interface GasPrediction {
  operation: string;
  currentCost: number;
  predictedCost: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  optimizationPotential: number;
  recommendations: string[];
}

interface NetworkState {
  gasPrice: number;
  blockTime: number;
  congestion: 'low' | 'medium' | 'high' | 'extreme';
  trend: number;
}

interface MLModel {
  name: string;
  accuracy: number;
  trainingSamples: number;
  lastUpdated: number;
}

export default function NeuralGasOracle({
  code,
  onLog
}: {
  code: string;
  onLog: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}) {
  const [predictions, setPredictions] = useState<GasPrediction[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [networkState, setNetworkState] = useState<NetworkState>({
    gasPrice: 30,
    blockTime: 12,
    congestion: 'medium',
    trend: 0.05
  });
  const [mlModels, setMlModels] = useState<MLModel[]>([
    { name: 'LSTM Gas Predictor', accuracy: 0.94, trainingSamples: 100000, lastUpdated: Date.now() },
    { name: 'Transformer Optimizer', accuracy: 0.91, trainingSamples: 50000, lastUpdated: Date.now() },
    { name: 'Neural Pattern Matcher', accuracy: 0.89, trainingSamples: 75000, lastUpdated: Date.now() }
  ]);
  const [selectedModel, setSelectedModel] = useState(0);
  const [totalSavings, setTotalSavings] = useState(0);
  const [predictionHistory, setPredictionHistory] = useState<number[]>([]);
  const [realTimeMode, setRealTimeMode] = useState(false);

  // Simulate real-time gas price updates
  useEffect(() => {
    if (realTimeMode) {
      const interval = setInterval(() => {
        setNetworkState(prev => {
          const fluctuation = (Math.random() - 0.5) * 10;
          const newGasPrice = Math.max(10, prev.gasPrice + fluctuation);
          const newCongestion = 
            newGasPrice > 100 ? 'extreme' :
            newGasPrice > 60 ? 'high' :
            newGasPrice > 30 ? 'medium' : 'low';
          
          return {
            ...prev,
            gasPrice: newGasPrice,
            congestion: newCongestion,
            trend: fluctuation / prev.gasPrice
          };
        });
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [realTimeMode]);

  // Update prediction history
  useEffect(() => {
    setPredictionHistory(prev => [...prev, networkState.gasPrice].slice(-20));
  }, [networkState.gasPrice]);

  const analyzeContract = async () => {
    setIsAnalyzing(true);
    onLog('info', '🧠 Neural network analyzing contract...');

    // Simulate neural network processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const operations = extractOperations(code);
    const newPredictions: GasPrediction[] = [];

    for (const operation of operations) {
      const currentCost = estimateCurrentGas(operation);
      const predictedCost = await predictWithML(operation, currentCost);
      const optimizationPotential = currentCost - predictedCost.optimized;

      newPredictions.push({
        operation,
        currentCost,
        predictedCost: predictedCost.optimized,
        confidence: predictedCost.confidence,
        trend: predictedCost.trend,
        optimizationPotential,
        recommendations: predictedCost.recommendations
      });
    }

    setPredictions(newPredictions);
    
    const totalOptimization = newPredictions.reduce((sum, p) => sum + p.optimizationPotential, 0);
    setTotalSavings(prev => prev + totalOptimization);
    
    setIsAnalyzing(false);
    onLog('success', `✨ Found ${totalOptimization.toLocaleString()} gas optimization opportunities!`);
  };

  const extractOperations = (contractCode: string): string[] => {
    const operations: string[] = [];
    
    // Storage operations
    if (contractCode.match(/mapping\s*\(/)) operations.push('Storage Mapping');
    if (contractCode.match(/\w+\s*\[\s*\]/)) operations.push('Array Storage');
    
    // Loops
    if (contractCode.includes('for') || contractCode.includes('while')) {
      operations.push('Loop Iteration');
    }
    
    // External calls
    if (contractCode.includes('.call') || contractCode.includes('.transfer')) {
      operations.push('External Call');
    }
    
    // Math operations
    if (contractCode.match(/[\+\-\*\/]/)) operations.push('Arithmetic');
    
    // Event emissions
    if (contractCode.includes('emit')) operations.push('Event Emission');
    
    return operations.length > 0 ? operations : ['Contract Deployment'];
  };

  const estimateCurrentGas = (operation: string): number => {
    const gasTable: Record<string, number> = {
      'Storage Mapping': 20000,
      'Array Storage': 25000,
      'Loop Iteration': 15000,
      'External Call': 30000,
      'Arithmetic': 5000,
      'Event Emission': 3000,
      'Contract Deployment': 200000
    };
    
    return gasTable[operation] || 10000;
  };

  const predictWithML = async (
    operation: string,
    currentCost: number
  ): Promise<{
    optimized: number;
    confidence: number;
    trend: 'up' | 'down' | 'stable';
    recommendations: string[];
  }> => {
    // Simulate ML model inference
    await new Promise(resolve => setTimeout(resolve, 300));

    const model = mlModels[selectedModel];
    const optimizationFactor = 0.7 + (Math.random() * 0.2); // 70-90% of original
    const optimized = Math.floor(currentCost * optimizationFactor);
    const confidence = model.accuracy * (0.9 + Math.random() * 0.1);

    // Determine trend based on network state
    const trend: 'up' | 'down' | 'stable' = 
      networkState.trend > 0.1 ? 'up' :
      networkState.trend < -0.1 ? 'down' : 'stable';

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (operation === 'Storage Mapping') {
      recommendations.push('Use packed storage for multiple variables');
      recommendations.push('Consider using uint96 instead of uint256 if possible');
    } else if (operation === 'Array Storage') {
      recommendations.push('Use fixed-size arrays when length is known');
      recommendations.push('Batch array operations to reduce SSTORE costs');
    } else if (operation === 'Loop Iteration') {
      recommendations.push('Cache array length outside loop');
      recommendations.push('Use unchecked{} for counter increments');
      recommendations.push('Consider using mappings instead of loops');
    } else if (operation === 'External Call') {
      recommendations.push('Batch multiple calls when possible');
      recommendations.push('Use staticcall for read-only operations');
    } else if (operation === 'Event Emission') {
      recommendations.push('Use indexed parameters wisely (max 3)');
      recommendations.push('Emit events after state changes');
    }

    return { optimized, confidence, trend, recommendations };
  };

  const optimizeWithAI = async (prediction: GasPrediction) => {
    onLog('info', `🤖 AI optimizing ${prediction.operation}...`);
    
    // Simulate AI code transformation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    onLog('success', `✨ Optimized! Saved ${prediction.optimizationPotential.toLocaleString()} gas`);
    
    // Update prediction to show it's been applied
    setPredictions(prev =>
      prev.map(p =>
        p.operation === prediction.operation
          ? { ...p, optimizationPotential: 0, currentCost: p.predictedCost }
          : p
      )
    );
  };

  const trainModel = async () => {
    onLog('info', '🎓 Training neural network on latest blockchain data...');
    setIsAnalyzing(true);

    await new Promise(resolve => setTimeout(resolve, 3000));

    setMlModels(prev =>
      prev.map((model, i) =>
        i === selectedModel
          ? {
              ...model,
              accuracy: Math.min(0.99, model.accuracy + 0.02),
              trainingSamples: model.trainingSamples + 10000,
              lastUpdated: Date.now()
            }
          : model
      )
    );

    setIsAnalyzing(false);
    onLog('success', '✅ Model retrained! Accuracy improved.');
  };

  const getCongestionColor = (congestion: string) => {
    switch (congestion) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'extreme': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-gray-900 dark:to-cyan-900/20">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Brain className="w-6 h-6" />
            <h3 className="font-bold text-lg">Neural Gas Oracle</h3>
            <span className="px-2 py-0.5 text-xs bg-amber-400/20 text-amber-200 rounded border border-amber-400/30">
              Concept Demo
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={analyzeContract}
              disabled={isAnalyzing}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              {isAnalyzing ? '🧠 Analyzing...' : '🔮 Predict'}
            </button>
            <button
              onClick={trainModel}
              disabled={isAnalyzing}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              🎓 Train
            </button>
          </div>
        </div>

        {/* Model Selector */}
        <div className="flex items-center space-x-4 text-sm">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(Number(e.target.value))}
            className="px-3 py-1 bg-white/20 rounded-lg border-none text-white"
          >
            {mlModels.map((model, i) => (
              <option key={i} value={i} className="text-gray-900">
                {model.name} ({(model.accuracy * 100).toFixed(1)}%)
              </option>
            ))}
          </select>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={realTimeMode}
              onChange={(e) => setRealTimeMode(e.target.checked)}
              className="rounded"
            />
            <span>⚡ Live Mode</span>
          </label>
        </div>
      </div>

      {/* Network State Dashboard */}
      <div className="p-4 bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/20 dark:to-blue-900/20 border-b border-cyan-200 dark:border-cyan-800">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Zap className="w-4 h-4 text-cyan-600 mr-1" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Gas Price</span>
            </div>
            <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">
              {networkState.gasPrice.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">gwei</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Clock className="w-4 h-4 text-blue-600 mr-1" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Block Time</span>
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {networkState.blockTime}
            </div>
            <div className="text-xs text-gray-500">seconds</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Activity className="w-4 h-4 text-purple-600 mr-1" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Congestion</span>
            </div>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getCongestionColor(networkState.congestion)}`}>
              {networkState.congestion}
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <DollarSign className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Total Saved</span>
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {(totalSavings / 1000).toFixed(1)}k
            </div>
            <div className="text-xs text-gray-500">gas</div>
          </div>
        </div>

        {/* Gas Price Chart */}
        {predictionHistory.length > 0 && (
          <div className="mt-4 h-20 flex items-end space-x-1">
            {predictionHistory.map((price, i) => (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
                style={{ height: `${(price / 150) * 100}%` }}
                title={`${price.toFixed(1)} gwei`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ML Model Stats */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-bold mb-3 flex items-center">
          <Cpu className="w-4 h-4 mr-2" />
          Active Model: {mlModels[selectedModel].name}
        </h4>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">Accuracy</div>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                  style={{ width: `${mlModels[selectedModel].accuracy * 100}%` }}
                />
              </div>
              <span className="font-bold">{(mlModels[selectedModel].accuracy * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">Training Samples</div>
            <div className="font-bold">
              <Database className="w-3 h-3 inline mr-1" />
              {(mlModels[selectedModel].trainingSamples / 1000).toFixed(0)}k
            </div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400 mb-1">Last Updated</div>
            <div className="font-bold">
              {new Date(mlModels[selectedModel].lastUpdated).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Predictions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {predictions.length === 0 && !isAnalyzing && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Brain className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Neural network ready</p>
            <p className="text-xs mt-2">Click "Predict" to analyze gas costs</p>
          </div>
        )}

        {predictions.map((prediction, i) => (
          <div
            key={i}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-cyan-200 dark:border-cyan-800 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h5 className="font-bold text-lg flex items-center space-x-2">
                  <span>{prediction.operation}</span>
                  {prediction.trend === 'down' ? (
                    <TrendingDown className="w-5 h-5 text-green-600" />
                  ) : prediction.trend === 'up' ? (
                    <TrendingUp className="w-5 h-5 text-red-600" />
                  ) : (
                    <Activity className="w-5 h-5 text-blue-600" />
                  )}
                </h5>
                <div className="text-xs text-gray-500 mt-1">
                  Confidence: {(prediction.confidence * 100).toFixed(1)}%
                </div>
              </div>
              {prediction.optimizationPotential > 0 && (
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-bold">
                  -{((prediction.optimizationPotential / prediction.currentCost) * 100).toFixed(0)}%
                </span>
              )}
            </div>

            {/* Gas Comparison */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-xs text-red-600 dark:text-red-400 mb-1">Current Cost</div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {prediction.currentCost.toLocaleString()}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">gas</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-xs text-green-600 dark:text-green-400 mb-1">Optimized Cost</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {prediction.predictedCost.toLocaleString()}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">gas</div>
              </div>
            </div>

            {/* Recommendations */}
            {prediction.recommendations.length > 0 && (
              <div className="mb-3">
                <h6 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Recommendations:
                </h6>
                <ul className="space-y-1">
                  {prediction.recommendations.map((rec, j) => (
                    <li key={j} className="text-xs text-gray-700 dark:text-gray-300 flex items-start">
                      <CheckCircle className="w-3 h-3 mr-2 mt-0.5 text-cyan-600 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Button */}
            {prediction.optimizationPotential > 0 && (
              <button
                onClick={() => optimizeWithAI(prediction)}
                className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-700 hover:to-blue-700 transition-all"
              >
                <Zap className="w-4 h-4 inline mr-2" />
                Apply AI Optimization
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="p-4 bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 border-t border-cyan-200 dark:border-cyan-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400 flex items-center">
            <Network className="w-3 h-3 mr-1" />
            Analyzing {predictions.length} operations
          </span>
          <span className="text-gray-600 dark:text-gray-400 flex items-center">
            <BarChart3 className="w-3 h-3 mr-1" />
            Powered by {mlModels[selectedModel].name}
          </span>
        </div>
      </div>
    </div>
  );
}
