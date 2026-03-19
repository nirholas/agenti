'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  WalletTypeCard,
  SUPPORTED_NETWORKS,
  getEvmNetworks,
  getSolanaNetworks,
  getStacksNetworks,
  type WalletInfo,
} from './network-card';
import { api } from '@/lib/api';

interface NetworksSectionProps {
  facilitatorId: string;
}

export function NetworksSection({ facilitatorId }: NetworksSectionProps) {
  const queryClient = useQueryClient();
  const [showTestnets, setShowTestnets] = useState(false);

  // EVM Wallet queries
  const { data: evmWallet } = useQuery({
    queryKey: ['wallet', facilitatorId],
    queryFn: () => api.getWallet(facilitatorId),
    enabled: !!facilitatorId,
  });

  // Solana Wallet queries
  const { data: solanaWallet } = useQuery({
    queryKey: ['solanaWallet', facilitatorId],
    queryFn: () => api.getSolanaWallet(facilitatorId),
    enabled: !!facilitatorId,
  });

  // Stacks Wallet queries
  const { data: stacksWallet } = useQuery({
    queryKey: ['stacksWallet', facilitatorId],
    queryFn: () => api.getStacksWallet(facilitatorId),
    enabled: !!facilitatorId,
  });

  // EVM Wallet mutations
  const generateEvmWallet = useMutation({
    mutationFn: () => api.generateWallet(facilitatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', facilitatorId] });
    },
  });

  const importEvmWallet = useMutation({
    mutationFn: (privateKey: string) => api.importWallet(facilitatorId, privateKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', facilitatorId] });
    },
  });

  const deleteEvmWallet = useMutation({
    mutationFn: () => api.deleteWallet(facilitatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', facilitatorId] });
    },
  });

  // Solana Wallet mutations
  const generateSolanaWallet = useMutation({
    mutationFn: () => api.generateSolanaWallet(facilitatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solanaWallet', facilitatorId] });
    },
  });

  const importSolanaWallet = useMutation({
    mutationFn: (privateKey: string) => api.importSolanaWallet(facilitatorId, privateKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solanaWallet', facilitatorId] });
    },
  });

  const deleteSolanaWallet = useMutation({
    mutationFn: () => api.deleteSolanaWallet(facilitatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solanaWallet', facilitatorId] });
    },
  });

  // Stacks Wallet mutations
  const generateStacksWallet = useMutation({
    mutationFn: () => api.generateStacksWallet(facilitatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacksWallet', facilitatorId] });
    },
  });

  const importStacksWallet = useMutation({
    mutationFn: (privateKey: string) => api.importStacksWallet(facilitatorId, privateKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacksWallet', facilitatorId] });
    },
  });

  const deleteStacksWallet = useMutation({
    mutationFn: () => api.deleteStacksWallet(facilitatorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacksWallet', facilitatorId] });
    },
  });

  // Map wallet data
  const getEvmWalletInfo = (): WalletInfo | null => {
    if (!evmWallet?.hasWallet) return null;
    const baseBalance = evmWallet.balances?.['8453'];
    return {
      address: evmWallet.address || null,
      balance: baseBalance?.balance,
      balanceFormatted: baseBalance?.formatted,
    };
  };

  const getSolanaWalletInfo = (): WalletInfo | null => {
    if (!solanaWallet?.hasWallet) return null;
    return {
      address: solanaWallet.address || null,
      balance: solanaWallet.balance?.lamports,
      balanceFormatted: solanaWallet.balance?.sol,
    };
  };

  const getStacksWalletInfo = (): WalletInfo | null => {
    if (!stacksWallet?.hasWallet) return null;
    return {
      address: stacksWallet.address || null,
      balance: stacksWallet.balance?.microStx,
      balanceFormatted: stacksWallet.balance?.stx,
    };
  };

  const evmNetworks = getEvmNetworks();
  const solanaNetworks = getSolanaNetworks();
  const stacksNetworks = getStacksNetworks();

  return (
    <div className="space-y-4">
      {/* Header with testnet toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Networks
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure wallets to enable payment processing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="show-testnets" className="text-sm text-muted-foreground">
            Show Testnets
          </Label>
          <Switch
            id="show-testnets"
            checked={showTestnets}
            onCheckedChange={setShowTestnets}
          />
        </div>
      </div>

      {/* Wallet Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WalletTypeCard
          type="evm"
          title="EVM Wallet"
          subtitle="One wallet for all EVM chains"
          wallet={getEvmWalletInfo()}
          networks={evmNetworks}
          showTestnets={showTestnets}
          isGenerating={generateEvmWallet.isPending}
          isImporting={importEvmWallet.isPending}
          isDeleting={deleteEvmWallet.isPending}
          onGenerate={() => generateEvmWallet.mutate()}
          onImport={(pk) => importEvmWallet.mutate(pk)}
          onDelete={() => deleteEvmWallet.mutate()}
        />

        <WalletTypeCard
          type="solana"
          title="Solana Wallet"
          subtitle="Required for Solana payments"
          wallet={getSolanaWalletInfo()}
          networks={solanaNetworks}
          showTestnets={showTestnets}
          isGenerating={generateSolanaWallet.isPending}
          isImporting={importSolanaWallet.isPending}
          isDeleting={deleteSolanaWallet.isPending}
          onGenerate={() => generateSolanaWallet.mutate()}
          onImport={(pk) => importSolanaWallet.mutate(pk)}
          onDelete={() => deleteSolanaWallet.mutate()}
        />

        <WalletTypeCard
          type="stacks"
          title="Stacks Wallet"
          subtitle="Required for STX, sBTC, and USDCx payments"
          wallet={getStacksWalletInfo()}
          networks={stacksNetworks}
          showTestnets={showTestnets}
          isGenerating={generateStacksWallet.isPending}
          isImporting={importStacksWallet.isPending}
          isDeleting={deleteStacksWallet.isPending}
          onGenerate={() => generateStacksWallet.mutate()}
          onImport={(pk) => importStacksWallet.mutate(pk)}
          onDelete={() => deleteStacksWallet.mutate()}
        />
      </div>
    </div>
  );
}

// Export helper for stats
export function useNetworkStats(facilitatorId: string) {
  const { data: evmWallet } = useQuery({
    queryKey: ['wallet', facilitatorId],
    queryFn: () => api.getWallet(facilitatorId),
    enabled: !!facilitatorId,
  });

  const { data: solanaWallet } = useQuery({
    queryKey: ['solanaWallet', facilitatorId],
    queryFn: () => api.getSolanaWallet(facilitatorId),
    enabled: !!facilitatorId,
  });

  const { data: stacksWallet } = useQuery({
    queryKey: ['stacksWallet', facilitatorId],
    queryFn: () => api.getStacksWallet(facilitatorId),
    enabled: !!facilitatorId,
  });

  const evmConfigured = evmWallet?.hasWallet ?? false;
  const solanaConfigured = solanaWallet?.hasWallet ?? false;
  const stacksConfigured = stacksWallet?.hasWallet ?? false;

  // Count mainnet networks enabled
  const evmMainnets = getEvmNetworks().filter(n => !n.testnet).length;
  const solanaMainnets = getSolanaNetworks().filter(n => !n.testnet).length;
  const stacksMainnets = getStacksNetworks().filter(n => !n.testnet).length;

  const networksEnabled = (evmConfigured ? evmMainnets : 0) + (solanaConfigured ? solanaMainnets : 0) + (stacksConfigured ? stacksMainnets : 0);
  const totalMainnets = evmMainnets + solanaMainnets + stacksMainnets;

  return {
    walletsConfigured: (evmConfigured ? 1 : 0) + (solanaConfigured ? 1 : 0) + (stacksConfigured ? 1 : 0),
    totalWallets: 3,
    networksEnabled,
    totalMainnets,
  };
}
