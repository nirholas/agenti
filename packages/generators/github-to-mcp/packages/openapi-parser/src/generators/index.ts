/**
 * @fileoverview Generators module exports
 * OpenAPI specification generation from source code
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

export * from './types.js';
export { ExpressAnalyzer } from './express-analyzer.js';
export { FastAPIAnalyzer } from './fastapi-analyzer.js';
export { NextJSAnalyzer } from './nextjs-analyzer.js';
export { OpenApiBuilder } from './openapi-builder.js';

import { ExpressAnalyzer } from './express-analyzer.js';
import { FastAPIAnalyzer } from './fastapi-analyzer.js';
import { NextJSAnalyzer } from './nextjs-analyzer.js';
import { OpenApiBuilder } from './openapi-builder.js';
import type {
  FileContent,
  GeneratorOptions,
  AnalysisResult,
  OpenAPISpec,
  RouteAnalyzer,
} from './types.js';

/**
 * All available analyzers
 */
const ANALYZERS: RouteAnalyzer[] = [
  new ExpressAnalyzer(),
  new FastAPIAnalyzer(),
  new NextJSAnalyzer(),
];

/**
 * Auto-detect framework and analyze files
 */
export async function analyzeFiles(files: FileContent[]): Promise<AnalysisResult> {
  // Try each analyzer until one can handle the files
  for (const analyzer of ANALYZERS) {
    if (analyzer.canAnalyze(files)) {
      return analyzer.analyze(files);
    }
  }

  // If no specific analyzer matches, try all and combine results
  const results: AnalysisResult[] = [];
  
  for (const analyzer of ANALYZERS) {
    try {
      const result = await analyzer.analyze(files);
      if (result.routes.length > 0) {
        results.push(result);
      }
    } catch {
      // Analyzer failed, continue with next
    }
  }

  if (results.length === 0) {
    return {
      routes: [],
      schemas: {},
      securitySchemes: {},
      warnings: ['No routes could be extracted from the provided files'],
      errors: [],
      framework: 'unknown',
      filesAnalyzed: files.map(f => f.path),
    };
  }

  // Combine results
  return combineResults(results);
}

/**
 * Combine multiple analysis results
 */
function combineResults(results: AnalysisResult[]): AnalysisResult {
  const combined: AnalysisResult = {
    routes: [],
    schemas: {},
    securitySchemes: {},
    warnings: [],
    errors: [],
    framework: results[0]?.framework || 'unknown',
    filesAnalyzed: [],
  };

  for (const result of results) {
    combined.routes.push(...result.routes);
    Object.assign(combined.schemas, result.schemas);
    Object.assign(combined.securitySchemes, result.securitySchemes);
    combined.warnings.push(...result.warnings);
    combined.errors.push(...result.errors);
    combined.filesAnalyzed.push(...result.filesAnalyzed);
  }

  // Deduplicate files
  combined.filesAnalyzed = [...new Set(combined.filesAnalyzed)];

  return combined;
}

/**
 * Generate OpenAPI specification from code files
 * 
 * @param files - Array of file contents to analyze
 * @param options - Generator options
 * @returns Generated OpenAPI specification
 * 
 * @example
 * ```typescript
 * const files = [
 *   { path: 'routes/users.ts', content: '...' },
 *   { path: 'routes/posts.ts', content: '...' },
 * ];
 * 
 * const spec = await generateOpenApiFromCode(files, {
 *   title: 'My API',
 *   version: '1.0.0',
 *   baseUrl: 'https://api.example.com',
 * });
 * ```
 */
export async function generateOpenApiFromCode(
  files: FileContent[],
  options: GeneratorOptions = {}
): Promise<OpenAPISpec> {
  // Analyze files
  const result = await analyzeFiles(files);
  
  // Build OpenAPI spec
  const builder = new OpenApiBuilder(options);
  return builder.build(result);
}

/**
 * Generate OpenAPI specification from code with detailed results
 * 
 * @param files - Array of file contents to analyze
 * @param options - Generator options
 * @returns Analysis result and generated OpenAPI specification
 */
export async function generateOpenApiFromCodeWithDetails(
  files: FileContent[],
  options: GeneratorOptions = {}
): Promise<{
  spec: OpenAPISpec;
  analysis: AnalysisResult;
  json: string;
  yaml: string;
}> {
  // Analyze files
  const analysis = await analyzeFiles(files);
  
  // Build OpenAPI spec
  const builder = new OpenApiBuilder(options);
  const spec = builder.build(analysis);
  
  return {
    spec,
    analysis,
    json: builder.toJSON(spec),
    yaml: builder.toYAML(spec),
  };
}

/**
 * Analyze files with a specific analyzer
 */
export async function analyzeWithFramework(
  files: FileContent[],
  framework: 'express' | 'fastapi' | 'nextjs'
): Promise<AnalysisResult> {
  const analyzerMap: Record<string, RouteAnalyzer> = {
    express: new ExpressAnalyzer(),
    fastapi: new FastAPIAnalyzer(),
    nextjs: new NextJSAnalyzer(),
  };

  const analyzer = analyzerMap[framework];
  if (!analyzer) {
    throw new Error(`Unknown framework: ${framework}`);
  }

  return analyzer.analyze(files);
}

/**
 * Detect the framework used in the files
 */
export function detectFramework(files: FileContent[]): 'express' | 'fastapi' | 'nextjs' | 'unknown' {
  for (const analyzer of ANALYZERS) {
    if (analyzer.canAnalyze(files)) {
      return analyzer.name as 'express' | 'fastapi' | 'nextjs';
    }
  }
  return 'unknown';
}
