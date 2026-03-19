'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { api } from '@/lib/api';
import { Loader2, CheckCircle, AlertCircle, Wallet, ExternalLink, Gift, Twitter } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  rewardAmount: string;
  onSuccess?: () => void;
}

type Status = 'idle' | 'connecting' | 'confirming' | 'processing' | 'success' | 'error';

function formatTokenAmount(amount: string): string {
  // $OPEN has 9 decimals (standard SPL token)
  const value = Number(amount) / 1_000_000_000;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function celebrateClaim() {
  // Fire from center
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });

  // Side bursts for dramatic effect
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
    });
  }, 200);
}

function shareOnTwitter(amount: string, txSignature: string | null) {
  const text = `I just claimed ${formatTokenAmount(amount)} $OPEN tokens from @OpenFacilitator rewards!`;
  const baseUrl = 'https://twitter.com/intent/tweet';

  let twitterUrl: string;
  if (txSignature) {
    const txUrl = `https://solscan.io/tx/${txSignature}`;
    twitterUrl = `${baseUrl}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(txUrl)}`;
  } else {
    twitterUrl = `${baseUrl}?text=${encodeURIComponent(text)}`;
  }

  window.open(
    twitterUrl,
    'twitter-share',
    'width=550,height=450,menubar=no,toolbar=no,resizable=yes,scrollbars=yes'
  );
}

export function ClaimModal({
  open,
  onOpenChange,
  claimId,
  rewardAmount,
  onSuccess,
}: ClaimModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [claimedWallet, setClaimedWallet] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  // Handle wallet connection - transition from connecting to confirming
  useEffect(() => {
    if (status === 'connecting' && connected && publicKey) {
      setStatus('confirming');
    }
  }, [connected, publicKey, status]);

  const handleConnect = useCallback(() => {
    setStatus('connecting');
    setErrorMessage(null);
    setVisible(true);
  }, [setVisible]);

  const handleConfirm = useCallback(async () => {
    if (!publicKey) return;

    setStatus('processing');
    setErrorMessage(null);

    try {
      const walletAddress = publicKey.toBase58();
      const result = await api.initiateClaim(claimId, walletAddress);

      if (result.success) {
        setClaimedWallet(walletAddress);
        // Store tx_signature if returned (will be present after 10-02 completes)
        if (result.claim?.tx_signature) {
          setTxSignature(result.claim.tx_signature);
        }
        setStatus('success');
        // Fire celebratory confetti
        celebrateClaim();
        onSuccess?.();
      } else {
        setErrorMessage(result.error || 'Failed to initiate claim');
        setStatus('error');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to initiate claim'
      );
      setStatus('error');
    }
  }, [publicKey, claimId, onSuccess]);

  const handleTryAgain = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    disconnect();
  }, [disconnect]);

  const handleClose = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state and disconnect wallet on close (ephemeral connection)
        setStatus('idle');
        setErrorMessage(null);
        setClaimedWallet(null);
        setTxSignature(null);
        disconnect();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, disconnect]
  );

  const handleDone = useCallback(() => {
    handleClose(false);
  }, [handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Claim Your Rewards</DialogTitle>
          <DialogDescription>
            Connect your Solana wallet to receive your $OPEN tokens.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          {status === 'idle' && (
            <>
              <div className="mb-6 p-4 rounded-full bg-primary/10">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center mb-6">
                <p className="text-2xl font-bold text-primary mb-2">
                  {formatTokenAmount(rewardAmount)} $OPEN
                </p>
                <p className="text-sm text-muted-foreground">
                  Connect your Solana wallet to claim your reward.
                  Tokens will be sent to the connected wallet.
                </p>
              </div>
              <Button onClick={handleConnect} className="w-full">
                <Wallet className="h-4 w-4 mr-2" />
                Connect Solana Wallet
              </Button>
            </>
          )}

          {status === 'connecting' && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-center text-muted-foreground">
                Connecting wallet...
              </p>
            </>
          )}

          {status === 'confirming' && publicKey && (
            <>
              <div className="mb-4 p-4 rounded-full bg-primary/10">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center mb-6 w-full">
                <p className="text-sm text-muted-foreground mb-2">
                  Tokens will be sent to:
                </p>
                <p className="font-mono text-sm bg-muted px-3 py-2 rounded-md break-all">
                  {publicKey.toBase58()}
                </p>
                <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {formatTokenAmount(rewardAmount)} $OPEN
                  </p>
                </div>
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={handleTryAgain} className="flex-1">
                  Change Wallet
                </Button>
                <Button onClick={handleConfirm} className="flex-1">
                  Confirm Claim
                </Button>
              </div>
            </>
          )}

          {status === 'processing' && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-center text-muted-foreground">
                Processing your claim...
              </p>
            </>
          )}

          {status === 'success' && claimedWallet && (
            <>
              <div className="mb-4 p-5 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40">
                <Gift className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-xl mb-2">Congratulations!</h3>
              <p className="text-center text-sm text-muted-foreground mb-4">
                Your claim has been initiated
              </p>
              <div className="w-full p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-4">
                <p className="text-3xl font-bold text-green-700 dark:text-green-400 text-center">
                  {formatTokenAmount(rewardAmount)} $OPEN
                </p>
              </div>
              <p className="text-center text-sm text-muted-foreground mb-1">
                Will be sent to:
              </p>
              <a
                href={`https://solscan.io/account/${claimedWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 font-mono text-sm text-primary hover:underline mb-4"
              >
                {truncateAddress(claimedWallet)}
                <ExternalLink className="h-3 w-3" />
              </a>
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-4"
                >
                  <CheckCircle className="h-4 w-4" />
                  View transaction
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="flex flex-col gap-3 w-full mt-2">
                <Button
                  variant="outline"
                  onClick={() => shareOnTwitter(rewardAmount, txSignature)}
                  className="w-full"
                >
                  <Twitter className="h-4 w-4 mr-2" />
                  Share on X
                </Button>
                <Button onClick={handleDone} className="w-full">
                  Done
                </Button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mb-4 p-4 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Claim Failed</h3>
              <p className="text-center text-sm text-red-600 dark:text-red-400 mb-6">
                {errorMessage}
              </p>
              <Button onClick={handleTryAgain} className="w-full">
                Try Again
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
