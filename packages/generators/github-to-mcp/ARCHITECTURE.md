# GitHub to MCP - Complete Architecture Documentation

> **Last Updated**: January 17, 2026  
> **Version**: 1.0.0  
> **Maintained by**: nirholas

## 📖 Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Core Architecture](#core-architecture)
- [Packages](#packages)
- [Web Application](#web-application)
- [Data Flow](#data-flow)
- [API Reference](#api-reference)
- [Component Reference](#component-reference)
- [Development Guide](#development-guide)
- [Deployment](#deployment)

---

## Overview

**GitHub to MCP** is a monorepo project that converts any GitHub repository into a Model Context Protocol (MCP) server. It provides multiple interfaces:

- **Web UI**: Next.js application for browser-based conversion
- **CLI**: Command-line tool for terminal usage
- **Programmatic API**: TypeScript/JavaScript library
- **MCP Server**: Exposes conversion as MCP tools

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion |
| **Backend Core** | Node.js, TypeScript, Octokit (GitHub API) |
| **Parsers** | OpenAPI Parser, GraphQL Parser, AST Parsers |
| **Build System** | pnpm workspaces, tsup, Next.js |
| **Testing** | Vitest, React Testing Library |
| **Deployment** | Vercel (Web), npm (CLI/Packages) |

---

## Project Structure

```
github-to-mcp/
├── 📁 apps/                        # Applications
│   ├── web/                        # Next.js web application
│   ├── docs/                       # Documentation site
│   └── vscode/                     # VS Code extension
│
├── 📁 packages/                    # Shared packages
│   ├── core/                       # Core conversion engine
│   ├── openapi-parser/             # OpenAPI/GraphQL parser
│   └── mcp-server/                 # MCP server implementation
│
├── 📁 tests/                       # Integration tests
│   └── fixtures/                   # Test fixtures
│
├── 📁 templates/                   # Code generation templates
│
├── 📄 pnpm-workspace.yaml         # pnpm workspace configuration
├── 📄 package.json                # Root package.json
├── 📄 tsconfig.json               # TypeScript base config
└── 📄 vitest.config.ts            # Test configuration
```

---

## Core Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input (GitHub URL)                   │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│              GithubToMcpGenerator (packages/core)                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. Fetch Repository                                        │  │
│  │    - GithubClient: Fetch metadata, README, files          │  │
│  │    - Caching: Redis/Upstash for rate limit management     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                ↓                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 2. Classify Repository                                     │  │
│  │    - Analyze README and package.json                       │  │
│  │    - Determine: mcp-server | api-sdk | cli-tool |         │  │
│  │      library | documentation | data | unknown              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                ↓                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 3. Extract Tools from Multiple Sources                     │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ OpenAPI/Swagger Specs                           │    │  │
│  │    │ - Find openapi.json, swagger.yaml               │    │  │
│  │    │ - Parse endpoints → MCP tools                    │    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ GraphQL Schemas                                  │    │  │
│  │    │ - Find schema.graphql, .gql files               │    │  │
│  │    │ - Parse queries/mutations → MCP tools            │    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ README Documentation                             │    │  │
│  │    │ - Extract CLI commands, API examples            │    │  │
│  │    │ - Parse code blocks → MCP tools                  │    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ Source Code Analysis                             │    │  │
│  │    │ - Python: @mcp.tool decorators                   │    │  │
│  │    │ - TypeScript: function exports                   │    │  │
│  │    │ - Rust/Go/Java: annotated functions              │    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ MCP Server Introspection                         │    │  │
│  │    │ - Detect existing MCP servers                    │    │  │
│  │    │ - Extract tool definitions                       │    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ Universal Tools (always included)                │    │  │
│  │    │ - read_file, list_files, search_code, get_readme│    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                ↓                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 4. Deduplicate & Validate Tools                            │  │
│  │    - Remove duplicate tools by name                        │  │
│  │    - Validate input schemas                                │  │
│  │    - Calculate confidence scores                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                ↓                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 5. Generate MCP Server Code                                │  │
│  │    - TypeScript: Full MCP server with SDK                  │  │
│  │    - Python: Flask/FastAPI-based MCP server                │  │
│  │    - Generate configs: Claude, Cursor, OpenAI              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Output (Multiple Formats)                     │
│  - TypeScript MCP Server                                         │
│  - Python MCP Server                                             │
│  - Configuration files (JSON)                                    │
│  - Docker deployment files                                       │
│  - OpenAPI specification                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Plugin Architecture**: Extractors are modular and extensible
2. **Multi-Source**: Extract from docs, specs, and code simultaneously
3. **Language-Agnostic**: Works with any language GitHub repo
4. **Caching**: Aggressive caching to respect GitHub rate limits
5. **Progressive Enhancement**: Universal tools + smart extraction
6. **Type Safety**: Full TypeScript throughout codebase

---

## Packages

### 1. `@nirholas/github-to-mcp` (packages/core)

**Purpose**: Core conversion engine and CLI

#### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main generator class and exports |
| `src/github-client.ts` | GitHub API client with caching |
| `src/readme-extractor.ts` | Extract tools from README |
| `src/code-extractor.ts` | AST-based code analysis |
| `src/graphql-extractor.ts` | GraphQL schema parser |
| `src/mcp-introspector.ts` | MCP server detection |
| `src/python-generator.ts` | Python code generation |
| `src/docker-generator.ts` | Dockerfile generation |
| `src/cli.ts` | Command-line interface |
| `src/types.ts` | TypeScript type definitions |

#### Main Class: `GithubToMcpGenerator`

```typescript
class GithubToMcpGenerator {
  constructor(options: GithubToMcpOptions)
  
  async generate(githubUrl: string): Promise<GenerationResult>
  
  // Private methods
  private async classifyRepo()
  private async extractFromOpenApi()
  private async extractFromReadme()
  private async extractFromCode()
  private async extractFromGraphQL()
  private async introspectMcpServer()
  private generateUniversalTools()
  private deduplicateTools()
  private async generateCode()
  private async saveToFiles()
}
```

#### Tool Extraction Pipeline

```typescript
// 1. OpenAPI Extraction
const openapiTools = await extractFromOpenApi(owner, repo);
// Finds: openapi.json, swagger.yaml, api-spec.yaml
// Converts: Each endpoint → MCP tool with typed params

// 2. README Extraction
const readmeTools = await extractFromReadme(owner, repo);
// Finds: CLI commands, API examples, usage patterns
// Converts: Code blocks → MCP tools

// 3. Code Extraction
const codeTools = await extractFromCode(owner, repo);
// Finds: @mcp.tool, exported functions, decorators
// Supports: Python, TypeScript, Rust, Go, Java

// 4. GraphQL Extraction
const graphqlTools = await extractFromGraphQL(owner, repo);
// Finds: schema.graphql, .gql files
// Converts: Queries/Mutations → MCP tools

// 5. MCP Introspection
const mcpTools = await introspectMcpServer(owner, repo);
// Detects existing MCP servers
// Extracts registered tools

// 6. Universal Tools (Always Added)
const universalTools = generateUniversalTools();
// Adds: read_file, list_files, search_code, get_readme
```

#### Configuration Options

```typescript
interface GithubToMcpOptions {
  // Sources to extract from
  sources?: ('readme' | 'openapi' | 'graphql' | 'code')[];
  
  // Output language
  outputLanguage?: 'typescript' | 'python';
  
  // Naming conventions
  naming?: {
    prefix?: string;
    suffix?: string;
    style?: 'camelCase' | 'snake_case' | 'kebab-case';
  };
  
  // GitHub authentication
  githubToken?: string;
  
  // Caching options
  cache?: boolean;
  cacheDir?: string;
  cacheTTL?: {
    metadata?: number;  // Default: 3600s
    files?: number;     // Default: 900s
  };
  
  // Rate limiting
  rateLimit?: {
    maxRequests: number;
    perSeconds: number;
  };
}
```

#### Generation Result

```typescript
interface GenerationResult {
  repo: string;
  name: string;
  tools: ExtractedTool[];
  sources: SourceBreakdown[];
  classification: RepoClassification;
  metadata: RepositoryMetadata;
  
  // Generation methods
  generate(): string;              // TypeScript code
  generatePython(): string;        // Python code
  save(outputDir: string): Promise<void>;
  download(): Buffer;              // Zip file
}
```

### 2. `@github-to-mcp/openapi-parser` (packages/openapi-parser)

**Purpose**: Multi-format API specification parser

#### Supported Formats

- **OpenAPI** 2.0, 3.0, 3.1
- **AsyncAPI** 2.x, 3.x
- **GraphQL** Schema Definition Language
- **Postman** Collections
- **Insomnia** Workspaces
- **HAR** (HTTP Archive)

#### Key Files

| File | Purpose |
|------|---------|
| `src/parser.ts` | OpenAPI spec parsing |
| `src/analyzer.ts` | Endpoint analysis |
| `src/transformer.ts` | OpenAPI → MCP conversion |
| `src/generator.ts` | Code generation |
| `src/ref-resolver.ts` | $ref resolution |
| `src/graphql-parser.ts` | GraphQL parsing |
| `src/postman-parser.ts` | Postman parsing |
| `src/asyncapi-parser.ts` | AsyncAPI parsing |
| `src/generators/` | Framework-specific generators |

#### Main Class: `OpenApiToMcp`

```typescript
class OpenApiToMcp {
  constructor(config: ConverterConfig)
  
  async convert(): Promise<ConversionStats>
  async getMcpTools(): Promise<McpToolDefinition[]>
  async generateCode(format: 'typescript' | 'python'): Promise<string>
  async save(): Promise<void>
}
```

#### Framework Analyzers

```typescript
// Express.js
const expressAnalyzer = new ExpressAnalyzer();
const endpoints = await expressAnalyzer.analyze(['./routes/**/*.js']);

// FastAPI
const fastapiAnalyzer = new FastAPIAnalyzer();
const endpoints = await fastapiAnalyzer.analyze(['./app/**/*.py']);

// Next.js App Router
const nextAnalyzer = new NextJSAnalyzer();
const endpoints = await nextAnalyzer.analyze(['./app/**/*.ts']);

// Generate OpenAPI from code
const spec = await generateOpenApiFromCode('./src', { 
  framework: 'express',
  title: 'My API',
  version: '1.0.0'
});
```

### 3. `@github-to-mcp/mcp-server` (packages/mcp-server)

**Purpose**: MCP server that exposes github-to-mcp as tools

#### Exposed Tools

| Tool | Description |
|------|-------------|
| `convert_repo` | Convert GitHub repo to MCP server |
| `list_extracted_tools` | Preview extractable tools |
| `generate_openapi` | Generate OpenAPI from code |
| `stream_convert` | Server-Sent Events conversion |
| `export_docker` | Generate Docker deployment |
| `list_providers` | List supported Git providers |

#### Usage

```bash
# Start MCP server
npx @github-to-mcp/mcp-server

# Configure in Claude Desktop
{
  "mcpServers": {
    "github-to-mcp": {
      "command": "npx",
      "args": ["@github-to-mcp/mcp-server"]
    }
  }
}
```

---

## Web Application

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Components**: Radix UI primitives
- **State**: React hooks, localStorage
- **Animations**: Framer Motion, CSS animations
- **Particles**: @tsparticles/react

### Directory Structure

```
apps/web/
├── app/                           # Next.js App Router
│   ├── page.tsx                   # Landing page
│   ├── layout.tsx                 # Root layout
│   ├── globals.css                # Global styles
│   │
│   ├── convert/                   # Conversion page
│   │   └── page.tsx
│   │
│   ├── batch/                     # Batch conversion
│   │   ├── page.tsx
│   │   └── BatchConvertClient.tsx
│   │
│   ├── playground/                # Tool tester
│   │   └── page.tsx
│   │
│   └── api/                       # API routes
│       ├── convert/route.ts
│       ├── stream/route.ts
│       └── generate-openapi/route.ts
│
├── components/                    # React components
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Hero.tsx
│   ├── Features.tsx
│   ├── HowItWorks.tsx
│   ├── ParticleBackground.tsx
│   ├── GithubUrlInput.tsx
│   ├── ProductCards.tsx
│   │
│   ├── convert/                   # Conversion components
│   │   ├── ConversionResult.tsx
│   │   ├── ToolCard.tsx
│   │   ├── ConfigTabs.tsx
│   │   └── LoadingSteps.tsx
│   │
│   ├── streaming/                 # Streaming components
│   │   └── StreamingProgress.tsx
│   │
│   ├── docker/                    # Docker export
│   │   └── DockerExport.tsx
│   │
│   ├── install/                   # Installation
│   │   └── OneClickInstall.tsx
│   │
│   ├── batch/                     # Batch conversion
│   │   └── BatchConvert.tsx
│   │
│   └── ui/                        # UI primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── input.tsx
│       └── tabs.tsx
│
├── hooks/                         # Custom React hooks
│   ├── useStreaming.ts
│   ├── useBatchConversion.ts
│   ├── usePlatformDetection.ts
│   └── useDockerConfig.ts
│
├── lib/                           # Utilities
│   ├── utils.ts
│   └── constants.ts
│
└── types/                         # TypeScript types
    └── index.ts
```

### Key Pages

#### 1. Landing Page (`app/page.tsx`)

Features:
- Hero section with particle background
- Feature showcase
- "How It Works" diagram
- Product cards (Web, CLI, API, Docs)
- GitHub URL input for quick conversion

#### 2. Convert Page (`app/convert/page.tsx`)

Features:
- URL parameter support (`?url=...`)
- Loading states with animated steps
- Conversion result display
- Tool list with expandable cards
- Configuration tabs (Claude, Cursor, OpenAI)
- Download options (Code, Config, Docker)
- Conversion history (localStorage)

#### 3. Batch Convert Page (`app/batch/`)

Features:
- Multi-URL input (paste, file import, drag-to-reorder)
- Parallel conversion (configurable concurrency)
- Real-time progress per repo
- Bulk operations (retry, clear, download all)
- Status tracking (pending, converting, success, error)

#### 4. Playground Page (`app/playground/`)

Features:
- Interactive tool tester
- Execute tools with custom inputs
- JSON schema validation
- Response visualization
- History tracking

### Core Components

#### StreamingProgress Component

**File**: `components/streaming/StreamingProgress.tsx`

**Purpose**: Real-time conversion progress via Server-Sent Events

**Features**:
- SSE connection to `/api/stream`
- Animated progress bar (0-100%)
- Step indicators (fetch → analyze → extract → generate)
- Live tool discovery with framer-motion
- Elapsed time tracking
- Live log viewer (50-message history)
- Connection status (connecting, streaming, complete, error)
- Pause/cancel/retry controls

**Props**:
```typescript
interface StreamingProgressProps {
  url: string;
  onComplete: (result: ConversionResult) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  autoStart?: boolean;
}
```

**Usage**:
```tsx
<StreamingProgress
  url="https://github.com/owner/repo"
  onComplete={(result) => console.log(result)}
  onError={(error) => console.error(error)}
  autoStart={true}
/>
```

#### DockerExport Component

**File**: `components/docker/DockerExport.tsx`

**Purpose**: Generate Dockerfile and docker-compose for MCP servers

**Features**:
- Interactive Dockerfile generator
- Multi-stage build support
- Base image selection (Node, Python variants)
- Health check configuration
- Non-root user execution
- OCI labels
- Preview tabs (Dockerfile, Compose, Env, Commands)
- Copy to clipboard & download
- Quick start guide

**Configuration Options**:
```typescript
interface DockerExportOptions {
  baseImage: string;
  port: number;
  exposePorts: number[];
  envVars: Record<string, string>;
  volumes: string[];
  healthCheck: boolean;
  multiStage: boolean;
  runAsNonRoot: boolean;
  labels: boolean;
}
```

**Generated Files**:
- `Dockerfile` - Multi-stage optimized Dockerfile
- `docker-compose.yml` - Complete compose configuration
- `.env.example` - Environment variables template
- Build/run commands

#### OneClickInstall Component

**File**: `components/install/OneClickInstall.tsx`

**Purpose**: Platform-specific installation instructions

**Features**:
- Platform auto-detection (macOS, Windows, Linux, Docker)
- Step-by-step guided installation
- Prerequisites checklist
- Command snippets with copy buttons
- Progress tracking (mark steps complete)
- Optional vs required steps
- Warning/info notes
- Integration guides (Claude Desktop, Cursor, systemd)

**Supported Platforms**:
- macOS (Homebrew, npm)
- Windows (npm, chocolatey)
- Linux (npm, source build, systemd)
- Docker (container deployment)

#### BatchConvert Component

**File**: `components/batch/BatchConvert.tsx`

**Purpose**: Convert multiple repositories in parallel

**Features**:
- Multi-URL input (paste, file import, CSV)
- Drag-to-reorder repos
- Configurable concurrency (1-10 parallel)
- Real-time progress tracking per repo
- Bulk operations:
  - Retry failed conversions
  - Clear completed items
  - Download all results as JSON
- Expandable result cards showing:
  - Tool count, language, stars
  - Individual tool names
  - Error messages
- Status indicators (pending, converting, success, error)
- Pause/resume functionality

**Props**:
```typescript
interface BatchConvertProps {
  onBatchComplete?: (results: Array<{
    url: string;
    result?: ConversionResult;
    error?: string;
  }>) => void;
  maxConcurrent?: number;  // Default: 3
}
```

### Custom Hooks

#### useStreaming

**File**: `hooks/useStreaming.ts`

**Purpose**: Manage SSE streaming connections

```typescript
const {
  status,        // 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'
  progress,      // 0-100
  currentStep,   // Current progress data
  discoveredTools,
  error,
  elapsedTime,
  start,
  stop,
  reset
} = useStreaming(url, {
  autoStart: true,
  onProgress: (data) => {},
  onTool: (tool, index, total) => {},
  onComplete: (result) => {},
  onError: (error) => {}
});
```

#### useBatchConversion

**File**: `hooks/useBatchConversion.ts`

**Purpose**: Manage batch conversion state

```typescript
const {
  items,         // Array of BatchConversionItem
  state,         // 'idle' | 'running' | 'paused' | 'complete'
  stats,         // { total, pending, converting, success, error, progress }
  addUrl,
  addUrls,
  removeItem,
  clearAll,
  clearCompleted,
  retryFailed,
  start,
  pause,
  resume
} = useBatchConversion({
  maxConcurrent: 3,
  onItemComplete: (item) => {},
  onItemError: (item, error) => {},
  onBatchComplete: (items) => {}
});
```

#### usePlatformDetection

**File**: `hooks/usePlatformDetection.ts`

**Purpose**: Detect user's platform and environment

```typescript
const {
  detection,     // { os, arch, nodeVersion, npmVersion, hasDocker, hasPython }
  isDetecting,   // boolean
  platform,      // 'macos' | 'windows' | 'linux' | 'docker'
  refresh
} = usePlatformDetection();
```

#### useDockerConfig

**File**: `hooks/useDockerConfig.ts`

**Purpose**: Generate Docker configuration

```typescript
const {
  options,       // DockerExportOptions
  config,        // { dockerfile, dockerCompose, envExample, buildCommand, runCommand }
  setOptions,
  resetOptions,
  downloadAll
} = useDockerConfig(result, serverName);
```

### API Routes

#### POST /api/convert

**Purpose**: Convert GitHub repository

**Request**:
```typescript
{
  url: string;
  options?: {
    outputLanguage?: 'typescript' | 'python';
    sources?: string[];
    githubToken?: string;
  }
}
```

**Response**:
```typescript
{
  name: string;
  tools: Tool[];
  code: string;
  pythonCode?: string;
  claudeConfig: string;
  cursorConfig: string;
  // ... full ConversionResult
}
```

#### GET /api/stream

**Purpose**: Server-Sent Events streaming conversion

**Query Params**:
- `url`: GitHub repository URL

**Events**:
```typescript
// progress event
{
  type: 'progress',
  data: {
    step: string,
    description: string,
    progress: number,
    details?: string
  }
}

// tool event
{
  type: 'tool',
  data: {
    tool: Tool,
    index: number,
    total: number
  }
}

// complete event
{
  type: 'complete',
  data: {
    result: ConversionResult,
    totalTime: number
  }
}

// error event
{
  type: 'error',
  data: {
    error: string,
    code: string
  }
}
```

#### POST /api/generate-openapi

**Purpose**: Generate OpenAPI from code repository

**Request**:
```typescript
{
  githubUrl: string;
  framework?: 'express' | 'fastapi' | 'nextjs' | 'auto';
  includeExamples?: boolean;
  includeSchemas?: boolean;
}
```

**Response**:
```typescript
{
  openapi: string;        // "3.1.0"
  info: { ... };
  paths: { ... };
  components: { ... };
}
```

### Design System

#### Colors

```css
/* Black/White monochrome palette */
--background: #000000;
--foreground: #ffffff;
--neutral-50: #fafafa;
--neutral-100: #f5f5f5;
--neutral-200: #e5e5e5;
--neutral-300: #d4d4d4;
--neutral-400: #a3a3a3;
--neutral-500: #737373;
--neutral-600: #525252;
--neutral-700: #404040;
--neutral-800: #262626;
--neutral-900: #171717;
--neutral-950: #0a0a0a;
```

#### Typography

```css
/* Font family */
font-family: Inter, system-ui, sans-serif;

/* Scale */
text-xs: 0.75rem;    /* 12px */
text-sm: 0.875rem;   /* 14px */
text-base: 1rem;     /* 16px */
text-lg: 1.125rem;   /* 18px */
text-xl: 1.25rem;    /* 20px */
text-2xl: 1.5rem;    /* 24px */
text-3xl: 1.875rem;  /* 30px */
text-4xl: 2.25rem;   /* 36px */
text-5xl: 3rem;      /* 48px */
```

#### Spacing

```css
/* Scale */
0.5: 0.125rem;   /* 2px */
1: 0.25rem;      /* 4px */
2: 0.5rem;       /* 8px */
3: 0.75rem;      /* 12px */
4: 1rem;         /* 16px */
6: 1.5rem;       /* 24px */
8: 2rem;         /* 32px */
12: 3rem;        /* 48px */
16: 4rem;        /* 64px */
```

#### Components

```css
/* Glass-morphism cards */
.card {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
}

/* Buttons */
.button-primary {
  background: white;
  color: black;
  border-radius: 0.75rem;
  transition: all 0.2s;
}

.button-primary:hover {
  background: #e5e5e5;
}

/* Badges */
.badge {
  border-radius: 9999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  border: 1px solid;
}
```

---

## Data Flow

### Conversion Flow

```
User Input (GitHub URL)
    ↓
Web UI / CLI / API
    ↓
GithubToMcpGenerator.generate()
    ↓
┌────────────────────────────┐
│ 1. Fetch Repository        │
│    - GitHub API (Octokit)  │
│    - Cache (Redis/Memory)  │
└────────────────────────────┘
    ↓
┌────────────────────────────┐
│ 2. Classify Repository     │
│    - Parse README          │
│    - Analyze package.json  │
│    - Detect frameworks     │
└────────────────────────────┘
    ↓
┌────────────────────────────┐
│ 3. Extract Tools           │
│    - OpenAPI Parser        │
│    - GraphQL Parser        │
│    - README Extractor      │
│    - Code Extractor        │
│    - MCP Introspector      │
└────────────────────────────┘
    ↓
┌────────────────────────────┐
│ 4. Deduplicate Tools       │
│    - Merge by name         │
│    - Prefer higher conf.   │
└────────────────────────────┘
    ↓
┌────────────────────────────┐
│ 5. Generate Code           │
│    - TypeScript template   │
│    - Python template       │
│    - Config files          │
└────────────────────────────┘
    ↓
ConversionResult
    ↓
Output (Code, Configs, Docker)
```

### Streaming Flow

```
Client Request (GET /api/stream?url=...)
    ↓
Server (Next.js API Route)
    ↓
Create EventSource Stream
    ↓
GithubToMcpGenerator with Progress Callbacks
    ↓
┌────────────────────────────┐
│ Progress Event             │
│ { type: 'progress', ... }  │
└────────────────────────────┘
    ↓ (sent to client)
Client: StreamingProgress Component
    ↓ (update UI)
Progress Bar, Step Indicator
    ↓
┌────────────────────────────┐
│ Tool Event                 │
│ { type: 'tool', ... }      │
└────────────────────────────┘
    ↓ (sent to client)
Client: Add to discoveredTools[]
    ↓ (animate)
Tool Card Appears
    ↓
┌────────────────────────────┐
│ Complete Event             │
│ { type: 'complete', ... }  │
└────────────────────────────┘
    ↓ (sent to client)
Client: Display ConversionResult
    ↓
Show Tools, Download Options
```

---

## API Reference

### Core API

#### `GithubToMcpGenerator`

```typescript
import { GithubToMcpGenerator } from '@nirholas/github-to-mcp';

const generator = new GithubToMcpGenerator({
  githubToken: process.env.GITHUB_TOKEN,
  outputLanguage: 'typescript',
  cache: true
});

const result = await generator.generate('https://github.com/owner/repo');

console.log(`Generated ${result.tools.length} tools`);
console.log(result.generate());  // TypeScript code
console.log(result.generatePython());  // Python code

await result.save('./output');  // Save to directory
```

#### `convertOpenApiToMcp`

```typescript
import { convertOpenApiToMcp } from '@github-to-mcp/openapi-parser';

const converter = new convertOpenApiToMcp({
  spec: './openapi.json',
  outputDir: './mcp-server',
  baseUrl: 'https://api.example.com'
});

const stats = await converter.convert();
const tools = await converter.getMcpTools();
const code = await converter.generateCode('typescript');
```

#### `generateOpenApiFromCode`

```typescript
import { generateOpenApiFromCode } from '@github-to-mcp/openapi-parser';

const spec = await generateOpenApiFromCode('./src', {
  framework: 'express',
  title: 'My API',
  version: '1.0.0',
  includeExamples: true
});

console.log(JSON.stringify(spec, null, 2));
```

### CLI API

```bash
# Convert repository
npx @nirholas/github-to-mcp convert https://github.com/owner/repo

# With options
npx @nirholas/github-to-mcp convert \
  https://github.com/owner/repo \
  --output-language python \
  --sources readme openapi code \
  --output ./my-mcp-server

# Generate OpenAPI from code
npx @github-to-mcp/openapi-parser generate \
  ./src \
  --framework express \
  --output openapi.json

# Start MCP server
npx @github-to-mcp/mcp-server
```

---

## Component Reference

### UI Components (apps/web/components/ui/)

#### Button

```tsx
import { Button } from '@/components/ui/button';

<Button variant="default" size="lg">
  Click Me
</Button>

// Variants: default, secondary, outline, ghost
// Sizes: sm, default, lg
```

#### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

#### Badge

```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="default">New</Badge>

// Variants: default, secondary, success, warning, error
```

#### Tabs

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

<Tabs defaultValue="typescript">
  <TabsList>
    <TabsTrigger value="typescript">TypeScript</TabsTrigger>
    <TabsTrigger value="python">Python</TabsTrigger>
  </TabsList>
  <TabsContent value="typescript">TS Code</TabsContent>
  <TabsContent value="python">Python Code</TabsContent>
</Tabs>
```

---

## Development Guide

### Setup

```bash
# Clone repository
git clone https://github.com/nirholas/github-to-mcp.git
cd github-to-mcp

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development server
pnpm dev
```

### Scripts

```bash
# Development
pnpm dev              # Start web dev server
pnpm dev:core         # Watch core package

# Build
pnpm build            # Build all packages
pnpm build:core       # Build core only
pnpm build:web        # Build web only

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage
pnpm test:ui          # Vitest UI

# Linting
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript check

# Release
pnpm changeset        # Create changeset
pnpm version-packages # Bump versions
pnpm release          # Publish to npm
```

### Adding a New Extractor

1. Create extractor file in `packages/core/src/extractors/`
2. Implement `Extractor` interface
3. Register in `packages/core/src/extractors/index.ts`
4. Add tests in `packages/core/src/__tests__/`
5. Update documentation

Example:

```typescript
// packages/core/src/extractors/my-extractor.ts
export class MyExtractor {
  async extract(files: FileContent[]): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];
    
    for (const file of files) {
      // Parse file and extract tools
      const extracted = this.parseFile(file);
      tools.push(...extracted);
    }
    
    return tools;
  }
  
  private parseFile(file: FileContent): ExtractedTool[] {
    // Implementation
  }
}
```

### Adding a New Component

1. Create component in `apps/web/components/`
2. Add TypeScript types in `apps/web/types/index.ts`
3. Create tests (if applicable)
4. Export from barrel file
5. Add to Storybook (if applicable)

Example:

```tsx
// apps/web/components/MyComponent.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export default function MyComponent({ title, onAction }: MyComponentProps) {
  const [state, setState] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-neutral-800 p-4"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <button onClick={onAction}>Action</button>
    </motion.div>
  );
}
```

---

## Deployment

### Vercel (Web App)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

Environment Variables:
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
NEXT_PUBLIC_API_URL=https://your-domain.com
```

### npm (Packages)

```bash
# Login to npm
npm login

# Publish all packages
pnpm release

# Publish single package
cd packages/core
npm publish --access public
```

### Docker

```bash
# Build image
docker build -t github-to-mcp-web .

# Run container
docker run -p 3000:3000 github-to-mcp-web

# Docker Compose
docker-compose up
```

---

## Performance Considerations

### Caching Strategy

1. **GitHub API Responses**: 1 hour TTL for metadata, 15 minutes for files
2. **Generated Code**: Cache by repo URL + commit SHA
3. **OpenAPI Parsing**: Cache parsed specs by content hash
4. **Redis/Upstash**: Production caching with TTL

### Rate Limiting

- GitHub API: 5,000 requests/hour (authenticated), 60/hour (unauthenticated)
- Implement exponential backoff
- Use conditional requests (ETags, If-Modified-Since)
- Batch requests where possible

### Optimization

- Lazy load components with React.lazy
- Code splitting per route
- Image optimization with Next.js Image
- Bundle analysis with `@next/bundle-analyzer`
- Tree shaking via ESM

---

## Security

### Best Practices

1. **API Keys**: Never commit tokens, use environment variables
2. **Input Validation**: Validate GitHub URLs, sanitize user input
3. **Rate Limiting**: Implement per-user rate limits
4. **CORS**: Restrict origins in production
5. **CSP**: Content Security Policy headers
6. **Dependency Scanning**: Use `npm audit`, Dependabot

### Secrets Management

```bash
# Development
cp .env.example .env
# Add secrets to .env

# Production (Vercel)
vercel env add GITHUB_TOKEN
vercel env add UPSTASH_REDIS_URL
```

---

## Monitoring & Logging

### Web Vitals

- Largest Contentful Paint (LCP) < 2.5s
- First Input Delay (FID) < 100ms
- Cumulative Layout Shift (CLS) < 0.1

### Error Tracking

- Client errors: window.onerror, unhandledrejection
- Server errors: try/catch in API routes
- Integration: Sentry, LogRocket (optional)

### Analytics

- Page views, conversions
- Tool usage statistics
- Error rates
- Performance metrics

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

Quick start:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

**Last Updated**: January 17, 2026  
**Version**: 1.0.0  
**Maintained by**: [nirholas](https://github.com/nirholas)
