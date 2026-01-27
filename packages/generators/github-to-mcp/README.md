<p align="center">
  <img src="apps/web/public/logo.svg" alt="GitHub to MCP" width="120" height="120" />
</p>

<h1 align="center">GitHub to MCP</h1>

<p align="center">
  <strong>Convert any GitHub repository into an MCP server in seconds</strong>
</p>

<p align="center">
  Give Claude, ChatGPT, Cursor, Windsurf, Cline, and any AI assistant instant access to any codebase.
</p>

<p align="center">
  <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://www.npmjs.com/package/@nirholas/github-to-mcp"><img src="https://img.shields.io/npm/v/@nirholas/github-to-mcp.svg" alt="npm version" /></a>
  <a href="https://github.com/nirholas/github-to-mcp/stargazers"><img src="https://img.shields.io/github/stars/nirholas/github-to-mcp.svg?style=social" alt="GitHub Stars" /></a>
</p>

<p align="center">
  <a href="https://github-to-mcp.vercel.app">🌐 Web App</a> •
  <a href="#-quick-start">🚀 Quick Start</a> •
  <a href="#-features">✨ Features</a> •
  <a href="https://docs-github-to-mcp.vercel.app">📖 Docs</a>
</p>

---

## 📋 Table of Contents

- [Introduction](#-introduction)
- [What is MCP](#-what-is-mcp)
- [Quick Start](#-quick-start)
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [How It Works](#-how-it-works)
- [Generated Tools](#-generated-tools)
- [Configuration](#%EF%B8%8F-configuration)
- [Integrating with AI Assistants](#-integrating-with-ai-assistants)
- [Interactive Playground](#-interactive-playground)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Architecture Overview](#-architecture-overview)
- [Supported Input Formats](#-supported-input-formats)
- [Output Formats](#-output-formats)
- [Limitations](#%EF%B8%8F-limitations)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📖 Introduction

GitHub to MCP bridges the gap between code repositories and AI assistants. Instead of manually describing APIs or copying code snippets into chat windows, this tool generates a standardized interface that allows AI systems to programmatically explore, read, and interact with any GitHub repository.

The generated MCP servers provide tools that AI assistants can invoke to read files, search code, list directory structures, and call API endpoints discovered within the repository. This enables AI assistants to have deep, structured access to codebases without requiring manual context management.

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  1. Fetch & Classify  →  Detect repo type (API/CLI/Lib)     │
│  2. Extract Tools     →  OpenAPI, GraphQL, Code, README     │
│  3. Generate Server   →  TypeScript or Python MCP server    │
│  4. Bundle Output     →  Complete package with dependencies │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Ready-to-use MCP Server + Config               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 What is MCP

The **Model Context Protocol (MCP)** is an open standard developed by Anthropic that defines how AI assistants communicate with external tools and data sources. MCP servers expose "tools" that AI models can invoke, along with "resources" that provide context and "prompts" that guide interactions.

When you connect an MCP server to an AI assistant like Claude Desktop, the assistant gains the ability to call the tools defined by that server. For example, a GitHub MCP server might expose tools like `read_file`, `search_code`, or `list_pull_requests`, which the AI can invoke to gather information needed to answer questions or complete tasks.

This project generates MCP servers from GitHub repositories, automatically creating tools based on the repository's contents, APIs, and documentation.

---

## 🚀 Quick Start

### 🌐 Web UI (Easiest)

Visit **[github-to-mcp.vercel.app](https://github-to-mcp.vercel.app)** — Paste any GitHub URL, click Generate, download your MCP server.

### 💻 CLI (One Command)

```bash
npx @nirholas/github-to-mcp https://github.com/stripe/stripe-node
```

### 📦 Programmatic (For Automation)

```typescript
import { generateFromGithub } from '@nirholas/github-to-mcp';

const result = await generateFromGithub('https://github.com/stripe/stripe-node');
console.log(`Generated ${result.tools.length} tools`);
await result.save('./my-mcp-server');
```

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔬 Repository Analysis
- Automatic repository type classification (API, library, CLI tool, MCP server, documentation)
- Detection and parsing of OpenAPI/Swagger specifications
- GraphQL schema extraction and query/mutation tool generation
- gRPC/Protobuf service definition parsing
- AsyncAPI specification support for event-driven APIs
- Source code analysis for function extraction

</td>
<td width="50%">

### 🌍 Multi-Language Support

**Input repositories:**
- TypeScript and JavaScript
- Python
- Go
- Java and Kotlin
- Rust
- Ruby
- C# and F#

**Output MCP servers:**
- TypeScript (using the official MCP SDK)
- Python (using the MCP Python SDK)
- Go (using community MCP libraries)

</td>
</tr>
<tr>
<td width="50%">

### 🔧 Tool Extraction
- OpenAPI endpoints become callable tools with typed parameters
- GraphQL queries and mutations become tools with input validation
- Python functions decorated with `@mcp.tool` are preserved
- CLI commands documented in READMEs become executable tools
- HTTP route handlers from popular frameworks are detected

</td>
<td width="50%">

### ⚡ Code Generation
- Complete, runnable MCP server code with all dependencies
- Configuration files for Claude Desktop, Cursor, and other clients
- Docker deployment templates
- TypeScript type definitions for all generated tools

</td>
</tr>
</table>

---

## 📥 Installation

### From Source

Clone the repository and install dependencies:

```bash
git clone https://github.com/nirholas/github-to-mcp.git
cd github-to-mcp
pnpm install
pnpm build
```

### Using the Web Interface

The web application is deployed at **[github-to-mcp.vercel.app](https://github-to-mcp.vercel.app)**. Use the browser-based interface without any local installation.

---

## 📖 Usage

### 🌐 Web Interface

The web interface provides the simplest way to convert repositories:

1. Navigate to the web application
2. Enter a GitHub repository URL (e.g., `https://github.com/owner/repo`)
3. Optionally configure extraction options
4. Click "Generate" to analyze the repository
5. Review the generated tools and code
6. Download the MCP server package or copy the configuration

The web interface also provides an interactive playground where you can test generated tools before downloading.

### 💻 Command Line Interface

After building the project locally, you can use the CLI:

```bash
# Basic usage
node packages/core/dist/cli.mjs https://github.com/owner/repo

# Specify output directory
node packages/core/dist/cli.mjs https://github.com/owner/repo --output ./my-mcp-server

# Generate Python instead of TypeScript
node packages/core/dist/cli.mjs https://github.com/owner/repo --language python

# Include only specific extraction sources
node packages/core/dist/cli.mjs https://github.com/owner/repo --sources openapi,readme

# Use a GitHub token for private repos or higher rate limits
GITHUB_TOKEN=ghp_xxx node packages/core/dist/cli.mjs https://github.com/owner/repo
```

### 📦 Programmatic API

Import the generator in your own TypeScript or JavaScript code:

```typescript
import { GithubToMcpGenerator } from '@nirholas/github-to-mcp';

const generator = new GithubToMcpGenerator({
  githubToken: process.env.GITHUB_TOKEN,
  sources: ['openapi', 'readme', 'code'],
  outputLanguage: 'typescript'
});

const result = await generator.generate('https://github.com/owner/repo');

console.log(`Repository: ${result.name}`);
console.log(`Classification: ${result.classification.type}`);
console.log(`Generated ${result.tools.length} tools`);

// Access the generated code
console.log(result.code);

// Save to disk
await result.save('./output-directory');
```

<details>
<summary><strong>📋 Generator Options Interface</strong></summary>

```typescript
interface GithubToMcpOptions {
  // GitHub personal access token for API authentication
  githubToken?: string;
  
  // Which sources to extract tools from
  // Default: ['openapi', 'readme', 'code', 'graphql', 'mcp']
  sources?: Array<'openapi' | 'readme' | 'code' | 'graphql' | 'grpc' | 'mcp'>;
  
  // Output language for generated server
  // Default: 'typescript'
  outputLanguage?: 'typescript' | 'python' | 'go';
  
  // Include universal tools (read_file, list_files, etc.)
  // Default: true
  includeUniversalTools?: boolean;
  
  // Maximum number of tools to generate
  // Default: 100
  maxTools?: number;
  
  // Specific branch to analyze
  // Default: repository's default branch
  branch?: string;
}
```

</details>

---

## ⚙️ How It Works

The conversion process follows these stages:

### 🏷️ Repository Classification

The generator first analyzes the repository to determine its type and structure:

1. Fetch repository metadata from the GitHub API
2. Download and parse the README file
3. Examine package.json, setup.py, go.mod, or other manifest files
4. Scan for API specification files (openapi.json, schema.graphql, etc.)
5. Classify the repository as one of:

| Classification | Description |
|----------------|-------------|
| `mcp-server` | An existing MCP server implementation |
| `api-sdk` | A client library for an API |
| `cli-tool` | A command-line application |
| `library` | A general-purpose code library |
| `documentation` | Primarily documentation content |
| `data` | Data files or datasets |
| `unknown` | Unclassified repository |

Classification influences which extraction strategies are prioritized and how tools are named.

### 🔍 Tool Extraction

Tools are extracted from multiple sources within the repository:

<details>
<summary><strong>📄 OpenAPI/Swagger Extraction</strong></summary>

When an OpenAPI specification is found:
1. Parse the specification (JSON or YAML, v2 or v3)
2. Extract each endpoint as a potential tool
3. Convert path parameters, query parameters, and request bodies to tool input schemas
4. Generate descriptions from operation summaries and descriptions
5. Map HTTP methods to appropriate tool semantics

</details>

<details>
<summary><strong>🔷 GraphQL Extraction</strong></summary>

When GraphQL schemas are found:
1. Parse .graphql or .gql schema files
2. Extract Query type fields as read-only tools
3. Extract Mutation type fields as write tools
4. Convert GraphQL input types to JSON Schema for tool inputs
5. Handle nested types and custom scalars

</details>

<details>
<summary><strong>📖 README Extraction</strong></summary>

The README is analyzed for:
1. Code blocks showing CLI usage patterns
2. API endpoint examples with curl or fetch
3. Function call examples with parameters
4. Installation and usage instructions

Extracted examples become tools with inferred parameter schemas.

</details>

<details>
<summary><strong>💻 Source Code Extraction</strong></summary>

For supported languages, the source code is analyzed:
1. **Python**: Functions decorated with `@mcp.tool`, `@server.tool`, or similar
2. **TypeScript**: Exported functions with JSDoc annotations
3. **Go**: HTTP handlers from Gin, Echo, Chi, Fiber, or Gorilla Mux
4. **Java/Kotlin**: Methods annotated with `@GetMapping`, `@PostMapping`, etc.
5. **Rust**: Route handlers from Actix-web, Axum, or Rocket

</details>

<details>
<summary><strong>🔌 MCP Server Introspection</strong></summary>

If the repository is already an MCP server:
1. Detect `server.tool()` definitions
2. Extract tool names, descriptions, and schemas
3. Preserve existing tool implementations where possible

</details>

### 🏗️ Code Generation

After tools are extracted, the generator produces:

1. A main server file implementing the MCP protocol
2. Tool handler functions for each extracted tool
3. Type definitions for all input and output schemas
4. A package.json or equivalent with required dependencies
5. Configuration files for popular MCP clients
6. Optional Docker deployment files

The generated code is complete and runnable without modification.

---

## 🛠️ Generated Tools

### 🌐 Universal Tools

Every generated MCP server includes these baseline tools for repository exploration:

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_readme` | Retrieve the repository's README content | None |
| `list_files` | List files and directories at a given path | `path` (optional, defaults to root) |
| `read_file` | Read the contents of a specific file | `path` (required) |
| `search_code` | Search for patterns across the repository | `query` (required), `path` (optional) |

These tools ensure that even if no APIs or functions are detected, the AI assistant can still explore and understand the repository.

### 🔧 Extracted Tools

Additional tools are generated based on repository contents:

#### From OpenAPI Specifications

Each API endpoint becomes a tool:

```
POST /users      →  create_user(name: string, email: string)
GET /users/{id}  →  get_user(id: string)
PUT /users/{id}  →  update_user(id: string, name?: string, email?: string)
DELETE /users/{id} →  delete_user(id: string)
GET /users       →  list_users(page?: number, limit?: number)
```

#### From GraphQL Schemas

Queries and mutations become tools:

```graphql
type Query {
  user(id: ID!): User         →  get_user(id: string)
  users(first: Int): [User]   →  list_users(first?: number)
}

type Mutation {
  createUser(input: CreateUserInput!): User  →  create_user(input: object)
}
```

#### From Python Code

```python
@server.tool()
async def analyze_sentiment(text: str) -> str:
    """Analyze the sentiment of the given text."""
    # Implementation
```

Becomes: `analyze_sentiment(text: string)` → "Analyze the sentiment of the given text."

#### From README Examples

CLI commands documented in READMEs:

```bash
# Create a new project
mycli create --name myproject --template typescript
```

Becomes: `mycli_create(name: string, template?: string)`

---

## ⚙️ Configuration

### 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub personal access token for API access | No (but recommended) |
| `GITHUB_API_URL` | Custom GitHub API URL for Enterprise | No |

#### GitHub Token

Without a token, GitHub API requests are limited to **60 per hour**. With a token, the limit increases to **5,000 per hour**. For private repositories, a token with appropriate access is required.

Create a token at: https://github.com/settings/tokens

**Required scopes:**
- `repo` (for private repositories)
- `public_repo` (for public repositories only)

### 🎛️ Generator Options

When using the programmatic API, you can configure:

```typescript
const generator = new GithubToMcpGenerator({
  // Authentication
  githubToken: process.env.GITHUB_TOKEN,
  
  // Extraction sources to enable
  sources: ['openapi', 'readme', 'code', 'graphql', 'grpc', 'mcp'],
  
  // Output configuration
  outputLanguage: 'typescript', // or 'python', 'go'
  
  // Tool filtering
  includeUniversalTools: true,
  maxTools: 100,
  
  // Repository options
  branch: 'main', // specific branch to analyze
});
```

---

## 🤖 Integrating with AI Assistants

### <img src="https://claude.ai/favicon.ico" width="16" height="16" /> Claude Desktop

Add the generated server to your Claude Desktop configuration:

| Platform | Config Path |
|----------|-------------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "my-repo": {
      "command": "node",
      "args": ["/absolute/path/to/generated/server.mjs"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxx"
      }
    }
  }
}
```

> ⚠️ Restart Claude Desktop after modifying the configuration.

### <img src="https://cursor.sh/favicon.ico" width="16" height="16" /> Cursor

Cursor supports MCP servers through its settings. Add the server path in Cursor's MCP configuration panel, or edit the configuration file directly:

```json
{
  "mcp": {
    "servers": {
      "my-repo": {
        "command": "node",
        "args": ["/path/to/server.mjs"]
      }
    }
  }
}
```

### 💻 VS Code with Continue

If using the Continue extension for VS Code:

```json
{
  "models": [...],
  "mcpServers": {
    "my-repo": {
      "command": "node",
      "args": ["/path/to/server.mjs"]
    }
  }
}
```

### 🔌 Other MCP Clients

Any MCP-compatible client can use the generated servers. The server communicates over stdio by default, accepting JSON-RPC messages on stdin and responding on stdout.

To run manually:

```bash
node server.mjs
```

The server will wait for MCP protocol messages on stdin.

---

## 🎮 Interactive Playground

The web application includes an interactive playground for testing generated tools:

1. After generating tools from a repository, click **"Open in Playground"**
2. Select a tool from the list
3. Fill in the required parameters
4. Click **"Execute"** to run the tool
5. View the JSON response

The playground executes tools in a sandboxed environment and displays results in real-time.

### 🔗 Sharing Playground Sessions

You can share your generated tools with others:

| Parameter | Description |
|-----------|-------------|
| `?code=<base64>` | Base64-encoded TypeScript server code |
| `?gist=<id>` | GitHub Gist ID containing server code |
| `?name=<name>` | Display name for the server |

**Example:**
```
https://github-to-mcp.vercel.app/playground?gist=abc123&name=My%20API
```

---

## 📁 Project Structure

```
github-to-mcp/
├── 📂 apps/
│   ├── 📂 web/                    # Next.js web application
│   │   ├── 📂 app/                # Next.js App Router pages
│   │   │   ├── 📂 api/            # API routes for conversion
│   │   │   ├── 📂 convert/        # Conversion page
│   │   │   ├── 📂 playground/     # Interactive playground
│   │   │   └── 📂 dashboard/      # User dashboard
│   │   ├── 📂 components/         # React components
│   │   ├── 📂 hooks/              # Custom React hooks
│   │   ├── 📂 lib/                # Utility functions
│   │   └── 📂 types/              # TypeScript type definitions
│   └── 📂 vscode/                 # VS Code extension (in development)
│
├── 📂 packages/
│   ├── 📂 core/                   # Main conversion engine
│   │   └── 📂 src/
│   │       ├── index.ts           # GithubToMcpGenerator class
│   │       ├── github-client.ts   # GitHub API client
│   │       ├── readme-extractor.ts    # README parsing
│   │       ├── code-extractor.ts      # Source code analysis
│   │       ├── graphql-extractor.ts   # GraphQL schema parsing
│   │       ├── mcp-introspector.ts    # Existing MCP server detection
│   │       ├── python-generator.ts    # Python output generation
│   │       ├── go-generator.ts        # Go output generation
│   │       └── types.ts               # Type definitions
│   │
│   ├── 📂 openapi-parser/         # OpenAPI specification parser
│   │   └── 📂 src/
│   │       ├── parser.ts          # OpenAPI parsing logic
│   │       ├── analyzer.ts        # Endpoint analysis
│   │       ├── transformer.ts     # Schema transformation
│   │       └── generator.ts       # Tool generation
│   │
│   ├── 📂 mcp-server/             # MCP server utilities
│   │   └── 📂 src/
│   │       ├── server.ts          # Base MCP server implementation
│   │       └── tools.ts           # Tool registration helpers
│   │
│   └── 📂 registry/               # Tool registry management
│       └── 📂 src/
│           └── index.ts           # Registry operations
│
├── 📂 mkdocs/                     # Documentation site (MkDocs)
│   ├── 📂 docs/                   # Markdown documentation
│   └── mkdocs.yml                 # MkDocs configuration
│
├── 📂 tests/                      # Integration tests
│   ├── 📂 fixtures/               # Test fixture repositories
│   │   ├── 📂 express-app/        # Express.js test app
│   │   ├── 📂 fastapi-app/        # FastAPI test app
│   │   ├── 📂 graphql/            # GraphQL test schemas
│   │   └── 📂 openapi/            # OpenAPI test specs
│   └── 📂 integration/            # Integration test files
│
├── 📂 templates/                  # Code generation templates
│   ├── Dockerfile.python.template
│   └── Dockerfile.typescript.template
│
├── package.json                   # Root package configuration
├── pnpm-workspace.yaml            # pnpm workspace configuration
├── tsconfig.json                  # TypeScript configuration
└── vitest.config.ts               # Test configuration
```

---

## 🔨 Development

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 22.x or later |
| pnpm | 10.x or later |
| Git | 2.x or later |

### Local Setup

```bash
# Clone the repository
git clone https://github.com/nirholas/github-to-mcp.git
cd github-to-mcp

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the development server
pnpm dev
```

The web application will be available at `http://localhost:3000`.

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @nirholas/github-to-mcp build
pnpm --filter @github-to-mcp/openapi-parser build
pnpm --filter web build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test -- tests/integration/openapi-conversion.test.ts
```

### Code Quality

```bash
# Run linting
pnpm lint

# Type checking
pnpm typecheck
```

---

## 🏗️ Architecture Overview

The system follows a pipeline architecture:

```
Input (GitHub URL)
       │
       ▼
┌──────────────────┐
│  GitHub Client   │  Fetches repository metadata, files, and README
└──────────────────┘
       │
       ▼
┌──────────────────┐
│   Classifier     │  Determines repository type and structure
└──────────────────┘
       │
       ▼
┌──────────────────┐
│   Extractors     │  Multiple extractors run in parallel:
│  ├─ OpenAPI      │  • Parse API specifications
│  ├─ GraphQL      │  • Parse GraphQL schemas
│  ├─ README       │  • Extract examples from documentation
│  ├─ Code         │  • Analyze source code
│  └─ MCP          │  • Detect existing MCP tools
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Deduplicator    │  Removes duplicate tools, merges similar ones
└──────────────────┘
       │
       ▼
┌──────────────────┐
│   Validator      │  Validates tool schemas, adds confidence scores
└──────────────────┘
       │
       ▼
┌──────────────────┐
│   Generator      │  Produces output code in target language
└──────────────────┘
       │
       ▼
Output (MCP Server Code + Configuration)
```

Each extractor produces a list of `ExtractedTool` objects with a standardized schema. The deduplicator and validator ensure consistency before the generator produces the final output.

---

## 📥 Supported Input Formats

### API Specifications

| Format | File Patterns | Version Support |
|--------|---------------|-----------------|
| **OpenAPI** | `openapi.json`, `openapi.yaml`, `swagger.json`, `swagger.yaml`, `api.json`, `api.yaml` | 2.0, 3.0.x, 3.1.x |
| **GraphQL** | `schema.graphql`, `*.gql`, `schema.json` | June 2018 spec |
| **gRPC** | `*.proto` | proto3 |
| **AsyncAPI** | `asyncapi.json`, `asyncapi.yaml` | 2.x |

### Source Code Languages

| Language | Framework Detection |
|----------|---------------------|
| **TypeScript/JavaScript** | Express, Fastify, Hono, Next.js API routes |
| **Python** | FastAPI, Flask, Django REST, MCP SDK decorators |
| **Go** | Gin, Echo, Chi, Fiber, Gorilla Mux |
| **Java** | Spring Boot, JAX-RS, Micronaut |
| **Kotlin** | Ktor, Spring Boot |
| **Rust** | Actix-web, Axum, Rocket |
| **Ruby** | Rails, Sinatra, Grape |

---

## 📤 Output Formats

### TypeScript Server

The default output is a TypeScript MCP server using the official `@modelcontextprotocol/sdk` package:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'generated-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [/* generated tools */],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Tool dispatch logic
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Python Server

Python output uses the MCP Python SDK:

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server

server = Server("generated-server")

@server.tool()
async def example_tool(param: str) -> str:
    """Tool description."""
    # Implementation
    
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### Configuration Files

Each generated server includes:

| File | Description |
|------|-------------|
| `claude_desktop_config.json` | Claude Desktop configuration snippet |
| `cursor_config.json` | Cursor editor configuration |
| `package.json` or `requirements.txt` | Dependencies |
| `Dockerfile` (optional) | Container deployment |

---

## ⚠️ Limitations

<details>
<summary><strong>🔄 GitHub API Rate Limits</strong></summary>

- Unauthenticated requests: **60 per hour**
- Authenticated requests: **5,000 per hour**
- Large repositories may require multiple API calls

Provide a `GITHUB_TOKEN` to increase rate limits.

</details>

<details>
<summary><strong>📦 Repository Size</strong></summary>

- Very large repositories (>1GB) may time out during analysis
- Repositories with thousands of files may hit API limits
- Consider analyzing specific subdirectories for monorepos

</details>

<details>
<summary><strong>🎯 Tool Extraction Accuracy</strong></summary>

- OpenAPI specs produce the most accurate tools
- README extraction relies on consistent documentation formatting
- Source code analysis may miss dynamically defined routes
- Confidence scores indicate extraction reliability

</details>

<details>
<summary><strong>🌍 Language Support</strong></summary>

- TypeScript output is the most mature
- Python output is functional but may require minor edits
- Go output is experimental

</details>

---

## 🔧 Troubleshooting

<details>
<summary><strong>❌ "Rate limit exceeded" errors</strong></summary>

Provide a GitHub token:
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

</details>

<details>
<summary><strong>❌ "Repository not found" errors</strong></summary>

- Verify the URL is correct
- For private repositories, ensure your token has `repo` scope
- Check that the repository exists and is accessible

</details>

<details>
<summary><strong>❌ "No tools extracted" results</strong></summary>

- Verify the repository contains API definitions or documented endpoints
- Try enabling all extraction sources: `--sources openapi,readme,code,graphql,mcp`
- Check that specification files follow standard naming conventions

</details>

<details>
<summary><strong>❌ Generated server fails to start</strong></summary>

- Ensure Node.js 22+ is installed
- Run `npm install` in the generated directory
- Check for TypeScript compilation errors with `npx tsc --noEmit`

</details>

<details>
<summary><strong>❌ Claude Desktop does not show the server</strong></summary>

- Verify the path in `claude_desktop_config.json` is absolute
- Restart Claude Desktop after configuration changes
- Check Claude Desktop logs for connection errors

</details>

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:

- Setting up the development environment
- Code style and formatting requirements
- Testing requirements
- Pull request process

### 🐛 Reporting Issues

When reporting issues, please include:

- Repository URL that caused the issue (if public)
- Error messages or unexpected behavior
- Node.js and pnpm versions
- Operating system

---

## 📄 License

Apache 2.0. See [LICENSE](LICENSE) for details.

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| 📖 Documentation | [docs-github-to-mcp.vercel.app](https://docs-github-to-mcp.vercel.app) |
| 🌐 Web App | [github-to-mcp.vercel.app](https://github-to-mcp.vercel.app) |
| 📦 npm Package | [npmjs.com/package/@nirholas/github-to-mcp](https://www.npmjs.com/package/@nirholas/github-to-mcp) |
| 🔗 MCP Specification | [modelcontextprotocol.io](https://modelcontextprotocol.io) |
| 📘 MCP TypeScript SDK | [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) |
| 🐍 MCP Python SDK | [github.com/modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) |
| 💬 Discussions | [github.com/nirholas/github-to-mcp/discussions](https://github.com/nirholas/github-to-mcp/discussions) |

---

<p align="center">
  Built by <a href="https://x.com/nichxbt">nich</a>
</p>
