/**
 * @fileoverview SSE endpoint for streaming generation progress
 * GET /api/stream - Server-Sent Events endpoint
 */

import { NextRequest } from 'next/server';
import { generateFromGithub } from '@nirholas/github-to-mcp';

/**
 * Progress event structure
 */
interface ProgressEvent {
  type: 'start' | 'analyzing' | 'extracting' | 'generating' | 'validating' | 'complete' | 'error';
  message: string;
  progress: number;
  details?: {
    step?: string;
    filesProcessed?: number;
    totalFiles?: number;
    toolsFound?: number;
    currentSource?: string;
  };
  timestamp: number;
  data?: unknown;
}

/**
 * Create a Server-Sent Events response
 */
function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Send an SSE event
 */
function formatSSEEvent(event: ProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const language = (searchParams.get('language') || 'typescript') as 'typescript' | 'python';
  const sourcesParam = searchParams.get('sources');
  const sources = sourcesParam ? sourcesParam.split(',') : ['readme', 'openapi', 'code'];

  if (!url) {
    const errorStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const event: ProgressEvent = {
          type: 'error',
          message: 'GitHub URL is required',
          progress: 0,
          timestamp: Date.now(),
        };
        controller.enqueue(encoder.encode(formatSSEEvent(event)));
        controller.close();
      },
    });
    return createSSEResponse(errorStream);
  }

  // Validate GitHub URL
  const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/;
  if (!githubPattern.test(url)) {
    const errorStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const event: ProgressEvent = {
          type: 'error',
          message: 'Invalid GitHub URL format',
          progress: 0,
          timestamp: Date.now(),
        };
        controller.enqueue(encoder.encode(formatSSEEvent(event)));
        controller.close();
      },
    });
    return createSSEResponse(errorStream);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(formatSSEEvent(event)));
        } catch {
          // Stream may be closed
        }
      };

      try {
        // Start event
        emit({
          type: 'start',
          message: 'Starting conversion...',
          progress: 0,
          timestamp: Date.now(),
          details: { step: 'initialization' },
        });

        // Analyzing event
        emit({
          type: 'analyzing',
          message: 'Analyzing repository structure...',
          progress: 10,
          timestamp: Date.now(),
          details: { step: 'analysis' },
        });

        // Generate MCP tools
        const result = await generateFromGithub(url, {
          sources: sources as ('readme' | 'openapi' | 'code' | 'graphql')[],
          githubToken: process.env.GITHUB_TOKEN,
        });

        // Extracting event
        emit({
          type: 'extracting',
          message: `Extracting tools from ${result.sources.length} sources...`,
          progress: 40,
          timestamp: Date.now(),
          details: {
            step: 'extraction',
            toolsFound: result.tools.length,
          },
        });

        // Generating event
        emit({
          type: 'generating',
          message: 'Generating MCP server code...',
          progress: 70,
          timestamp: Date.now(),
          details: {
            step: 'generation',
            toolsFound: result.tools.length,
          },
        });

        // Generate code
        const code = language === 'python' ? result.generatePython() : result.generate();

        // Generate config snippets
        const repoName = result.name;
        
        const claudeConfig = {
          mcpServers: {
            [repoName]: {
              command: language === 'python' ? 'python' : 'npx',
              args: language === 'python' 
                ? ['-m', `${repoName.replace(/-/g, '_')}_mcp`]
                : ['tsx', `${repoName}-mcp/index.ts`],
            },
          },
        };

        // Validating event
        emit({
          type: 'validating',
          message: 'Validating generated code...',
          progress: 90,
          timestamp: Date.now(),
          details: { step: 'validation' },
        });

        // Complete event with data
        emit({
          type: 'complete',
          message: 'Conversion complete!',
          progress: 100,
          timestamp: Date.now(),
          details: {
            toolsFound: result.tools.length,
          },
          data: {
            name: result.name,
            tools: result.tools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              source: t.source,
            })),
            sources: result.sources,
            classification: result.classification,
            code,
            claudeConfig: JSON.stringify(claudeConfig, null, 2),
          },
        });

        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Conversion failed';
        
        emit({
          type: 'error',
          message,
          progress: 0,
          timestamp: Date.now(),
        });

        controller.close();
      }
    },
  });

  return createSSEResponse(stream);
}

// Support OPTIONS for CORS preflight
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
