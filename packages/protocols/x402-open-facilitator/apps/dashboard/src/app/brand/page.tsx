'use client';

import { useState } from 'react';
import { Navbar } from '@/components/navbar';
import { Download, Check, Copy, ExternalLink } from 'lucide-react';

const BADGES = [
  {
    name: 'Refund Protected',
    description: 'Standard badge - blue background',
    variants: [
      { size: 'Small (32px)', file: 'refund-protected-sm.svg', width: 128, height: 32 },
      { size: 'Medium (44px)', file: 'refund-protected.svg', width: 180, height: 44 },
      { size: 'Large (56px)', file: 'refund-protected-lg.svg', width: 230, height: 56 },
    ],
  },
  {
    name: 'Refund Protected (Dark)',
    description: 'For dark backgrounds - white background',
    variants: [
      { size: 'Small (32px)', file: 'refund-protected-dark-sm.svg', width: 128, height: 32 },
      { size: 'Medium (44px)', file: 'refund-protected-dark.svg', width: 180, height: 44 },
      { size: 'Large (56px)', file: 'refund-protected-dark-lg.svg', width: 230, height: 56 },
    ],
  },
  {
    name: 'Shield Icon',
    description: 'Minimal shield icon only',
    variants: [
      { size: '36x36', file: 'shield-icon.svg', width: 36, height: 36 },
      { size: '36x36 (Dark)', file: 'shield-icon-dark.svg', width: 36, height: 36 },
    ],
  },
];

const COLORS = [
  { name: 'Primary Blue', hex: '#0B64F4', hsl: 'hsl(217, 91%, 50%)' },
  { name: 'White', hex: '#FFFFFF', hsl: 'hsl(0, 0%, 100%)' },
  { name: 'Dark', hex: '#0F172A', hsl: 'hsl(222, 47%, 11%)' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-secondary rounded transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

function BadgePreview({ file, width, height, darkBg }: { file: string; width: number; height: number; darkBg?: boolean }) {
  return (
    <div className={`p-6 rounded-lg border ${darkBg ? 'bg-slate-900' : 'bg-secondary/30'} flex items-center justify-center min-h-[100px]`}>
      <img src={`/badges/${file}`} alt={file} width={width} height={height} />
    </div>
  );
}

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-grid">
      <Navbar />

      <main className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Brand Kit</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Download official OpenFacilitator badges to show your resources are refund protected.
            </p>
          </div>

          {/* Badges Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Badges</h2>

            {BADGES.map((badge) => (
              <div key={badge.name} className="mb-8 p-6 bg-card rounded-xl border">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">{badge.name}</h3>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {badge.variants.map((variant) => (
                    <div key={variant.file} className="flex items-center gap-4">
                      <BadgePreview
                        file={variant.file}
                        width={variant.width}
                        height={variant.height}
                        darkBg={badge.name.includes('Dark')}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{variant.size}</p>
                        <p className="text-sm text-muted-foreground">{variant.file}</p>
                      </div>
                      <a
                        href={`/badges/${variant.file}`}
                        download={variant.file}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* Colors Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Colors</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLORS.map((color) => (
                <div key={color.name} className="p-4 bg-card rounded-xl border">
                  <div
                    className="w-full h-20 rounded-lg mb-4 border"
                    style={{ backgroundColor: color.hex }}
                  />
                  <h3 className="font-medium mb-2">{color.name}</h3>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">HEX</span>
                      <div className="flex items-center gap-1">
                        <code className="font-mono">{color.hex}</code>
                        <CopyButton text={color.hex} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">HSL</span>
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-xs">{color.hsl}</code>
                        <CopyButton text={color.hsl} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Usage Guidelines */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Usage Guidelines</h2>
            <div className="bg-card rounded-xl border p-6 space-y-4">
              <div>
                <h3 className="font-medium text-green-600 mb-2">Do</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Use the badge on resources that have refund protection enabled</li>
                  <li>Maintain minimum clear space around the badge</li>
                  <li>Use the dark variant on dark backgrounds</li>
                  <li>Link the badge to the verification page</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-red-600 mb-2">Don&apos;t</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Use the badge without actually having refund protection</li>
                  <li>Modify the badge colors or proportions</li>
                  <li>Use the badge smaller than minimum size (24px height)</li>
                  <li>Place the badge on busy backgrounds that reduce legibility</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Embed Script */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold mb-6">Embed Script</h2>
            <div className="bg-card rounded-xl border p-6">
              <p className="text-muted-foreground mb-4">
                Add the badge to your site automatically with our embed script:
              </p>
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto mb-4">
                <code>{`<script src="https://openfacilitator.io/badge.js" data-facilitator="your-domain.com"></script>`}</code>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Options via data attributes:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li><code className="text-slate-300">data-facilitator</code> - Your facilitator domain (required)</li>
                <li><code className="text-slate-300">data-size</code> - &quot;small&quot; | &quot;medium&quot; | &quot;large&quot; (default: medium)</li>
                <li><code className="text-slate-300">data-theme</code> - &quot;light&quot; | &quot;dark&quot; (default: light)</li>
              </ul>
            </div>
          </section>

          {/* Verification API */}
          <section>
            <h2 className="text-2xl font-semibold mb-6">Verification API</h2>
            <div className="bg-card rounded-xl border p-6">
              <p className="text-muted-foreground mb-4">
                Programmatically verify if a facilitator supports refunds:
              </p>
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto mb-4">
                <code>GET https://api.openfacilitator.io/api/verify?facilitator=your-domain.com</code>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Response:</p>
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto mb-4">
                <pre>{`{
  "verified": true,
  "supportsRefunds": true,
  "facilitator": "your-domain.com",
  "facilitatorName": "Your Facilitator",
  "badgeUrl": "https://openfacilitator.io/badges/refund-protected.svg"
}`}</pre>
              </div>
              <a
                href="/docs/api"
                className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
              >
                View API documentation
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
