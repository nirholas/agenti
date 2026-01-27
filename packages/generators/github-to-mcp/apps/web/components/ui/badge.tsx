/**
 * Badge Component
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/10 text-white border border-neutral-700',
        secondary: 'bg-white/5 text-neutral-400 border border-neutral-800',
        success: 'bg-green-500/20 text-green-300 border border-green-500/30',
        warning: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        destructive: 'bg-red-500/20 text-red-300 border border-red-500/30',
        blue: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        purple: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
        outline: 'bg-transparent border border-neutral-700 text-neutral-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
