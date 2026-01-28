'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const TIER_LIMITS = {
  free: { servers: 1, tools: 5, callsPerMonth: 1000 },
  pro: { servers: 10, tools: 50, callsPerMonth: 100000 },
  enterprise: { servers: 'Unlimited', tools: 'Unlimited', callsPerMonth: 'Unlimited' },
};

export default function CreateServerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subdomain: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Current user tier - would come from auth/API
  const currentTier = 'pro';
  const limits = TIER_LIMITS[currentTier as keyof typeof TIER_LIMITS];

  const validateSubdomain = useCallback((value: string): string | null => {
    if (!value) return 'Subdomain is required';
    if (value.length < 3) return 'Subdomain must be at least 3 characters';
    if (value.length > 32) return 'Subdomain must be 32 characters or less';
    if (!/^[a-z0-9-]+$/.test(value)) return 'Only lowercase letters, numbers, and hyphens allowed';
    if (value.startsWith('-') || value.endsWith('-')) return 'Cannot start or end with a hyphen';
    return null;
  }, []);

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData(prev => ({ ...prev, subdomain: value }));
    
    const error = validateSubdomain(value);
    setErrors(prev => ({ ...prev, subdomain: error || '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const subdomainError = validateSubdomain(formData.subdomain);
    if (subdomainError) {
      setErrors(prev => ({ ...prev, subdomain: subdomainError }));
      return;
    }
    if (!formData.name.trim()) {
      setErrors(prev => ({ ...prev, name: 'Name is required' }));
      return;
    }

    setIsSubmitting(true);

    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/dashboard/servers/new-server-id');
    } catch (error) {
      console.error('Failed to create server:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-white/50 mb-6">
        <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/servers" className="hover:text-white transition-colors">Servers</Link>
        <span>/</span>
        <span className="text-white">New</span>
      </nav>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Create New Server</h1>
          <p className="mt-1 text-sm text-white/60">
            Set up a new MCP server to host your tools
          </p>
        </div>

        {/* Tier info */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white capitalize">{currentTier} Plan</p>
              <p className="text-xs text-white/50 mt-1">
                {typeof limits.servers === 'number' ? `${limits.servers} servers` : limits.servers} • 
                {typeof limits.tools === 'number' ? ` ${limits.tools} tools per server` : ` ${limits.tools} tools`} • 
                {typeof limits.callsPerMonth === 'number' ? ` ${limits.callsPerMonth.toLocaleString()} calls/mo` : ` ${limits.callsPerMonth} calls`}
              </p>
            </div>
            <Link
              href="/dashboard/billing"
              className="text-xs text-white/60 hover:text-white transition-colors"
            >
              Upgrade →
            </Link>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
              Server Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
              placeholder="My MCP Server"
              className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors ${
                errors.name ? 'border-red-500/50' : 'border-white/10'
              }`}
            />
            {errors.name && (
              <p className="mt-2 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
              Description
              <span className="text-white/40 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what your server does..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors resize-none"
            />
          </div>

          {/* Subdomain */}
          <div>
            <label htmlFor="subdomain" className="block text-sm font-medium text-white mb-2">
              Subdomain
            </label>
            <div className="flex">
              <input
                type="text"
                id="subdomain"
                value={formData.subdomain}
                onChange={handleSubdomainChange}
                placeholder="my-server"
                maxLength={32}
                className={`flex-1 px-4 py-3 bg-white/5 border rounded-l-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors ${
                  errors.subdomain ? 'border-red-500/50' : 'border-white/10'
                }`}
              />
              <div className="px-4 py-3 bg-white/[0.03] border border-l-0 border-white/10 rounded-r-lg text-white/50">
                .agenti.xyz
              </div>
            </div>
            {errors.subdomain ? (
              <p className="mt-2 text-sm text-red-400">{errors.subdomain}</p>
            ) : (
              <p className="mt-2 text-xs text-white/40">
                3-32 characters. Lowercase letters, numbers, and hyphens only.
              </p>
            )}
            {formData.subdomain && !errors.subdomain && (
              <p className="mt-2 text-sm text-white/60">
                Your server will be available at{' '}
                <span className="text-white font-mono">{formData.subdomain}.agenti.xyz</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Server'
              )}
            </button>
            <Link
              href="/dashboard"
              className="px-6 py-3 text-sm text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
