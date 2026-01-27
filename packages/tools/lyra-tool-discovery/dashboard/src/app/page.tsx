'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Hero } from '@/components/home/Hero';
import { Features } from '@/components/home/Features';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TemplateShowcase } from '@/components/home/TemplateShowcase';
import { QuickStart } from '@/components/home/QuickStart';
import { Stats } from '@/components/home/Stats';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <Hero />

      {/* Features Grid */}
      <Features />

      {/* How It Works Timeline */}
      <HowItWorks />

      {/* Template Showcase */}
      <TemplateShowcase />

      {/* Quick Start / Installation */}
      <QuickStart />

      {/* Stats Section */}
      <Stats />

      {/* Final CTA Section */}
      <section className="py-24 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-neutral-500/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-headline mb-6">
              Ready to <span className="gradient-text">discover</span>?
            </h2>
            <p className="text-body-lg text-muted-foreground mb-10">
              Join developers who are using Lyra to discover and integrate MCP tools 
              faster than ever. Start discovering today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/discover">
                <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                  Try It Now
                </Button>
              </Link>
              <Link href="/templates">
                <Button variant="outline" size="lg">
                  Explore Templates
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
