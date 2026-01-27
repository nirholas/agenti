import React from 'react';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lyra Registry - The NPM for Crypto AI Tools',
  description: 'Central registry for Lyra ecosystem tools, agents, and plugins. Discover, evaluate, and integrate crypto AI tools.',
  keywords: ['crypto', 'AI', 'MCP', 'tools', 'DeFi', 'blockchain', 'registry'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
