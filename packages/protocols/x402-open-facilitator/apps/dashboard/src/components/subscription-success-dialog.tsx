'use client';

import { PartyPopper, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SubscriptionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: 'starter' | 'basic' | 'pro' | null; // Keep basic/pro for backwards compatibility
  txHash?: string;
}

const NEXT_STEPS = [
  'Create your first facilitator',
  'Set up your custom domain DNS',
  'Configure your wallet',
  'Start accepting payments',
];

export function SubscriptionSuccessDialog({
  open,
  onOpenChange,
  tier,
  txHash,
}: SubscriptionSuccessDialogProps) {
  if (!tier) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <PartyPopper className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Welcome to OpenFacilitator!
          </DialogTitle>
        </DialogHeader>

        <div className="text-center text-muted-foreground text-sm mb-4">
          Your subscription is now active. Here&apos;s what to do next:
        </div>

        {/* Next steps */}
        <ul className="space-y-2 py-2">
          {NEXT_STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm">
              <span className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium text-primary shrink-0">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ul>

        {/* Transaction link */}
        {txHash && (
          <div className="pt-2 border-t">
            <a
              href={`https://solscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
            >
              View transaction on Solscan
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
