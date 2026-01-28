/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        glass: 'rgba(255, 255, 255, 0.95)',
        whisper: 'rgba(255, 255, 255, 0.75)',
        ghost: 'rgba(255, 255, 255, 0.55)',
        faint: 'rgba(255, 255, 255, 0.3)',
        shimmer: 'rgba(255, 255, 255, 0.08)',
        surface: 'rgba(255, 255, 255, 0.03)',
      },
    },
  },
  plugins: [],
};
