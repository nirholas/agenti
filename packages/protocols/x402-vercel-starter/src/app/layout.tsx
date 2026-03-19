import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "x402 AI Starter Kit",
  description:
    "A demo of agentic payments powered by x402 using Next.js, AI SDK, AI Elements, AI Gateway, and the Coinbase CDP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <div className="size-full flex flex-col">
          <header className={`${geistSans.className} border-b border-black`}>
            <div className="flex flex-col gap-2 w-full">
              <div className="flex flex-row gap-2 text-xl font-bold items-center justify-center">
                <Link
                  href="https://github.com/vercel-labs/x402-ai-starter"
                  className="underline"
                >
                  <h1>x402 AI Starter Kit</h1>
                </Link>{" "}
                -
                <h2>
                  powered by:{" "}
                  <Link href="https://nextjs.org" className="underline">
                    Next.js
                  </Link>
                  ,{" "}
                  <Link href="https://ai-sdk.dev" className="underline">
                    AI SDK
                  </Link>
                  ,{" "}
                  <Link
                    href="https://vercel.com/ai-gateway"
                    className="underline"
                  >
                    AI Gateway
                  </Link>
                  ,{" "}
                  <Link
                    href="https://ai-sdk.dev/elements/overview"
                    className="underline"
                  >
                    AI Elements
                  </Link>
                  , and the{" "}
                  <Link
                    href="https://docs.cdp.coinbase.com/"
                    className="underline"
                  >
                    Coinbase CDP
                  </Link>
                </h2>
              </div>
              <div className="w-full flex flex-row items-center justify-center py-1">
                <div className="flex flex-row gap-5 items-center">
                  <Link href="/" className="underline">
                    Chat with paid remote MCP tools
                  </Link>
                  <Link href="/playground" className="underline">
                    Paid API playground
                  </Link>
                  <Link href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fx402-ai-starter&env=CDP_API_KEY_ID,CDP_API_KEY_SECRET,CDP_WALLET_SECRET&envDescription=Coinbase%20Developer%20Platform%20credentials%20are%20needed%20to%20create%20and%20fund%20server%20wallets&envLink=https%3A%2F%2Fdocs.cdp.coinbase.com%2Fapi-reference%2Fv2%2Fauthentication&project-name=x402-ai-starter&repository-name=x402-ai-starter&demo-title=x402%20AI%20Starter&demo-description=A%20fullstack%20template%20for%20using%20x402%20with%20MCP%20and%20AI%20SDK&demo-url=https%3A%2F%2Fx402-ai-starter.labs.vercel.dev%2F&demo-image=https%3A%2F%2Fx402-ai-starter.labs.vercel.dev%2Fscreenshot.png">
                    <img
                      src="https://vercel.com/button"
                      alt="Deploy with Vercel"
                    />
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
