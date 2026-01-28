import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Agenti - Universal Crypto Payment Protocol',
  description: 'Accept any token on any chain. 55+ DEX aggregators, 89+ chains, real-time cross-chain swaps. Enterprise-grade crypto payments.',
  keywords: ['crypto', 'payments', 'blockchain', 'swap', 'DEX', 'cross-chain', 'USDC', 'merchant'],
  openGraph: {
    title: 'Agenti - Universal Crypto Payment Protocol',
    description: 'Accept any token on any chain with instant conversion to USDC.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-black text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
