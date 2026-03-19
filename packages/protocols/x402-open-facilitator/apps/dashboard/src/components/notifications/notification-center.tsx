'use client';

import { useNotifications } from '@/hooks/use-notifications';
import { NotificationItem } from './notification-item';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

export function NotificationCenter() {
  const { notifications, isLoading, dismiss, markAllRead, unreadCount } = useNotifications();

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center">
        <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No notifications</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[400px]">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="font-medium text-sm">Notifications</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-auto py-1"
            onClick={() => markAllRead()}
          >
            Mark all as read
          </Button>
        )}
      </div>
      <div className="overflow-y-auto">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </div>
  );
}
