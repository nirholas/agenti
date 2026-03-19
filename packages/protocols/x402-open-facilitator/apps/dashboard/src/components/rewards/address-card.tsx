'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Wallet, CheckCircle, Clock, MoreVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AddressData {
  id: string;
  address: string;
  chain_type: 'solana' | 'evm';
  verification_status: 'pending' | 'verified';
  created_at: string;
}

interface AddressCardProps {
  address: AddressData;
  onRemoveClick?: (address: AddressData) => void;
  onVerify?: () => void;
}

function ChainBadge({ chainType }: { chainType: 'solana' | 'evm' }) {
  if (chainType === 'solana') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold">
        S
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold">
      E
    </span>
  );
}

export function AddressCard({ address, onRemoveClick, onVerify }: AddressCardProps) {
  // Truncate address: first 6...last 4 chars
  const truncatedAddress = `${address.address.slice(0, 6)}...${address.address.slice(-4)}`;

  // Format date
  const dateAdded = new Date(address.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isVerified = address.verification_status === 'verified';
  const chainLabel = address.chain_type === 'solana' ? 'Solana' : 'Ethereum';

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border border-border bg-card',
        !isVerified && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="p-2 rounded-full bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1">
            <ChainBadge chainType={address.chain_type} />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{truncatedAddress}</span>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                <CheckCircle className="h-3 w-3" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded">
                <Clock className="h-3 w-3" />
                Pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{chainLabel}</span>
            <span>-</span>
            <span>Added {dateAdded}</span>
          </div>
          {!isVerified && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              Rewards won't track until verified
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isVerified && onVerify && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onVerify}
          >
            Verify
          </Button>
        )}

        {onRemoveClick && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => onRemoveClick(address)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
