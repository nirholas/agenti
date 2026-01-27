/**
 * Dashboard Page - Manage deployed MCP servers
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  Server,
  Activity,
  BarChart3,
  Clock,
  Zap,
  Settings,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  ChevronRight,
  TrendingUp,
  Globe,
  Shield,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/utils';
import type { DeployedServer } from '@/types/deploy';
import Link from 'next/link';

export default function DashboardPage() {
  const [servers, setServers] = useState<DeployedServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<DeployedServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Load servers from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('deployed-servers');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setServers(parsed);
        if (parsed.length > 0) {
          setSelectedServer(parsed[0]);
        }
      } catch (e) {
        console.error('Failed to parse stored servers:', e);
      }
    }
    setLoading(false);
  }, []);

  const handleCopy = useCallback(async (text: string, id: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  const handleDelete = useCallback((serverId: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return;
    
    const updated = servers.filter(s => s.id !== serverId);
    setServers(updated);
    localStorage.setItem('deployed-servers', JSON.stringify(updated));
    
    if (selectedServer?.id === serverId) {
      setSelectedServer(updated[0] || null);
    }
  }, [servers, selectedServer]);

  const handleToggleStatus = useCallback((serverId: string) => {
    const updated = servers.map(s => {
      if (s.id === serverId) {
        return { ...s, status: s.status === 'active' ? 'paused' as const : 'active' as const };
      }
      return s;
    });
    setServers(updated);
    localStorage.setItem('deployed-servers', JSON.stringify(updated));
    
    if (selectedServer?.id === serverId) {
      setSelectedServer(updated.find(s => s.id === serverId) || null);
    }
  }, [servers, selectedServer]);

  // Calculate overall stats
  const stats = useMemo(() => {
    return {
      totalServers: servers.length,
      activeServers: servers.filter(s => s.status === 'active').length,
      totalTools: servers.reduce((sum, s) => sum + s.tools.length, 0),
      totalCalls: servers.reduce((sum, s) => sum + s.usage.totalCalls, 0),
    };
  }, [servers]);

  if (loading) {
    return (
      <main className="relative min-h-screen">
        <ParticleBackground />
        <Header />
        <div className="container mx-auto px-4 pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
            <div className="text-neutral-400">Loading dashboard...</div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <ParticleBackground />
      <Header />

      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-neutral-400">Manage your deployed MCP servers</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Deployed Servers', value: stats.totalServers, icon: Server, color: 'blue' },
            { label: 'Active', value: stats.activeServers, icon: Zap, color: 'green' },
            { label: 'Total Tools', value: stats.totalTools, icon: Settings, color: 'purple' },
            { label: 'API Calls', value: stats.totalCalls.toLocaleString(), icon: Activity, color: 'orange' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-xs text-neutral-500">{label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{value}</div>
            </div>
          ))}
        </motion.div>

        {servers.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-neutral-800 flex items-center justify-center mb-6">
              <Cloud className="w-10 h-10 text-neutral-600" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No deployed servers yet</h2>
            <p className="text-neutral-400 mb-6 max-w-md mx-auto">
              Convert a GitHub repository and deploy it to the cloud to see it here.
            </p>
            <Link href="/convert">
              <Button className="bg-white text-black hover:bg-neutral-200">
                Convert a Repository
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </motion.div>
        ) : (
          /* Server List & Details */
          <div className="grid md:grid-cols-3 gap-6">
            {/* Server List */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="md:col-span-1 space-y-3"
            >
              <h2 className="text-sm font-medium text-neutral-400 mb-4">Your Servers</h2>
              {servers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => setSelectedServer(server)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    selectedServer?.id === server.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-white truncate pr-2">{server.name}</div>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        server.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-neutral-500/20 text-neutral-400'
                      }`}
                    >
                      {server.status}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 flex items-center gap-3">
                    <span>{server.tools.length} tools</span>
                    <span>•</span>
                    <span>{server.usage.totalCalls} calls</span>
                  </div>
                </button>
              ))}
            </motion.div>

            {/* Server Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="md:col-span-2"
            >
              {selectedServer && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 backdrop-blur-sm overflow-hidden">
                  {/* Server Header */}
                  <div className="p-6 border-b border-neutral-800">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white mb-1">{selectedServer.name}</h2>
                        <p className="text-sm text-neutral-400">{selectedServer.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(selectedServer.id)}
                          className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                          title={selectedServer.status === 'active' ? 'Pause server' : 'Resume server'}
                        >
                          {selectedServer.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(selectedServer.id)}
                          className="p-2 text-neutral-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Delete server"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Endpoint */}
                  <div className="p-6 border-b border-neutral-800">
                    <div className="text-xs text-neutral-500 mb-2">Endpoint URL</div>
                    <div className="flex items-center gap-2 p-3 bg-black/30 rounded-lg">
                      <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <code className="flex-1 text-sm text-green-400 font-mono truncate">
                        {selectedServer.endpoint}
                      </code>
                      <button
                        onClick={() => handleCopy(selectedServer.endpoint, `endpoint-${selectedServer.id}`)}
                        className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-white/5"
                      >
                        {copied === `endpoint-${selectedServer.id}` ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Usage Stats */}
                  <div className="p-6 border-b border-neutral-800">
                    <h3 className="text-sm font-medium text-neutral-400 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Usage Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Total Calls', value: selectedServer.usage.totalCalls, trend: '+12%' },
                        { label: 'Today', value: selectedServer.usage.totalCallsToday },
                        { label: 'Success Rate', value: `${selectedServer.usage.successRate}%`, good: true },
                        { label: 'Avg Latency', value: `${selectedServer.usage.avgLatencyMs}ms` },
                      ].map(({ label, value, trend, good }) => (
                        <div key={label} className="p-3 bg-black/30 rounded-lg">
                          <div className="text-xs text-neutral-500 mb-1">{label}</div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-bold text-white">{value}</div>
                            {trend && (
                              <span className="text-xs text-green-400 flex items-center">
                                <TrendingUp className="w-3 h-3 mr-0.5" />
                                {trend}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tools */}
                  <div className="p-6">
                    <h3 className="text-sm font-medium text-neutral-400 mb-4 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Deployed Tools ({selectedServer.tools.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedServer.tools.map((tool) => (
                        <div
                          key={tool.name}
                          className="flex items-center justify-between p-3 bg-black/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${tool.enabled ? 'bg-green-400' : 'bg-neutral-500'}`} />
                            <div>
                              <div className="text-sm font-medium text-white">{tool.name}</div>
                              <div className="text-xs text-neutral-500 truncate max-w-[300px]">
                                {tool.description}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-neutral-400">
                            {tool.callCount} calls
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="px-6 pb-6">
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {new Date(selectedServer.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {selectedServer.region}
                      </span>
                      {selectedServer.sourceRepo && (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {selectedServer.sourceRepo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
