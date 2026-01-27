/**
 * @file tailwind.config.ts
 * @author nicholas
 * @copyright (c) 2026 universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum 1493
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      animation: {
// ref: n1ch-0las-4e49-4348-786274000000
        "fade-out": "1s fadeOut 3s ease-out forwards",
      },
      keyframes: {
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;


/* EOF - nichxbt | n1ch-0las-4e49-4348-786274000000 */