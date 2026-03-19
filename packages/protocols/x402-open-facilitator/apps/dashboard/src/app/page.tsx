'use client';

import Link from 'next/link';
import { ArrowRight, Globe, Github, Check, Copy, Zap, Code, Sparkles, ShieldCheck, Shield, Link2, Bell } from 'lucide-react';
import { useState } from 'react';
import { Navbar } from '@/components/navbar';

const FREE_ENDPOINT = 'https://pay.openfacilitator.io';

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-medium"
    >
      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
      {label || (copied ? 'Copied!' : 'Copy URL')}
    </button>
  );
}

function GetStartedButton({ className }: { className?: string }) {
  // Always go to dashboard - it handles auth redirect and facilitator creation
  return (
    <Link href="/dashboard" className={className}>
      Get Started
    </Link>
  );
}

export default function Home() {
  const [codeTab, setCodeTab] = useState<'sdk' | 'hono' | 'express' | 'claude'>('express');

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-grid scroll-smooth">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6 text-foreground">
            Launch <span className="text-primary">your own</span> <span className="whitespace-nowrap">x402 facilitator</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Start free. Add your domain when you&apos;re ready.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => scrollTo('integration')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors font-medium"
            >
              Try free
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollTo('pricing')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-secondary transition-colors font-medium"
            >
              Get your domain
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Trust indicators */}
      <section className="py-12 px-6 border-y border-border bg-secondary/30">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-8 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <span className="font-medium">EVM + Solana</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-medium">x402 v2</span>
          </div>
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-primary" />
            <span className="font-medium">Apache 2.0</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-medium">No Rate Limits</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-medium">Refund Protection</span>
          </div>
        </div>
      </section>

      {/* Instant Integration */}
      <section id="integration" className="py-20 px-6 bg-background">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Or just use ours
          </h2>
          <p className="text-muted-foreground text-center text-balance mb-12 max-w-xl mx-auto">
            Completely free. Start accepting payments in&nbsp;seconds. Offer refund protection to your users.
          </p>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <span className="text-gray-900 dark:text-gray-100 flex-1 font-mono text-sm sm:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
              pay.openfacilitator.io
            </span>
            <CopyButton text={FREE_ENDPOINT} />
          </div>

          {/* Refund Protection callout */}
          <Link
            href="/refunds/setup?facilitator=pay.openfacilitator.io"
            className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <Shield className="w-4 h-4 text-primary" />
            <span>
              <span className="font-medium text-foreground group-hover:text-primary transition-colors">Refund Protection Available</span>
              {' — '}Automatically refund users when API calls fail
            </span>
            <ArrowRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
          </Link>

          {/* Quick code example with tabs */}
          <div className="mt-6 rounded-xl bg-[#0d1117] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-[#161b22]">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27ca40]"></div>
                </div>
                <span className="text-xs text-muted-foreground ml-2">
                  {codeTab === 'claude' ? '' : codeTab === 'sdk' ? 'example.ts' : 'server.ts'}
                </span>
              </div>
              <div className="flex gap-1 bg-[#0d1117] rounded-md p-0.5">
                <button
                  onClick={() => setCodeTab('express')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    codeTab === 'express'
                      ? 'bg-[#30363d] text-[#c9d1d9]'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'
                  }`}
                >
                  Express
                </button>
                <button
                  onClick={() => setCodeTab('hono')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    codeTab === 'hono'
                      ? 'bg-[#30363d] text-[#c9d1d9]'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'
                  }`}
                >
                  Hono
                </button>
                <button
                  onClick={() => setCodeTab('sdk')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    codeTab === 'sdk'
                      ? 'bg-[#30363d] text-[#c9d1d9]'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setCodeTab('claude')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    codeTab === 'claude'
                      ? 'bg-[rgba(212,165,116,0.2)] text-[#e8c9a0]'
                      : 'text-[#d4a574] hover:bg-[rgba(212,165,116,0.1)] hover:text-[#e8c9a0]'
                  }`}
                >
                  Claude
                </button>
              </div>
            </div>
            {codeTab === 'claude' && (
              <pre className="p-4 text-sm overflow-x-auto font-mono leading-relaxed border-0 bg-transparent">
                <code className="text-[#c9d1d9]">
                  <span className="text-[#8b949e]">{"# Install the OpenFacilitator skill for Claude"}</span>
                  {"\n"}
                  <span className="text-[#d4a574]">$</span> npx <span className="text-[#ffa657]">skills</span> add rawgroundbeef/openfacilitator
                  {"\n\n"}
                  <span className="text-[#8b949e]">{"# Then just ask Claude:"}</span>
                  {"\n"}
                  <span className="text-[#8b949e]">{"# \"Add x402 USDC payments to my Hono server\""}</span>
                </code>
              </pre>
            )}
            {codeTab !== 'claude' && <pre className="p-4 text-sm overflow-x-auto font-mono leading-relaxed border-0 bg-transparent">
              {codeTab === 'hono' && (
                <code className="text-[#c9d1d9]">
                  <span className="text-[#ff7b72]">import</span>{" { "}
                  <span className="text-[#ffa657]">honoPaymentMiddleware</span>{" } "}
                  <span className="text-[#ff7b72]">from</span>
                  <span className="text-[#a5d6ff]">{" '@openfacilitator/sdk'"}</span>;
                  {"\n\n"}
                  app.<span className="text-[#d2a8ff]">post</span>(<span className="text-[#a5d6ff]">'/api/resource'</span>, <span className="text-[#d2a8ff]">honoPaymentMiddleware</span>({"{"}
                  {"\n"}  <span className="text-[#d2a8ff]">getRequirements</span>: () {"=>"} ({"{"}
                  {"\n"}    scheme: <span className="text-[#a5d6ff]">'exact'</span>,
                  {"\n"}    network: <span className="text-[#a5d6ff]">'base'</span>,
                  {"\n"}    maxAmountRequired: <span className="text-[#a5d6ff]">'1000000'</span>,
                  {"\n"}    asset: <span className="text-[#a5d6ff]">'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'</span>,
                  {"\n"}    payTo: <span className="text-[#a5d6ff]">'0xYourAddress'</span>,
                  {"\n"}  {"}"}),
                  {"\n"}  <span className="text-[#d2a8ff]">refundProtection</span>: {"{"}
                  {"\n"}    apiKey: process.env.<span className="text-[#79c0ff]">REFUND_API_KEY</span>,
                  {"\n"}  {"}"},
                  {"\n"}{"}"}), <span className="text-[#ff7b72]">async</span> (c) {"=>"} {"{"}
                  {"\n"}  <span className="text-[#8b949e]">{"// Payment verified & settled automatically"}</span>
                  {"\n"}  <span className="text-[#ff7b72]">return</span> c.<span className="text-[#d2a8ff]">json</span>({"{"} success: <span className="text-[#79c0ff]">true</span> {"}"});
                  {"\n"}{"}"});
                </code>
              )}
              {codeTab === 'express' && (
                <code className="text-[#c9d1d9]">
                  <span className="text-[#ff7b72]">import</span>{" { "}
                  <span className="text-[#ffa657]">createPaymentMiddleware</span>{" } "}
                  <span className="text-[#ff7b72]">from</span>
                  <span className="text-[#a5d6ff]">{" '@openfacilitator/sdk'"}</span>;
                  {"\n\n"}
                  <span className="text-[#ff7b72]">const</span> paymentMiddleware = <span className="text-[#d2a8ff]">createPaymentMiddleware</span>({"{"}
                  {"\n"}  <span className="text-[#d2a8ff]">getRequirements</span>: () {"=>"} ({"{"}
                  {"\n"}    scheme: <span className="text-[#a5d6ff]">'exact'</span>,
                  {"\n"}    network: <span className="text-[#a5d6ff]">'base'</span>,
                  {"\n"}    maxAmountRequired: <span className="text-[#a5d6ff]">'1000000'</span>,
                  {"\n"}    asset: <span className="text-[#a5d6ff]">'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'</span>,
                  {"\n"}    payTo: <span className="text-[#a5d6ff]">'0xYourAddress'</span>,
                  {"\n"}  {"}"}),
                  {"\n"}  <span className="text-[#d2a8ff]">refundProtection</span>: {"{"}
                  {"\n"}    apiKey: process.env.<span className="text-[#79c0ff]">REFUND_API_KEY</span>,
                  {"\n"}  {"}"},
                  {"\n"}{"}"});
                  {"\n\n"}
                  app.<span className="text-[#d2a8ff]">post</span>(<span className="text-[#a5d6ff]">'/api/resource'</span>, paymentMiddleware, <span className="text-[#ff7b72]">async</span> (req, res) {"=>"} {"{"}
                  {"\n"}  <span className="text-[#8b949e]">{"// Payment verified & settled automatically"}</span>
                  {"\n"}  res.<span className="text-[#d2a8ff]">json</span>({"{"} success: <span className="text-[#79c0ff]">true</span> {"}"});
                  {"\n"}{"}"});
                </code>
              )}
              {codeTab === 'sdk' && (
                <code className="text-[#c9d1d9]">
                  <span className="text-[#ff7b72]">import</span>{" { "}
                  <span className="text-[#ffa657]">OpenFacilitator</span>, <span className="text-[#ffa657]">reportFailure</span>{" } "}
                  <span className="text-[#ff7b72]">from</span>
                  <span className="text-[#a5d6ff]">{" '@openfacilitator/sdk'"}</span>;
                  {"\n\n"}
                  <span className="text-[#ff7b72]">const</span> facilitator = <span className="text-[#ff7b72]">new</span> <span className="text-[#ffa657]">OpenFacilitator</span>(<span className="text-[#a5d6ff]">'pay.openfacilitator.io'</span>);
                  {"\n"}
                  <span className="text-[#ff7b72]">const</span> {"{"} isValid {"}"} = <span className="text-[#ff7b72]">await</span> facilitator.<span className="text-[#d2a8ff]">verify</span>(payment, requirements);
                  {"\n"}
                  <span className="text-[#ff7b72]">const</span> {"{"} transaction {"}"} = <span className="text-[#ff7b72]">await</span> facilitator.<span className="text-[#d2a8ff]">settle</span>(payment, requirements);
                  {"\n\n"}
                  <span className="text-[#8b949e]">{"// On failure, report for refund"}</span>
                  {"\n"}
                  <span className="text-[#ff7b72]">await</span> <span className="text-[#d2a8ff]">reportFailure</span>({"{"} apiKey: process.env.<span className="text-[#79c0ff]">REFUND_API_KEY</span>, ...payment {"}"});
                </code>
              )}
            </pre>}
          </div>

          <div className="flex items-center justify-center gap-8 mt-8">
            <Link
              href="/docs"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Documentation
            </Link>
            <Link
              href="https://github.com/rawgroundbeef/openfacilitator"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              View Source
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            How it works
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
            x402 is an open standard for web payments. The facilitator handles the blockchain stuff.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative p-6 rounded-2xl bg-background border border-border">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
              <Code className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Add to your app</h3>
              <p className="text-muted-foreground">
                Point your x402 client at the free endpoint. One line of config.
              </p>
            </div>
            <div className="relative p-6 rounded-2xl bg-background border border-border">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
              <Sparkles className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">User pays</h3>
              <p className="text-muted-foreground">
                User signs a payment with their wallet. No gas fees for users.
              </p>
            </div>
            <div className="relative p-6 rounded-2xl bg-background border border-border">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
              <ShieldCheck className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Facilitator settles</h3>
              <p className="text-muted-foreground">
                We verify and submit the transaction. Funds go directly to your wallet.
              </p>
            </div>
          </div>

          {/* Custom domain CTA */}
          <div className="mt-16 p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl text-center max-w-xl mx-auto border border-primary/20">
            <h3 className="text-lg font-semibold mb-2">
              Ready for your own domain?
            </h3>
            <p className="text-muted-foreground mb-4 text-balance">
              Get your volume tracked on x402 leaderboards, professional branding at pay.yourdomain.com, and full control.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              Get your domain — $5/mo
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Payment Links & Webhooks */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Built for builders
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Everything you need to monetize your app or API.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Payment Links */}
            <div className="p-6 rounded-2xl bg-background border border-border flex flex-col">
              <Link2 className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Payment Links</h3>
              <p className="text-muted-foreground mb-4">
                Shareable URLs that accept payments. Works for humans (clean UI) and AI agents (x402 protocol) — same link.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground mb-4 flex-1">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  No code required
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  Custom amounts or fixed pricing
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  Works with any wallet
                </li>
              </ul>
              <Link href="/dashboard" className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1">
                Create a payment link <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Webhooks */}
            <div className="p-6 rounded-2xl bg-background border border-border flex flex-col">
              <Bell className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Webhooks</h3>
              <p className="text-muted-foreground mb-4">
                Get notified instantly when payments complete. Automate fulfillment, unlock content, or trigger any workflow.
              </p>
              <div className="bg-[#0d1117] rounded-lg p-3 mb-4 font-mono text-xs overflow-x-auto flex-1">
                <div className="text-[#8b949e]">// Your webhook receives</div>
                <div><span className="text-[#ff7b72]">{"{"}</span></div>
                <div className="pl-3"><span className="text-[#7ee787]">"event"</span>: <span className="text-[#a5d6ff]">"payment.completed"</span>,</div>
                <div className="pl-3"><span className="text-[#7ee787]">"amount"</span>: <span className="text-[#a5d6ff]">"5.00"</span>,</div>
                <div className="pl-3"><span className="text-[#7ee787]">"payer"</span>: <span className="text-[#a5d6ff]">"0x..."</span></div>
                <div><span className="text-[#ff7b72]">{"}"}</span></div>
              </div>
              <Link href="/dashboard" className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1">
                Set up webhooks <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Refund Protection */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-4xl mx-auto text-center">
          <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">
            Stand out with refund protection
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
            Differentiate yourself in the x402 ecosystem. When your API fails after payment, automatically refund your users. Build trust and reduce support burden.
          </p>
          <Link
            href="/refunds/setup?facilitator=pay.openfacilitator.io"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Set up refund protection
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Discovery */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            x402 Discovery Built In
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto text-balance">
            We&apos;ve partnered with trusted x402 marketplaces like{' '}
            <a href="https://x402.jobs" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              x402.jobs
            </a>{' '}
            to give your facilitator access to discoverable, verified endpoints out of the box. Your agents can find paid APIs programmatically.
          </p>

          <a
            href="https://api.openfacilitator.io/discovery/resources"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 mb-6 hover:border-primary/50 transition-colors group"
          >
            <code className="text-gray-900 dark:text-gray-100 font-mono text-sm sm:text-base">
              GET /discovery/resources
            </code>
            <span className="text-muted-foreground group-hover:text-primary transition-colors text-sm flex items-center gap-1">
              View <ArrowRight className="w-4 h-4" />
            </span>
          </a>

          <p className="text-sm text-muted-foreground text-center">
            Hundreds of verified x402-enabled APIs with payment requirements. No auth needed.{' '}
            <Link href="/docs" className="text-primary hover:underline">
              See the docs →
            </Link>
          </p>
        </div>
      </section>

      {/* Make It Yours (Pricing) */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Your brand. Your facilitator.</h2>
          <p className="text-muted-foreground text-center mb-8 max-w-xl mx-auto">
            Show up in x402scan. Build trust with your users.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <div className="p-6 rounded-2xl bg-secondary/30 border border-border">
              <h3 className="text-lg font-semibold mb-2">Free</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted-foreground">/forever</span>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Shared endpoint
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  EVM + Solana mainnet
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  No account needed
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Unlimited requests
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <Link href="/rewards" className="hover:text-primary transition-colors">
                    Earn $OPEN rewards
                  </Link>
                </li>
              </ul>
              <GetStartedButton
                className="block w-full py-2.5 rounded-lg border border-border hover:bg-secondary text-center font-medium transition-colors text-sm"
              />
            </div>

            {/* Starter */}
            <div className="p-6 rounded-2xl bg-background border-2 border-primary">
              <h3 className="text-lg font-semibold mb-2">Starter</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold">$5</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Your own custom domain
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  pay.yourdomain.com
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Dashboard & analytics
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Manage your keys
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <Link href="/rewards" className="hover:text-primary transition-colors">
                    Earn $OPEN rewards (2x bonus)
                  </Link>
                </li>
              </ul>
              <GetStartedButton
                className="block w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-center font-medium hover:bg-primary/90 transition-colors text-sm"
              />
            </div>
          </div>

          <p className="text-center text-sm text-gray-600 mt-10">
            Want full control? It&apos;s open source.{' '}
            <Link href="https://github.com/rawgroundbeef/openfacilitator" className="hover:text-gray-900 transition-colors">
              View on GitHub &rarr;
            </Link>
          </p>
        </div>
      </section>

      {/* Endpoints Reference */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">API Reference</h2>
          <p className="text-muted-foreground text-center mb-12">
            Four endpoints. That&apos;s all you need.
          </p>

          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 rounded text-xs font-bold bg-gray-500/20 text-gray-500">GET</span>
                <code className="text-sm font-mono">/supported</code>
              </div>
              <p className="text-sm text-muted-foreground">Returns supported networks and tokens</p>
            </div>

            <div className="p-5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 rounded text-xs font-bold bg-gray-500/20 text-gray-500">GET</span>
                <code className="text-sm font-mono">/discovery/resources</code>
              </div>
              <p className="text-sm text-muted-foreground">Discover x402-enabled APIs from trusted marketplaces</p>
            </div>

            <div className="p-5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-sm font-mono">/verify</code>
              </div>
              <p className="text-sm text-muted-foreground">Verify a payment signature is valid</p>
            </div>

            <div className="p-5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400">POST</span>
                <code className="text-sm font-mono">/settle</code>
              </div>
              <p className="text-sm text-muted-foreground">Submit the transaction to the blockchain</p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              Full documentation
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          {/* Main footer row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <img src="/icon.svg" alt="" className="w-6 h-6" />
              <span className="font-semibold">OpenFacilitator</span>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-5">
              <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                Docs
              </Link>
              <a href="https://x.com/openfacilitator" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="X (Twitter)">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://discord.gg/26Rhd85DPn" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Discord">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a href="https://t.me/OpenFacilitator" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Telegram">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
              <a href="https://github.com/rawgroundbeef/openfacilitator" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Secondary info */}
          <div className="mt-6 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
            <span>Apache 2.0</span>
            <span className="hidden sm:inline">·</span>
            <a
              href="https://www.coingecko.com/en/coins/openfacilitator"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-foreground transition-colors"
            >
              cpbq...open
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
