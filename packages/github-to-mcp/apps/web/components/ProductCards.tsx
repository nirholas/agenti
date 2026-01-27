/**
 * Product Cards Component - Landing page feature cards
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Github, Terminal, FileJson, BookOpen, Layers, Play, Sparkles, Cloud } from 'lucide-react';
import Link from 'next/link';

const PRODUCTS = [
  {
    id: 'convert',
    icon: Github,
    title: 'Convert Repository',
    description: 'Transform any GitHub repo into a fully functional MCP server. Extracts tools from README, code, and API specs.',
    href: '/convert',
    badge: 'Popular',
    badgeColor: 'bg-green-500/20 text-green-300',
    features: ['Auto-detection', 'TypeScript & Python', 'Ready configs'],
  },
  {
    id: 'playground',
    icon: Play,
    title: 'Interactive Playground',
    description: 'Test your generated MCP tools in real-time. Execute tools, view results, and debug before deployment.',
    href: '/playground',
    badge: 'Try It',
    badgeColor: 'bg-orange-500/20 text-orange-300',
    features: ['Live testing', 'Real-time results', 'Debug mode'],
  },
  {
    id: 'dashboard',
    icon: Cloud,
    title: 'Cloud Deploy',
    description: 'One-click deploy your MCP server to the cloud. Get instant endpoints, usage analytics, and API management.',
    href: '/dashboard',
    badge: 'New',
    badgeColor: 'bg-pink-500/20 text-pink-300',
    features: ['Instant deploy', 'Usage dashboard', 'API keys'],
  },
  {
    id: 'batch',
    icon: Layers,
    title: 'Batch Convert',
    description: 'Convert multiple repositories at once. Perfect for teams or creating comprehensive tool collections.',
    href: '/batch',
    badge: 'New',
    badgeColor: 'bg-purple-500/20 text-purple-300',
    features: ['Multiple repos', 'Parallel processing', 'Bulk export'],
  },
  {
    id: 'vscode',
    icon: Sparkles,
    title: 'VS Code Extension',
    description: 'Convert repos directly from VS Code. Right-click any GitHub URL or use the command palette.',
    href: 'https://marketplace.visualstudio.com/items?itemName=nirholas.github-to-mcp',
    badge: 'Extension',
    badgeColor: 'bg-blue-500/20 text-blue-300',
    features: ['One-click convert', 'Inline results', 'Auto-config'],
    external: true,
  },
  {
    id: 'cli',
    icon: Terminal,
    title: 'CLI Tool',
    description: 'Use the command-line tool for local development and CI/CD integration. Full control over the conversion process.',
    href: 'https://github.com/nirholas/github-to-mcp#cli',
    badge: 'Dev',
    badgeColor: 'bg-cyan-500/20 text-cyan-300',
    features: ['npm install', 'CI/CD ready', 'Batch processing'],
    external: true,
  },
  {
    id: 'api',
    icon: FileJson,
    title: 'REST API',
    description: 'Programmatic access to the conversion engine. Build custom integrations and automated workflows.',
    href: 'https://github.com/nirholas/github-to-mcp#api',
    badge: null,
    badgeColor: '',
    features: ['JSON responses', 'Rate limited', 'OpenAPI spec'],
    external: true,
  },
  {
    id: 'docs',
    icon: BookOpen,
    title: 'Documentation',
    description: 'Learn how to use github-to-mcp effectively. Guides, examples, and best practices.',
    href: 'https://github.com/nirholas/github-to-mcp#readme',
    badge: null,
    badgeColor: '',
    features: ['Getting started', 'Examples', 'FAQ'],
    external: true,
  },
];

export default function ProductCards() {
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-white mb-4"
        >
          All Tools & Features
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg text-neutral-400 max-w-2xl mx-auto"
        >
          Convert GitHub repos to MCP servers, test interactively, and deploy
        </motion.p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {PRODUCTS.map((product, index) => {
          const CardWrapper = product.external ? 'a' : Link;
          const cardProps = product.external 
            ? { href: product.href, target: '_blank', rel: 'noopener noreferrer' }
            : { href: product.href };

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <CardWrapper
                {...cardProps}
                className="group block h-full rounded-xl border border-neutral-800 p-6 bg-neutral-900/50 backdrop-blur-sm hover:border-neutral-600 hover:bg-neutral-900/80 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-neutral-800 flex items-center justify-center group-hover:border-neutral-600 group-hover:bg-white/10 transition-all">
                    <product.icon className="w-6 h-6 text-white" />
                  </div>
                  {product.badge && (
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${product.badgeColor}`}>
                      {product.badge}
                    </span>
                  )}
                </div>
                
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-white transition-colors flex items-center gap-2">
                  {product.title}
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </h3>
                
                <p className="text-neutral-400 text-sm mb-4 leading-relaxed">
                  {product.description}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {product.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-1 text-xs bg-white/5 border border-neutral-800 rounded text-neutral-400"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </CardWrapper>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
