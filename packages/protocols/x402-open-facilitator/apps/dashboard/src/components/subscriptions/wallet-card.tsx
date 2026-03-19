'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WalletCardProps {
  network: 'solana' | 'base';
  address: string | null;
  balance: string;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  isCreating?: boolean;
}

// Chain configuration
const CHAIN_CONFIG = {
  solana: {
    name: 'Solana',
    logo: '/chains/solana.svg', // We'll use text fallback if missing
    explorerUrl: 'https://solscan.io/account/',
    explorerName: 'Solscan',
    color: 'from-purple-500/10 to-purple-600/5',
  },
  base: {
    name: 'Base',
    logo: '/chains/base.svg',
    explorerUrl: 'https://basescan.org/address/',
    explorerName: 'Basescan',
    color: 'from-blue-500/10 to-blue-600/5',
  },
};

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletCard({
  network,
  address,
  balance,
  isLoading,
  isRefreshing,
  onRefresh,
  onCreate,
  isCreating,
}: WalletCardProps) {
  const { toast } = useToast();
  const config = CHAIN_CONFIG[network];
  const [justUpdated, setJustUpdated] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast({
      title: 'Address copied!',
      description: 'Wallet address copied to clipboard.',
    });
  };

  const handleRefresh = () => {
    onRefresh();
    // Brief highlight effect when balance updates
    setTimeout(() => setJustUpdated(true), 500);
    setTimeout(() => setJustUpdated(false), 2000);
  };

  const isZeroBalance = balance === '0.00' || balance === '0';
  const hasWallet = !!address;

  return (
    <Card className={cn('relative overflow-hidden', !hasWallet && 'border-dashed')}>
      {/* Subtle gradient background */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', config.color)} />

      <CardHeader className="relative pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          {/* Chain logo placeholder - using first letter as fallback */}
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
            network === 'solana' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
          )}>
            {config.name[0]}
          </div>
          {config.name} Wallet
        </CardTitle>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {!hasWallet ? (
          /* No wallet state */
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No {config.name} wallet yet
            </p>
            <Button
              onClick={onCreate}
              disabled={isCreating}
              size="sm"
            >
              {isCreating ? 'Creating...' : `Create ${config.name} Wallet`}
            </Button>
          </div>
        ) : (
          <>
            {/* Balance display */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Balance</p>
              <div className="flex items-center gap-2">
                {isLoading || isRefreshing ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <p className={cn(
                    'text-2xl font-bold transition-colors duration-500',
                    justUpdated && 'text-green-500',
                    isZeroBalance && 'text-muted-foreground'
                  )}>
                    {balance} <span className="text-base font-normal text-muted-foreground">USDC</span>
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                </Button>
              </div>
            </div>

            {/* Zero balance funding prompt */}
            {isZeroBalance && !isLoading && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Fund this wallet with USDC to enable subscription payments.
                </p>
              </div>
            )}

            {/* Address with copy and explorer link */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Address</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {truncateAddress(address)}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  title="Copy address"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <a
                  href={`${config.explorerUrl}${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                  title={`View on ${config.explorerName}`}
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
