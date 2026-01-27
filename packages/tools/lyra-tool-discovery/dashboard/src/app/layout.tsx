import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Lyra - AI-Powered MCP Tool Discovery',
    template: '%s | Lyra Tool Discovery',
  },
  description:
    'Discover, analyze, and configure Model Context Protocol (MCP) tools from GitHub and npm using AI. Automatically generate plugin configurations for plugin.delivery ecosystem.',
  keywords: [
    'MCP',
    'Model Context Protocol',
    'AI tools',
    'plugin discovery',
    'GitHub',
    'npm',
    'OpenAI',
    'Anthropic',
    'CLI',
    'plugin.delivery',
  ],
  authors: [{ name: 'Lyra Team' }],
  creator: 'Lyra Tool Discovery',
  publisher: 'Lyra',
  metadataBase: new URL('https://lyra.dev'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://lyra.dev',
    siteName: 'Lyra Tool Discovery',
    title: 'Lyra - AI-Powered MCP Tool Discovery',
    description:
      'Discover, analyze, and configure Model Context Protocol (MCP) tools from GitHub and npm using AI.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Lyra Tool Discovery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lyra - AI-Powered MCP Tool Discovery',
    description:
      'Discover, analyze, and configure Model Context Protocol (MCP) tools from GitHub and npm using AI.',
    images: ['/og-image.png'],
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
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <div className="relative min-h-screen flex flex-col bg-background text-foreground">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
