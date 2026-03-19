'use client';

import { useState } from 'react';
import { Book, Rocket, Code, Globe, MoreHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/docs/Sidebar';
import { Navbar } from '@/components/navbar';
import { cn } from '@/lib/utils';

const bottomNavItems = [
  { href: '/docs', label: 'Overview', icon: Book },
  { href: '/docs/quickstart', label: 'Start', icon: Rocket },
  { href: '/docs/sdk', label: 'SDK', icon: Code },
  { href: '/docs/networks', label: 'Networks', icon: Globe },
  { href: '#more', label: 'More', icon: MoreHorizontal, isMenu: true },
];

const moreMenuItems = [
  { href: '/docs/api', label: 'HTTP API' },
  { href: '/docs/dns-setup', label: 'DNS Setup' },
  { href: '/docs/self-hosting', label: 'Self-Hosting' },
  { href: '/docs/sdk/errors', label: 'Error Handling' },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/docs') return pathname === '/docs';
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-20 min-h-[calc(100vh-5rem)]">
        <div className="flex min-h-full">
          {/* Desktop sidebar - hidden on mobile */}
          <aside className="hidden lg:block w-64 shrink-0 border-r border-border min-h-[calc(100vh-5rem)]">
            <div className="sticky top-20 pr-6">
              <Sidebar />
            </div>
          </aside>

          {/* Main content - full width on mobile, bottom padding for nav */}
          <main className="flex-1 min-w-0">
            <article className="max-w-3xl px-2 lg:pl-12 lg:pr-8 pt-6 pb-24 lg:pb-12">
              {children}
            </article>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav - hidden on desktop */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.isMenu ? menuOpen : isActive(item.href);
            
            if (item.isMenu) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 transition-colors',
                    menuOpen ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  <span className="text-xs">{menuOpen ? 'Close' : item.label}</span>
                </button>
              );
            }
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* "More" menu slide-up panel */}
      {menuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 bg-background border-t border-border z-50 p-4 rounded-t-2xl lg:hidden animate-in slide-in-from-bottom-4 duration-200">
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              {moreMenuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    'p-4 rounded-xl text-center text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
