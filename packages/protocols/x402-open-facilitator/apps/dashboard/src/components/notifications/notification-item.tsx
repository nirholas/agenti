'use client';

import { formatDistanceToNow } from 'date-fns';
import { Check, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cva } from 'class-variance-authority';
import type { Notification } from '@/lib/api';

const itemVariants = cva(
  'relative flex gap-3 p-4 border-b last:border-0 transition-colors',
  {
    variants: {
      severity: {
        success: 'bg-green-50 dark:bg-green-950/20',
        warning: 'bg-amber-50 dark:bg-amber-950/20',
        error: 'bg-red-50 dark:bg-red-950/20',
        info: 'bg-background',
      },
      read: {
        true: 'opacity-70',
        false: '',
      },
    },
    defaultVariants: {
      severity: 'info',
      read: false,
    },
  }
);

const iconMap = {
  success: Check,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

const iconColorMap = {
  success: 'text-green-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
  info: 'text-muted-foreground',
};

interface NotificationItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

export function NotificationItem({ notification, onDismiss }: NotificationItemProps) {
  const Icon = iconMap[notification.severity];

  return (
    <div className={itemVariants({ severity: notification.severity, read: notification.read })}>
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`w-5 h-5 ${iconColorMap[notification.severity]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
