/**
 * Batch Convert Client Component
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Archive,
  Download,
  Settings,
  Info,
  Zap,
} from 'lucide-react';
import { BatchConvert } from '@/components/batch';
import type { ConversionResult } from '@/types';

export default function BatchConvertClient() {
  const [completedResults, setCompletedResults] = useState<Array<{
    url: string;
    result?: ConversionResult;
    error?: string;
  }>>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(3);

  const handleBatchComplete = useCallback((results: typeof completedResults) => {
    setCompletedResults(results);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-500/5 via-black to-blue-500/5 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <Link 
            href="/"
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to home
          </Link>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-4">
            <Zap className="w-4 h-4" />
            Parallel Processing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Batch Convert
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            Convert multiple GitHub repositories to MCP servers simultaneously.
            Perfect for setting up tool suites or migrating multiple projects.
          </p>
        </motion.div>

        {/* Settings panel */}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
          >
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Conversion Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">
                  Max Concurrent Conversions
                </label>
                <select
                  value={maxConcurrent}
                  onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                  className="w-full p-2 bg-black border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-white/50"
                >
                  <option value={1}>1 (Sequential)</option>
                  <option value={2}>2</option>
                  <option value={3}>3 (Recommended)</option>
                  <option value={5}>5</option>
                  <option value={10}>10 (High Load)</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-blue-200">
                    Higher concurrency is faster but may hit rate limits
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main batch convert component */}
        <BatchConvert
          onBatchComplete={handleBatchComplete}
          maxConcurrent={maxConcurrent}
        />

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            {
              icon: Archive,
              title: 'Bulk Import',
              description: 'Import URLs from file, paste multiple, or drag and drop',
            },
            {
              icon: Zap,
              title: 'Parallel Processing',
              description: 'Convert multiple repos simultaneously for speed',
            },
            {
              icon: Download,
              title: 'Combined Export',
              description: 'Download all results as a single JSON file',
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/30"
            >
              <feature.icon className="w-8 h-8 text-white/80 mb-3" />
              <h3 className="font-medium text-white mb-1">{feature.title}</h3>
              <p className="text-sm text-neutral-500">{feature.description}</p>
            </div>
          ))}
        </motion.div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 rounded-xl border border-neutral-800 bg-neutral-900/30"
        >
          <h3 className="text-sm font-medium text-white mb-2">Pro Tips</h3>
          <ul className="text-sm text-neutral-500 space-y-1">
            <li>• Drag to reorder URLs - they'll be processed in order</li>
            <li>• Use Import URLs to paste a list from a text file</li>
            <li>• Failed conversions can be retried without re-adding URLs</li>
            <li>• Results are preserved even if you navigate away</li>
          </ul>
        </motion.div>
      </div>
    </main>
  );
}
