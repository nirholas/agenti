'use client';

import { motion } from 'framer-motion';
import { Search, Brain, Rocket } from 'lucide-react';

const steps = [
  {
    number: 1,
    title: 'Discover',
    description: 'AI scans GitHub repositories and npm packages to find MCP-compatible servers and tools.',
    icon: Search,
    color: 'light',
  },
  {
    number: 2,
    title: 'Analyze',
    description: 'Intelligent analysis determines the optimal plugin template based on code structure and patterns.',
    icon: Brain,
    color: 'medium',
  },
  {
    number: 3,
    title: 'Generate',
    description: 'Automatically creates ready-to-use plugin configurations for plugin.delivery ecosystem.',
    icon: Rocket,
    color: 'dark',
  },
];

const colorClasses = {
  light: {
    bg: 'bg-white/10',
    border: 'border-white/20',
    text: 'text-white',
    glow: 'shadow-white/10',
  },
  medium: {
    bg: 'bg-neutral-500/20',
    border: 'border-neutral-500/30',
    text: 'text-neutral-300',
    glow: 'shadow-neutral-500/10',
  },
  dark: {
    bg: 'bg-neutral-700/30',
    border: 'border-neutral-600/40',
    text: 'text-neutral-400',
    glow: 'shadow-neutral-600/10',
  },
};

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-dots opacity-30" />

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
            How it <span className="gradient-text">works</span>
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to discover and configure MCP tools for your projects.
          </p>
        </motion.div>

        {/* Steps timeline */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-white/30 via-neutral-500/30 to-neutral-700/30 hidden md:block" />

            {/* Steps */}
            <div className="space-y-12 md:space-y-24">
              {steps.map((step, index) => {
                const colors = colorClasses[step.color as keyof typeof colorClasses];
                const Icon = step.icon;
                const isEven = index % 2 === 0;

                return (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.2 }}
                    className={`flex flex-col md:flex-row items-center gap-8 ${
                      isEven ? 'md:flex-row' : 'md:flex-row-reverse'
                    }`}
                  >
                    {/* Content */}
                    <div className={`flex-1 text-center ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="inline-block"
                      >
                        <div className="glass rounded-2xl p-6 md:p-8">
                          <div className={`text-sm font-bold ${colors.text} mb-2`}>
                            Step {step.number}
                          </div>
                          <h3 className="text-xl md:text-2xl font-bold text-white mb-3">
                            {step.title}
                          </h3>
                          <p className="text-muted-foreground">
                            {step.description}
                          </p>
                        </div>
                      </motion.div>
                    </div>

                    {/* Center icon */}
                    <div className="relative z-10">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className={`
                          w-16 h-16 md:w-20 md:h-20 rounded-2xl
                          ${colors.bg} ${colors.border} border
                          flex items-center justify-center
                          shadow-lg ${colors.glow}
                        `}
                      >
                        <Icon className={`w-8 h-8 md:w-10 md:h-10 ${colors.text}`} />
                      </motion.div>
                      
                      {/* Number badge */}
                      <div className={`
                        absolute -top-2 -right-2 w-6 h-6 rounded-full
                        ${colors.bg} ${colors.border} border
                        flex items-center justify-center
                        text-xs font-bold ${colors.text}
                      `}>
                        {step.number}
                      </div>
                    </div>

                    {/* Empty space for alternating layout */}
                    <div className="flex-1 hidden md:block" />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { HowItWorks };
