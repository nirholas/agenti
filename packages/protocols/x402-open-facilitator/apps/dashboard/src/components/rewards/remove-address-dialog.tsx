'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface RemoveAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: {
    id: string;
    address: string;
    chain_type: 'solana' | 'evm';
    verification_status: 'pending' | 'verified';
  } | null;
  isLastVerified: boolean;
  onConfirm: () => void;
  isRemoving: boolean;
}

export function RemoveAddressDialog({
  open,
  onOpenChange,
  address,
  isLastVerified,
  onConfirm,
  isRemoving,
}: RemoveAddressDialogProps) {
  if (!address) return null;

  // Truncate address: first 6...last 4 chars
  const truncatedAddress = `${address.address.slice(0, 6)}...${address.address.slice(-4)}`;
  const chainLabel = address.chain_type === 'solana' ? 'Solana' : 'EVM';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Address</DialogTitle>
          <DialogDescription>
            Remove this address from your rewards tracking?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <span className="font-mono text-sm">{truncatedAddress}</span>
            <span className="text-xs text-muted-foreground">({chainLabel})</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Volume history will be preserved.
          </p>

          {isLastVerified && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                This is your last verified address. You'll stop earning rewards until you add and verify another address.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRemoving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              'Remove'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
