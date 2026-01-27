import { NextRequest, NextResponse } from 'next/server';

// ============================================
// Real Analysis Implementation
// ============================================

const GITHUB_API = 'https://api.github.com';
const NPM_REGISTRY = 'https://registry.npmjs.org';

interface AnalyzeRequest {
  url?: string;
  package?: string;
}

interface AnalysisResult {
  success: boolean;
  source: 'github' | 'npm';
  name: string;
  template: string;
  confidence: number;
  metadata: {
    description?: string;
    stars?: number;
    downloads?: number;
    lastUpdated?: string;
    license?: string;
    author?: string;
    homepage?: string;
  };
  config: Record<string, unknown>;
}

// MCP and crypto-related keywords for detection
const MCP_INDICATORS = ['mcp', 'modelcontextprotocol', '@modelcontextprotocol/sdk'];
const CRYPTO_KEYWORDS = [
  'crypto', 'defi', 'blockchain', 'web3', 'ethereum', 'solana', 'bitcoin',
  'wallet', 'token', 'nft', 'dex', 'swap', 'staking', 'yield', 'bridge'
];

/**
 * Detect the best template based on package/repo analysis
 */
function detectTemplate(data: {
  name: string;
  description?: string;
  readme?: string;
  packageJson?: Record<string, unknown>;
  hasMCP: boolean;
  hasOpenAPI: boolean;
}): { template: string; confidence: number } {
  const searchText = [data.name, data.description || '', data.readme || ''].join(' ').toLowerCase();
  const pkg = data.packageJson || {};
  const deps = {
    ...(pkg.dependencies as Record<string, string> || {}),
    ...(pkg.devDependencies as Record<string, string> || {})
  };

  // Check for MCP SDK dependency
  if (deps['@modelcontextprotocol/sdk'] || data.hasMCP) {
    // Determine HTTP vs stdio based on package analysis
    if (searchText.includes('http') || searchText.includes('streamable') || deps['express'] || deps['fastify']) {
      return { template: 'mcp-http', confidence: 95 };
    }
    return { template: 'mcp-stdio', confidence: 92 };
  }

  // Check for OpenAPI/Swagger
  if (data.hasOpenAPI || searchText.includes('openapi') || searchText.includes('swagger') || deps['swagger-ui-express']) {
    return { template: 'openapi', confidence: 88 };
  }

  // Check for markdown-heavy documentation
  if (searchText.includes('documentation') || searchText.includes('docs') || searchText.includes('markdown')) {
    return { template: 'markdown', confidence: 75 };
  }

  // Check for settings/config
  if (searchText.includes('settings') || searchText.includes('config') || searchText.includes('preferences')) {
    return { template: 'settings', confidence: 70 };
  }

  // Check for standalone tools
  if (pkg.bin || searchText.includes('cli') || searchText.includes('command')) {
    return { template: 'standalone', confidence: 72 };
  }

  // Default fallback
  return { template: 'default', confidence: 60 };
}

/**
 * Analyze a GitHub repository
 */
async function analyzeGitHubRepo(owner: string, repo: string): Promise<AnalysisResult> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'lyra-dashboard'
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // Fetch repo metadata
  const repoResponse = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
  if (!repoResponse.ok) {
    throw new Error(`Repository not found: ${owner}/${repo}`);
  }
  const repoData = await repoResponse.json();

  // Try to fetch README and package.json in parallel
  const [readmeContent, packageJsonContent] = await Promise.all([
    fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/README.md`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => data?.content ? Buffer.from(data.content, 'base64').toString('utf-8') : null)
      .catch(() => null),
    fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/package.json`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => data?.content ? JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8')) : null)
      .catch(() => null)
  ]);

  const hasMCP = !!(repoData.topics?.includes('mcp') || 
                 repoData.name.toLowerCase().includes('mcp') ||
                 repoData.description?.toLowerCase().includes('mcp') ||
                 packageJsonContent?.dependencies?.['@modelcontextprotocol/sdk']);

  const hasOpenAPI = !!(readmeContent?.toLowerCase().includes('openapi') ||
                        readmeContent?.toLowerCase().includes('swagger'));

  const { template, confidence } = detectTemplate({
    name: repoData.name,
    description: repoData.description,
    readme: readmeContent || undefined,
    packageJson: packageJsonContent || undefined,
    hasMCP,
    hasOpenAPI
  });

  return {
    success: true,
    source: 'github',
    name: `${owner}/${repo}`,
    template,
    confidence,
    metadata: {
      description: repoData.description,
      stars: repoData.stargazers_count,
      lastUpdated: repoData.pushed_at,
      license: repoData.license?.spdx_id,
      author: repoData.owner?.login,
      homepage: repoData.homepage || undefined
    },
    config: generateConfig(template, repoData.name, packageJsonContent)
  };
}

