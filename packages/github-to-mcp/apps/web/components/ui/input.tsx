/**
 * Input Component
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-xl border bg-black px-4 py-2 text-sm text-white transition-all',
            'placeholder:text-neutral-500',
            'focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-neutral-600',
            'disabled:cursor-not-allowed disabled:opacity-50',
            leftIcon && 'pl-11',
            rightIcon && 'pr-11',
            error
              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
              : 'border-neutral-700 hover:border-neutral-600',
            className
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
