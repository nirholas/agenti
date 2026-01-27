/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every expert was once a beginner 📚
 */

import { useState } from 'react';
import { Lock, Clock, Unlock } from 'lucide-react';

interface VestingSchedule {
  beneficiary: string;
  totalAmount: number;
  startTime: number;
  duration: number; // in days
  cliffDuration: number; // in days
  released: number;
}

export default function TokenVestingExample() {
  const [schedules, setSchedules] = useState<VestingSchedule[]>([
    {
      beneficiary: '0xaaaa...bbbb',
      totalAmount: 10000,
      startTime: Date.now() - 86400000 * 30, // started 30 days ago
      duration: 365,
      cliffDuration: 90,
      released: 0,
    },
    {
      beneficiary: '0xcccc...dddd',
      totalAmount: 5000,
      startTime: Date.now() - 86400000 * 180, // started 180 days ago
      duration: 365,
      cliffDuration: 0,
      released: 2500,
    },
  ]);

  const [newSchedule, setNewSchedule] = useState({
    beneficiary: '',
    amount: '',
    duration: '365',
    cliff: '90',
  });

  const calculateVestedAmount = (schedule: VestingSchedule): number => {
    const currentTime = Date.now();
    const elapsedTime = currentTime - schedule.startTime;
    const elapsedDays = elapsedTime / 86400000;

    // Check if cliff period has passed
    if (elapsedDays < schedule.cliffDuration) {
      return 0;
    }

    // Calculate vested amount
    if (elapsedDays >= schedule.duration) {
      return schedule.totalAmount;
    }

    return (schedule.totalAmount * elapsedDays) / schedule.duration;
  };

  const calculateReleasableAmount = (schedule: VestingSchedule): number => {
    const vested = calculateVestedAmount(schedule);
    return Math.max(0, vested - schedule.released);
  };

  const handleCreateSchedule = () => {
    if (!newSchedule.beneficiary || !newSchedule.amount) {
      alert('Please fill all required fields');
      return;
    }

    const schedule: VestingSchedule = {
      beneficiary: newSchedule.beneficiary,
      totalAmount: parseFloat(newSchedule.amount),
      startTime: Date.now(),
      duration: parseInt(newSchedule.duration),
      cliffDuration: parseInt(newSchedule.cliff),
      released: 0,
    };

    setSchedules([...schedules, schedule]);
    setNewSchedule({ beneficiary: '', amount: '', duration: '365', cliff: '90' });
  };

  const handleRelease = (index: number) => {
    const schedule = schedules[index];
    const releasable = calculateReleasableAmount(schedule);
    
    if (releasable <= 0) {
      alert('No tokens available to release');
      return;
    }

    setSchedules(schedules.map((s, i) => 
      i === index ? { ...s, released: s.released + releasable } : s
    ));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Token Vesting</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Time-locked token distribution for team members and investors
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Schedules</span>
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold">{schedules.length}</p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Locked</span>
            <Lock className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold">
            {schedules.reduce((sum, s) => sum + (s.totalAmount - s.released), 0).toLocaleString()}
          </p>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Released</span>
            <Unlock className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold">
            {schedules.reduce((sum, s) => sum + s.released, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Create New Schedule */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Create Vesting Schedule</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Beneficiary Address</label>
            <input
              type="text"
              value={newSchedule.beneficiary}
              onChange={(e) => setNewSchedule({ ...newSchedule, beneficiary: e.target.value })}
              placeholder="0x..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Total Amount</label>
            <input
              type="number"
              value={newSchedule.amount}
              onChange={(e) => setNewSchedule({ ...newSchedule, amount: e.target.value })}
              placeholder="0"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Vesting Duration (days)</label>
            <input
              type="number"
              value={newSchedule.duration}
              onChange={(e) => setNewSchedule({ ...newSchedule, duration: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Cliff Period (days)</label>
            <input
              type="number"
              value={newSchedule.cliff}
              onChange={(e) => setNewSchedule({ ...newSchedule, cliff: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <button onClick={handleCreateSchedule} className="w-full btn-primary mt-4">
          Create Schedule
        </button>
      </div>

      {/* Vesting Schedules */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Vesting Schedules</h2>
        
        {schedules.map((schedule, index) => {
          const vested = calculateVestedAmount(schedule);
          const releasable = calculateReleasableAmount(schedule);
          const vestedPercentage = (vested / schedule.totalAmount) * 100;
          const elapsedDays = Math.floor((Date.now() - schedule.startTime) / 86400000);
          const isCliffActive = elapsedDays < schedule.cliffDuration;

          return (
            <div key={index} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold mb-1">
                    Beneficiary: <span className="font-mono text-sm">{schedule.beneficiary}</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                      <span className="font-semibold ml-2">{schedule.totalAmount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                      <span className="font-semibold ml-2">{schedule.duration} days</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Cliff:</span>
                      <span className="font-semibold ml-2">{schedule.cliffDuration} days</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Elapsed:</span>
                      <span className="font-semibold ml-2">{elapsedDays} days</span>
                    </div>
                  </div>
                </div>
              </div>

              {isCliffActive && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-900 dark:text-yellow-200">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Cliff period active. {schedule.cliffDuration - elapsedDays} days remaining.
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Vesting Progress</span>
                  <span className="font-semibold">{vestedPercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(vestedPercentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Token Breakdown */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Vested</p>
                  <p className="font-bold text-blue-600">{Math.floor(vested).toLocaleString()}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Released</p>
                  <p className="font-bold text-green-600">{schedule.released.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Releasable</p>
                  <p className="font-bold text-purple-600">{Math.floor(releasable).toLocaleString()}</p>
                </div>
              </div>

              <button
                onClick={() => handleRelease(index)}
                disabled={releasable <= 0}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Release Tokens
              </button>
            </div>
          );
        })}
      </div>

      {/* Demo Notice */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mt-6">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Demo Mode:</strong> This demonstrates token vesting contracts used for team allocations and investor lockups. 
          Tokens vest linearly over time after an optional cliff period, ensuring long-term alignment.
        </p>
      </div>
    </div>
  );
}
