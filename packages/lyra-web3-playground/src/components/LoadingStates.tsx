/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Good things come to those who wait (with nice loading states) ⏳
 */

import { cn } from '@/utils/helpers';

/**
 * Skeleton Loader - Animated placeholder while content loads
 */
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({ 
  className, 
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClass = 'animate-pulse bg-gray-200 dark:bg-gray-700';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg',
  };

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseClass, variantClasses[variant], className)}
            style={{
              ...style,
              width: i === lines - 1 ? '75%' : style.width, // Last line shorter
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClass, variantClasses[variant], className)}
      style={style}
    />
  );
}

/**
 * Card Skeleton - Loading state for card components
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700', className)}>
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={20} className="rounded" />
          <Skeleton width="40%" height={16} className="rounded" />
        </div>
      </div>
      <div className="mt-4">
        <Skeleton lines={3} className="h-3" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton width={80} height={32} className="rounded-full" />
        <Skeleton width={80} height={32} className="rounded-full" />
      </div>
    </div>
  );
}

/**
 * Table Skeleton - Loading state for tables
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height={20} className="rounded" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} width={`${100 / columns}%`} height={16} className="rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Page Loading Spinner
 */
export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
        {/* Spinning ring */}
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-primary-500 rounded-full animate-spin" />
      </div>
      <p className="text-gray-500 dark:text-gray-400 animate-pulse">{message}</p>
    </div>
  );
}

/**
 * Inline Spinner - Small spinner for buttons or inline use
 */
export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div
      className={cn(
        'border-gray-300 dark:border-gray-600 border-t-primary-500 rounded-full animate-spin',
        sizeClasses[size],
        className
      )}
    />
  );
}

/**
 * Dots Loader - Three bouncing dots
 */
export function DotsLoader({ className }: { className?: string }) {
  return (
    <div className={cn('flex gap-1 items-center justify-center', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

/**
 * Progress Bar - Determinate progress indicator
 */
export function ProgressBar({ 
  progress, 
  className,
  showLabel = false,
}: { 
  progress: number; 
  className?: string;
  showLabel?: boolean;
}) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
          <span>Progress</span>
          <span>{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Code Editor Skeleton - Loading state for Monaco editor
 */
export function EditorSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-gray-900 rounded-lg p-4 font-mono text-sm', className)}>
      {/* Line numbers and code lines */}
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton width={24} height={16} className="bg-gray-800" />
            <Skeleton 
              width={`${Math.random() * 40 + 30}%`} 
              height={16} 
              className="bg-gray-800" 
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dashboard Skeleton - Full page skeleton for dashboard
 */
export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Skeleton width={200} height={32} className="rounded" />
        <Skeleton width={120} height={40} className="rounded-lg" />
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <Skeleton width={80} height={16} className="rounded mb-2" />
            <Skeleton width={120} height={32} className="rounded" />
          </div>
        ))}
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CardSkeleton />
        </div>
        <div>
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

export default {
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  PageLoader,
  Spinner,
  DotsLoader,
  ProgressBar,
  EditorSkeleton,
  DashboardSkeleton,
};
