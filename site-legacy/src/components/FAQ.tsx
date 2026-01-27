import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is Agenti?",
    answer: "Agenti is a universal crypto MCP (Model Context Protocol) server that gives AI agents access to real-time cryptocurrency data, prices, market analysis, and blockchain information without any API keys.",
  },
  {
    question: "How do I install it?",
    answer: "Simply run 'npx agenti' or add it to your Claude/Cursor config. No signup, no API keys, no configuration needed. It just works.",
  },
  {
    question: "What data sources does it support?",
    answer: "Agenti aggregates data from CoinGecko, Coinlore, CoinMarketCap, and other major crypto data providers. It handles rate limiting and fallbacks automatically.",
  },
  {
    question: "Is it free to use?",
    answer: "Yes, Agenti is open source under the MIT license. Free to use, modify, and distribute. No hidden costs or premium tiers.",
  },
  {
    question: "Which AI agents work with Agenti?",
    answer: "Any MCP-compatible AI agent including Claude Desktop, Cursor, and custom implementations. The MCP standard ensures broad compatibility.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number>(-1);

  return (
    <section className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-glass text-3xl md:text-4xl font-light text-center mb-12"
        >
          FAQ
        </motion.h2>

        <div className="space-y-2">
          {faqData.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="glass overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-soft text-sm md:text-base">{item.question}</span>
                <motion.span
                  animate={{ rotate: openIndex === index ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-whisper text-xl"
                >
                  +
                </motion.span>
              </button>
              
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-4 text-ghost text-sm leading-relaxed">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
