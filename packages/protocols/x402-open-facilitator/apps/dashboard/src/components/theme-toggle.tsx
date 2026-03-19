'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-4 h-4" />;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none transition-colors">
          {theme === 'dark' ? (
            <Moon className="w-4 h-4" />
          ) : theme === 'light' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Monitor className="w-4 h-4" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 p-1">
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Sun className="w-4 h-4" />
          Light
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Moon className="w-4 h-4" />
          Dark
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors ${
            theme === 'system'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Monitor className="w-4 h-4" />
          System
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
