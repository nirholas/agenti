'use client';

import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SubscriptionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: 'starter' | 'basic' | 'pro' | null; // Keep basic/pro for backwards compatibility
  balance: string | null;
  isPurchasing: boolean;
  onConfirm: () => void;
}

const PRICE = 5; // $5/month for starter tier

const BENEFITS = [
  'Your own custom domain (pay.yourdomain.com)',
  'EVM + Solana support',
  'USDC payments',
  'Dashboard & analytics',
];

export function SubscriptionConfirmDialog({
  open,
  onOpenChange,
  tier,
  balance,
  isPurchasing,
  onConfirm,
}: SubscriptionConfirmDialogProps) {
  if (!tier) return null;

  const balanceNum = balance ? parseFloat(balance) : 0;
  const hasInsufficientBalance = balanceNum < PRICE;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Subscribe to Starter
          </DialogTitle>
        </DialogHeader>

        {/* Benefits */}
        <ul className="space-y-2 py-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Price and balance - inline */}
        <div className={`text-sm ${hasInsufficientBalance ? 'text-orange-500' : 'text-muted-foreground'}`}>
          ${PRICE}/month · {hasInsufficientBalance ? 'Insufficient balance' : 'Paying from your wallet'} (${balance ?? '0.00'} available)
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPurchasing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={hasInsufficientBalance || isPurchasing}
          >
            {isPurchasing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Subscribe Now'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
