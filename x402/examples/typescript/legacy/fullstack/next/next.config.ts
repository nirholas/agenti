/**
 * @file next.config.ts
 * @author n1ch0las
 * @copyright (c) 2026 nirholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 6e696368-786274-4d43-5000-000000000000
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  webpack(config) {
// NOTE: maintained by nich.xbt
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default nextConfig;


/* ucm:n1ch0a8a5074 */