/**
 * Playground V2 Layout - Metadata and layout wrapper
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { PlaygroundV2Providers } from './providers';

export const metadata: Metadata = {
  title: 'MCP Playground | github-to-mcp',
  description: 'Interactive MCP server testing playground. Connect to any MCP server using STDIO, SSE, or Streamable HTTP transport and test tools, resources, and prompts in real-time.',
  keywords: [
    'MCP',
    'Model Context Protocol',
    'playground',
    'testing',
    'tools',
    'resources',
    'prompts',
    'AI',
    'LLM',
  ],
  openGraph: {
    title: 'MCP Playground | github-to-mcp',
    description: 'Interactive MCP server testing playground. Test tools, resources, and prompts in real-time.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCP Playground | github-to-mcp',
    description: 'Interactive MCP server testing playground. Test tools, resources, and prompts in real-time.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
};

interface PlaygroundV2LayoutProps {
  children: ReactNode;
}

export default function PlaygroundV2Layout({ children }: PlaygroundV2LayoutProps) {
  return (
    <PlaygroundV2Providers>
      {children}
    </PlaygroundV2Providers>
  );
}
