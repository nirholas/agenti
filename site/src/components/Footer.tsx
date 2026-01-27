import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="py-20 px-6"
    >
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-ghost text-xs tracking-wide">
          MIT License · Built for the open web
        </p>
      </div>
    </motion.footer>
  );
}
