'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClaimModal } from './claim-modal';
import { Gift } from 'lucide-react';

interface ClaimButtonProps {
  claimId: string;
  rewardAmount: string;
  disabled?: boolean;
  className?: string;
  onSuccess?: () => void;
}

function formatTokenAmount(amount: string): string {
  // $OPEN has 9 decimals (standard SPL token)
  const value = Number(amount) / 1_000_000_000;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ClaimButton({
  claimId,
  rewardAmount,
  disabled = false,
  className,
  onSuccess,
}: ClaimButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setModalOpen(true)}
        disabled={disabled}
        className={className}
      >
        <Gift className="h-4 w-4 mr-2" />
        Claim {formatTokenAmount(rewardAmount)} $OPEN
      </Button>
      <ClaimModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        claimId={claimId}
        rewardAmount={rewardAmount}
        onSuccess={onSuccess}
      />
    </>
  );
}
