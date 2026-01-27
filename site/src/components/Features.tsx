import { motion } from 'framer-motion';
import { Zap, Database, Bot } from 'lucide-react';

const features = [
  {
    icon: Database,
    title: 'Real-time Data',
    description: 'Live prices, market caps, and volume across thousands of cryptocurrencies',
  },
  {
    icon: Zap,
    title: 'Multi-source',
    description: 'Aggregated data from CoinGecko, Coinlore, and more',
  },
  {
    icon: Bot,
    title: 'Zero Config',
    description: 'Works instantly with Claude, GPT, and any MCP-compatible agent',
  },
];

export default function Features() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-glass text-3xl md:text-4xl font-light mb-4">
            Why Agenti
          </h2>
          <p className="text-ghost text-sm max-w-md mx-auto">
            Give your AI agents access to real-time crypto market data
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="glass glass-hover p-8"
            >
              <feature.icon className="w-5 h-5 text-ghost mb-4" strokeWidth={1.5} />
              <h3 className="text-soft text-sm tracking-wide mb-3">
                {feature.title}
              </h3>
              <p className="text-ghost text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
