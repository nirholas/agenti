import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@agenti/sdk', '@agenti/core'],
}

export default config
