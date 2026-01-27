/**
 * Discovery Tools - MCP tools for discovering and analyzing crypto MCP repositories
 * 
 * These tools allow AI to:
 * - Scan GitHub for new MCP crypto repositories
 * - Analyze specific repositories for tools
 * - Submit validated tools to the registry
 * - Run the complete discovery pipeline
 */

import { z } from 'zod';
import { UnifiedTool } from './registry.js';
import { spawn } from 'child_process';

// Schemas for discovery tools

const scanGitHubSchema = z.object({
  daysBack: z.number().default(7).describe("How many days back to search for new repositories"),
  minStars: z.number().default(0).describe("Minimum stars required for a repository"),
  queries: z.array(z.string()).optional().describe("Custom search queries (defaults to crypto MCP queries)"),
  maxResults: z.number().default(50).describe("Maximum number of repositories to return"),
});

const analyzeRepoSchema = z.object({
  repoUrl: z.string().describe("GitHub repository URL to analyze"),
  checkSecurity: z.boolean().default(true).describe("Whether to run security analysis"),
});

const submitToolSchema = z.object({
  repoUrl: z.string().describe("GitHub repository URL of the analyzed repo"),
  dryRun: z.boolean().default(true).describe("If true, simulates submission without actually submitting"),
  minQualityScore: z.number().default(50).describe("Minimum quality score required for submission"),
  minSecurityScore: z.number().default(70).describe("Minimum security score required for submission"),
});

const runPipelineSchema = z.object({
  daysBack: z.number().default(7).describe("How many days back to search"),
  submit: z.boolean().default(false).describe("Whether to submit discovered tools to registry"),
  dryRun: z.boolean().default(true).describe("If true, simulates submission without actually submitting"),
  maxRepos: z.number().default(20).describe("Maximum repositories to process"),
});

const getDiscoveryStatsSchema = z.object({});

