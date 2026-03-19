'use client';

import { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  Plus,
  Import,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// Network configuration
export interface NetworkConfig {
  v1Id: string;
  v2Id: string;
  name: string;
  type: 'evm' | 'solana' | 'stacks';
  chainId?: number;
  testnet: boolean;
}

// All supported networks
export const SUPPORTED_NETWORKS: NetworkConfig[] = [
  // ============ EVM Mainnets ============
  {
    v1Id: 'base',
    v2Id: 'eip155:8453',
    name: 'Base',
    type: 'evm',
    chainId: 8453,
    testnet: false,
  },
  {
    v1Id: 'polygon',
    v2Id: 'eip155:137',
    name: 'Polygon',
    type: 'evm',
    chainId: 137,
    testnet: false,
  },
  {
    v1Id: 'avalanche',
    v2Id: 'eip155:43114',
    name: 'Avalanche',
    type: 'evm',
    chainId: 43114,
    testnet: false,
  },
  {
    v1Id: 'sei',
    v2Id: 'eip155:1329',
    name: 'Sei',
    type: 'evm',
    chainId: 1329,
    testnet: false,
  },
  {
    v1Id: 'iotex',
    v2Id: 'eip155:4689',
    name: 'IoTeX',
    type: 'evm',
    chainId: 4689,
    testnet: false,
  },
  {
    v1Id: 'peaq',
    v2Id: 'eip155:3338',
    name: 'Peaq',
    type: 'evm',
    chainId: 3338,
    testnet: false,
  },
  {
    v1Id: 'xlayer',
    v2Id: 'eip155:196',
    name: 'X Layer',
    type: 'evm',
    chainId: 196,
    testnet: false,
  },

  // ============ EVM Testnets ============
  {
    v1Id: 'base-sepolia',
    v2Id: 'eip155:84532',
    name: 'Base Sepolia',
    type: 'evm',
    chainId: 84532,
    testnet: true,
  },
  {
    v1Id: 'polygon-amoy',
    v2Id: 'eip155:80002',
    name: 'Polygon Amoy',
    type: 'evm',
    chainId: 80002,
    testnet: true,
  },
  {
    v1Id: 'avalanche-fuji',
    v2Id: 'eip155:43113',
    name: 'Avalanche Fuji',
    type: 'evm',
    chainId: 43113,
    testnet: true,
  },
  {
    v1Id: 'sei-testnet',
    v2Id: 'eip155:1328',
    name: 'Sei Testnet',
    type: 'evm',
    chainId: 1328,
    testnet: true,
  },
  {
    v1Id: 'xlayer-testnet',
    v2Id: 'eip155:195',
    name: 'X Layer Testnet',
    type: 'evm',
    chainId: 195,
    testnet: true,
  },

  // ============ Solana ============
  {
    v1Id: 'solana',
    v2Id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    name: 'Solana',
    type: 'solana',
    testnet: false,
  },
  {
    v1Id: 'solana-devnet',
    v2Id: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    name: 'Solana Devnet',
    type: 'solana',
    testnet: true,
  },

  // ============ Stacks ============
  {
    v1Id: 'stacks',
    v2Id: 'stacks:1',
    name: 'Stacks',
    type: 'stacks',
    testnet: false,
  },
  {
    v1Id: 'stacks-testnet',
    v2Id: 'stacks:2147483648',
    name: 'Stacks Testnet',
    type: 'stacks',
    testnet: true,
  },
];

// Helper functions
export const getMainnets = () => SUPPORTED_NETWORKS.filter(n => !n.testnet);
export const getTestnets = () => SUPPORTED_NETWORKS.filter(n => n.testnet);
export const getEvmNetworks = () => SUPPORTED_NETWORKS.filter(n => n.type === 'evm');
export const getSolanaNetworks = () => SUPPORTED_NETWORKS.filter(n => n.type === 'solana');
export const getStacksNetworks = () => SUPPORTED_NETWORKS.filter(n => n.type === 'stacks');

// Explorer URLs
const EXPLORER_URLS: Record<string, string> = {
  // EVM
  base: 'https://basescan.org',
  polygon: 'https://polygonscan.com',
  avalanche: 'https://snowtrace.io',
  sei: 'https://seitrace.com',
  iotex: 'https://iotexscan.io',
  peaq: 'https://peaq.subscan.io',
  xlayer: 'https://www.okx.com/explorer/xlayer',
  // EVM Testnets
  'base-sepolia': 'https://sepolia.basescan.org',
  'polygon-amoy': 'https://amoy.polygonscan.com',
  'avalanche-fuji': 'https://testnet.snowtrace.io',
  'sei-testnet': 'https://testnet.seitrace.com',
  'xlayer-testnet': 'https://www.okx.com/explorer/xlayer-test',
  // Solana
  solana: 'https://solscan.io',
  'solana-devnet': 'https://solscan.io',
  // Stacks
  stacks: 'https://explorer.hiro.so',
  'stacks-testnet': 'https://explorer.hiro.so/?chain=testnet',
};

export function getExplorerAddressUrl(type: 'evm' | 'solana' | 'stacks', address: string): string {
  if (type === 'solana') {
    return `https://solscan.io/account/${address}`;
  }
  if (type === 'stacks') {
    return `https://explorer.hiro.so/address/${address}?chain=mainnet`;
  }
  return `https://basescan.org/address/${address}`;
}

// Balance thresholds for warnings
const LOW_BALANCE_THRESHOLDS = {
  evm: 0.01,    // ETH
  solana: 0.05, // SOL
  stacks: 0.5,  // STX
} as const;

// Per-type display constants
const NETWORK_ICONS = { evm: '🔷', solana: '🟣', stacks: '🟠' } as const;
const NATIVE_SYMBOLS = { evm: 'ETH', solana: 'SOL', stacks: 'STX' } as const;
const SETTLEMENT_LABELS = { evm: 'EVM chain', solana: 'Solana', stacks: 'Stacks' } as const;
const IMPORT_DESCRIPTIONS = {
  evm: 'Enter your private key (0x-prefixed hex). It will be encrypted and stored securely.',
  solana: 'Enter your Solana private key (base58 encoded). It will be encrypted and stored securely.',
  stacks: 'Enter your Stacks private key (64 hex characters). It will be encrypted and stored securely.',
} as const;
const IMPORT_PLACEHOLDERS = { evm: '0x...', solana: 'base58 encoded key...', stacks: '64 hex characters...' } as const;
const IMPORT_HELP = {
  evm: 'Must be 0x-prefixed 64 hex characters',
  solana: '64-byte base58-encoded Solana keypair',
  stacks: '64 hex characters (no 0x prefix)',
} as const;

export interface WalletInfo {
  address: string | null;
  balance?: string;
  balanceFormatted?: string;
}

// Network Pill Component
interface NetworkPillProps {
  network: NetworkConfig;
  active: boolean;
}

export function NetworkPill({ network, active }: NetworkPillProps) {
  if (!active) {
    return (
      <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
        {network.name}
      </span>
    );
  }

  if (network.testnet) {
    return (
      <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs border border-dashed border-border">
        {network.name}
      </span>
    );
  }

  return (
    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
      {network.name}
    </span>
  );
}

// Wallet Type Card Component
interface WalletTypeCardProps {
  type: 'evm' | 'solana' | 'stacks';
  title: string;
  subtitle: string;
  wallet: WalletInfo | null;
  networks: NetworkConfig[];
  showTestnets: boolean;
  isGenerating: boolean;
  isImporting: boolean;
  isDeleting: boolean;
  onGenerate: () => void;
  onImport: (privateKey: string) => void;
  onDelete: () => void;
}

export function WalletTypeCard({
  type,
  title,
  subtitle,
  wallet,
  networks,
  showTestnets,
  isGenerating,
  isImporting,
  isDeleting,
  onGenerate,
  onImport,
  onDelete,
}: WalletTypeCardProps) {
  const [copied, setCopied] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importKey, setImportKey] = useState('');

  const hasWallet = wallet?.address != null;
  const displayNetworks = showTestnets ? networks : networks.filter(n => !n.testnet);
  const balance = wallet?.balanceFormatted ? parseFloat(wallet.balanceFormatted) : 0;
  const balanceStatus = hasWallet
    ? balance === 0 ? 'empty' : balance < LOW_BALANCE_THRESHOLDS[type] ? 'low' : 'ok'
    : null;

  const handleCopy = async () => {
    if (wallet?.address) {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImport = () => {
    onImport(importKey);
    setImportKey('');
    setIsImportOpen(false);
  };

  const icon = NETWORK_ICONS[type];
  const nativeSymbol = NATIVE_SYMBOLS[type];

  return (
    <Card className={hasWallet && balanceStatus === 'ok' ? 'border-green-500/30' : ''}>
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {hasWallet ? (
            <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Configured
            </span>
          ) : (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              Not Configured
            </span>
          )}
        </div>

        {hasWallet ? (
          /* Configured state */
          <div className="space-y-4">
            {/* Wallet Address */}
            <div className="flex items-center gap-2 font-mono text-sm bg-muted p-2 rounded">
              <span className="truncate flex-1">{wallet?.address}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
              <a
                href={getExplorerAddressUrl(type, wallet?.address || '')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Balance */}
            {wallet?.balanceFormatted && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-mono">
                  {wallet.balanceFormatted} {nativeSymbol}
                </span>
              </div>
            )}

            {(balanceStatus === 'low' || balanceStatus === 'empty') && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Low balance - fund wallet to process payments
              </p>
            )}

            {/* Change Wallet */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm(`Remove ${title}? This will stop ${SETTLEMENT_LABELS[type]} settlements.`)) {
                  onDelete();
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Change Wallet
            </Button>
          </div>
        ) : (
          /* Not configured state */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A wallet is required to submit settlement transactions. You can generate a new wallet or import an existing one.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={onGenerate}
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Generate Wallet
              </Button>
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Import className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import {title.replace(' Wallet', '')} Private Key</DialogTitle>
                    <DialogDescription>
                      {IMPORT_DESCRIPTIONS[type]}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor={`import-${type}`}>Private Key</Label>
                      <Input
                        id={`import-${type}`}
                        type="password"
                        placeholder={IMPORT_PLACEHOLDERS[type]}
                        value={importKey}
                        onChange={(e) => setImportKey(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {IMPORT_HELP[type]}
                      </p>
                    </div>
                    <Button
                      onClick={handleImport}
                      disabled={isImporting || !importKey}
                      className="w-full"
                    >
                      {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Import Wallet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        {/* Networks */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Enabled Networks:</p>
          <div className="flex flex-wrap gap-1.5">
            {displayNetworks.map(network => (
              <NetworkPill
                key={network.v1Id}
                network={network}
                active={hasWallet}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
