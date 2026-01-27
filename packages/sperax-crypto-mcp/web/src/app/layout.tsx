import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sperax MCP — AI Gateway to Sperax DeFi",
  description: "Enable AI agents to interact with the Sperax DeFi ecosystem on Arbitrum. USDs stablecoin, veSPA governance, Demeter farms, and more.",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "Claude",
    "AI",
    "Sperax",
    "USDs",
    "SPA",
    "veSPA",
    "Arbitrum",
    "DeFi",
    "stablecoin",
    "yield",
    "Demeter",
    "governance",
    "crypto tools",
    "blockchain",
    "Web3",
  ],
  authors: [{ name: "Sperax", url: "https://github.com/Sperax" }],
  creator: "Sperax",
  publisher: "Sperax",
  metadataBase: new URL("https://mcp.sperax.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://mcp.sperax.io",
    siteName: "Sperax MCP",
    title: "Sperax MCP — AI Gateway to Sperax DeFi",
    description: "Enable AI agents to interact with Sperax DeFi on Arbitrum. USDs, veSPA, Demeter farms and more.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sperax MCP — AI Gateway to DeFi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sperax MCP — AI Gateway to DeFi",
    description: "Enable AI agents to interact with Sperax DeFi. USDs stablecoin, veSPA governance, Demeter farms.",
    creator: "@SperaxUSD",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  category: "technology",
};

// JSON-LD structured data for rich search results
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Sperax MCP",
  alternateName: "Sperax MCP Server",
  description: "Enable AI agents to interact with the Sperax DeFi ecosystem on Arbitrum. USDs, veSPA, Demeter farms and more.",
  url: "https://mcp.sperax.io",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Organization",
    name: "Sperax",
    url: "https://github.com/Sperax",
  },
  keywords: "MCP, Model Context Protocol, Claude, AI, Sperax, USDs, SPA, veSPA, Arbitrum, DeFi, stablecoin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
