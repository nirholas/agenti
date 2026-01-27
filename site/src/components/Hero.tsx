import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-4xl mx-auto text-center">
        {/* Minimal badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-8"
        >
          <span className="text-ghost text-xs tracking-[0.3em] uppercase font-light">
            Model Context Protocol
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-glass glow-subtle text-7xl md:text-9xl font-light tracking-tight mb-8"
        >
          Agenti
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-ghost text-lg md:text-xl font-light max-w-md mx-auto mb-16 leading-relaxed"
        >
          Universal crypto intelligence for AI agents
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="https://github.com/nirholas/agenti"
            target="_blank"
            rel="noopener noreferrer"
            className="glass glass-hover px-8 py-3 text-whisper text-sm tracking-wide"
          >
            View Source
          </a>
          <code className="text-ghost text-sm font-mono">
            npx agenti
          </code>
        </motion.div>
      </div>
    </section>
  );
}
