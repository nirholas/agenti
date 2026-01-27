import type { Template, Feature, NavLink, Stat } from '@/types';

// All 8 plugin templates
export const TEMPLATES: Template[] = [
  {
    id: 'basic',
    name: 'Basic',
    type: 'default',
    icon: '📦',
    description: 'Minimal plugin configuration for simple use cases',
    useCase: 'Simple tools with minimal configuration needs',
    criteria: [
      'No complex settings required',
      'Single-purpose tool',
      'Minimal dependencies',
    ],
    example: {
      name: 'example-basic',
      version: '1.0.0',
      template: 'basic',
      entry: './index.js',
    },
    cliCommand: 'lyra-discover analyze-repo owner/repo --template basic',
  },
  {
    id: 'default',
    name: 'Default',
    type: 'default',
    icon: '🔧',
    description: 'Standard plugin template with common configurations',
    useCase: 'General-purpose plugins with typical feature set',
    criteria: [
      'Standard plugin structure',
      'Common configuration patterns',
      'Moderate complexity',
    ],
    example: {
      name: 'example-default',
      version: '1.0.0',
      template: 'default',
      entry: './index.js',
      settings: {
        enabled: true,
      },
    },
    cliCommand: 'lyra-discover analyze-repo owner/repo --template default',
  },
  {
    id: 'markdown',
    name: 'Markdown',
    type: 'markdown',
    icon: '📝',
    description: 'For documentation and content-focused plugins',
    useCase: 'Documentation generators, content processors, markdown tools',
    criteria: [
      'Processes markdown content',
      'Documentation focused',
      'Text transformation',
    ],
    example: {
      name: 'example-markdown',
      version: '1.0.0',
      template: 'markdown',
      entry: './index.js',
      contentTypes: ['markdown', 'mdx'],
    },
    cliCommand: 'lyra-discover analyze-repo owner/repo --template markdown',
  },
  {
    id: 'openapi',
    name: 'OpenAPI',
    type: 'openapi',
    icon: '🌐',
    description: 'For REST API integrations with OpenAPI spec support',
    useCase: 'API wrappers, REST clients, service integrations',
    criteria: [
      'Has OpenAPI/Swagger specification',
      'REST API based',
      'HTTP client functionality',
    ],
    example: {
      name: 'example-openapi',
      version: '1.0.0',
      template: 'openapi',
      spec: './openapi.yaml',
      baseUrl: 'https://api.example.com',
    },
    cliCommand: 'lyra-discover analyze-repo owner/repo --template openapi',
  },
  {
    id: 'settings',
    name: 'Settings',
    type: 'settings',
    icon: '⚙️',
    description: 'For plugins with complex configuration requirements',
    useCase: 'Highly configurable tools, preference-heavy plugins',
    criteria: [
      'Complex configuration schema',
      'User preferences',
      'Multiple setting categories',
    ],
    example: {
      name: 'example-settings',
      version: '1.0.0',
      template: 'settings',
      settingsSchema: './settings.schema.json',
      categories: ['general', 'advanced', 'experimental'],
    },
    cliCommand: 'lyra-discover analyze-repo owner/repo --template settings',
  },
  {
    id: 'standalone',
    name: 'Standalone',
    type: 'standalone',
    icon: '🎯',
    description: 'Self-contained plugins with no external dependencies',
    useCase: 'Independent tools, isolated functionality',
    criteria: [
      'No external dependencies',
      'Self-contained logic',
      'Portable functionality',
    ],
    example: {
      name: 'example-standalone',
      version: '1.0.0',
      template: 'standalone',
      entry: './index.js',
      isolated: true,
    },
    cliCommand: 'lyra-discover analyze-repo owner/repo --template standalone',
  },
  {
    id: 'mcp-http',
    name: 'MCP HTTP',
    type: 'mcp',
    icon: '🔌',
    description: 'MCP server using HTTP/SSE transport protocol',
    useCase: 'Web-based MCP servers, cloud deployments, stateless APIs',
    criteria: [
      'Uses HTTP transport',
      'Server-Sent Events (SSE)',
      'Stateless operation',
      'Cloud-native deployment',
    ],
    example: {
      name: 'example-mcp-http',
      version: '1.0.0',
      template: 'mcp-http',
      transport: 'http',
      port: 3000,
      endpoints: {
        tools: '/tools',
        execute: '/execute',
      },
    },
    cliCommand: 'lyra-discover analyze-repo owner/repo --template mcp-http',
  },
  {
    id: 'mcp-stdio',
    name: 'MCP STDIO',
    type: 'mcp',
    icon: '💻',
    description: 'MCP server using stdio transport protocol',
    useCase: 'Local MCP servers, CLI integrations, desktop applications',
    criteria: [
      'Uses stdio transport',
      'Local execution',
      'Process-based communication',
      'Desktop/CLI integration',
    ],
    example: {
      name: 'example-mcp-stdio',
      version: '1.0.0',
      template: 'mcp-stdio',
      transport: 'stdio',
      command: 'node',
      args: ['./server.js'],
    },
    cliCommand: 'lyra-discover analyze-repo owner/repo --template mcp-stdio',
  },
];

