/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Write code that makes you proud 🏆
 */

import { useState } from 'react';
import {
  GitBranch,
  Globe,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader,
  Link as LinkIcon,
  Rocket,
  DollarSign,
  Clock,
  Network,
  Sparkles,
  TrendingUp
} from 'lucide-react';

interface Chain {
  id: number;
  name: string;
  logo: string;
  color: string;
  gasPrice: number;
  blockTime: number;
  deployed: boolean;
  deploymentCost: number;
  contractAddress?: string;
  verified: boolean;
}

interface Bridge {
  from: string;
  to: string;
  protocol: string;
  cost: number;
}

export default function CrossChainDreamWeaver({
  code,
  onLog
}: {
  code: string;
  onLog: (type: 'info' | 'success' | 'error' | 'warning', message: string) => void;
}) {
  const [selectedChains, setSelectedChains] = useState<number[]>([1]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState<Record<number, number>>({});
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [syncMode, setSyncMode] = useState<'sequential' | 'parallel' | 'smart'>('smart');
  const [totalCost, setTotalCost] = useState(0);
  
  const chains: Chain[] = [
    {
      id: 1,
      name: 'Ethereum',
      logo: '⟠',
      color: 'bg-blue-600',
      gasPrice: 30,
      blockTime: 12,
      deployed: false,
      deploymentCost: 250,
      verified: false
    },
    {
      id: 137,
      name: 'Polygon',
      logo: '⬢',
      color: 'bg-purple-600',
      gasPrice: 50,
      blockTime: 2,
      deployed: false,
      deploymentCost: 15,
      verified: false
    },
    {
      id: 56,
      name: 'BSC',
      logo: '◆',
      color: 'bg-yellow-600',
      gasPrice: 5,
      blockTime: 3,
      deployed: false,
      deploymentCost: 8,
      verified: false
    },
    {
      id: 42161,
      name: 'Arbitrum',
      logo: '◉',
      color: 'bg-cyan-600',
      gasPrice: 0.5,
      blockTime: 0.25,
      deployed: false,
      deploymentCost: 2,
      verified: false
    },
    {
      id: 10,
      name: 'Optimism',
      logo: '○',
      color: 'bg-red-600',
      gasPrice: 0.3,
      blockTime: 2,
      deployed: false,
      deploymentCost: 3,
      verified: false
    },
    {
      id: 43114,
      name: 'Avalanche',
      logo: '▲',
      color: 'bg-red-500',
      gasPrice: 25,
      blockTime: 2,
      deployed: false,
      deploymentCost: 20,
      verified: false
    },
    {
      id: 250,
      name: 'Fantom',
      logo: '◊',
      color: 'bg-blue-500',
      gasPrice: 20,
      blockTime: 1,
      deployed: false,
      deploymentCost: 5,
      verified: false
    },
    {
      id: 100,
      name: 'Gnosis',
      logo: '◎',
      color: 'bg-green-600',
      gasPrice: 2,
      blockTime: 5,
      deployed: false,
      deploymentCost: 1,
      verified: false
    }
  ];

  const [chainStates, setChainStates] = useState<Chain[]>(chains);

  const toggleChain = (chainId: number) => {
    setSelectedChains(prev =>
      prev.includes(chainId)
        ? prev.filter(id => id !== chainId)
        : [...prev, chainId]
    );
  };

  const calculateTotalCost = () => {
    const cost = selectedChains.reduce((sum, chainId) => {
      const chain = chainStates.find(c => c.id === chainId);
      return sum + (chain?.deploymentCost || 0);
    }, 0);
    setTotalCost(cost);
    return cost;
  };

  const deployToAllChains = async () => {
    if (selectedChains.length === 0) {
      onLog('error', 'Select at least one chain');
      return;
    }

    setIsDeploying(true);
    const cost = calculateTotalCost();
    onLog('info', `🚀 Deploying to ${selectedChains.length} chains... Total cost: $${cost}`);

    // Deploy based on mode
    if (syncMode === 'parallel') {
      await deployParallel();
    } else if (syncMode === 'sequential') {
      await deploySequential();
    } else {
      await deploySmart();
    }

    setIsDeploying(false);
    onLog('success', `🎉 Successfully deployed to ${selectedChains.length} chains!`);
    
    // Auto-setup bridges
    if (selectedChains.length > 1) {
      setupBridges();
    }
  };

  const deploySequential = async () => {
    for (const chainId of selectedChains) {
      await deployToChain(chainId);
    }
  };

  const deployParallel = async () => {
    await Promise.all(selectedChains.map(chainId => deployToChain(chainId)));
  };

  const deploySmart = async () => {
    // Deploy to cheapest chains first
    const sortedChains = [...selectedChains].sort((a, b) => {
      const chainA = chainStates.find(c => c.id === a);
      const chainB = chainStates.find(c => c.id === b);
      return (chainA?.deploymentCost || 0) - (chainB?.deploymentCost || 0);
    });

    onLog('info', '🧠 Smart deployment: Optimizing order by cost...');
    
    // Deploy in batches of 3
    for (let i = 0; i < sortedChains.length; i += 3) {
      const batch = sortedChains.slice(i, i + 3);
      await Promise.all(batch.map(chainId => deployToChain(chainId)));
    }
  };

  const deployToChain = async (chainId: number) => {
    const chain = chainStates.find(c => c.id === chainId);
    if (!chain) return;

    onLog('info', `📡 Deploying to ${chain.name}...`);

    // Simulate deployment progress
    for (let progress = 0; progress <= 100; progress += 10) {
      setDeploymentProgress(prev => ({ ...prev, [chainId]: progress }));
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Generate contract address
    const address = `0x${Math.random().toString(16).slice(2, 42).padStart(40, '0')}`;
    
    setChainStates(prev =>
      prev.map(c =>
        c.id === chainId
          ? { ...c, deployed: true, contractAddress: address, verified: true }
          : c
      )
    );

    onLog('success', `✅ ${chain.name}: ${address}`);
  };

  const setupBridges = () => {
    onLog('info', '🌉 Setting up cross-chain bridges...');
    
    const newBridges: Bridge[] = [];
    const selectedChainData = chainStates.filter(c => selectedChains.includes(c.id));

    // Create bridges between adjacent chains
    for (let i = 0; i < selectedChainData.length - 1; i++) {
      newBridges.push({
        from: selectedChainData[i].name,
        to: selectedChainData[i + 1].name,
        protocol: 'LayerZero',
        cost: 5
      });
    }

    setBridges(newBridges);
    onLog('success', `🌉 Set up ${newBridges.length} bridges`);
  };

  const verifyAllContracts = async () => {
    onLog('info', '🔍 Verifying contracts on block explorers...');
    
    for (const chainId of selectedChains) {
      const chain = chainStates.find(c => c.id === chainId);
      if (!chain?.deployed) continue;
      
      await new Promise(resolve => setTimeout(resolve, 500));
      onLog('success', `✓ Verified on ${chain.name}scan`);
    }
  };

  const getNetworkStats = () => {
    const deployed = chainStates.filter(c => c.deployed).length;
    const totalGas = selectedChains.reduce((sum, id) => {
      const chain = chainStates.find(c => c.id === id);
      return sum + (chain?.gasPrice || 0);
    }, 0);
    const avgBlockTime = selectedChains.reduce((sum, id) => {
      const chain = chainStates.find(c => c.id === id);
      return sum + (chain?.blockTime || 0);
    }, 0) / selectedChains.length;

    return { deployed, totalGas, avgBlockTime };
  };

  const stats = getNetworkStats();

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-emerald-900/20">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Globe className="w-6 h-6" />
            <h3 className="font-bold text-lg">Cross-Chain Dream Weaver</h3>
            <span className="px-2 py-0.5 text-xs bg-amber-400/20 text-amber-200 rounded border border-amber-400/30">
              Concept Demo
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={deployToAllChains}
              disabled={isDeploying || selectedChains.length === 0}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center space-x-2"
            >
              <Rocket className="w-4 h-4" />
              <span>{isDeploying ? 'Deploying...' : 'Deploy All'}</span>
            </button>
            <button
              onClick={verifyAllContracts}
              disabled={!chainStates.some(c => c.deployed) || isDeploying}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              🔍 Verify
            </button>
          </div>
        </div>

        {/* Deployment Mode */}
        <div className="flex items-center space-x-4 text-sm">
          <span>Deployment Strategy:</span>
          {['sequential', 'parallel', 'smart'].map((mode) => (
            <label key={mode} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                checked={syncMode === mode}
                onChange={() => setSyncMode(mode as any)}
                className="rounded-full"
              />
              <span className="capitalize">{mode}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="p-4 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-200 dark:border-emerald-800">
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {selectedChains.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Selected Chains</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.deployed}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Deployed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {bridges.length}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Bridges Active</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              ${calculateTotalCost()}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Cost</div>
          </div>
        </div>
      </div>

      {/* Chain Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4 mb-6">
          {chainStates.map((chain) => {
            const isSelected = selectedChains.includes(chain.id);
            const progress = deploymentProgress[chain.id] || 0;

            return (
              <div
                key={chain.id}
                onClick={() => !isDeploying && toggleChain(chain.id)}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                } ${chain.deployed ? 'ring-2 ring-green-400' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${chain.color} rounded-full flex items-center justify-center text-2xl`}>
                      {chain.logo}
                    </div>
                    <div>
                      <h4 className="font-bold">{chain.name}</h4>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Chain ID: {chain.id}
                      </div>
                    </div>
                  </div>
                  {chain.deployed ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : isSelected ? (
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-600 bg-emerald-100 dark:bg-emerald-900/50" />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </div>

                {/* Chain Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-yellow-600" />
                    <span>{chain.gasPrice} gwei</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span>{chain.blockTime}s block</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <DollarSign className="w-3 h-3 text-green-600" />
                    <span>${chain.deploymentCost}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {chain.verified ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span className="text-green-600">Verified</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-400">Not verified</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Deployment Progress */}
                {isDeploying && isSelected && progress < 100 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Deploying...</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Contract Address */}
                {chain.contractAddress && (
                  <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs font-mono break-all">
                    {chain.contractAddress}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Cross-Chain Bridges */}
        {bridges.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-bold mb-3 flex items-center">
              <LinkIcon className="w-4 h-4 mr-2" />
              Active Cross-Chain Bridges
            </h4>
            <div className="space-y-2">
              {bridges.map((bridge, i) => (
                <div
                  key={i}
                  className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <GitBranch className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-medium">
                      {bridge.from} ↔ {bridge.to}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                      {bridge.protocol}
                    </span>
                    <span className="text-gray-500">${bridge.cost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <button
            onClick={() => setSelectedChains(chainStates.map(c => c.id))}
            disabled={isDeploying}
            className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all disabled:opacity-50"
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedChains([])}
            disabled={isDeploying}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
          >
            Clear All
          </button>
          <button
            onClick={() => {
              // Select cheapest chains
              const cheapest = [...chainStates]
                .sort((a, b) => a.deploymentCost - b.deploymentCost)
                .slice(0, 3)
                .map(c => c.id);
              setSelectedChains(cheapest);
            }}
            disabled={isDeploying}
            className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-all disabled:opacity-50"
          >
            Cheapest 3
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 border-t border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400 flex items-center">
            <Network className="w-3 h-3 mr-1" />
            8 networks supported
          </span>
          <span className="text-gray-600 dark:text-gray-400 flex items-center">
            <Sparkles className="w-3 h-3 mr-1" />
            One-click multi-chain deployment
          </span>
        </div>
      </div>
    </div>
  );
}
