/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: [
    '@agenti/sdk',
    '@agenti/core',
    'solana-agent-kit',
    '@solana/web3.js',
    '@drift-labs/sdk',
    '@pythnetwork/pyth-solana-receiver',
    'jito-ts',
    'rpc-websockets',
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, net: false, tls: false, crypto: false,
      }
    }
    return config
  },
}

export default config
