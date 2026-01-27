import { motion } from 'framer-motion';

const traditionalSteps = [
  { title: "Sign up for API provider", desc: "Create account, verify email" },
  { title: "Add payment method", desc: "Credit card, KYC verification" },
  { title: "Buy credits/subscription", desc: "Prepay or commit monthly" },
  { title: "Manage API keys", desc: "Store securely, rotate regularly" },
  { title: "Handle rate limits", desc: "Track usage, handle errors" },
];

const agentiSteps = [
  { title: "Install Agenti", desc: "npx agenti" },
  { title: "Use it", desc: "Ask your AI anything about crypto" },
];

export default function ComparisonSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-glass text-3xl md:text-4xl font-light text-center mb-16"
        >
          The difference
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
          {/* Traditional way */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="text-ghost text-xs uppercase tracking-widest mb-6">
              The old way
            </h3>
            <div className="space-y-4">
              {traditionalSteps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-ghost text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-whisper text-sm">{step.title}</div>
                    <div className="text-ghost text-xs">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Agenti way */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h3 className="text-green-400/60 text-xs uppercase tracking-widest mb-6">
              With Agenti
            </h3>
            <div className="space-y-4">
              {agentiSteps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400/80 text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-green-400/80 text-sm">{step.title}</div>
                    <div className="text-green-400/50 text-xs font-mono">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Emphasis */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-8 glass p-6 text-center"
            >
              <div className="text-soft text-lg font-light mb-1">That's it.</div>
              <div className="text-ghost text-sm">No API keys. No signups. No billing.</div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