// Navigation links
export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/discover', label: 'Discover' },
  { href: '/templates', label: 'Templates' },
  { href: '/docs', label: 'Docs' },
  { href: 'https://llm.energy', label: 'LLM.energy', external: true },
  { href: 'https://github.com/nirholas/lyra-tool-discovery', label: 'GitHub', external: true },
];

// Social links
export const SOCIAL_LINKS = {
  github: 'https://github.com/nirholas/lyra-tool-discovery',
  discord: '#', // placeholder
  twitter: '#', // placeholder
  llmEnergy: 'https://llm.energy',
};

// Homepage features
export const FEATURES: Feature[] = [
  {
    icon: '🤖',
    title: 'Multi-AI Support',
    description: 'Choose between OpenAI and Anthropic for intelligent analysis of repositories and packages.',
    color: 'violet',
  },
  {
    icon: '🔍',
    title: 'Smart Discovery',
    description: 'Automatically scan GitHub repositories and npm packages to find MCP-compatible tools.',
    color: 'cyan',
  },
  {
    icon: '📦',
    title: '8 Templates',
    description: 'Support for all plugin types: basic, default, markdown, openapi, settings, standalone, mcp-http, and mcp-stdio.',
    color: 'pink',
  },
  {
    icon: '⚡',
    title: 'Fast Analysis',
    description: 'Instant template detection and configuration generation powered by advanced AI models.',
    color: 'green',
  },
  {
    icon: '🔗',
    title: 'Pipeline Ready',
    description: 'Seamless integration with github-to-mcp pipeline for automated tool discovery workflows.',
    color: 'orange',
  },
  {
    icon: '🎯',
    title: 'Plugin.delivery',
    description: 'Direct marketplace submission support for SperaxOS and plugin.delivery ecosystem.',
    color: 'blue',
  },
];

// Stats for homepage
export const STATS: Stat[] = [
  { value: 8, label: 'Plugin Templates' },
  { value: 2, label: 'AI Providers', suffix: '+' },
  { value: 1000, label: 'Tools Discovered', suffix: '+' },
];

// Template type colors
export const TEMPLATE_TYPE_COLORS: Record<string, string> = {
  mcp: 'bg-white/15 text-white border-white/20',
  default: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
  openapi: 'bg-neutral-600/20 text-neutral-300 border-neutral-600/30',
  settings: 'bg-neutral-700/30 text-neutral-400 border-neutral-700/40',
  standalone: 'bg-white/10 text-white/70 border-white/15',
  markdown: 'bg-neutral-400/20 text-neutral-200 border-neutral-400/30',
};
