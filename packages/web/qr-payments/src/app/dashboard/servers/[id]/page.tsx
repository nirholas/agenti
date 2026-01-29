'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// Mock server data
const mockServer = {
  id: '1',
  name: 'DeFi Analytics',
  subdomain: 'defi-analytics',
  description: 'Real-time DeFi analytics and price tracking tools',
  status: 'active',
  createdAt: '2024-01-15',
  callsThisMonth: 12453,
  revenue: 124.53,
  tools: [
    { id: '1', name: 'get_token_price', description: 'Get real-time token prices', enabled: true, price: 0.01, calls: 5420 },
    { id: '2', name: 'get_pool_info', description: 'Get liquidity pool information', enabled: true, price: 0.01, calls: 3210 },
    { id: '3', name: 'get_swap_quote', description: 'Get best swap routes', enabled: true, price: 0.02, calls: 2100 },
    { id: '4', name: 'analyze_wallet', description: 'Analyze wallet holdings', enabled: false, price: 0.05, calls: 890 },
    { id: '5', name: 'get_gas_prices', description: 'Get current gas prices', enabled: true, price: 0.001, calls: 833 },
  ],
};

const tabs = [
  { id: 'overview', name: 'Overview' },
  { id: 'tools', name: 'Tools' },
  { id: 'prompts', name: 'Prompts' },
  { id: 'settings', name: 'Settings' },
  { id: 'analytics', name: 'Analytics' },
];

export default function ServerDetailPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [serverStatus, setServerStatus] = useState(mockServer.status);
  const [tools, setTools] = useState(mockServer.tools);

  const toggleTool = (toolId: string) => {
    setTools(prev => prev.map(tool => 
      tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool
    ));
  };

  const serverUrl = `https://${mockServer.subdomain}.agenti.cash`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-white/50">
        <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/servers" className="hover:text-white transition-colors">Servers</Link>
        <span>/</span>
        <span className="text-white">{mockServer.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{mockServer.name}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                serverStatus === 'active'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/10 text-white/50'
              }`}
            >
              {serverStatus === 'active' && (
                <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-400 rounded-full animate-pulse" />
              )}
              {serverStatus}
            </span>
          </div>
          <p className="mt-1 text-sm text-white/60">{mockServer.description}</p>
        </div>
        <button
          onClick={() => setServerStatus(s => s === 'active' ? 'paused' : 'active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            serverStatus === 'active'
              ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
              : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
          }`}
        >
          {serverStatus === 'active' ? 'Pause Server' : 'Start Server'}
        </button>
      </div>

      {/* Server URL */}
      <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
        <p className="text-xs text-white/50 mb-2">Server URL</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 px-3 py-2 bg-black/50 rounded-lg text-sm text-white font-mono">
            {serverUrl}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(serverUrl)}
            className="px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-sm text-white transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-white border-white'
                  : 'text-white/50 border-transparent hover:text-white/70'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-sm text-white/50">Calls This Month</p>
            <p className="mt-2 text-3xl font-semibold text-white">{mockServer.callsThisMonth.toLocaleString()}</p>
          </div>
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-sm text-white/50">Revenue This Month</p>
            <p className="mt-2 text-3xl font-semibold text-white">${mockServer.revenue.toFixed(2)}</p>
          </div>
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-sm text-white/50">Active Tools</p>
            <p className="mt-2 text-3xl font-semibold text-white">{tools.filter(t => t.enabled).length}</p>
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Tools</h2>
            <Link
              href={`/dashboard/servers/${params.id}/tools/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Tool
            </Link>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Tool</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Calls</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tools.map((tool) => (
                  <tr key={tool.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-white font-mono">{tool.name}</p>
                        <p className="text-xs text-white/50 mt-0.5">{tool.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60">${tool.price.toFixed(3)}</td>
                    <td className="px-6 py-4 text-sm text-white/60">{tool.calls.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleTool(tool.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          tool.enabled ? 'bg-emerald-500/30' : 'bg-white/10'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                            tool.enabled ? 'translate-x-6 bg-emerald-400' : 'translate-x-1 bg-white/50'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="p-8 bg-white/5 border border-white/10 rounded-xl text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-6 h-6 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-white">Prompts coming soon</h3>
          <p className="mt-2 text-sm text-white/50">Define custom prompts and resources for your MCP server</p>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
            <h3 className="text-lg font-medium text-white mb-4">Server Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Server Name</label>
                <input
                  type="text"
                  defaultValue={mockServer.name}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Description</label>
                <textarea
                  rows={3}
                  defaultValue={mockServer.description}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
            <h3 className="text-lg font-medium text-red-400 mb-2">Danger Zone</h3>
            <p className="text-sm text-white/60 mb-4">Once you delete a server, there is no going back.</p>
            <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm font-medium text-red-400 transition-colors">
              Delete Server
            </button>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="p-8 bg-white/5 border border-white/10 rounded-xl text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-6 h-6 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-white">Analytics coming soon</h3>
          <p className="mt-2 text-sm text-white/50">View detailed usage stats and revenue analytics</p>
        </div>
      )}
    </div>
  );
}
