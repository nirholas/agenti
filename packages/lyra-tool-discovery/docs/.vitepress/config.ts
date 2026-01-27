import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Lyra Tool Discovery',
  description: 'AI-powered tool discovery for the MCP ecosystem',
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Lyra Tool Discovery' }],
    ['meta', { property: 'og:description', content: 'AI-powered tool discovery for the MCP ecosystem' }],
    ['meta', { property: 'og:image', content: '/og-image.png' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      {
        text: 'Ecosystem',
        items: [
          { text: 'github-to-mcp', link: 'https://github.com/nirholas/github-to-mcp' },
          { text: 'plugin.delivery', link: 'https://plugin.delivery' },
          { text: 'SperaxOS', link: 'https://github.com/nirholas/SperaxOS' },
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Lyra?', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Plugin Templates', link: '/guide/plugin-templates' },
            { text: 'AI Providers', link: '/guide/ai-providers' },
            { text: 'Discovery Sources', link: '/guide/sources' },
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Custom Sources', link: '/guide/custom-sources' },
            { text: 'Pipeline Integration', link: '/guide/pipeline' },
            { text: 'GitHub Actions', link: '/guide/github-actions' },
          ]
        }
      ],
      '/cli/': [
        {
          text: 'CLI Reference',
          items: [
            { text: 'Overview', link: '/cli/' },
            { text: 'Commands', link: '/cli/commands' },
            { text: 'Configuration', link: '/cli/configuration' },
            { text: 'Output Formats', link: '/cli/output' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'ToolDiscovery', link: '/api/tool-discovery' },
            { text: 'AIAnalyzer', link: '/api/ai-analyzer' },
            { text: 'Types', link: '/api/types' },
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Basic Discovery', link: '/examples/basic-discovery' },
            { text: 'Custom AI Config', link: '/examples/custom-ai' },
            { text: 'Batch Processing', link: '/examples/batch-processing' },
            { text: 'GitHub Actions', link: '/examples/github-actions' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nirholas/lyra-tool-discovery' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@nirholas/lyra-tool-discovery' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present nirholas'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/nirholas/lyra-tool-discovery/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
