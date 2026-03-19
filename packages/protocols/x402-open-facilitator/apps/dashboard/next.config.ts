import type { NextConfig } from 'next';
import createMDX from '@next/mdx';
import rehypePrettyCode from 'rehype-pretty-code';
import remarkGfm from 'remark-gfm';

const nextConfig: NextConfig = {
  transpilePackages: ['@openfacilitator/core'],
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      [
        rehypePrettyCode,
        {
          theme: 'github-dark',
          keepBackground: false,
        },
      ],
    ],
  },
});

// @ts-ignore - Next.js version mismatch between @next/mdx and next (local only)
export default withMDX(nextConfig);
