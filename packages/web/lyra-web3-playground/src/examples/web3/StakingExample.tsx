/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your potential is limitless 🌌
 */

import { useState, useEffect } from 'react';
import { Lock, TrendingUp, Coins, Clock } from 'lucide-react';

interface StakingPool {
  id: string;
  name: string;
  apy: number;
  minStake: number;
  lockPeriod: number; // in days
  totalStaked: number;
}

export default function StakingExample() {
  const pools: StakingPool[] = [
    { id: '1', name: 'Flexible Staking', apy: 5.5, minStake: 0.1, lockPeriod: 0, totalStaked: 1250000 },
    { id: '2', name: '30-Day Lock', apy: 12.5, minStake: 1, lockPeriod: 30, totalStaked: 850000 },
    { id: '3', name: '90-Day Lock', apy: 18.8, minStake: 5, lockPeriod: 90, totalStaked: 2100000 },
    { id: '4', name: '365-Day Lock', apy: 25.0, minStake: 10, lockPeriod: 365, totalStaked: 3500000 },
  ];

  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState('');
  const [stakedPositions, setStakedPositions] = useState<{ [key: string]: { amount: number; timestamp: number; rewards: number } }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      
      // Calculate rewards
      setStakedPositions(prevPositions => {
        const updated = { ...prevPositions };
        Object.entries(prevPositions).forEach(([poolId, position]) => {
          const pool = pools.find(p => p.id === poolId);
          if (pool) {
            const timeElapsed = (Date.now() - position.timestamp) / 1000;
            const rewardRate = (pool.apy / 100) / (365 * 24 * 60 * 60);
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
    
    const pool = pools.find(p => p.id === selectedPool);
    if (!pool || parseFloat(stakeAmount) < pool.minStake) {
      alert(`Minimum stake is ${pool?.minStake} tokens`);
      return;
    }

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
    const pool = pools.find(p => p.id === poolId);
    const position = stakedPositions[poolId];
    
    if (pool && position) {
      const elapsed = (Date.now() - position.timestamp) / (86400000);
      if (pool.lockPeriod > 0 && elapsed < pool.lockPeriod) {
        alert(`Lock period not complete. ${(pool.lockPeriod - elapsed).toFixed(1)} days remaining.`);
        return;
      }
    }

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
        <h1 className="text-3xl font-bold mb-2">Token Staking</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Stake tokens to earn passive rewards
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Your Staked</span>
            <Lock className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">{totalStaked.toFixed(2)}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Pending Rewards</span>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{totalRewards.toFixed(6)}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Active Pools</span>
            <Coins className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">{Object.keys(stakedPositions).length}</p>
        </div>
      </div>

      {/* Staking Interface */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Stake Tokens</h2>
        
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
            <label className="block text-sm font-medium mb-2">Amount</label>
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
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Staking Pools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pools.map(pool => (
            <div key={pool.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">{pool.name}</h3>
                <span className="text-sm px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                  {pool.apy}% APY
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Min Stake:</span>
                  <span className="font-semibold">{pool.minStake} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Lock Period:</span>
                  <span className="font-semibold">{pool.lockPeriod === 0 ? 'Flexible' : `${pool.lockPeriod} days`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Staked:</span>
                  <span className="font-semibold">${(pool.totalStaked / 1000).toFixed(0)}K</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Your Positions */}
      {Object.keys(stakedPositions).length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Your Staking Positions</h2>
          <div className="space-y-4">
            {Object.entries(stakedPositions).map(([poolId, position]) => {
              const pool = pools.find(p => p.id === poolId);
              if (!pool) return null;

              const elapsed = (Date.now() - position.timestamp) / 86400000;
              const isLocked = pool.lockPeriod > 0 && elapsed < pool.lockPeriod;

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
                      <p className="font-semibold">{position.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Pending Rewards</p>
                      <p className="font-semibold text-green-600">{position.rewards.toFixed(6)}</p>
                    </div>
                  </div>

                  {isLocked && (
                    <div className="flex items-center text-xs text-yellow-600 dark:text-yellow-400 mb-3">
                      <Clock className="w-3 h-3 mr-1" />
                      Locked for {(pool.lockPeriod - elapsed).toFixed(1)} more days
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleClaimRewards(poolId)}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Claim Rewards
                    </button>
                    <button
                      onClick={() => handleUnstake(poolId)}
                      disabled={isLocked}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
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
          <strong>Demo Mode:</strong> This demonstrates token staking mechanisms common in DeFi protocols. 
          Rewards are calculated in real-time based on APY and staking duration. Lock periods ensure network security and stability.
        </p>
      </div>
    </div>
  );
}
