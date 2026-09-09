/** @type {import('next').NextConfig} */
const config = {
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
