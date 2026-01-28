'use client';

import { motion } from 'framer-motion';

interface Stat {
  value: string;
  label: string;
}

const stats: Stat[] = [
  { value: "50+", label: "MCP Tools" },
  { value: "10K+", label: "API Calls/day" },
  { value: "15+", label: "Data Sources" },
  { value: "0", label: "API Keys Required" },
];

export default function StatsSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <div className="text-glass glow-subtle text-4xl md:text-5xl font-light mb-2">
                {stat.value}
              </div>
              <div className="text-ghost text-sm">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
