'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Settings types
interface MerchantSettings {
  businessName: string;
  email: string;
  webhookUrl: string;
  defaultCurrency: string;
  settlementAddress: string;
  autoConvert: boolean;
  notifyEmail: boolean;
  notifyWebhook: boolean;
  apiKey: string;
  testMode: boolean;
}

// Default settings
const DEFAULT_SETTINGS: MerchantSettings = {
  businessName: 'My Business',
  email: 'merchant@example.com',
  webhookUrl: 'https://example.com/webhooks/agenti',
  defaultCurrency: 'USDC',
  settlementAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f3B0F8',
  autoConvert: true,
  notifyEmail: true,
  notifyWebhook: true,
  apiKey: 'ak_live_xxxxxxxxxxxxxxxxxxxx',
  testMode: false,
};

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<MerchantSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'notifications' | 'api'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsSaving(false);
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(settings.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateApiKey = () => {
    const newKey = 'ak_live_' + Math.random().toString(36).substring(2, 22);
    setSettings({ ...settings, apiKey: newKey });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-xl font-semibold tracking-tight">Agenti</span>
            </Link>
            <span className="text-zinc-600 mx-2">/</span>
            <span className="text-zinc-400">Settings</span>
          </div>
          
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/merchant" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/merchant/invoices" className="text-zinc-400 hover:text-white transition-colors">Invoices</Link>
            <Link href="/merchant/analytics" className="text-zinc-400 hover:text-white transition-colors">Analytics</Link>
            <Link href="/merchant/settings" className="text-white font-medium">Settings</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Settings</h1>
          <p className="text-zinc-500">Manage your merchant account configuration</p>
        </div>

        {/* Settings Tabs */}
        <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg mb-8 w-fit">
          {[
            { id: 'general', label: 'General', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
            { id: 'payments', label: 'Payments', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
            { id: 'api', label: 'API Keys', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="space-y-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="card space-y-6">
              <h3 className="text-lg font-semibold">General Settings</h3>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Business Name</label>
                <input
                  type="text"
                  className="input"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Email Address</label>
                <input
                  type="email"
                  className="input"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                />
                <p className="text-xs text-zinc-500 mt-1">Used for account notifications and receipts</p>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-zinc-800">
                <div>
                  <p className="font-medium">Test Mode</p>
                  <p className="text-sm text-zinc-500">Use test network for transactions</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, testMode: !settings.testMode })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.testMode ? 'bg-amber-500' : 'bg-zinc-700'
                  }`}
                >
                  <span 
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.testMode ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Payments Settings */}
          {activeTab === 'payments' && (
            <div className="card space-y-6">
              <h3 className="text-lg font-semibold">Payment Settings</h3>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Settlement Address</label>
                <input
                  type="text"
                  className="input font-mono"
                  value={settings.settlementAddress}
                  onChange={(e) => setSettings({ ...settings, settlementAddress: e.target.value })}
                  placeholder="0x..."
                />
                <p className="text-xs text-zinc-500 mt-1">Wallet address to receive payments</p>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Default Currency</label>
                <select
                  className="input"
                  value={settings.defaultCurrency}
                  onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                >
                  <option value="USDC">USDC - USD Coin</option>
                  <option value="USDT">USDT - Tether</option>
                  <option value="DAI">DAI - Dai Stablecoin</option>
                  <option value="ETH">ETH - Ethereum</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-zinc-800">
                <div>
                  <p className="font-medium">Auto-Convert to Stablecoin</p>
                  <p className="text-sm text-zinc-500">Automatically swap incoming tokens to your default currency</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, autoConvert: !settings.autoConvert })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.autoConvert ? 'bg-blue-500' : 'bg-zinc-700'
                  }`}
                >
                  <span 
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.autoConvert ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Zero Platform Fees</span>
                </div>
                <p className="text-sm text-zinc-400">You only pay network gas fees. We don&apos;t charge any additional fees.</p>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="card space-y-6">
              <h3 className="text-lg font-semibold">Notification Settings</h3>
              
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-zinc-500">Receive payment confirmations via email</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, notifyEmail: !settings.notifyEmail })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.notifyEmail ? 'bg-blue-500' : 'bg-zinc-700'
                  }`}
                >
                  <span 
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.notifyEmail ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-zinc-800">
                <div>
                  <p className="font-medium">Webhook Notifications</p>
                  <p className="text-sm text-zinc-500">Send payment events to your server</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, notifyWebhook: !settings.notifyWebhook })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.notifyWebhook ? 'bg-blue-500' : 'bg-zinc-700'
                  }`}
                >
                  <span 
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.notifyWebhook ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {settings.notifyWebhook && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Webhook URL</label>
                  <input
                    type="url"
                    className="input"
                    value={settings.webhookUrl}
                    onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                    placeholder="https://your-server.com/webhooks/agenti"
                  />
                  <p className="text-xs text-zinc-500 mt-1">We&apos;ll POST payment events to this URL</p>
                </div>
              )}

              <div className="p-4 bg-zinc-800/50 rounded-xl">
                <p className="text-sm text-zinc-400 mb-2">Webhook Events</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-success">payment.confirmed</span>
                    <span className="text-zinc-500">When a payment is confirmed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-info">payment.pending</span>
                    <span className="text-zinc-500">When a payment is initiated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-error">payment.failed</span>
                    <span className="text-zinc-500">When a payment fails</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API Keys Settings */}
          {activeTab === 'api' && (
            <div className="card space-y-6">
              <h3 className="text-lg font-semibold">API Keys</h3>
              
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-medium">Keep your API key secure</span>
                </div>
                <p className="text-sm text-zinc-400">Never share your API key or commit it to public repositories.</p>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Live API Key</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      className="input font-mono pr-10"
                      value={settings.apiKey}
                      readOnly
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      {showApiKey ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <button onClick={copyApiKey} className="btn btn-secondary">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <div>
                  <p className="font-medium">Regenerate API Key</p>
                  <p className="text-sm text-zinc-500">This will invalidate your current key</p>
                </div>
                <button onClick={regenerateApiKey} className="btn btn-danger">
                  Regenerate
                </button>
              </div>

              <div className="p-4 bg-zinc-800/50 rounded-xl">
                <p className="font-medium mb-3">Quick Start</p>
                <div className="bg-black rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-zinc-500">// Initialize the Agenti SDK</div>
                  <div className="mt-1">
                    <span className="text-blue-400">const</span>{' '}
                    <span className="text-zinc-300">agenti</span>{' '}
                    <span className="text-zinc-500">=</span>{' '}
                    <span className="text-blue-400">new</span>{' '}
                    <span className="text-zinc-300">Agenti</span>
                    <span className="text-zinc-500">(&#123;</span>
                  </div>
                  <div className="pl-4 text-zinc-300">
                    apiKey: <span className="text-emerald-400">&apos;{settings.apiKey.slice(0, 12)}...&apos;</span>
                  </div>
                  <div className="text-zinc-500">&#125;);</div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
