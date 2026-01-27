import { motion } from 'framer-motion';
import Hero from './components/Hero';
import Features from './components/Features';
import CodeExample from './components/CodeExample';
import Footer from './components/Footer';

function App() {
  return (
    <div className="relative min-h-screen">
      {/* Subtle background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-white/[0.015] rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -right-48 w-96 h-96 bg-white/[0.015] rounded-full blur-3xl" />
      </div>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10"
      >
        <Hero />
        <Features />
        <CodeExample />
        <Footer />
      </motion.main>
    </div>
  );
}

export default App;
