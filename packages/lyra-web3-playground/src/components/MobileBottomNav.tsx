/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Mobile-first, always accessible 📱
 */

import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Code, Sparkles, Wallet, Terminal } from 'lucide-react';
import { useWalletStore } from '@/stores/walletStore';
import { cn } from '@/utils/helpers';

interface NavItem {
  path: string;
  icon: typeof Home;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/tutorials', icon: BookOpen, label: 'Learn' },
  { path: '/ide', icon: Terminal, label: 'IDE' },
  { path: '/sandbox', icon: Sparkles, label: 'Sandbox' },
];

export default function MobileBottomNav() {
  const location = useLocation();
  const { isConnected } = useWalletStore();

  // Don't show on IDE/fullscreen pages
  const hiddenPaths = ['/ide', '/sandbox'];
  if (hiddenPaths.some(path => location.pathname.startsWith(path) && location.pathname !== '/sandbox')) {
    return null;
  }

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-inset-bottom"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || 
            (path !== '/' && location.pathname.startsWith(path));
          
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full px-2 py-2 transition-colors',
                'active:bg-gray-100 dark:active:bg-gray-700 rounded-lg mx-0.5',
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5 mb-1" aria-hidden="true" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
        
        {/* Wallet indicator */}
        <div 
          className={cn(
            'flex flex-col items-center justify-center flex-1 h-full px-2 py-2',
            isConnected ? 'text-green-500' : 'text-gray-400'
          )}
          role="status"
          aria-label={isConnected ? 'Wallet connected' : 'Wallet not connected'}
        >
          <div className="relative">
            <Wallet className="w-5 h-5 mb-1" aria-hidden="true" />
            {isConnected && (
              <span 
                className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" 
                aria-hidden="true"
              />
            )}
          </div>
          <span className="text-xs font-medium">
            {isConnected ? 'Connected' : 'Wallet'}
          </span>
        </div>
      </div>
    </nav>
  );
}
