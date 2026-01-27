/**
 * @fileoverview Streaming generation for GitHub to MCP conversion
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { GithubToMcpGenerator } from './index';
import {
  GithubToMcpOptions,
  ExtractedTool,
  SourceBreakdown,
  RepoClassification,
  GenerationResult,
  SourceType
} from './types';

/**
 * Event types emitted during streaming generation
 */
export type StreamEventType = 
  | 'start'
  | 'metadata'
  | 'classifying'
  | 'classified'
  | 'extracting'
  | 'tool-found'
  | 'source-complete'
  | 'generating'
  | 'complete'
  | 'error'
  | 'progress';

/**
 * Base interface for all stream events
 */
export interface BaseStreamEvent {
  type: StreamEventType;
  timestamp: number;
}

/**
 * Emitted when generation starts
 */
export interface StartEvent extends BaseStreamEvent {
  type: 'start';
  url: string;
  owner: string;
  repo: string;
}

/**
 * Emitted when repository metadata is fetched
 */
export interface MetadataEvent extends BaseStreamEvent {
  type: 'metadata';
  metadata: {
    stars: number;
    language: string;
    license?: string;
    description?: string;
  };
}

/**
 * Emitted when classification begins
 */
export interface ClassifyingEvent extends BaseStreamEvent {
  type: 'classifying';
  message: string;
}

/**
 * Emitted when classification completes
 */
export interface ClassifiedEvent extends BaseStreamEvent {
  type: 'classified';
  classification: RepoClassification;
}

/**
 * Emitted when extraction from a source begins
 */
export interface ExtractingEvent extends BaseStreamEvent {
  type: 'extracting';
  source: SourceType;
  message: string;
}

/**
 * Emitted when a tool is found
 */
export interface ToolFoundEvent extends BaseStreamEvent {
  type: 'tool-found';
  tool: ExtractedTool;
  source: SourceType;
  totalFound: number;
}

/**
 * Emitted when extraction from a source completes
 */
export interface SourceCompleteEvent extends BaseStreamEvent {
  type: 'source-complete';
  source: SourceType;
  toolCount: number;
  files: string[];
}

/**
 * Emitted when code generation begins
 */
export interface GeneratingEvent extends BaseStreamEvent {
  type: 'generating';
  language: 'typescript' | 'python';
  toolCount: number;
}

/**
 * Emitted when generation completes successfully
 */
export interface CompleteEvent extends BaseStreamEvent {
  type: 'complete';
  result: GenerationResult;
  totalTools: number;
  sources: SourceBreakdown[];
  duration: number;
}

/**
 * Emitted when an error occurs
 */
export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  error: Error;
  phase: string;
  recoverable: boolean;
}

/**
 * Progress update event
 */
export interface ProgressEvent extends BaseStreamEvent {
  type: 'progress';
  phase: string;
  progress: number; // 0-100
  message: string;
}

/**
 * Union of all stream event types
 */
export type StreamEvent =
  | StartEvent
  | MetadataEvent
  | ClassifyingEvent
  | ClassifiedEvent
  | ExtractingEvent
  | ToolFoundEvent
  | SourceCompleteEvent
  | GeneratingEvent
  | CompleteEvent
  | ErrorEvent
  | ProgressEvent;

/**
 * Options for streaming generation
 */
export interface StreamOptions extends GithubToMcpOptions {
  /** Emit progress events with percentage */
  emitProgress?: boolean;
  /** Minimum interval between tool-found events in ms (debouncing) */
  toolEventDebounce?: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Create a timestamp for events
 */
function timestamp(): number {
  return Date.now();
}

/**
 * Streaming generator class that wraps the main generator
 * and yields events as extraction progresses
 */
export class StreamingGenerator {
  private options: StreamOptions;
  private toolCount: number = 0;
  private startTime: number = 0;

  constructor(options: StreamOptions = {}) {
    this.options = options;
  }