// Helper function to run Python discovery commands
async function runPythonDiscovery(
  command: string,
  args: Record<string, any>,
  onProgress?: (message: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Build command arguments
    const cmdArgs = ['python', '-m', 'src.discovery.cli', command];
    
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && value !== null) {
        const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        if (typeof value === 'boolean') {
          if (value) cmdArgs.push(`--${kebabKey}`);
        } else if (Array.isArray(value)) {
          for (const v of value) {
            cmdArgs.push(`--${kebabKey}`, String(v));
          }
        } else {
          cmdArgs.push(`--${kebabKey}`, String(value));
        }
      }
    }

    onProgress?.(`Running: ${cmdArgs.join(' ')}`);

    const proc = spawn(cmdArgs[0], cmdArgs.slice(1), {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      onProgress?.(text);
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to start command: ${err.message}`));
    });
  });
}

// Tool: Scan GitHub for MCP repositories
export const discoveryScanGitHubTool: UnifiedTool = {
  name: "discovery-scan-github",
  description: "Scan GitHub for new MCP crypto tool repositories. Returns a list of discovered repositories with metadata.",
  zodSchema: scanGitHubSchema,
  prompt: {
    description: "Search GitHub for new MCP (Model Context Protocol) repositories related to crypto, DeFi, and blockchain",
  },
  category: 'discovery',
  execute: async (args, onProgress) => {
    const { daysBack, minStars, queries, maxResults } = args as z.infer<typeof scanGitHubSchema>;
    
    try {
      onProgress?.(`🔍 Scanning GitHub for MCP crypto repositories...`);
      onProgress?.(`📅 Looking back ${daysBack} days`);
      if (minStars > 0) {
        onProgress?.(`⭐ Minimum stars: ${minStars}`);
      }
      
      // Call Python discovery module
      const result = await runPythonDiscovery('scan', {
        daysBack,
        minStars,
        queries,
        maxResults,
        format: 'json',
      }, onProgress);
      
      try {
        const data = JSON.parse(result);
        const repoCount = data.repos?.length || 0;
        
        onProgress?.(`✅ Found ${repoCount} repositories`);
        
        return JSON.stringify({
          success: true,
          repos_found: repoCount,
          repos: data.repos?.slice(0, 10).map((r: any) => ({
            name: r.full_name,
            description: r.description?.slice(0, 100),
            stars: r.stars,
            quality: r.quality,
            url: r.url,
          })),
          total_available: repoCount,
          message: `Found ${repoCount} MCP crypto repositories from the last ${daysBack} days`,
        }, null, 2);
      } catch {
        return result;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
};

// Tool: Analyze a specific repository
export const discoveryAnalyzeRepoTool: UnifiedTool = {
  name: "discovery-analyze-repo",
  description: "Analyze a GitHub repository to extract MCP tool definitions, assess quality, and check security.",
  zodSchema: analyzeRepoSchema,
  prompt: {
    description: "Analyze a specific GitHub repository to find MCP tools and assess their quality",
  },
  category: 'discovery',
  execute: async (args, onProgress) => {
    const { repoUrl, checkSecurity } = args as z.infer<typeof analyzeRepoSchema>;
    
    try {
      onProgress?.(`🔬 Analyzing repository: ${repoUrl}`);
      onProgress?.(`📥 Cloning repository...`);
      
      // Call Python discovery module
      const result = await runPythonDiscovery('analyze', {
        repoUrl,
        checkSecurity,
        format: 'json',
      }, onProgress);
      
      try {
        const data = JSON.parse(result);
        
        onProgress?.(`📊 Analysis complete`);
        onProgress?.(`🔧 Found ${data.total_tools || 0} tools`);
        onProgress?.(`📈 Quality score: ${data.quality_score?.toFixed(1) || 'N/A'}`);
        onProgress?.(`🛡️ Security score: ${data.security_score?.toFixed(1) || 'N/A'}`);
        
        return JSON.stringify({
          success: true,
          repo: data.repo_full_name,
          total_tools: data.total_tools,
          tools: data.tools?.map((t: any) => ({
            name: t.name,
            description: t.description?.slice(0, 100),
            category: t.category,
            chains: t.chains,
          })),
          quality_score: data.quality_score,
          security_score: data.security_score,
          categories: data.categories_found,
          chains_supported: data.chains_supported,
          issues: data.issues?.slice(0, 5),
        }, null, 2);
      } catch {
        return result;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
};

// Tool: Submit tools to registry
export const discoverySubmitToolTool: UnifiedTool = {
  name: "discovery-submit-tool",
  description: "Submit analyzed tools from a repository to the Lyra Registry. Requires prior analysis.",
  zodSchema: submitToolSchema,
  prompt: {
    description: "Submit validated tools from a repository to the Lyra Registry",
  },
  category: 'discovery',
  execute: async (args, onProgress) => {
    const { repoUrl, dryRun, minQualityScore, minSecurityScore } = args as z.infer<typeof submitToolSchema>;
    
    try {
      onProgress?.(`📤 ${dryRun ? '[DRY RUN] ' : ''}Submitting tools to registry...`);
      onProgress?.(`📊 Quality threshold: ${minQualityScore}`);
      onProgress?.(`🛡️ Security threshold: ${minSecurityScore}`);
      
      // Call Python discovery module
      const result = await runPythonDiscovery('submit', {
        repoUrl,
        dryRun,
        minQualityScore,
        minSecurityScore,
        format: 'json',
      }, onProgress);
      
      try {
        const data = JSON.parse(result);
        
        onProgress?.(`✅ Submission complete`);
        onProgress?.(`📥 Submitted: ${data.submitted || 0}`);
        onProgress?.(`✓ Accepted: ${data.accepted || 0}`);
        onProgress?.(`✗ Rejected: ${data.rejected || 0}`);
        
        return JSON.stringify({
          success: true,
          dry_run: dryRun,
          submitted: data.submitted,
          accepted: data.accepted,
          rejected: data.rejected,
          results: data.results?.slice(0, 10),
        }, null, 2);
      } catch {
        return result;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
};

// Tool: Run complete discovery pipeline
export const discoveryRunPipelineTool: UnifiedTool = {
  name: "discovery-run-pipeline",
  description: "Run the complete discovery pipeline: scan GitHub, analyze repos, and optionally submit to registry.",
  zodSchema: runPipelineSchema,
  prompt: {
    description: "Run the full discovery pipeline to find, analyze, and optionally submit new MCP crypto tools",
  },
  category: 'discovery',
  execute: async (args, onProgress) => {
    const { daysBack, submit, dryRun, maxRepos } = args as z.infer<typeof runPipelineSchema>;
    
    try {
      onProgress?.(`🚀 Starting discovery pipeline...`);
      onProgress?.(`📅 Days back: ${daysBack}`);
      onProgress?.(`📦 Max repos: ${maxRepos}`);
      onProgress?.(`📤 Submit: ${submit} (dry run: ${dryRun})`);
      
      // Call Python discovery module
      const result = await runPythonDiscovery('run', {
        daysBack,
        submit,
        dryRun,
        maxRepos,
        format: 'json',
      }, onProgress);
      
      try {
        const data = JSON.parse(result);
        
        onProgress?.(`\n✅ Pipeline complete!`);
        
        return JSON.stringify({
          success: true,
          duration_seconds: data.duration_seconds,
          repos_discovered: data.repos_discovered,
          repos_analyzed: data.repos_analyzed,
          total_tools_found: data.total_tools_found,
          tools_accepted: data.tools_accepted,
          tools_rejected: data.tools_rejected,
          quality_breakdown: {
            high: data.high_quality_repos,
            medium: data.medium_quality_repos,
            low: data.low_quality_repos,
          },
          top_repos: data.analyzed_repos?.slice(0, 5).map((r: any) => ({
            name: r.repo_full_name,
            tools: r.total_tools,
            quality: r.quality_score?.toFixed(1),
          })),
        }, null, 2);
      } catch {
        return result;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
};

// Tool: Get discovery statistics
export const discoveryGetStatsTool: UnifiedTool = {
  name: "discovery-get-stats",
  description: "Get statistics about the discovery module: recent runs, tools found, submission rates.",
  zodSchema: getDiscoveryStatsSchema,
  prompt: {
    description: "Get discovery module statistics",
  },
  category: 'discovery',
  execute: async (_args, onProgress) => {
    try {
      onProgress?.(`📊 Fetching discovery statistics...`);
      
      // Call Python discovery module
      const result = await runPythonDiscovery('stats', {
        format: 'json',
      }, onProgress);
      
      try {
        const data = JSON.parse(result);
        return JSON.stringify(data, null, 2);
      } catch {
        return result;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: errorMessage,
        note: "Discovery module stats not available. Run discovery first.",
      }, null, 2);
    }
  }
};

// Export all discovery tools
export const discoveryTools = [
  discoveryScanGitHubTool,
  discoveryAnalyzeRepoTool,
  discoverySubmitToolTool,
  discoveryRunPipelineTool,
  discoveryGetStatsTool,
];
