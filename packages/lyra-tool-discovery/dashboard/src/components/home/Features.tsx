'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FEATURES } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/Card';

const colorClasses = {
  violet: 'from-white/10 to-white/[0.02] group-hover:from-white/15',
  cyan: 'from-neutral-400/15 to-neutral-400/[0.02] group-hover:from-neutral-400/20',
  pink: 'from-neutral-500/15 to-neutral-500/[0.02] group-hover:from-neutral-500/20',
  green: 'from-white/8 to-white/[0.02] group-hover:from-white/12',
  orange: 'from-neutral-600/15 to-neutral-600/[0.02] group-hover:from-neutral-600/20',
  blue: 'from-neutral-300/10 to-neutral-300/[0.02] group-hover:from-neutral-300/15',
};

const iconColorClasses = {
  violet: 'bg-white/15 text-white',
  cyan: 'bg-neutral-400/20 text-neutral-300',
  pink: 'bg-neutral-500/20 text-neutral-300',
  green: 'bg-white/10 text-white/80',
  orange: 'bg-neutral-600/20 text-neutral-400',
  blue: 'bg-neutral-300/15 text-neutral-200',
};

function Features() {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-headline mb-4">
            Everything you need for{' '}
            <span className="gradient-text">MCP discovery</span>
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features to streamline your MCP tool discovery and plugin configuration workflow.
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card
                className={cn(
                  'group h-full bg-gradient-to-br transition-all duration-300',
                  colorClasses[feature.color]
                )}
              >
                <CardContent className="p-6">
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
                      'text-2xl transition-transform duration-300 group-hover:scale-110',
                      iconColorClasses[feature.color]
                    )}
                  >
                    {feature.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { Features };