  /**
   * Stream generation events as an async generator
   */
  async *generate(githubUrl: string): AsyncGenerator<StreamEvent, void, unknown> {
    this.startTime = Date.now();
    this.toolCount = 0;

    // Import dynamically to avoid circular dependencies
    const { GithubClient } = await import('./github-client');
    const { ReadmeExtractor } = await import('./readme-extractor');
    const { CodeExtractor } = await import('./code-extractor');
    const { GraphQLExtractor } = await import('./graphql-extractor');
    const { McpIntrospector } = await import('./mcp-introspector');
    const { PythonGenerator } = await import('./python-generator');
    const { convertOpenApiToMcp } = await import('@github-to-mcp/openapi-parser');

    const github = new GithubClient(this.options.githubToken);
    const readmeExtractor = new ReadmeExtractor();
    const codeExtractor = new CodeExtractor();
    const graphqlExtractor = new GraphQLExtractor();
    const mcpIntrospector = new McpIntrospector();
    const pythonGenerator = new PythonGenerator();

    try {
      // Check for abort signal
      if (this.options.abortSignal?.aborted) {
        throw new Error('Generation aborted');
      }

      // Parse GitHub URL
      const repoMeta = github.parseGithubUrl(githubUrl);

      // Emit start event
      yield {
        type: 'start',
        timestamp: timestamp(),
        url: githubUrl,
        owner: repoMeta.owner,
        repo: repoMeta.repo
      };

      // Emit progress
      if (this.options.emitProgress) {
        yield {
          type: 'progress',
          timestamp: timestamp(),
          phase: 'fetching',
          progress: 5,
          message: 'Fetching repository metadata...'
        };
      }

      // Get repository metadata
      const metadata = await github.getRepoMetadata(repoMeta.owner, repoMeta.repo);

      yield {
        type: 'metadata',
        timestamp: timestamp(),
        metadata: {
          stars: metadata.stars,
          language: metadata.language,
          license: metadata.license,
          description: metadata.description
        }
      };

      // Check for abort
      if (this.options.abortSignal?.aborted) {
        throw new Error('Generation aborted');
      }

      // Get README
      const readme = await github.getReadme(repoMeta.owner, repoMeta.repo);

      // Emit classifying event
      yield {
        type: 'classifying',
        timestamp: timestamp(),
        message: 'Analyzing repository type...'
      };

      if (this.options.emitProgress) {
        yield {
          type: 'progress',
          timestamp: timestamp(),
          phase: 'classifying',
          progress: 15,
          message: 'Classifying repository...'
        };
      }

      // Classify repository
      const classification = await this.classifyRepo(github, repoMeta.owner, repoMeta.repo, readme, metadata);

      yield {
        type: 'classified',
        timestamp: timestamp(),
        classification
      };

      // Prepare for extraction
      const tools: ExtractedTool[] = [];
      const sources: SourceBreakdown[] = [];
      const enabledSources = this.options.sources || ['readme', 'openapi', 'code'];

      let progressBase = 20;
      const progressPerSource = 60 / (enabledSources.length + 2); // +2 for graphql and universal

      // 1. Extract from OpenAPI specs
      if (enabledSources.includes('openapi')) {
        if (this.options.abortSignal?.aborted) throw new Error('Generation aborted');

        yield {
          type: 'extracting',
          timestamp: timestamp(),
          source: 'openapi',
          message: 'Searching for OpenAPI/Swagger specifications...'
        };

        const openapiTools = await this.extractFromOpenApi(github, repoMeta.owner, repoMeta.repo, convertOpenApiToMcp);
        
        for (const tool of openapiTools) {
          this.toolCount++;
          tools.push(tool);
          yield {
            type: 'tool-found',
            timestamp: timestamp(),
            tool,
            source: 'openapi',
            totalFound: this.toolCount
          };
        }

        if (openapiTools.length > 0) {
          sources.push({
            type: 'openapi',
            count: openapiTools.length,
            files: [...new Set(openapiTools.map(t => t.source.file))]
          });
        }

        yield {
          type: 'source-complete',
          timestamp: timestamp(),
          source: 'openapi',
          toolCount: openapiTools.length,
          files: openapiTools.length > 0 ? [...new Set(openapiTools.map(t => t.source.file))] : []
        };

        progressBase += progressPerSource;
        if (this.options.emitProgress) {
          yield {
            type: 'progress',
            timestamp: timestamp(),
            phase: 'extracting',
            progress: Math.round(progressBase),
            message: `Extracted ${openapiTools.length} tools from OpenAPI specs`
          };
        }
      }

      // 2. Extract from README
      if (enabledSources.includes('readme')) {
        if (this.options.abortSignal?.aborted) throw new Error('Generation aborted');

        yield {
          type: 'extracting',
          timestamp: timestamp(),
          source: 'readme',
          message: 'Extracting tools from README documentation...'
        };

        const readmeTools = await this.extractFromReadme(readmeExtractor, readme, repoMeta.repo);
        
        for (const tool of readmeTools) {
          this.toolCount++;
          tools.push(tool);
          yield {
            type: 'tool-found',
            timestamp: timestamp(),
            tool,
            source: 'readme',
            totalFound: this.toolCount
          };
        }

        if (readmeTools.length > 0) {
          sources.push({
            type: 'readme',
            count: readmeTools.length,
            files: ['README.md']
          });
        }

        yield {
          type: 'source-complete',
          timestamp: timestamp(),
          source: 'readme',
          toolCount: readmeTools.length,
          files: readmeTools.length > 0 ? ['README.md'] : []
        };

        progressBase += progressPerSource;
        if (this.options.emitProgress) {
          yield {
            type: 'progress',
            timestamp: timestamp(),
            phase: 'extracting',
            progress: Math.round(progressBase),
            message: `Extracted ${readmeTools.length} tools from README`
          };
        }
      }

      // 3. Extract from code
      if (enabledSources.includes('code')) {
        if (this.options.abortSignal?.aborted) throw new Error('Generation aborted');

        yield {
          type: 'extracting',
          timestamp: timestamp(),
          source: 'code',
          message: 'Analyzing source code for extractable tools...'
        };

        const codeTools = await this.extractFromCode(github, codeExtractor, repoMeta.owner, repoMeta.repo);
        
        for (const tool of codeTools) {
          this.toolCount++;
          tools.push(tool);
          yield {
            type: 'tool-found',
            timestamp: timestamp(),
            tool,
            source: 'code',
            totalFound: this.toolCount
          };
        }

        if (codeTools.length > 0) {
          sources.push({
            type: 'code',
            count: codeTools.length,
            files: [...new Set(codeTools.map(t => t.source.file))]
          });
        }

        yield {
          type: 'source-complete',
          timestamp: timestamp(),
          source: 'code',
          toolCount: codeTools.length,
          files: codeTools.length > 0 ? [...new Set(codeTools.map(t => t.source.file))] : []
        };

        progressBase += progressPerSource;
        if (this.options.emitProgress) {
          yield {
            type: 'progress',
            timestamp: timestamp(),
            phase: 'extracting',
            progress: Math.round(progressBase),
            message: `Extracted ${codeTools.length} tools from source code`
          };
        }
      }

      // 4. Extract from GraphQL schemas
      if (this.options.abortSignal?.aborted) throw new Error('Generation aborted');

      yield {
        type: 'extracting',
        timestamp: timestamp(),
        source: 'graphql',
        message: 'Searching for GraphQL schemas...'
      };

      const graphqlTools = await this.extractFromGraphQL(github, graphqlExtractor, repoMeta.owner, repoMeta.repo);
      
      for (const tool of graphqlTools) {
        this.toolCount++;
        tools.push(tool);
        yield {
          type: 'tool-found',
          timestamp: timestamp(),
          tool,
          source: 'graphql',
          totalFound: this.toolCount
        };
      }

      if (graphqlTools.length > 0) {
        sources.push({
          type: 'graphql',
          count: graphqlTools.length,
          files: [...new Set(graphqlTools.map(t => t.source.file))]
        });
      }

      yield {
        type: 'source-complete',
        timestamp: timestamp(),
        source: 'graphql',
        toolCount: graphqlTools.length,
        files: graphqlTools.length > 0 ? [...new Set(graphqlTools.map(t => t.source.file))] : []
      };

      progressBase += progressPerSource;

      // 5. Introspect existing MCP servers
      if (classification.type === 'mcp-server') {
        if (this.options.abortSignal?.aborted) throw new Error('Generation aborted');

        yield {
          type: 'extracting',
          timestamp: timestamp(),
          source: 'mcp-introspect',
          message: 'Introspecting existing MCP server tools...'
        };

        const mcpTools = await this.introspectMcpServer(github, mcpIntrospector, repoMeta.owner, repoMeta.repo);
        
        for (const tool of mcpTools) {
          this.toolCount++;
          tools.push(tool);
          yield {
            type: 'tool-found',
            timestamp: timestamp(),
            tool,
            source: 'mcp-introspect',
            totalFound: this.toolCount
          };
        }

        if (mcpTools.length > 0) {
          sources.push({
            type: 'mcp-introspect',
            count: mcpTools.length,
            files: [...new Set(mcpTools.map(t => t.source.file))]
          });
        }

        yield {
          type: 'source-complete',
          timestamp: timestamp(),
          source: 'mcp-introspect',
          toolCount: mcpTools.length,
          files: mcpTools.length > 0 ? [...new Set(mcpTools.map(t => t.source.file))] : []
        };
      }

      // 6. Add universal fallback tools
      yield {
        type: 'extracting',
        timestamp: timestamp(),
        source: 'universal',
        message: 'Adding universal repository tools...'
      };

      const universalTools = this.generateUniversalTools(repoMeta.owner, repoMeta.repo);
      
      for (const tool of universalTools) {
        this.toolCount++;
        tools.push(tool);
        yield {
          type: 'tool-found',
          timestamp: timestamp(),
          tool,
          source: 'universal',
          totalFound: this.toolCount
        };
      }

      sources.push({
        type: 'universal',
        count: universalTools.length,
        files: []
      });

      yield {
        type: 'source-complete',
        timestamp: timestamp(),
        source: 'universal',
        toolCount: universalTools.length,
        files: []
      };

      if (this.options.emitProgress) {
        yield {
          type: 'progress',
          timestamp: timestamp(),
          phase: 'extracting',
          progress: 80,
          message: `Extraction complete. Found ${this.toolCount} total tools.`
        };
      }

      // Deduplicate tools
      const uniqueTools = this.deduplicateTools(tools);

      // Generate code
      const outputLanguage = this.options.outputLanguage || 'typescript';

      yield {
        type: 'generating',
        timestamp: timestamp(),
        language: outputLanguage,
        toolCount: uniqueTools.length
      };

      if (this.options.emitProgress) {
        yield {
          type: 'progress',
          timestamp: timestamp(),
          phase: 'generating',
          progress: 90,
          message: `Generating ${outputLanguage} MCP server...`
        };
      }

      // Build result using the main generator for code generation
      const generator = new GithubToMcpGenerator(this.options);
      
      const result: GenerationResult = {
        repo: githubUrl,
        name: repoMeta.repo,
        tools: uniqueTools,
        sources,
        classification,
        metadata,
        generate: () => generator['generateCode'](uniqueTools, repoMeta.repo, repoMeta.owner, outputLanguage),
        generatePython: () => pythonGenerator.generateServer(uniqueTools, repoMeta.repo, repoMeta.owner),
        save: async (outputDir: string) => generator['saveToFiles'](uniqueTools, repoMeta.repo, repoMeta.owner, outputDir),
        download: () => generator['downloadZip'](uniqueTools, repoMeta.repo)
      };

      const duration = Date.now() - this.startTime;

      if (this.options.emitProgress) {
        yield {
          type: 'progress',
          timestamp: timestamp(),
          phase: 'complete',
          progress: 100,
          message: `Generation complete in ${duration}ms`
        };
      }

      // Emit complete event
      yield {
        type: 'complete',
        timestamp: timestamp(),
        result,
        totalTools: uniqueTools.length,
        sources,
        duration
      };

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      yield {
        type: 'error',
        timestamp: timestamp(),
        error: err,
        phase: 'generation',
        recoverable: false
      };
    }
  }

