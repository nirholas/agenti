/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  serverExternalPackages: ['pino-pretty', 'lokijs', 'encoding'],
};

export default nextConfig;
