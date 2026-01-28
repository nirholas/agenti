'use client';

import { motion } from 'framer-motion';
import MiniChatApp from './MiniChatApp';

export default function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateY: -10 }}
      whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative mx-auto"
      style={{ perspective: '1000px' }}
    >
      {/* Phone frame with glass effect */}
      <div className="relative glass p-2 rounded-[40px]">
        {/* Inner phone bezel */}
        <div 
          className="relative rounded-[32px] overflow-hidden bg-black"
          style={{ width: '280px', height: '580px' }}
        >
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-20" />
          
          {/* Interactive chat app - live data! */}
          <div className="absolute inset-0 pt-7">
            <MiniChatApp />
          </div>
          
          {/* Screen shimmer overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)',
            }}
          />
        </div>
        
        {/* Reflection on glass frame */}
        <div 
          className="absolute inset-0 rounded-[40px] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 30%)',
          }}
        />
      </div>
      
      {/* Floating glow beneath phone */}
      <div 
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-48 h-20 rounded-full opacity-30"
        style={{
          background: 'radial-gradient(ellipse, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
    </motion.div>
  );
}