  /**
   * Classify repository type
   */
  private async classifyRepo(
    github: any,
    owner: string,
    repo: string,
    readme: string | null,
    metadata: any
  ): Promise<RepoClassification> {
    const indicators: string[] = [];
    let type: RepoClassification['type'] = 'unknown';
    let confidence = 0.3;

    const readmeLower = (readme || '').toLowerCase();

    if (readmeLower.includes('mcp') || readmeLower.includes('model context protocol')) {
      type = 'mcp-server';
      confidence = 0.9;
      indicators.push('MCP keywords in README');
    } else if (readmeLower.includes('api') || readmeLower.includes('sdk') || readmeLower.includes('openapi')) {
      type = 'api-sdk';
      confidence = 0.7;
      indicators.push('API/SDK keywords in README');
    } else if (readmeLower.includes('cli') || readmeLower.includes('command line')) {
      type = 'cli-tool';
      confidence = 0.7;
      indicators.push('CLI keywords in README');
    } else if (metadata.language) {
      type = 'library';
      confidence = 0.5;
      indicators.push(`${metadata.language} repository`);
    }

    return { type, confidence, indicators };
  }

  /**
   * Extract tools from OpenAPI specs
   */
  private async extractFromOpenApi(
    github: any,
    owner: string,
    repo: string,
    convertOpenApiToMcp: any
  ): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];
    
