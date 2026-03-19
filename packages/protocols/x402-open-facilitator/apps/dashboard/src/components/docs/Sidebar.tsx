'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { title: 'Overview', href: '/docs' },
  { title: 'Quickstart', href: '/docs/quickstart' },
  {
    title: 'SDK',
    href: '/docs/sdk',
    children: [
      { title: 'Installation', href: '/docs/sdk/installation' },
      { title: 'verify()', href: '/docs/sdk/verify' },
      { title: 'settle()', href: '/docs/sdk/settle' },
      { title: 'supported()', href: '/docs/sdk/supported' },
      { title: 'Fee Payer', href: '/docs/sdk/fee-payer' },
      { title: 'Networks', href: '/docs/sdk/networks' },
      { title: 'Errors', href: '/docs/sdk/errors' },
      { title: 'Refunds', href: '/docs/sdk/refunds' },
    ],
  },
  { title: 'HTTP API', href: '/docs/api' },
  { title: 'Networks', href: '/docs/networks' },
  { title: 'DNS Setup', href: '/docs/dns-setup' },
  { title: 'Self-Hosting', href: '/docs/self-hosting' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      {navigation.map((item) => (
        <div key={item.href} className="mb-1">
          <Link
            href={item.href}
            className={cn(
              'block px-3 py-2 rounded-md text-sm transition-colors',
              pathname === item.href
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {item.title}
          </Link>
          {item.children && (
            <div className="ml-4 mt-1 space-y-1 border-l border-border pl-3">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    'block px-3 py-1.5 rounded-md text-sm transition-colors',
                    pathname === child.href
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {child.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
