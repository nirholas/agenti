'use client';

import { Bell } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationCenter } from './notification-center';
import { useNotifications } from '@/hooks/use-notifications';

export function NotificationBell() {
  const { unreadCount } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-muted/50 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <NotificationCenter />
      </PopoverContent>
    </Popover>
  );
}
