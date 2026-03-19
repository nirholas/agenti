'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, LogOut, LayoutDashboard, CreditCard, Trophy, ChevronDown, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/auth/auth-provider';

export function UserMenu() {
  const pathname = usePathname();
  const { user, signOut, hasClaimable } = useAuth();
  const { theme, setTheme } = useTheme();
  const isOnDashboard = pathname === '/dashboard';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-muted/50 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none transition-colors">
          <User className="w-5 h-5" />
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium truncate">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isOnDashboard && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="flex items-center cursor-pointer">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/subscriptions" className="flex items-center cursor-pointer">
            <CreditCard className="w-4 h-4 mr-2" />
            Subscriptions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/rewards" className="flex items-center cursor-pointer relative">
            <Trophy className="w-4 h-4 mr-2" />
            Rewards
            {hasClaimable && (
              <span className="absolute right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 mr-2" />
            ) : theme === 'light' ? (
              <Sun className="w-4 h-4 mr-2" />
            ) : (
              <Monitor className="w-4 h-4 mr-2" />
            )}
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
                <Sun className="w-4 h-4 mr-2" />
                Light
                {theme === 'light' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
                <Moon className="w-4 h-4 mr-2" />
                Dark
                {theme === 'dark' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
                <Monitor className="w-4 h-4 mr-2" />
                System
                {theme === 'system' && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={signOut} className="cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
