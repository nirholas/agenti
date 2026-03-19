import { cn } from '@/lib/utils';
import { AlertCircle, Info, Lightbulb, AlertTriangle } from 'lucide-react';

interface CalloutProps {
  type?: 'info' | 'warning' | 'tip' | 'danger';
  title?: string;
  children: React.ReactNode;
}

const styles = {
  info: {
    container: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    icon: 'text-blue-600',
    title: 'text-blue-800 dark:text-blue-300',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    icon: 'text-yellow-600',
    title: 'text-yellow-800 dark:text-yellow-300',
  },
  tip: {
    container: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    icon: 'text-green-600',
    title: 'text-green-800 dark:text-green-300',
  },
  danger: {
    container: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    icon: 'text-red-600',
    title: 'text-red-800 dark:text-red-300',
  },
};

const icons = {
  info: Info,
  warning: AlertTriangle,
  tip: Lightbulb,
  danger: AlertCircle,
};

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const Icon = icons[type];
  const style = styles[type];

  return (
    <div className={cn('border rounded-lg p-4 my-4', style.container)}>
      <div className="flex gap-3">
        <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', style.icon)} />
        <div>
          {title && (
            <p className={cn('font-semibold mb-1', style.title)}>{title}</p>
          )}
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
