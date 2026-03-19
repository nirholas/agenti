'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  current: string;
  threshold: string;
  className?: string;
}

function formatUSDC(amount: string): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ProgressBar({ current, threshold, className }: ProgressBarProps) {
  const currentNum = Number(current) / 1_000_000;
  const thresholdNum = Number(threshold) / 1_000_000;

  // Guard against division by zero
  const percentage = thresholdNum > 0 ? Math.min((currentNum / thresholdNum) * 100, 100) : 0;
  const metThreshold = currentNum >= thresholdNum;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress text */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {formatUSDC(current)} / {formatUSDC(threshold)}
        </span>
        <span className="text-muted-foreground">
          ({percentage.toFixed(1)}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-4 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            metThreshold ? 'bg-green-500' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
