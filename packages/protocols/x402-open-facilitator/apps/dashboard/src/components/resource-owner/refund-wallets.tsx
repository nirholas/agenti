'use client';

import { useState } from 'react';
import {
  Wallet,
  Plus,
  Copy,
  Check,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatAddress } from '@/lib/utils';
import type { RefundWallet } from './types';

interface RefundWalletsProps {
  wallets: RefundWallet[];
  supportedNetworks: string[];
  onGenerateWallet: (network: string) => Promise<void>;
  onDeleteWallet: (network: string) => Promise<void>;
  isLoading?: boolean;
}

export function RefundWallets({
  wallets,
  supportedNetworks,
  onGenerateWallet,
  onDeleteWallet,
}: RefundWalletsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingNetwork, setGeneratingNetwork] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = async (network: string) => {
    setGeneratingNetwork(network);
    try {
      await onGenerateWallet(network);
    } finally {
      setGeneratingNetwork(null);
    }
  };

  const existingWalletNetworks = new Set(wallets.map(w => w.network));
  const availableNetworks = supportedNetworks.filter(n => !existingWalletNetworks.has(n));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Refund Wallets
        </CardTitle>
        <CardDescription>
          Fund these wallets with USDC to pay out refunds to your users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {wallets.map((wallet) => (
            <div key={wallet.network} className="p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="capitalize">{wallet.network}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onDeleteWallet(wallet.network)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Wallet
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Address</Label>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono truncate flex-1">
                      {formatAddress(wallet.address)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(wallet.address, `wallet-${wallet.network}`)}
                    >
                      {copiedId === `wallet-${wallet.network}` ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Balance</Label>
                  <p className="text-lg font-semibold">${wallet.balance} USDC</p>
                </div>
              </div>
            </div>
          ))}

          {availableNetworks.map((network) => (
            <button
              key={network}
              onClick={() => handleGenerate(network)}
              disabled={generatingNetwork === network}
              className="p-4 rounded-lg border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-accent transition-colors flex flex-col items-center justify-center gap-2 min-h-[120px] disabled:opacity-50"
            >
              <Plus className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground capitalize">
                {generatingNetwork === network ? 'Generating...' : `Generate ${network} Wallet`}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
