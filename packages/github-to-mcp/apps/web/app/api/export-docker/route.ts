/**
 * @fileoverview API route to export Docker configuration
 * POST /api/export-docker
 */

import { NextRequest, NextResponse } from 'next/server';

export interface ExportDockerRequest {
  language: 'typescript' | 'python';
  serverName?: string;
  port?: number;
  envVars?: Record<string, string>;
  includeHealthcheck?: boolean;
  multiStage?: boolean;
}

export interface DockerConfig {
  dockerfile: string;
  dockerCompose: string;
  dockerignore: string;
  buildScript: string;
  claudeConfig: string;
}

export interface ExportDockerResponse {
  success: boolean;
  config?: DockerConfig;
  error?: string;
}

/**
 * Docker configuration templates
 */
const DOCKER_TEMPLATES = {
  typescript: {
    dockerfile: (options: { multiStage: boolean; includeHealthcheck: boolean }) => {
      if (options.multiStage) {
        return `# TypeScript MCP Server Dockerfile (Multi-stage)
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-slim

WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Security: Run as non-root user
USER node

${options.includeHealthcheck ? `# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD node -e "console.log('healthy')" || exit 1

` : ''}# Run the server
CMD ["node", "dist/index.js"]
`;
      }
      return `# TypeScript MCP Server Dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

${options.includeHealthcheck ? `# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD node -e "console.log('healthy')" || exit 1

` : ''}# Run the server
CMD ["node", "dist/index.js"]
`;
    },
    dockerignore: `node_modules
npm-debug.log
.git
.gitignore
.env
*.md
dist
coverage
.nyc_output
*.test.ts
*.spec.ts
__tests__
`,
  },
  python: {
    dockerfile: (options: { includeHealthcheck: boolean }) => `# Python MCP Server Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Security: Run as non-root user
RUN useradd -m -r mcpuser && chown -R mcpuser:mcpuser /app
USER mcpuser

${options.includeHealthcheck ? `# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD python -c "print('healthy')" || exit 1

` : ''}# Run the server
CMD ["python", "-m", "mcp_server"]
`,
    dockerignore: `__pycache__
*.py[cod]
*$py.class
*.so
.Python
.git
.gitignore
.env
venv/
ENV/
*.md
.pytest_cache/
.coverage
htmlcov/
dist/
build/
*.egg-info/
`,
  },
};

function generateDockerCompose(
  serverName: string,
  port?: number,
  envVars?: Record<string, string>
): string {
  const envLines = envVars
    ? Object.entries(envVars)
        .map(([key, value]) => `      - ${key}=${value}`)
        .join('\n')
    : '      - NODE_ENV=production';

  const portSection = port
    ? `    ports:
      - "${port}:${port}"
`
    : '';

  return `version: '3.8'

services:
  ${serverName}:
    build: .
    environment:
${envLines}
${portSection}    volumes:
      - ./config:/app/config:ro
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
`;
}

function generateBuildScript(serverName: string): string {
  return `#!/bin/bash
# Build and run the MCP server in Docker
set -e

echo "Building Docker image..."
docker build -t ${serverName} .

echo "Image built successfully!"
echo ""
echo "To run the MCP server:"
echo "  docker run -it --rm ${serverName}"
echo ""
echo "Or with docker-compose:"
echo "  docker-compose up -d"
`;
}

function generateClaudeConfig(serverName: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          command: 'docker',
          args: ['run', '-i', '--rm', serverName],
        },
      },
    },
    null,
    2
  );
}

export async function POST(request: NextRequest): Promise<NextResponse<ExportDockerResponse>> {
  try {
    const body = await request.json() as ExportDockerRequest;

    // Validate request
    if (!body.language || !['typescript', 'python'].includes(body.language)) {
      return NextResponse.json(
        { success: false, error: 'Language must be "typescript" or "python"' },
        { status: 400 }
      );
    }

    const serverName = body.serverName || 'mcp-server';
    const includeHealthcheck = body.includeHealthcheck ?? false;
    const multiStage = body.multiStage ?? true;

    const template = DOCKER_TEMPLATES[body.language];
    
    const dockerfile = body.language === 'typescript'
      ? template.dockerfile({ multiStage, includeHealthcheck })
      : (template as typeof DOCKER_TEMPLATES.python).dockerfile({ includeHealthcheck });

    const config: DockerConfig = {
      dockerfile,
      dockerCompose: generateDockerCompose(serverName, body.port, body.envVars),
      dockerignore: template.dockerignore,
      buildScript: generateBuildScript(serverName),
      claudeConfig: generateClaudeConfig(serverName),
    };

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Docker config generation error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Docker config generation failed',
      },
      { status: 500 }
    );
  }
}

// Support OPTIONS for CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
