/**
 * GitHub to MCP Converter - Type Definitions
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
  source: {
    type: SourceType;
    file: string;
    line?: number;
  };
}

export type SourceType = 
  | 'readme'
  | 'code'
  | 'openapi'
  | 'graphql'
  | 'mcp-introspect'
  | 'universal'
  | 'mcp-decorator'
  | 'python-mcp';

export type RepoClassificationType =
  | 'mcp-server'
  | 'api-sdk'
  | 'cli-tool'
  | 'library'
  | 'documentation'
  | 'data'
  | 'unknown';

export interface RepoClassification {
  type: RepoClassificationType;
  confidence: number;
  indicators: string[];
  metadata?: {
    language?: string;
    framework?: string;
    hasOpenAPI?: boolean;
    hasMcpManifest?: boolean;
  };
}

export interface ConversionResult {
  name: string;
  description: string;
  version: string;
  tools: Tool[];
  sources: SourceBreakdown[];
  classification: RepoClassification;
  code: string;
  pythonCode?: string;
  claudeConfig: string;
  cursorConfig: string;
  claudePythonConfig?: string;
  openaiConfig?: string;
  stats: ConversionStats;
  repository: RepositoryInfo;
  generatedAt: string;
}

export interface SourceBreakdown {
  type: SourceType;
  count: number;
  files: string[];
}

export interface ConversionStats {
  totalTools: number;
  filesAnalyzed: number;
  processingTimeMs: number;
  cacheHit: boolean;
}

export interface RepositoryInfo {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description?: string;
  stars?: number;
  language?: string;
  topics?: string[];
  lastUpdated?: string;
}

export interface ConversionRequest {
  url: string;
  options?: ConversionOptions;
}

export interface ConversionOptions {
  includeUniversalTools?: boolean;
  maxTools?: number;
  targetPlatform?: 'claude' | 'cursor' | 'openai' | 'all';
  customName?: string;
}

export interface ConversionHistory {
  id: string;
  url: string;
  name: string;
  toolCount: number;
  classification: RepoClassificationType;
  convertedAt: string;
  result?: ConversionResult;
}

export interface ApiError {
  error: string;
  code: string;
  details?: string;
  retryAfter?: number;
}

export type ConversionStatus = 'idle' | 'loading' | 'success' | 'error';

// ===== Streaming Types =====
export interface StreamingEvent {
  type: 'progress' | 'tool' | 'complete' | 'error';
  data: StreamingProgressData | StreamingToolData | StreamingCompleteData | StreamingErrorData;
  timestamp: string;
}

export interface StreamingProgressData {
  step: string;
  description: string;
  progress: number; // 0-100
  details?: string;
}

export interface StreamingToolData {
  tool: Tool;
  index: number;
  total: number;
}

export interface StreamingCompleteData {
  result: ConversionResult;
  totalTime: number;
}

export interface StreamingErrorData {
  error: string;
  code: string;
  details?: string;
}

export type StreamingStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

// ===== Docker Types =====
export interface DockerConfig {
  dockerfile: string;
  dockerCompose: string;
  envExample: string;
  buildCommand: string;
  runCommand: string;
  serverName: string;
}

export interface DockerExportOptions {
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

// ===== Batch Conversion Types =====
export interface BatchConversionItem {
  id: string;
  url: string;
  status: 'pending' | 'converting' | 'success' | 'error';
  result?: ConversionResult;
  error?: ApiError;
  progress?: number;
  startedAt?: string;
  completedAt?: string;
}

export type BatchConversionState = 'idle' | 'running' | 'paused' | 'complete';

export interface BatchConversionStats {
  items: BatchConversionItem[];
  status: BatchConversionState;
  totalCount: number;
  completedCount: number;
  errorCount: number;
  startedAt?: string;
  completedAt?: string;
}

// ===== One-Click Install Types =====
export type InstallPlatform = 'macos' | 'windows' | 'linux' | 'docker';

export interface InstallInstructions {
  platform: InstallPlatform;
  title: string;
  description: string;
  prerequisites: string[];
  steps: InstallStep[];
  estimatedTime: string;
  requirements?: string[];
  notes?: string[];
}

export interface InstallStep {
  title: string;
  description: string;
  command: string;
  isOptional: boolean;
  warning?: string;
  note?: string;
  link?: string;
  code?: string;
  language?: string;
  isManual?: boolean;
}

export interface PlatformDetection {
  os: InstallPlatform;
  arch: 'x64' | 'arm64';
  nodeVersion?: string;
  npmVersion?: string;
  hasDocker?: boolean;
  hasPython?: boolean;
  pythonVersion?: string;
}

