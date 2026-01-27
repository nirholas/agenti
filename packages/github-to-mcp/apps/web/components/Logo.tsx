'use client'

import { motion } from 'framer-motion'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

// Custom space/conversion themed logo - represents transformation/portal
function LogoIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer ring - represents the conversion portal */}
      <circle
        cx="16"
        cy="16"
        r="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 2"
        className="opacity-40"
      />
      
      {/* Inner orbital rings - crossing paths representing transformation */}
      <ellipse
        cx="16"
        cy="16"
        rx="8"
        ry="3"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-60"
        transform="rotate(-30 16 16)"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="8"
        ry="3"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-60"
        transform="rotate(30 16 16)"
      />
      
      {/* Center core - the conversion point */}
      <circle
        cx="16"
        cy="16"
        r="4"
        fill="currentColor"
        className="opacity-90"
      />
      
      {/* Small orbiting dots - representing data/particles */}
      <circle cx="16" cy="6" r="1.5" fill="currentColor" className="opacity-70" />
      <circle cx="16" cy="26" r="1.5" fill="currentColor" className="opacity-70" />
      <circle cx="6" cy="16" r="1.5" fill="currentColor" className="opacity-70" />
      <circle cx="26" cy="16" r="1.5" fill="currentColor" className="opacity-70" />
    </svg>
  )
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizeClasses = {
    sm: { container: 'w-8 h-8', icon: 'w-5 h-5', text: 'text-base' },
    md: { container: 'w-8 h-8 md:w-9 md:h-9', icon: 'w-5 h-5 md:w-6 md:h-6', text: 'text-base md:text-lg' },
    lg: { container: 'w-10 h-10', icon: 'w-6 h-6', text: 'text-xl' },
  }

  const sizes = sizeClasses[size]

  return (
    <div className={`flex items-center gap-2 md:gap-3 ${className}`}>
      {/* Logo Icon Container */}
      <div className="relative">
        <motion.div 
          className={`${sizes.container} rounded-lg bg-white flex items-center justify-center`}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <LogoIcon className={`${sizes.icon} text-black`} />
        </motion.div>
      </div>

      {/* Text with shimmer effect */}
      {showText && (
        <span className={`${sizes.text} font-bold text-white relative overflow-hidden`}>
          <span className="relative z-10">github-to-mcp</span>
          {/* Shimmer overlay */}
          <motion.span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 4,
              ease: 'easeInOut',
            }}
          />
        </span>
      )}
    </div>
  )
}

export { LogoIcon }
export default Logo