    try {
      const specPatterns = [
        'openapi.json', 'openapi.yaml', 'openapi.yml',
        'swagger.json', 'swagger.yaml', 'swagger.yml',
        'api-spec.json', 'api-spec.yaml',
        'api/openapi.json', 'api/openapi.yaml',
        'docs/openapi.json', 'docs/openapi.yaml',
        'spec/openapi.json', 'spec/openapi.yaml'
      ];

      for (const pattern of specPatterns) {
        try {
          const content = await github.getFile(owner, repo, pattern);
          if (content) {
            const spec = pattern.endsWith('.json') 
              ? JSON.parse(content) 
              : (await import('yaml')).parse(content);
            
            const mcpTools = await convertOpenApiToMcp(spec);
            tools.push(...mcpTools.map((t: any) => ({
              ...t,
              source: { type: 'openapi' as const, file: pattern }
            })));
            break;
          }
        } catch {
          // File not found, continue
        }
      }
    } catch (error) {
      // OpenAPI extraction failed, return empty
    }

    return tools;
  }

  /**
   * Extract tools from README
   */
  private async extractFromReadme(
    readmeExtractor: any,
    readme: string | null,
    repoName: string
  ): Promise<ExtractedTool[]> {
    if (!readme) return [];
    
    try {
      return await readmeExtractor.extract(readme, repoName);
    } catch {
      return [];
    }
  }

  /**
   * Extract tools from code
   */
  private async extractFromCode(
    github: any,
    codeExtractor: any,
    owner: string,
    repo: string
  ): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];
    
    try {
      const codeFiles = await github.searchCode(owner, repo, 'extension:ts extension:py extension:js');
      
      for (const file of codeFiles.slice(0, 20)) {
        try {
          const content = await github.getFile(owner, repo, file.path);
          if (content) {
            const fileTools = await codeExtractor.extract(content, file.path);
            tools.push(...fileTools);
          }
        } catch {
          // File extraction failed, continue
        }
      }
    } catch {
      // Code extraction failed
    }

    return tools;
  }

  /**
   * Extract tools from GraphQL schemas
   */
  private async extractFromGraphQL(
    github: any,
    graphqlExtractor: any,
    owner: string,
    repo: string
  ): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];
    
    try {
      const schemaPatterns = [
        'schema.graphql', 'schema.gql',
        'graphql/schema.graphql', 'graphql/schema.gql',
        'src/schema.graphql', 'src/schema.gql'
      ];

      for (const pattern of schemaPatterns) {
        try {
          const content = await github.getFile(owner, repo, pattern);
          if (content) {
            const graphqlTools = await graphqlExtractor.extract(content, pattern);
            tools.push(...graphqlTools);
            break;
          }
        } catch {
          // File not found, continue
        }
      }
    } catch {
      // GraphQL extraction failed
    }

    return tools;
  }

  /**
   * Introspect existing MCP server
   */
  private async introspectMcpServer(
    github: any,
    mcpIntrospector: any,
    owner: string,
    repo: string
  ): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];
    
    try {
      const serverPatterns = [
        'src/index.ts', 'src/server.ts', 'src/main.ts',
        'index.ts', 'server.ts', 'main.ts',
        'src/index.js', 'src/server.js'
      ];

      for (const pattern of serverPatterns) {
        try {
          const content = await github.getFile(owner, repo, pattern);
          if (content && (content.includes('server.tool') || content.includes('@mcp'))) {
            const mcpTools = await mcpIntrospector.extract(content, pattern);
            tools.push(...mcpTools);
          }
        } catch {
          // File not found, continue
        }
      }
    } catch {
      // MCP introspection failed
    }

    return tools;
  }

  /**
   * Generate universal tools for any repository
   */
  private generateUniversalTools(owner: string, repo: string): ExtractedTool[] {
    return [
      {
        name: 'get_readme',
        description: `Get the README file from ${owner}/${repo}`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        source: { type: 'universal', file: '' }
      },
      {
        name: 'list_files',
        description: `List files in ${owner}/${repo}`,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path to list (default: root)',
              default: ''
            }
          },
          required: []
        },
        source: { type: 'universal', file: '' }
      },
      {
        name: 'read_file',
        description: `Read a file from ${owner}/${repo}`,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        },
        source: { type: 'universal', file: '' }
      },
      {
        name: 'search_code',
        description: `Search for code patterns in ${owner}/${repo}`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            extension: {
              type: 'string',
              description: 'File extension to filter (e.g., "ts", "py")'
            }
          },
          required: ['query']
        },
        source: { type: 'universal', file: '' }
      }
    ];
  }

  /**
   * Deduplicate tools by name
   */
  private deduplicateTools(tools: ExtractedTool[]): ExtractedTool[] {
    const seen = new Map<string, ExtractedTool>();
    
    for (const tool of tools) {
      const existing = seen.get(tool.name);
      if (!existing || (tool.confidence || 0) > (existing.confidence || 0)) {
        seen.set(tool.name, tool);
      }
    }
    
    return Array.from(seen.values());
  }
}

/**
 * Convenience function for streaming generation
 */
export async function* streamGenerate(
  url: string,
  options: StreamOptions = {}
): AsyncGenerator<StreamEvent, void, unknown> {
  const generator = new StreamingGenerator(options);
  yield* generator.generate(url);
}

/**
 * Collect all events from a streaming generation into an array
 */
export async function collectStreamEvents(
  url: string,
  options: StreamOptions = {}
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of streamGenerate(url, options)) {
    events.push(event);
  }
  return events;
}

/**
 * Get just the final result from streaming generation
 */
export async function streamToResult(
  url: string,
  options: StreamOptions = {}
): Promise<GenerationResult | null> {
  for await (const event of streamGenerate(url, options)) {
    if (event.type === 'complete') {
      return event.result;
    }
    if (event.type === 'error') {
      throw event.error;
    }
  }
  return null;
}
