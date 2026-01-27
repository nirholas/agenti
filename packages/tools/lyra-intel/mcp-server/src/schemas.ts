import { z } from "zod";

// Validation schemas for tools
export const AnalyzeCodebaseSchema = z.object({
  path: z.string().describe("Path to the repository or codebase"),
  analysisType: z
    .enum(["quick", "standard", "deep"])
    .default("standard")
    .describe("Analysis depth: quick (basic), standard (comprehensive), deep (all metrics)"),
  includeMetrics: z
    .array(z.enum(["complexity", "security", "dependencies", "architecture", "debt"]))
    .default(["complexity", "security", "dependencies"])
    .describe("Which metrics to include in analysis"),
});

export const SearchCodeSchema = z.object({
  query: z.string().describe("Semantic search query"),
  path: z.string().optional().describe("Optional: restrict search to specific path"),
  limit: z.number().default(10).describe("Maximum number of results"),
});

export const GetSecurityIssuesSchema = z.object({
  path: z.string().describe("Repository path"),
  severity: z
    .enum(["critical", "high", "medium", "low", "all"])
    .default("all")
    .describe("Filter by severity level"),
});

export const GetComplexitySchema = z.object({
  path: z.string().describe("Repository path"),
  threshold: z.number().default(10).describe("Complexity threshold to flag"),
});

export const ExplainCodeSchema = z.object({
  filePath: z.string().describe("Path to the file to explain"),
  startLine: z.number().optional().describe("Start line number"),
  endLine: z.number().optional().describe("End line number"),
});

export const GenerateMigrationPlanSchema = z.object({
  path: z.string().describe("Repository path"),
  fromVersion: z.string().describe("Current version/framework"),
  toVersion: z.string().describe("Target version/framework"),
});

export const AnalyzeDebtSchema = z.object({
  path: z.string().describe("Repository path"),
  focus: z
    .enum(["all", "code-debt", "architectural-debt", "documentation-debt"])
    .default("all")
    .describe("Type of technical debt to analyze"),
});

// Utility types
export type AnalyzeCodebaseInput = z.infer<typeof AnalyzeCodebaseSchema>;
export type SearchCodeInput = z.infer<typeof SearchCodeSchema>;
export type GetSecurityIssuesInput = z.infer<typeof GetSecurityIssuesSchema>;
export type GetComplexityInput = z.infer<typeof GetComplexitySchema>;
export type ExplainCodeInput = z.infer<typeof ExplainCodeSchema>;
export type GenerateMigrationPlanInput = z.infer<typeof GenerateMigrationPlanSchema>;
export type AnalyzeDebtInput = z.infer<typeof AnalyzeDebtSchema>;
