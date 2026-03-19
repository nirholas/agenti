'use client';

import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, type Facilitator } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const SUBSCRIPTION_PAYMENT_URLS = {
  base: process.env.NEXT_PUBLIC_SUBSCRIPTION_PAYMENT_URL_BASE || 'https://pay.openfacilitator.io/pay/nZ4IC_1lB-usqHA5hL4VX',
  solana: process.env.NEXT_PUBLIC_SUBSCRIPTION_PAYMENT_URL_SOLANA || 'https://pay.openfacilitator.io/pay/9H_WKcSOnPAQNJlglx348',
};

type Network = 'base' | 'solana';

interface CreateFacilitatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (facilitator: Facilitator) => void;
  walletBalance?: string;
}

export function CreateFacilitatorModal({
  open,
  onOpenChange,
  onSuccess,
  walletBalance,
}: CreateFacilitatorModalProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const { toast } = useToast();

  const pendingMutation = useMutation({
    mutationFn: async (data: { name: string; customDomain: string }) => {
      // Save pending facilitator request and get the ID
      const pending = await api.createPendingFacilitator(data);
      return pending;
    },
    onSuccess: (pending) => {
      // Open payment link with pendingId - webhook will create the facilitator after payment
      const baseUrl = SUBSCRIPTION_PAYMENT_URLS[selectedNetwork!];
      const paymentUrl = `${baseUrl}?pendingId=${pending.id}`;
      window.open(paymentUrl, '_blank');

      toast({
        title: 'Complete payment to create facilitator',
        description: 'Your facilitator will be created automatically after payment.',
      });

      // Close modal and reset form
      onOpenChange(false);
      setName('');
      setDomain('');
      setSelectedNetwork(null);
    },
    onError: (error) => {
      toast({
        title: 'Failed to start facilitator creation',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const handlePayAndCreate = () => {
    if (!name.trim() || !domain.trim() || !selectedNetwork) return;
    pendingMutation.mutate({
      name: name.trim(),
      customDomain: domain.trim(),
    });
  };

  const isFormValid = name.trim() && domain.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Facilitator</DialogTitle>
          <DialogDescription>
            Set up a new x402 facilitator with your own domain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Internal name for your reference
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              placeholder="pay.yourdomain.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
            />
            <p className="text-xs text-muted-foreground">
              You'll need to configure DNS after creation
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Cost</span>
              <span className="font-semibold">$5.00 USDC/month</span>
            </div>

            <div className="space-y-2">
              <span className="text-sm">Pay with</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNetwork('base')}
                  disabled={!isFormValid}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    selectedNetwork === 'base'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  } ${!isFormValid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <svg width="20" height="20" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF"/>
                    <path d="M55.5 96C77.8675 96 96 77.8675 96 55.5C96 33.1325 77.8675 15 55.5 15C33.1325 15 15 33.1325 15 55.5C15 77.8675 33.1325 96 55.5 96Z" fill="#0052FF"/>
                    <path d="M55.5 85C71.793 85 85 71.793 85 55.5C85 39.207 71.793 26 55.5 26C39.207 26 26 39.207 26 55.5C26 71.793 39.207 85 55.5 85Z" fill="white"/>
                  </svg>
                  <span className="font-medium">Base</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNetwork('solana')}
                  disabled={!isFormValid}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    selectedNetwork === 'solana'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  } ${!isFormValid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <svg width="20" height="20" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="64" cy="64" r="64" fill="url(#solana-gradient)"/>
                    <path d="M36.5 79.3c.6-.6 1.4-1 2.3-1h53.3c1.5 0 2.2 1.8 1.1 2.8l-10.9 10.9c-.6.6-1.4 1-2.3 1H26.7c-1.5 0-2.2-1.8-1.1-2.8l10.9-10.9z" fill="white"/>
                    <path d="M36.5 35c.6-.6 1.4-1 2.3-1h53.3c1.5 0 2.2 1.8 1.1 2.8L82.3 47.7c-.6.6-1.4 1-2.3 1H26.7c-1.5 0-2.2-1.8-1.1-2.8L36.5 35z" fill="white"/>
                    <path d="M82.3 57c-.6-.6-1.4-1-2.3-1H26.7c-1.5 0-2.2 1.8-1.1 2.8l10.9 10.9c.6.6 1.4 1 2.3 1h53.3c1.5 0 2.2-1.8 1.1-2.8L82.3 57z" fill="white"/>
                    <defs>
                      <linearGradient id="solana-gradient" x1="0" y1="128" x2="128" y2="0">
                        <stop stopColor="#9945FF"/>
                        <stop offset="0.5" stopColor="#14F195"/>
                        <stop offset="1" stopColor="#00D1FF"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="font-medium">Solana</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Pay via x402 to activate your facilitator. Your facilitator will be created automatically after payment.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePayAndCreate}
            disabled={!isFormValid || !selectedNetwork || pendingMutation.isPending}
          >
            {pendingMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Pay $5 & Create
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
