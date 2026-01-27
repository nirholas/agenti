/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LYRA WEB3 PLAYGROUND - Tailwind Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 * ✨ Author: nich | 🐦 x.com/nichxbt | 🐙 github.com/nirholas
 * 📦 github.com/nirholas/lyra-web3-playground | 🌐 https://lyra.works
 * Copyright (c) 2024-2026 nirholas (nich) - MIT License
 * @preserve
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Monaco', 'Menlo', 'monospace'],
      },
      colors: {
        primary: {
          50: '#ffffff',
          100: '#fafafa',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#171717',
          900: '#000000',
        },
        secondary: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#18181b',
          900: '#000000',
        },
        // New dark theme colors - all black with subtle variations
        dark: {
          bg: '#000000',           // Pure black background
          card: '#0a0a0a',         // Slightly lighter for cards
          elevated: '#111111',     // Elevated surfaces
          border: '#1a1a1a',       // Subtle borders
          'border-light': '#262626', // More visible borders
        },
      },
      boxShadow: {
        // Subtle glow shadows for dark mode
        'glow-sm': '0 0 15px -3px rgba(255, 255, 255, 0.05)',
        'glow': '0 0 25px -5px rgba(255, 255, 255, 0.07)',
        'glow-lg': '0 0 35px -5px rgba(255, 255, 255, 0.1)',
        'glow-white': '0 0 20px rgba(255, 255, 255, 0.1)',
        // Soft elevation shadows
        'elevation-1': '0 1px 3px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03)',
        'elevation-2': '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'elevation-3': '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.07)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'stagger-1': 'fadeInUp 0.6s ease-out 0.1s both',
        'stagger-2': 'fadeInUp 0.6s ease-out 0.2s both',
        'stagger-3': 'fadeInUp 0.6s ease-out 0.3s both',
        'stagger-4': 'fadeInUp 0.6s ease-out 0.4s both',
        'stagger-5': 'fadeInUp 0.6s ease-out 0.5s both',
        'stagger-6': 'fadeInUp 0.6s ease-out 0.6s both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    // Custom plugin for hiding scrollbars (mobile-friendly horizontal scroll)
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.scrollbar-default': {
          '-ms-overflow-style': 'auto',
          'scrollbar-width': 'auto',
          '&::-webkit-scrollbar': {
            display: 'block',
          },
        },
      });
    },
  ],
}
