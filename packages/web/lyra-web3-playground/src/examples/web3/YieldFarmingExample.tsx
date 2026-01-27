/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your potential is limitless 🌌
 */

import { useState, useEffect } from 'react';
import { Sprout, TrendingUp, Clock, Coins } from 'lucide-react';

interface Pool {
  id: string;
  name: string;
  token0: string;
  token1: string;
  apy: number;
  tvl: number;
  rewardToken: string;
}

export default function YieldFarmingExample() {
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakedPositions, setStakedPositions] = useState<{ [key: string]: { amount: number; timestamp: number; rewards: number } }>({});

  const pools: Pool[] = [
    { id: 'eth-usdc', name: 'ETH-USDC', token0: 'ETH', token1: 'USDC', apy: 45.5, tvl: 12500000, rewardToken: 'FARM' },
    { id: 'eth-dai', name: 'ETH-DAI', token0: 'ETH', token1: 'DAI', apy: 38.2, tvl: 8900000, rewardToken: 'FARM' },
    { id: 'wbtc-eth', name: 'WBTC-ETH', token0: 'WBTC', token1: 'ETH', apy: 52.3, tvl: 15200000, rewardToken: 'FARM' },
    { id: 'usdc-dai', name: 'USDC-DAI', token0: 'USDC', token1: 'DAI', apy: 18.7, tvl: 22300000, rewardToken: 'FARM' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      
      // Calculate rewards for all positions
      setStakedPositions(prevPositions => {
        const updated = { ...prevPositions };
        Object.entries(prevPositions).forEach(([poolId, position]) => {
          const pool = pools.find(p => p.id === poolId);
          if (pool) {
            const timeElapsed = (Date.now() - position.timestamp) / 1000; // in seconds
            const rewardRate = (pool.apy / 100) / (365 * 24 * 60 * 60); // per second
            updated[poolId] = {
              ...position,
              rewards: position.amount * rewardRate * timeElapsed
            };
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pools]);

  const handleStake = () => {
    if (!selectedPool || !stakeAmount || parseFloat(stakeAmount) <= 0) return;
    
    const newPositions = { ...stakedPositions };
    if (newPositions[selectedPool]) {
      newPositions[selectedPool].amount += parseFloat(stakeAmount);
    } else {
      newPositions[selectedPool] = {
        amount: parseFloat(stakeAmount),
        timestamp: Date.now(),
        rewards: 0
      };
    }
    
    setStakedPositions(newPositions);
    setStakeAmount('');
  };

  const handleUnstake = (poolId: string) => {
    const newPositions = { ...stakedPositions };
    delete newPositions[poolId];
    setStakedPositions(newPositions);
  };

  const handleClaimRewards = (poolId: string) => {
    const newPositions = { ...stakedPositions };
    if (newPositions[poolId]) {
      newPositions[poolId].rewards = 0;
      newPositions[poolId].timestamp = Date.now();
      setStakedPositions(newPositions);
    }
  };

  const totalStaked = Object.values(stakedPositions).reduce((sum, pos) => sum + pos.amount, 0);
  const totalRewards = Object.values(stakedPositions).reduce((sum, pos) => sum + pos.rewards, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Yield Farming</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Stake LP tokens to earn rewards from liquidity provision
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Staked</span>
            <Coins className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">${totalStaked.toFixed(2)}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Pending Rewards</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{totalRewards.toFixed(6)} FARM</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Active Farms</span>
            <Sprout className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">{Object.keys(stakedPositions).length}</p>
        </div>
      </div>

      {/* Staking Interface */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Stake LP Tokens</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Pool</label>
            <select
              value={selectedPool}
              onChange={(e) => setSelectedPool(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="">Choose a pool</option>
              {pools.map(pool => (
                <option key={pool.id} value={pool.id}>
                  {pool.name} - {pool.apy}% APY
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount (LP Tokens)</label>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <button
          onClick={handleStake}
          disabled={!selectedPool || !stakeAmount}
          className="w-full btn-primary mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Stake Tokens
        </button>
      </div>

      {/* Available Pools */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Available Pools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pools.map(pool => (
            <div key={pool.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">{pool.name}</h3>
                <span className="text-sm px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                  {pool.apy}% APY
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">TVL:</span>
                  <span className="font-semibold">${(pool.tvl / 1000000).toFixed(2)}M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Reward Token:</span>
                  <span className="font-semibold">{pool.rewardToken}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Your Positions */}
      {Object.keys(stakedPositions).length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Your Staked Positions</h2>
          <div className="space-y-4">
            {Object.entries(stakedPositions).map(([poolId, position]) => {
              const pool = pools.find(p => p.id === poolId);
              if (!pool) return null;

              const stakingDuration = (Date.now() - position.timestamp) / 1000; // in seconds
              const hours = Math.floor(stakingDuration / 3600);
              const minutes = Math.floor((stakingDuration % 3600) / 60);
              const seconds = Math.floor(stakingDuration % 60);

              return (
                <div key={poolId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">{pool.name}</h3>
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                      {pool.apy}% APY
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Staked Amount</p>
                      <p className="font-semibold">{position.amount.toFixed(6)} LP</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Pending Rewards</p>
                      <p className="font-semibold text-green-600">{position.rewards.toFixed(6)} FARM</p>
                    </div>
                  </div>

                  <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-3">
                    <Clock className="w-3 h-3 mr-1" />
                    Staking for: {hours}h {minutes}m {seconds}s
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleClaimRewards(poolId)}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Claim Rewards
                    </button>
                    <button
                      onClick={() => handleUnstake(poolId)}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Unstake
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-6">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This is a simulation of yield farming protocols like SushiSwap or PancakeSwap. 
          Rewards are calculated in real-time based on staking duration and pool APY. In production, this would interact with smart contracts for LP token staking and reward distribution.
        </p>
      </div>
    </div>
  );
}
