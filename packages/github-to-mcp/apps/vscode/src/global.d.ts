/**
 * @fileoverview Type declarations for external modules
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

declare module '@nirholas/github-to-mcp' {
  export interface ExtractedTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }

  export interface RepoClassification {
    type: string;
    confidence: number;
    indicators: string[];
  }

  export interface GenerationResult {
    tools: ExtractedTool[];
    classification?: RepoClassification;
    generate(): string;
    generatePython?(): string;
  }

  export interface GenerateOptions {
    sources?: string[];
    outputLanguage?: 'typescript' | 'python';
  }

  export function generateFromGithub(
    url: string,
    options?: GenerateOptions
  ): Promise<GenerationResult>;
}
