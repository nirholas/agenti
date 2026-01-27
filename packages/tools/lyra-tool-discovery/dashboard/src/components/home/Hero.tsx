'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Github, Sparkles, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { SOCIAL_LINKS } from '@/lib/constants';

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Animated background */}
      <div className="absolute inset-0 gradient-bg opacity-50" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      
      {/* Floating decorative elements */}
      <motion.div
        className="absolute top-1/4 left-[10%] w-64 h-64 rounded-full bg-white/5 blur-3xl"
        animate={{
          y: [0, -30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-[10%] w-80 h-80 rounded-full bg-neutral-500/10 blur-3xl"
        animate={{
          y: [0, 30, 0],
          scale: [1.1, 1, 1.1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-neutral-700/10 blur-3xl"
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8"
          >
            <Sparkles size={16} className="text-white/60" />
            <span className="text-sm font-medium text-white/80">
              AI-Powered MCP Tool Discovery
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-display mb-6"
          >
            Discover MCP Tools{' '}
            <span className="gradient-text">with AI</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-body-lg text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Automatically discover, analyze, and configure Model Context Protocol servers 
            from GitHub and npm. Let AI determine the perfect plugin template for 
            seamless integration with plugin.delivery.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link href="/discover">
              <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                Get Started
              </Button>
            </Link>
            <Link href={SOCIAL_LINKS.github} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" leftIcon={<Github size={18} />}>
                View on GitHub
              </Button>
            </Link>
          </motion.div>

          {/* Terminal Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-white/5 via-neutral-500/10 to-white/5 rounded-2xl blur-xl opacity-50" />
              
              <div className="relative glass rounded-2xl overflow-hidden">
                {/* Terminal header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-white/40 font-mono flex items-center justify-center gap-2">
                      <Terminal size={12} />
                      lyra-discover
                    </span>
                  </div>
                </div>
                
                {/* Terminal content */}
                <div className="p-4 font-mono text-sm">
                  <div className="space-y-2">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="flex items-start gap-2"
                    >
                      <span className="text-green-400">$</span>
                      <span className="text-white">npx lyra-discover analyze-repo modelcontextprotocol/servers</span>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 }}
                      className="text-muted-foreground pl-4"
                    >
                      <div className="flex items-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: 3, ease: 'linear' }}
                          className="text-white/60"
                        >
                          ◌
                        </motion.span>
                        <span>Analyzing repository...</span>
                      </div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2 }}
                      className="space-y-1"
                    >
                      <div className="text-green-400">✓ Template detected: mcp-stdio</div>
                      <div className="text-white/70">✓ Confidence: 94%</div>
                      <div className="text-white/60">✓ Config generated successfully</div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2"
        >
          <motion.div className="w-1 h-2 rounded-full bg-white/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}

export { Hero };
