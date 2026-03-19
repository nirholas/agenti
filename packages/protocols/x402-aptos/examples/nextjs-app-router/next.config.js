/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["x402a", "x402a-next"],

  // Exclude server-side dependencies from client bundle
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
};

module.exports = nextConfig;