/**
 * Analyze an npm package
 */
async function analyzeNpmPackage(packageName: string): Promise<AnalysisResult> {
  // Fetch package metadata from npm registry
  const response = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(packageName)}`);
  if (!response.ok) {
    throw new Error(`Package not found: ${packageName}`);
  }
  const data = await response.json();
  
  const latestVersion = data['dist-tags']?.latest;
  const versionData = data.versions?.[latestVersion] || {};
  const readme = data.readme || '';

  const hasMCP = packageName.toLowerCase().includes('mcp') ||
                 data.description?.toLowerCase().includes('mcp') ||
                 versionData.dependencies?.['@modelcontextprotocol/sdk'];

  const hasOpenAPI = readme.toLowerCase().includes('openapi') ||
                     readme.toLowerCase().includes('swagger');

  const { template, confidence } = detectTemplate({
    name: packageName,
    description: data.description,
    readme,
    packageJson: versionData,
    hasMCP,
    hasOpenAPI
  });

  // Fetch download count from npm API
  let downloads: number | undefined;
  try {
    const downloadsResponse = await fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(packageName)}`);
    if (downloadsResponse.ok) {
      const downloadsData = await downloadsResponse.json();
      downloads = downloadsData.downloads;
    }
  } catch {
    // Ignore download count errors
  }

  return {
    success: true,
    source: 'npm',
    name: packageName,
    template,
    confidence,
    metadata: {
      description: data.description,
      downloads,
      lastUpdated: data.time?.modified,
      license: versionData.license,
      author: typeof data.author === 'string' ? data.author : data.author?.name,
      homepage: data.homepage
    },
    config: generateConfig(template, packageName, versionData)
  };
}

/**
 * Generate plugin configuration based on template
 */
function generateConfig(template: string, name: string, packageJson?: Record<string, unknown>): Record<string, unknown> {
  const baseName = name.split('/').pop() || name;
  const version = (packageJson?.version as string) || '1.0.0';

  const baseConfig = {
    name: baseName,
    version,
    template
  };

  switch (template) {
    case 'mcp-http':
      return {
        ...baseConfig,
        transport: 'http',
        url: `https://api.${baseName}.com/mcp`,
        headers: {}
      };
    case 'mcp-stdio':
      return {
        ...baseConfig,
        transport: 'stdio',
        command: 'npx',
        args: [name]
      };
    case 'openapi':
      return {
        ...baseConfig,
        spec: './openapi.yaml',
        baseUrl: `https://api.${baseName}.com`
      };
    case 'standalone':
      return {
        ...baseConfig,
        command: (packageJson?.bin as Record<string, string>)?.[baseName] || 'node',
        args: ['./index.js']
      };
    default:
      return baseConfig;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();

    // Validate input
    if (!body.url && !body.package) {
      return NextResponse.json(
        { error: 'Either "url" (GitHub repository) or "package" (npm package) is required' },
        { status: 400 }
      );
    }

    let result: AnalysisResult;

    if (body.url) {
      // Parse GitHub URL
      const match = body.url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
      if (!match) {
        return NextResponse.json(
          { error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo' },
          { status: 400 }
        );
      }
      const [, owner, repo] = match;
      result = await analyzeGitHubRepo(owner, repo.replace('.git', ''));
    } else {
      result = await analyzeNpmPackage(body.package!);
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to analyze a repository or package',
    endpoints: {
      analyze: {
        method: 'POST',
        body: {
          url: 'GitHub repository URL (e.g., https://github.com/owner/repo)',
          package: 'npm package name (e.g., @scope/package)',
        },
      },
    },
  });
}
