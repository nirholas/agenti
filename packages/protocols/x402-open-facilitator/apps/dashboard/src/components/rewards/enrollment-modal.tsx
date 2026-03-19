'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletIcon } from '@solana/wallet-adapter-react-ui';
import { signAndEnroll } from '@/lib/solana/verification';
import { useAuth } from '@/components/auth/auth-provider';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface EnrollmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Status = 'idle' | 'connecting' | 'signing' | 'success' | 'error';

export function EnrollmentModal({ open, onOpenChange }: EnrollmentModalProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Solana wallet hooks
  const wallet = useWallet();
  const { publicKey, connected, disconnect, select, connect, wallets, connecting, wallet: selectedWallet } = wallet;
  const { refetchRewardsStatus } = useAuth();

  // Find Phantom wallet
  const phantomWallet = wallets.find(
    (w) => w.adapter.name.toLowerCase() === 'phantom'
  );

  // When Phantom is selected and we're in connecting status, trigger connect
  useEffect(() => {
    if (status === 'connecting' && selectedWallet?.adapter.name.toLowerCase() === 'phantom' && !connected && !connecting) {
      connect().catch((err) => {
        console.error('Failed to connect:', err);
        if (err instanceof Error && err.message.includes('User rejected')) {
          setStatus('idle');
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to connect wallet');
          setStatus('error');
        }
      });
    }
  }, [status, selectedWallet, connected, connecting, connect]);

  // Handle wallet connection and automatic signing
  useEffect(() => {
    if (connected && publicKey && status === 'connecting') {
      handleSign();
    }
  }, [connected, publicKey, status]);

  const handleConnectPhantom = useCallback(async () => {
    if (!phantomWallet) {
      setErrorMessage('Phantom wallet not found. Please install Phantom.');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setErrorMessage(null);

    // Select Phantom and connect directly (avoid race condition with effect)
    select(phantomWallet.adapter.name);

    // Small delay to let selection register, then connect
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      await connect();
    } catch (err) {
      console.error('Failed to connect:', err);
      if (err instanceof Error && err.message.includes('User rejected')) {
        setStatus('idle');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to connect wallet');
        setStatus('error');
      }
    }
  }, [phantomWallet, select, connect]);

  const handleSign = useCallback(async () => {
    setStatus('signing');
    setErrorMessage(null);

    const result = await signAndEnroll(wallet);

    if (result.success) {
      await refetchRewardsStatus();
      setStatus('success');
    } else {
      setErrorMessage(result.error || 'Failed to verify address');
      setStatus('error');
    }
  }, [wallet, refetchRewardsStatus]);

  const handleTryAgain = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    disconnect();
  }, [disconnect]);

  const handleAddAnother = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    disconnect();
  }, [disconnect]);

  const handleClose = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setStatus('idle');
      setErrorMessage(null);
      disconnect();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, disconnect]);

  const handleDone = useCallback(() => {
    handleClose(false);
  }, [handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xs">
        <div className="flex flex-col items-center text-center pt-2">
          {status === 'idle' && (
            <>
              <h2 className="text-xl font-semibold mb-2">Start Earning Rewards</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Connect your pay-to wallet to track volume and earn $OPEN.
              </p>

              {phantomWallet ? (
                <button
                  onClick={handleConnectPhantom}
                  className="wallet-adapter-button wallet-adapter-button-trigger"
                >
                  <WalletIcon wallet={phantomWallet} className="wallet-adapter-button-start-icon" />
                  Connect Phantom
                </button>
              ) : (
                <Button
                  onClick={() => window.open('https://phantom.app/', '_blank')}
                >
                  Install Phantom
                </Button>
              )}
            </>
          )}

          {(status === 'connecting' || connecting) && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-center text-muted-foreground">
                Connecting to Phantom...
              </p>
            </>
          )}

          {status === 'signing' && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-center text-muted-foreground">
                Please sign the message in your wallet...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-4 p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Address Added!</h3>
              <p className="text-center text-sm text-muted-foreground mb-5">
                Your volume will now be tracked for this address.
              </p>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={handleAddAnother} className="flex-1">
                  Add Another
                </Button>
                <Button onClick={handleDone} className="flex-1">
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
              <h3 className="font-semibold text-lg mb-2">Verification Failed</h3>
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
