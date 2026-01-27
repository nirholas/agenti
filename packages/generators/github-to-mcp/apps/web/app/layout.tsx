import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

const siteUrl = 'https://github-to-mcp.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'GitHub to MCP | Convert Any Repo to MCP Server in Seconds',
    template: '%s | GitHub to MCP',
  },
  description: 'Convert any GitHub repository into a Model Context Protocol (MCP) server. Give Claude, ChatGPT, Cursor, and other AI assistants instant access to any codebase. Zero config, works in seconds.',
  keywords: [
    'MCP',
    'Model Context Protocol',
    'Claude',
    'ChatGPT',
    'Cursor',
    'AI tools',
    'GitHub',
    'MCP server',
    'AI assistant',
    'code assistant',
    'Anthropic',
    'OpenAI',
    'Windsurf',
    'Cline',
    'vibe coding',
  ],
  authors: [{ name: 'nirholas', url: 'https://github.com/nirholas' }],
  creator: 'nirholas',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'GitHub to MCP',
    title: 'GitHub to MCP | Convert Any Repo to MCP Server',
    description: 'Give Claude, ChatGPT, Cursor instant access to any GitHub codebase. Paste URL → Get MCP server → AI can read files, search code, use APIs.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GitHub to MCP - Convert repos to MCP servers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitHub to MCP | Convert Any Repo to MCP Server',
    description: 'Give Claude, ChatGPT, Cursor instant access to any GitHub codebase. Zero config, works in seconds.',
    images: ['/og-image.png'],
    creator: '@nirholas',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'GitHub to MCP',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    description: 'Convert any GitHub repository into a Model Context Protocol (MCP) server for AI assistants.',
    url: 'https://github-to-mcp.vercel.app',
    downloadUrl: 'https://www.npmjs.com/package/@nirholas/github-to-mcp',
    author: { '@type': 'Person', name: 'nirholas' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-dark-900 antialiased">
        {/* Skip link for keyboard users */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <div className="fixed inset-0 grid-bg pointer-events-none" aria-hidden="true" />
        <div className="fixed inset-0 hex-pattern pointer-events-none" aria-hidden="true" />
        <div className="relative z-10">
          <Providers>
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
