import { motion } from 'framer-motion';
import Hero from './components/Hero';
import Features from './components/Features';
import PhoneMockup from './components/PhoneMockup';
import StatsSection from './components/StatsSection';
import ComparisonSection from './components/ComparisonSection';
import CodeExample from './components/CodeExample';
import FAQ from './components/FAQ';
import Footer from './components/Footer';

function App() {
  return (
    <div className="relative min-h-screen">
      {/* Opal ambient orbs - pearly with subtle color hints */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Soft pink-white orb */}
        <motion.div
          animate={{
            x: [0, 20, -10, 15, 0],
            y: [0, -20, 10, 15, 0],
            scale: [1, 1.05, 0.95, 1.02, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(255, 250, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Soft blue-white orb */}
        <motion.div
          animate={{
            x: [0, -15, 10, -20, 0],
            y: [0, 15, -10, 20, 0],
            scale: [1, 0.95, 1.05, 0.98, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[20%] right-[-5%] w-[450px] h-[450px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(250, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Warm pearl orb */}
        <motion.div
          animate={{
            x: [0, 10, -15, 5, 0],
            y: [0, -10, 15, -5, 0],
            scale: [1, 1.02, 0.98, 1.03, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[50%] left-[30%] w-[300px] h-[300px] rounded-full opacity-35"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 250, 0.07) 0%, rgba(255, 255, 255, 0.03) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Opal shimmer overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 20% 20%, rgba(255, 252, 255, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 80%, rgba(252, 255, 255, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.015) 0%, transparent 70%)
            `,
          }}
        />
      </div>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10"
      >
        <Hero />
        
        {/* Phone mockup section */}
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1">
              <PhoneMockup />
            </div>
            <div className="flex-1 text-center lg:text-left">
              <h2 className="text-glass text-3xl md:text-4xl font-light mb-4">
                Real-time crypto data
              </h2>
              <p className="text-ghost text-sm md:text-base leading-relaxed mb-6">
                Your AI agent gets instant access to prices, market caps, volume, 
                and historical data for thousands of cryptocurrencies. No rate limits, 
                no API keys, no setup.
              </p>
              <code className="text-whisper text-sm font-mono">
                "What's the price of Bitcoin?"
              </code>
            </div>
          </div>
        </section>

        <StatsSection />
        <Features />
        <ComparisonSection />
        <CodeExample />
        <FAQ />
        <Footer />
      </motion.main>
    </div>
  );
}

export default App;
