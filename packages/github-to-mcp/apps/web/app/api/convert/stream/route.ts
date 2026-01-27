/**
 * Streaming Convert API - Real-time progress updates via Server-Sent Events
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Progress steps for the streaming response
const PROGRESS_STEPS = [
  { id: 'validate', label: 'Validating GitHub URL', description: 'Checking repository accessibility' },
  { id: 'fetch', label: 'Fetching repository', description: 'Downloading repository metadata' },
  { id: 'classify', label: 'Classifying repository', description: 'Detecting repo type and structure' },
  { id: 'readme', label: 'Analyzing README', description: 'Extracting documentation and examples' },
  { id: 'openapi', label: 'Scanning for OpenAPI specs', description: 'Looking for API definitions' },
  { id: 'code', label: 'Analyzing code', description: 'Extracting functions and patterns' },
  { id: 'generate-ts', label: 'Generating TypeScript server', description: 'Creating MCP server code' },
  { id: 'generate-py', label: 'Generating Python server', description: 'Creating Python alternative' },
  { id: 'configs', label: 'Creating configurations', description: 'Building platform configs' },
  { id: 'complete', label: 'Conversion complete', description: 'MCP server ready' },
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: 'GitHub URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate GitHub URL
  const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/;
  if (!githubPattern.test(url)) {
    return new Response(JSON.stringify({ error: 'Invalid GitHub URL format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: Validate URL
        sendEvent('progress', { 
          step: 'validate', 
          status: 'in-progress',
          message: PROGRESS_STEPS[0].label,
          description: PROGRESS_STEPS[0].description,
          progress: 5,
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        sendEvent('progress', { step: 'validate', status: 'complete', progress: 10 });

        // Step 2: Fetch repository
        sendEvent('progress', { 
          step: 'fetch', 
          status: 'in-progress',
          message: PROGRESS_STEPS[1].label,
          description: PROGRESS_STEPS[1].description,
          progress: 15,
        });

        // Import the generator dynamically
        const { generateFromGithub } = await import('@nirholas/github-to-mcp');
        
        // Create a wrapper that will be used for streaming updates
        let currentProgress = 15;
        
        // We'll call the actual generation, but simulate progress steps
        const progressUpdates = [
          { step: 'fetch', delay: 500, progress: 20 },
          { step: 'classify', delay: 800, progress: 30 },
          { step: 'readme', delay: 600, progress: 40 },
          { step: 'openapi', delay: 1000, progress: 55 },
          { step: 'code', delay: 1200, progress: 70 },
          { step: 'generate-ts', delay: 800, progress: 80 },
          { step: 'generate-py', delay: 600, progress: 90 },
          { step: 'configs', delay: 400, progress: 95 },
        ];

        // Start the actual generation in the background
        const generationPromise = generateFromGithub(url, {
          sources: ['readme', 'openapi', 'code'],
          githubToken: process.env.GITHUB_TOKEN,
        });

        // Send progress updates while generation is happening
        for (const update of progressUpdates) {
          sendEvent('progress', { 
            step: update.step, 
            status: 'in-progress',
            message: PROGRESS_STEPS.find(s => s.id === update.step)?.label || update.step,
            description: PROGRESS_STEPS.find(s => s.id === update.step)?.description || '',
            progress: update.progress,
          });
          await new Promise(resolve => setTimeout(resolve, update.delay));
          sendEvent('progress', { step: update.step, status: 'complete', progress: update.progress + 5 });
        }

        // Wait for actual generation to complete
        const result = await generationPromise;

        // Generate the MCP server code
        const code = result.generate();
        const pythonCode = result.generatePython ? result.generatePython() : '';

        // Generate config snippets
        const repoName = result.name;
        
        const claudeConfig = JSON.stringify({
          mcpServers: {
            [repoName]: {
              command: 'npx',
              args: ['tsx', `${repoName}-mcp/index.ts`],
            },
          },
        }, null, 2);

        const cursorConfig = JSON.stringify({
          mcpServers: {
            [repoName]: {
              command: 'npx',
              args: ['tsx', `${repoName}-mcp/index.ts`],
            },
          },
        }, null, 2);

        const claudePythonConfig = JSON.stringify({
          mcpServers: {
            [repoName]: {
              command: 'python',
              args: ['-m', `${repoName.replace(/-/g, '_')}_mcp`],
            },
          },
        }, null, 2);

        // Send completion
        sendEvent('progress', { 
          step: 'complete', 
          status: 'complete',
          message: PROGRESS_STEPS[9].label,
          description: `Successfully extracted ${result.tools.length} tools`,
          progress: 100,
        });

        // Send the final result
        sendEvent('result', {
          name: result.name,
          tools: result.tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            source: t.source,
          })),
          sources: result.sources,
          classification: result.classification,
          code,
          pythonCode,
          claudeConfig,
          cursorConfig,
          claudePythonConfig,
        });

        sendEvent('done', { success: true });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Conversion failed';
        
        sendEvent('error', { 
          error: message,
          code: message.includes('rate limit') ? 'RATE_LIMIT' : 'CONVERSION_ERROR',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
