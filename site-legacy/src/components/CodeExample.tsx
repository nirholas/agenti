'use client';

import { motion } from 'framer-motion';

const configCode = `{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["agenti"]
    }
  }
}`;

export default function CodeExample() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-glass text-3xl md:text-4xl font-light mb-4">
            Get Started
          </h2>
          <p className="text-ghost text-sm">
            Add to your Claude or Cursor config
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="glass p-6 md:p-8"
        >
          <pre className="text-ghost text-xs md:text-sm font-mono leading-relaxed overflow-x-auto">
            <code>{configCode}</code>
          </pre>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-center text-ghost text-xs mt-6"
        >
          That's it. Your agent now has crypto superpowers.
        </motion.p>
      </div>
    </section>
  );
}
