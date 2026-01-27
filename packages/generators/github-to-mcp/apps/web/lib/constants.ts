/**
 * Application Constants
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

export const APP_NAME = 'GitHub to MCP';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Convert any GitHub repository into an MCP server for AI assistants';

export const GITHUB_URL = 'https://github.com/nirholas/github-to-mcp';
export const DOCS_URL = 'https://github.com/nirholas/github-to-mcp#readme';

export const EXAMPLE_REPOS = [
  {
    name: 'Stripe Node.js SDK',
    url: 'https://github.com/stripe/stripe-node',
    description: 'Popular payment API SDK',
    category: 'API SDK',
  },
  {
    name: 'OpenAI Node.js SDK',
    url: 'https://github.com/openai/openai-node',
    description: 'Official OpenAI API library',
    category: 'API SDK',
  },
  {
    name: 'Octokit.js',
    url: 'https://github.com/octokit/octokit.js',
    description: 'GitHub REST API client',
    category: 'API SDK',
  },
  {
    name: 'Axios',
    url: 'https://github.com/axios/axios',
    description: 'Promise-based HTTP client',
    category: 'Library',
  },
  {
    name: 'Prisma',
    url: 'https://github.com/prisma/prisma',
    description: 'Next-generation ORM',
    category: 'Database',
  },
  {
    name: 'OpenAI MCP Server',
    url: 'https://github.com/arthurcolle/openai-mcp',
    description: 'Python MCP server for OpenAI',
    category: 'MCP Server',
  },
] as const;

export const CLASSIFICATION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  'mcp-server': { label: 'MCP Server', color: 'purple', icon: '🔮' },
  'api-sdk': { label: 'API SDK', color: 'blue', icon: '🔌' },
  'cli-tool': { label: 'CLI Tool', color: 'green', icon: '⌨️' },
  'library': { label: 'Library', color: 'yellow', icon: '📚' },
  'documentation': { label: 'Documentation', color: 'gray', icon: '📄' },
  'data': { label: 'Data/Config', color: 'orange', icon: '📊' },
  'unknown': { label: 'Unknown', color: 'gray', icon: '❓' },
};

export const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  'readme': { label: 'README', color: 'blue' },
  'code': { label: 'Source Code', color: 'green' },
  'openapi': { label: 'OpenAPI Spec', color: 'purple' },
  'graphql': { label: 'GraphQL', color: 'pink' },
  'mcp-introspect': { label: 'MCP Introspect', color: 'orange' },
  'universal': { label: 'Universal', color: 'gray' },
  'mcp-decorator': { label: 'MCP Decorator', color: 'pink' },
  'python-mcp': { label: 'Python MCP', color: 'yellow' },
};

export const PLATFORMS = {
  claude: {
    name: 'Claude Desktop',
    icon: '🤖',
    configPath: '~/Library/Application Support/Claude/claude_desktop_config.json',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-desktop',
  },
  cursor: {
    name: 'Cursor',
    icon: '⚡',
    configPath: '.cursor/mcp.json',
    docsUrl: 'https://www.cursor.com/docs',
  },
  openai: {
    name: 'ChatGPT / OpenAI',
    icon: '💬',
    configPath: 'openai-mcp-config.json',
    docsUrl: 'https://platform.openai.com/docs',
  },
} as const;

export const RATE_LIMIT = {
  requestsPerMinute: 30,
  burstLimit: 5,
};

export const CACHE_TTL = {
  conversion: 3600, // 1 hour
  repoInfo: 86400, // 24 hours
};

export const MAX_TOOLS_DISPLAY = 100;
export const MAX_HISTORY_ITEMS = 50;

export const KEYBOARD_SHORTCUTS = {
  convert: 'Enter',
  clearInput: 'Escape',
  copyCode: 'mod+shift+c',
  downloadCode: 'mod+shift+d',
  toggleTheme: 'mod+shift+t',
} as const;
