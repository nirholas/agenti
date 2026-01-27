/**
 * @fileoverview Export Docker configuration tool for MCP server
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { TextContent, Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Docker configuration templates
 */
const DOCKER_TEMPLATES = {
  typescript: {
    dockerfile: `# TypeScript MCP Server Dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Run the server
CMD ["node", "dist/index.js"]
`,
    dockerCompose: `version: '3.8'

services:
  mcp-server:
    build: .
    environment:
      - NODE_ENV=production
    volumes:
      - ./config:/app/config:ro
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
`,
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
    dockerfile: `# Python MCP Server Dockerfile
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

# Run the server
CMD ["python", "-m", "mcp_server"]
`,
    dockerCompose: `version: '3.8'

services:
  mcp-server:
    build: .
    environment:
      - PYTHONUNBUFFERED=1
    volumes:
      - ./config:/app/config:ro
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
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

/**
 * Tool definition for exporting Docker configuration
 */
export const exportDockerTool: Tool = {
  name: 'export_docker',
  description: `Generate Docker configuration files for an MCP server.

Creates:
- Dockerfile optimized for MCP servers
- docker-compose.yml for easy deployment
- .dockerignore for efficient builds

Supports TypeScript and Python MCP servers with best practices for:
- Multi-stage builds (TypeScript)
- Minimal image size
- Proper caching
- Security hardening
- Logging configuration

The generated configuration can be customized with server name, port, and environment variables.`,
  inputSchema: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        enum: ['typescript', 'python'],
        description: 'The programming language of the MCP server',
      },
      server_name: {
        type: 'string',
        description: 'Name for the Docker service',
      },
      port: {
        type: 'number',
        description: 'Port to expose (optional, MCP uses stdio by default)',
      },
      env_vars: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Environment variables to include',
      },
      include_healthcheck: {
        type: 'boolean',
        default: false,
        description: 'Include a health check endpoint',
      },
      multi_stage: {
        type: 'boolean',
        default: true,
        description: 'Use multi-stage build for smaller images (TypeScript only)',
      },
    },
    required: ['language'],
  },
};

/**
 * Handler for export_docker tool
 */
export async function handleExportDocker(args: {
  language: 'typescript' | 'python';
  server_name?: string;
  port?: number;
  env_vars?: Record<string, string>;
  include_healthcheck?: boolean;
  multi_stage?: boolean;
}): Promise<TextContent> {
  try {
    const { language, server_name, port, env_vars, include_healthcheck, multi_stage } = args;
    const template = DOCKER_TEMPLATES[language];
    const serviceName = server_name || 'mcp-server';

    let dockerfile = template.dockerfile;
    let dockerCompose = template.dockerCompose;

    // Customize Dockerfile
    if (language === 'typescript' && multi_stage !== false) {
      dockerfile = `# TypeScript MCP Server Dockerfile (Multi-stage)
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

${include_healthcheck ? `# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD node -e "console.log('healthy')" || exit 1
` : ''}
# Run the server
CMD ["node", "dist/index.js"]
`;
    }

    if (include_healthcheck && language === 'python') {
      dockerfile = dockerfile.replace(
        'CMD ["python", "-m", "mcp_server"]',
        `# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD python -c "print('healthy')" || exit 1

# Run the server
CMD ["python", "-m", "mcp_server"]`
      );
    }

    // Customize docker-compose.yml
    dockerCompose = dockerCompose.replace('mcp-server:', `${serviceName}:`);

    if (port) {
      dockerCompose = dockerCompose.replace(
        'restart: unless-stopped',
        `ports:
      - "${port}:${port}"
    restart: unless-stopped`
      );
    }

    if (env_vars && Object.keys(env_vars).length > 0) {
      const envEntries = Object.entries(env_vars)
        .map(([key, value]) => `      - ${key}=${value}`)
        .join('\n');
      
      dockerCompose = dockerCompose.replace(
        /environment:\n(.*?\n)+/m,
        `environment:\n${envEntries}\n`
      );
    }

    // Generate shell script for building and running
    const shellScript = language === 'typescript' ? `#!/bin/bash
# Build and run the MCP server in Docker

# Build the image
docker build -t ${serviceName} .

# Run with stdio (typical MCP usage)
docker run -it --rm ${serviceName}

# Or run with docker-compose
# docker-compose up -d
` : `#!/bin/bash
# Build and run the MCP server in Docker

# Build the image
docker build -t ${serviceName} .

# Run with stdio (typical MCP usage)
docker run -it --rm ${serviceName}

# Or run with docker-compose
# docker-compose up -d
`;

    const output = `# Docker Configuration for ${serviceName}

## Dockerfile

\`\`\`dockerfile
${dockerfile}
\`\`\`

## docker-compose.yml

\`\`\`yaml
${dockerCompose}
\`\`\`

## .dockerignore

\`\`\`
${template.dockerignore}
\`\`\`

## Build and Run Script (build.sh)

\`\`\`bash
${shellScript}
\`\`\`

## Usage Instructions

1. Save the Dockerfile to your project root
2. Save docker-compose.yml to your project root
3. Save .dockerignore to your project root
4. Build the image:
   \`\`\`bash
   docker build -t ${serviceName} .
   \`\`\`
5. Run the container:
   \`\`\`bash
   # For stdio-based MCP (typical)
   docker run -it --rm ${serviceName}
   
   # With docker-compose
   docker-compose up -d
   \`\`\`

## Integration with Claude Desktop

Add to your Claude Desktop config:

\`\`\`json
{
  "mcpServers": {
    "${serviceName}": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "${serviceName}"]
    }
  }
}
\`\`\`
`;

    return {
      type: 'text',
      text: output,
    };
  } catch (error) {
    return {
      type: 'text',
      text: `Error generating Docker config: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
