/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Ignore ESLint during builds (TypeScript handles type checking)
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
