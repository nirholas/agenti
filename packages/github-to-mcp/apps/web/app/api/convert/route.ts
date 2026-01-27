import { NextRequest, NextResponse } from 'next/server';
import { generateFromGithub } from '@nirholas/github-to-mcp';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'GitHub URL is required' },
        { status: 400 }
      );
    }

    // Validate GitHub URL
    const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/;
    if (!githubPattern.test(url)) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL format' },
        { status: 400 }
      );
    }

    // Generate MCP tools
    const result = await generateFromGithub(url, {
      sources: ['readme', 'openapi', 'code'],
      githubToken: process.env.GITHUB_TOKEN,
    });

    // Generate the MCP server code (TypeScript)
    const code = result.generate();
    
    // Generate Python MCP server code
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

    return NextResponse.json({
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
  } catch (error) {
    console.error('Conversion error:', error);
    
    const message = error instanceof Error ? error.message : 'Conversion failed';
    
    // Handle rate limiting
    if (message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'GitHub API rate limit exceeded. Please try again later or provide a GitHub token.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
