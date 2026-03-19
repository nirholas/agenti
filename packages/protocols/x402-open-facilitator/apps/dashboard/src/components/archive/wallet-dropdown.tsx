/**
 * ARCHIVED: 2026-01-22
 * Reason: Legacy embedded wallet UI removed from header in Phase 17
 * Note: Preserved for reference - wallet functionality moves to Subscriptions page
 * See: Phase 18 will implement multi-chain wallets in Subscriptions section
 */

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Copy, Check, ExternalLink, LogOut, LayoutDashboard, ChevronDown, Trophy } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletDropdown() {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { user, signOut, hasClaimable } = useAuth();

  const { data: wallet, isLoading, error } = useQuery({
    queryKey: ['billingWallet'],
    queryFn: async () => {
      try {
        return await api.getBillingWallet();
      } catch (e) {
        if (e instanceof Error && e.message.includes('not found')) {
          return null;
        }
        throw e;
      }
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createBillingWallet(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billingWallet'] });
    },
  });

  // Auto-create wallet if user doesn't have one
  const shouldCreateWallet = !isLoading && !wallet && !createMutation.isPending && !error;
  if (shouldCreateWallet) {
    createMutation.mutate();
  }

  const copyAddress = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = wallet?.address
    ? `https://solscan.io/account/${wallet.address}`
    : null;

  const displayBalance = wallet?.balance || '0.00';
  const isOnDashboard = pathname === '/dashboard';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="group inline-flex items-center gap-1 text-sm font-mono text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none transition-colors"
        >
          <span className="text-primary">$</span>
          <span>{displayBalance}</span>
          <ChevronDown className="w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* User Email */}
        <div className="px-4 py-3">
          <p className="text-sm font-medium">{user?.email}</p>
        </div>

        {/* Dashboard Link (only show if not on dashboard) */}
        {!isOnDashboard && (
          <>
            <div className="border-t border-border" />
            <div className="p-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted/50 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                Dashboard
              </Link>
            </div>
          </>
        )}

        {/* Rewards Link */}
        <div className="border-t border-border" />
        <div className="p-2">
          <Link
            href="/rewards"
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted/50 transition-colors relative"
          >
            <Trophy className="w-4 h-4 shrink-0" />
            Rewards
            {hasClaimable && (
              <span className="absolute right-3 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </Link>
        </div>

        {/* Billing Wallet Section */}
        <div className="border-t border-border" />
        <div className="px-4 py-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Billing Wallet
          </div>
          <div className="text-2xl font-bold mt-2">
            ${displayBalance} <span className="text-sm font-normal text-muted-foreground">USDC</span>
          </div>
        </div>

        {/* Wallet Address Row */}
        <div className="px-2 pb-2">
          {isLoading || createMutation.isPending ? (
            <div className="h-11 bg-muted/50 rounded-md animate-pulse mx-2" />
          ) : wallet?.address ? (
            <div className="flex items-center gap-2 w-full px-3 py-2.5 bg-muted/50 rounded-md">
              <code className="text-xs font-mono flex-1 truncate">
                {truncateAddress(wallet.address)}
              </code>
              <button
                onClick={copyAddress}
                className="p-1.5 rounded hover:bg-background/50 transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded hover:bg-background/50 transition-colors"
                  title="View on Solscan"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              )}
            </div>
          ) : error ? (
            <div className="text-sm text-destructive px-3">Failed to load wallet</div>
          ) : null}
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            Send USDC on Solana to fund your subscription
          </p>
        </div>

        {/* Sign Out */}
        <div className="border-t border-border" />
        <div className="p-2">
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted/50 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
