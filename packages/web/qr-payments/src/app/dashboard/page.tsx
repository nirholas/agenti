'use client';

import { useState } from 'react';
import Link from 'next/link';

// Mock data - in production this would come from API
const mockServers = [
  {
    id: '1',
    name: 'DeFi Analytics',
    subdomain: 'defi-analytics',
    status: 'active',
    callsThisMonth: 12453,
    revenue: 124.53,
    tools: 8,
  },
  {
    id: '2',
    name: 'NFT Tools',
    subdomain: 'nft-tools',
    status: 'active',
    callsThisMonth: 8721,
    revenue: 87.21,
    tools: 5,
  },
  {
    id: '3',
    name: 'Token Scanner',
    subdomain: 'token-scanner',
    status: 'paused',
    callsThisMonth: 0,
    revenue: 0,
    tools: 3,
  },
];

const stats = [
  { name: 'Total Revenue', value: '$211.74', change: '+12.3%' },
  { name: 'Total Calls', value: '21,174', change: '+8.2%' },
  { name: 'Active Servers', value: '2', change: '0' },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-white/60">Manage your MCP servers and track performance</p>
        </div>
        <Link
          href="/dashboard/servers/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-sm font-medium text-white transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create New Server
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="p-6 bg-white/5 border border-white/10 rounded-xl"
          >
            <p className="text-sm text-white/60">{stat.name}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
            <p className={`mt-1 text-sm ${stat.change.startsWith('+') ? 'text-emerald-400' : 'text-white/40'}`}>
              {stat.change} from last month
            </p>
          </div>
        ))}
      </div>

      {/* Servers list */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Your Servers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockServers.map((server) => (
            <Link
              key={server.id}
              href={`/dashboard/servers/${server.id}`}
              className="group p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/[0.07] hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-white group-hover:text-white/90">{server.name}</h3>
                  <p className="mt-1 text-sm text-white/50">{server.subdomain}.agenti.cash</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    server.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {server.status === 'active' && (
                    <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-400 rounded-full" />
                  )}
                  {server.status}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-xs text-white/40">Calls</p>
                  <p className="mt-1 text-sm font-medium text-white">{server.callsThisMonth.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Revenue</p>
                  <p className="mt-1 text-sm font-medium text-white">${server.revenue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Tools</p>
                  <p className="mt-1 text-sm font-medium text-white">{server.tools}</p>
                </div>
              </div>
            </Link>
          ))}

          {/* Empty state / Add new */}
          <Link
            href="/dashboard/servers/new"
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.02] transition-colors min-h-[180px]"
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-white/60">Create new server</p>
          </Link>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Recent Activity</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Server</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { event: 'Tool call', server: 'defi-analytics', time: '2 min ago', amount: '$0.01' },
                { event: 'Tool call', server: 'defi-analytics', time: '5 min ago', amount: '$0.01' },
                { event: 'Tool call', server: 'nft-tools', time: '12 min ago', amount: '$0.01' },
                { event: 'Server started', server: 'token-scanner', time: '1 hour ago', amount: '-' },
                { event: 'Tool call', server: 'nft-tools', time: '2 hours ago', amount: '$0.01' },
              ].map((activity, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4 text-sm text-white">{activity.event}</td>
                  <td className="px-6 py-4 text-sm text-white/60">{activity.server}</td>
                  <td className="px-6 py-4 text-sm text-white/40">{activity.time}</td>
                  <td className="px-6 py-4 text-sm text-white/60 text-right">{activity.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
