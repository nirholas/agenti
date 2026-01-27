/**
 * @fileoverview API route to generate OpenAPI spec from uploaded code
 * POST /api/generate-openapi
 */

// @ts-nocheck - Temporarily disabled due to missing openapi-parser types
import { NextRequest, NextResponse } from 'next/server';
import { generateOpenApiFromCodeWithDetails } from '@github-to-mcp/openapi-parser';
import type { FileContent, GeneratorOptions } from '@github-to-mcp/openapi-parser';

export interface GenerateOpenApiRequest {
  files: Array<{
    path: string;
    content: string;
    language?: 'typescript' | 'javascript' | 'python';
  }>;
  options?: GeneratorOptions;
  format?: 'json' | 'yaml' | 'both';
}

export interface GenerateOpenApiResponse {
  success: boolean;
  spec?: object;
  json?: string;
  yaml?: string;
  analysis?: {
    framework: string;
    routesCount: number;
    schemasCount: number;
    warnings: string[];
    errors: string[];
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateOpenApiResponse>> {
  try {
    const body = await request.json() as GenerateOpenApiRequest;

    // Validate request
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Files array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each file
    for (const file of body.files) {
      if (!file.path || typeof file.path !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Each file must have a path' },
          { status: 400 }
        );
      }
      if (!file.content || typeof file.content !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Each file must have content' },
          { status: 400 }
        );
      }
    }

    // Convert to FileContent format
    const files: FileContent[] = body.files.map(f => ({
      path: f.path,
      content: f.content,
      language: f.language,
    }));

    // Generate OpenAPI spec
    const result = await generateOpenApiFromCodeWithDetails(files, body.options || {});

    const format = body.format || 'json';
    const response: GenerateOpenApiResponse = {
      success: true,
      analysis: {
        framework: result.analysis.framework,
        routesCount: result.analysis.routes.length,
        schemasCount: Object.keys(result.analysis.schemas).length,
        warnings: result.analysis.warnings,
        errors: result.analysis.errors,
      },
    };

    if (format === 'json' || format === 'both') {
      response.spec = result.spec;
      response.json = result.json;
    }

    if (format === 'yaml' || format === 'both') {
      response.yaml = result.yaml;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('OpenAPI generation error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'OpenAPI generation failed',
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
