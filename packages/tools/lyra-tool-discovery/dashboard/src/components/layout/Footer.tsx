'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Github, Twitter, MessageCircle, Heart, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SOCIAL_LINKS } from '@/lib/constants';

const footerLinks = {
  product: [
    { label: 'Features', href: '/#features' },
    { label: 'Templates', href: '/templates' },
    { label: 'Discover', href: '/discover' },
    { label: 'Pricing', href: '#' },
  ],
  resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/docs/api' },
    { label: 'CLI Guide', href: '/docs/cli' },
    { label: 'Examples', href: 'https://github.com/nirholas/lyra-tool-discovery/tree/main/examples', external: true },
  ],
  community: [
    { label: 'GitHub', href: SOCIAL_LINKS.github, external: true },
    { label: 'Discord', href: SOCIAL_LINKS.discord, external: true },
    { label: 'Twitter', href: SOCIAL_LINKS.twitter, external: true },
    { label: 'Contributing', href: 'https://github.com/nirholas/lyra-tool-discovery/blob/main/CONTRIBUTING.md', external: true },
  ],
};

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/10 bg-background">
      {/* Gradient decoration */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <span className="text-black font-bold text-lg">L</span>
              </div>
              <span className="text-xl font-bold gradient-text">Lyra</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              AI-powered MCP tool discovery for the plugin.delivery ecosystem.
            </p>
            <div className="flex items-center gap-3">
              <motion.a
                whileHover={{ scale: 1.1, y: -2 }}
                href={SOCIAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                aria-label="GitHub"
              >
                <Github size={18} />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1, y: -2 }}
                href={SOCIAL_LINKS.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={18} />
              </motion.a>
              <motion.a
                whileHover={{ scale: 1.1, y: -2 }}
                href={SOCIAL_LINKS.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                aria-label="Discord"
              >
                <MessageCircle size={18} />
              </motion.a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      'text-sm text-muted-foreground hover:text-white',
                      'transition-colors inline-flex items-center gap-1'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Resources</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className={cn(
                      'text-sm text-muted-foreground hover:text-white',
                      'transition-colors inline-flex items-center gap-1'
                    )}
                  >
                    {link.label}
                    {link.external && <ExternalLink size={10} />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Community</h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className={cn(
                      'text-sm text-muted-foreground hover:text-white',
                      'transition-colors inline-flex items-center gap-1'
                    )}
                  >
                    {link.label}
                    {link.external && <ExternalLink size={10} />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} Lyra Tool Discovery. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              Built with{' '}
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
              >
                <Heart size={14} className="text-pink-500 fill-pink-500" />
              </motion.span>{' '}
              for the MCP ecosystem
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { Footer };
