/**
 * Enhanced Tools - Additional MCP tools for diff analysis, doc generation, and forensics
 * 
 * These tools expose powerful Lyra Intel capabilities:
 * - diff-analyze: Analyze git diffs and assess change impact
 * - generate-docs: Auto-generate documentation from code analysis
 * - forensic-scan: Deep analysis for dead code, tech debt, and orphans
 */

import { z } from 'zod';
import { spawn } from 'child_process';
import { UnifiedTool } from './registry.js';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Schemas
// =============================================================================

const diffAnalyzeSchema = z.object({
  path: z.string().describe("Path to the git repository"),
  sourceRef: z.string().default("HEAD~1").describe("Source git reference (commit, branch, tag)"),
  targetRef: z.string().default("HEAD").describe("Target git reference (commit, branch, tag)"),
  includeImpact: z.boolean().default(true).describe("Include impact analysis (affected tests, risk score)"),
  maxDepth: z.number().default(3).describe("Maximum depth for impact propagation analysis"),
  focusFiles: z.array(z.string()).optional().describe("Specific files/patterns to focus on"),
});

const generateDocsSchema = z.object({
  path: z.string().describe("Path to the codebase to document"),
  outputFormat: z.enum(['markdown', 'html', 'json']).default('markdown').describe("Output format for generated docs"),
  docType: z.enum(['api', 'readme', 'architecture', 'all']).default('api').describe("Type of documentation to generate"),
  includeExamples: z.boolean().default(true).describe("Include code examples in documentation"),
  includeToc: z.boolean().default(true).describe("Include table of contents"),
  projectName: z.string().optional().describe("Project name for the documentation header"),
});

const forensicScanSchema = z.object({
  path: z.string().describe("Path to the repository to scan"),
  scanType: z.enum(['dead-code', 'tech-debt', 'orphans', 'full']).default('full').describe("Type of forensic scan"),
  includeGitHistory: z.boolean().default(true).describe("Include git history analysis"),
  minConfidence: z.number().default(0.7).describe("Minimum confidence threshold (0.0-1.0)"),
  excludePatterns: z.array(z.string()).optional().describe("Patterns to exclude from scan"),
  maxFileSize: z.number().default(10).describe("Maximum file size in MB to analyze"),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Run a Python module command and capture output
 * Reserved for future use when integrating with Python backend
 */
// @ts-ignore - Reserved for future use
const _runPythonCommand = async (
  modulePath: string,
  args: Record<string, unknown>,
  onProgress?: (message: string) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Build Python command with inline execution
    const pythonScript = buildPythonScript(modulePath, args);
    
    const proc = spawn('python3', ['-c', pythonScript], {
      cwd: process.env.LYRA_REPO_PATH || path.resolve(process.cwd(), '..'),
      env: { 
        ...process.env,
        PYTHONPATH: process.env.LYRA_REPO_PATH || path.resolve(process.cwd(), '..'),
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      // Send progress for each line
      text.split('\n').filter(Boolean).forEach(line => {
        if (line.startsWith('PROGRESS:')) {
          onProgress?.(line.replace('PROGRESS:', '').trim());
        }
      });
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        // If Python failed, try to provide useful output anyway
        if (stdout) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed (exit ${code}): ${stderr || 'Unknown error'}`));
        }
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

/**
 * Build an inline Python script for execution
 */
function buildPythonScript(modulePath: string, args: Record<string, unknown>): string {
  const argsJson = JSON.stringify(args);
  return `
import sys
import json
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

args = json.loads('''${argsJson}''')

${modulePath}
`;
}

/**
 * Execute git command and return output
 */
async function execGitCommand(repoPath: string, gitArgs: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', gitArgs, { cwd: repoPath });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    
    proc.on('close', (code: number) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Git command failed with code ${code}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to run git: ${err.message}`));
    });
  });
}

/**
 * Parse git diff output into structured data
 */
function parseGitDiff(diffOutput: string): Array<{
  filePath: string;
  changeType: string;
  additions: number;
  deletions: number;
  hunks: Array<{ oldStart: number; oldCount: number; newStart: number; newCount: number; content: string }>;
}> {
  const files: Array<{
    filePath: string;
    changeType: string;
    additions: number;
    deletions: number;
    hunks: Array<{ oldStart: number; oldCount: number; newStart: number; newCount: number; content: string }>;
  }> = [];

  const fileSections = diffOutput.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split('\n');
    
    // Parse file path from "a/path b/path"
    const headerMatch = lines[0]?.match(/a\/(.+?)\s+b\/(.+)/);
    if (!headerMatch) continue;

    const filePath = headerMatch[2];
    
    // Determine change type
    let changeType = 'modified';
    if (section.includes('new file mode')) changeType = 'added';
    else if (section.includes('deleted file mode')) changeType = 'deleted';
    else if (section.includes('rename from')) changeType = 'renamed';

    // Count additions and deletions
    let additions = 0;
    let deletions = 0;
    const hunks: Array<{ oldStart: number; oldCount: number; newStart: number; newCount: number; content: string }> = [];
    
    let currentHunk: { oldStart: number; oldCount: number; newStart: number; newCount: number; content: string } | null = null;

    for (const line of lines) {
      // Parse hunk header
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        if (currentHunk) hunks.push(currentHunk);
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldCount: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newCount: parseInt(hunkMatch[4] || '1', 10),
          content: '',
        };
        continue;
      }

      if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
          currentHunk.content += line + '\n';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
          currentHunk.content += line + '\n';
        } else if (line.startsWith(' ')) {
          currentHunk.content += line + '\n';
        }
      }
    }

    if (currentHunk) hunks.push(currentHunk);

    files.push({ filePath, changeType, additions, deletions, hunks });
  }

  return files;
}

/**
 * Analyze semantic changes in diff (functions, classes modified)
 */
function analyzeSemanticChanges(files: Array<{
  filePath: string;
  changeType: string;
  additions: number;
  deletions: number;
  hunks: Array<{ oldStart: number; oldCount: number; newStart: number; newCount: number; content: string }>;
}>): Array<{
  filePath: string;
  elementType: string;
  elementName: string;
  changeType: string;
}> {
  const semanticChanges: Array<{
    filePath: string;
    elementType: string;
    elementName: string;
    changeType: string;
  }> = [];

  // Patterns for different languages
  const patterns = {
    function: [
      /^[+-]\s*(?:async\s+)?(?:def|function|func)\s+(\w+)/,  // Python, JS, Go
      /^[+-]\s*(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\(/,  // Java/C#
      /^[+-]\s*(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*[:=]\s*(?:async\s+)?\(/,  // TS arrow/method
    ],
    class: [
      /^[+-]\s*class\s+(\w+)/,  // Python, JS, TS, Java
      /^[+-]\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
    ],
    interface: [
      /^[+-]\s*(?:export\s+)?interface\s+(\w+)/,  // TS
    ],
    method: [
      /^[+-]\s{2,}(?:async\s+)?(?:def|function)\s+(\w+)/,  // Indented = method
    ],
  };

  for (const file of files) {
    for (const hunk of file.hunks) {
      const lines = hunk.content.split('\n');
      
      for (const line of lines) {
        for (const [elementType, elementPatterns] of Object.entries(patterns)) {
          for (const pattern of elementPatterns) {
            const match = line.match(pattern);
            if (match) {
              const changeType = line.startsWith('+') ? 'added' : 'removed';
              semanticChanges.push({
                filePath: file.filePath,
                elementType,
                elementName: match[1],
                changeType,
              });
              break;
            }
          }
        }
      }
    }
  }

  return semanticChanges;
}

/**
 * Calculate impact and risk from changes
 */
function calculateImpact(
  files: Array<{ filePath: string; changeType: string; additions: number; deletions: number }>,
  semanticChanges: Array<{ filePath: string; elementType: string; elementName: string; changeType: string }>
): {
  riskScore: number;
  riskLevel: string;
  impactedAreas: string[];
  testImpact: string[];
  recommendations: string[];
} {
  let riskScore = 0;
  const impactedAreas: Set<string> = new Set();
  const testImpact: string[] = [];
  const recommendations: string[] = [];

  // Analyze file changes
  for (const file of files) {
    const fileLower = file.filePath.toLowerCase();
    
    // High-risk file patterns
    if (fileLower.includes('auth') || fileLower.includes('security') || fileLower.includes('crypto')) {
      riskScore += 25;
      impactedAreas.add('Security');
      recommendations.push(`⚠️ Security-sensitive file changed: ${file.filePath} - requires careful review`);
    }
    
    if (fileLower.includes('config') || fileLower.includes('.env') || fileLower.includes('settings')) {
      riskScore += 15;
      impactedAreas.add('Configuration');
      recommendations.push(`📋 Configuration file changed: ${file.filePath} - verify environment compatibility`);
    }
    
    if (fileLower.includes('migration') || fileLower.includes('schema') || fileLower.includes('model')) {
      riskScore += 20;
      impactedAreas.add('Data Layer');
      recommendations.push(`🗄️ Data model changed: ${file.filePath} - check migration scripts`);
    }
    
    if (fileLower.includes('api') || fileLower.includes('route') || fileLower.includes('endpoint')) {
      riskScore += 15;
      impactedAreas.add('API');
      recommendations.push(`🔌 API surface changed: ${file.filePath} - update API documentation`);
    }

    // Test files affected
    if (fileLower.includes('test') || fileLower.includes('spec')) {
      testImpact.push(file.filePath);
    }

    // Large changes are riskier
    const totalChanges = file.additions + file.deletions;
    if (totalChanges > 100) {
      riskScore += 10;
      recommendations.push(`📊 Large change (${totalChanges} lines) in ${file.filePath} - consider breaking into smaller PRs`);
    }
  }

  // Analyze semantic changes
  for (const change of semanticChanges) {
    if (change.elementType === 'class' && change.changeType === 'removed') {
      riskScore += 15;
      recommendations.push(`🗑️ Class removed: ${change.elementName} - verify all usages are updated`);
    }
    
    if (change.elementType === 'function' || change.elementType === 'method') {
      impactedAreas.add('Business Logic');
    }
    
    if (change.elementType === 'interface') {
      riskScore += 10;
      impactedAreas.add('Contracts');
      recommendations.push(`📝 Interface changed: ${change.elementName} - update all implementations`);
    }
  }

  // Cap risk score at 100
  riskScore = Math.min(100, riskScore);

  // Determine risk level
  let riskLevel: string;
  if (riskScore >= 70) riskLevel = 'critical';
  else if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 25) riskLevel = 'medium';
  else riskLevel = 'low';

  // Add general recommendations based on change size
  if (files.length > 10) {
    recommendations.push(`📁 ${files.length} files changed - ensure comprehensive testing`);
  }

  if (testImpact.length === 0 && files.length > 0) {
    recommendations.push(`⚠️ No test files in this change - consider adding tests`);
  }

  return {
    riskScore,
    riskLevel,
    impactedAreas: Array.from(impactedAreas),
    testImpact,
    recommendations: recommendations.slice(0, 10),  // Limit to top 10
  };
}

/**
 * Categorize changes (feature, bugfix, refactor, etc.)
 */
function categorizeChanges(
  files: Array<{ filePath: string; changeType: string }>,
  semanticChanges: Array<{ elementType: string; changeType: string }>
): { category: string; confidence: number } {
  const signals: Record<string, number> = {
    feature: 0,
    bugfix: 0,
    refactor: 0,
    documentation: 0,
    test: 0,
    config: 0,
    style: 0,
  };

  for (const file of files) {
    const fileLower = file.filePath.toLowerCase();
    
    if (fileLower.includes('test') || fileLower.includes('spec')) signals.test += 2;
    if (fileLower.includes('readme') || fileLower.includes('doc') || fileLower.endsWith('.md')) signals.documentation += 2;
    if (fileLower.includes('config') || fileLower.includes('.json') || fileLower.includes('.yaml')) signals.config += 1;
    if (fileLower.includes('style') || fileLower.includes('.css') || fileLower.includes('.scss')) signals.style += 1;
    
    if (file.changeType === 'added') signals.feature += 1;
  }

  // Check semantic changes
  const addedElements = semanticChanges.filter(s => s.changeType === 'added').length;
  const removedElements = semanticChanges.filter(s => s.changeType === 'removed').length;
  
  if (addedElements > removedElements * 2) signals.feature += 3;
  if (removedElements > addedElements) signals.refactor += 2;
  if (addedElements === removedElements && addedElements > 0) signals.refactor += 1;

  // Find the highest signal
  let maxCategory = 'feature';
  let maxScore = 0;
  for (const [category, score] of Object.entries(signals)) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = category;
    }
  }

  // Calculate confidence
  const totalSignals = Object.values(signals).reduce((a, b) => a + b, 0);
  const confidence = totalSignals > 0 ? Math.min(0.95, maxScore / totalSignals + 0.3) : 0.5;

  return { category: maxCategory, confidence };
}

/**
 * Scan directory for code files
 */
function scanDirectory(
  dirPath: string,
  extensions: string[] = ['.py', '.js', '.ts', '.tsx', '.jsx', '.go', '.rs', '.java', '.c', '.cpp', '.h'],
  excludePatterns: string[] = ['node_modules', '__pycache__', '.git', 'dist', 'build', 'venv']
): string[] {
  const files: string[] = [];
  
  function walk(currentPath: string) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(dirPath, fullPath);
        
        // Check exclusions
        if (excludePatterns.some(p => relativePath.includes(p))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }
  
  walk(dirPath);
  return files;
}

/**
 * Extract code definitions from a file
 */
function extractDefinitions(filePath: string, content: string): Array<{
  name: string;
  type: string;
  line: number;
  exported: boolean;
}> {
  const definitions: Array<{ name: string; type: string; line: number; exported: boolean }> = [];
  const lines = content.split('\n');
  const ext = path.extname(filePath).toLowerCase();
  
  // Python patterns
  if (ext === '.py') {
    lines.forEach((line, idx) => {
      // Functions
      const funcMatch = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
      if (funcMatch) {
        definitions.push({ name: funcMatch[1], type: 'function', line: idx + 1, exported: !funcMatch[1].startsWith('_') });
      }
      
      // Classes
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        definitions.push({ name: classMatch[1], type: 'class', line: idx + 1, exported: !classMatch[1].startsWith('_') });
      }
      
      // Module-level variables
      const varMatch = line.match(/^([A-Z][A-Z_0-9]*)\s*=/);
      if (varMatch) {
        definitions.push({ name: varMatch[1], type: 'constant', line: idx + 1, exported: true });
      }
    });
  }
  
  // TypeScript/JavaScript patterns
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    lines.forEach((line, idx) => {
      // Exported functions
      const exportFuncMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
      if (exportFuncMatch) {
        definitions.push({ name: exportFuncMatch[1], type: 'function', line: idx + 1, exported: true });
      }
      
      // Exported classes
      const exportClassMatch = line.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
      if (exportClassMatch) {
        definitions.push({ name: exportClassMatch[1], type: 'class', line: idx + 1, exported: true });
      }
      
      // Exported interfaces
      const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        definitions.push({ name: interfaceMatch[1], type: 'interface', line: idx + 1, exported: true });
      }
      
      // Exported types
      const typeMatch = line.match(/^export\s+type\s+(\w+)/);
      if (typeMatch) {
        definitions.push({ name: typeMatch[1], type: 'type', line: idx + 1, exported: true });
      }
      
      // Exported consts
      const constMatch = line.match(/^export\s+const\s+(\w+)/);
      if (constMatch) {
        definitions.push({ name: constMatch[1], type: 'constant', line: idx + 1, exported: true });
      }
      
      // Non-exported definitions
      const funcMatch = line.match(/^(?:async\s+)?function\s+(\w+)/);
      if (funcMatch && !line.includes('export')) {
        definitions.push({ name: funcMatch[1], type: 'function', line: idx + 1, exported: false });
      }
      
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch && !line.includes('export')) {
        definitions.push({ name: classMatch[1], type: 'class', line: idx + 1, exported: false });
      }
    });
  }
  
  return definitions;
}

/**
 * Find usages of a name in content
 */
function findUsages(content: string, name: string): number {
  // Create a regex that matches the name as a whole word (not part of another word)
  const regex = new RegExp(`\\b${name}\\b`, 'g');
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

// =============================================================================
// Tool: Diff Analyze
// =============================================================================

export const diffAnalyzeTool: UnifiedTool = {
  name: "diff-analyze",
  description: "Analyze git diffs between commits/branches to understand changes, their impact, and risk level. Identifies affected functions, classes, and provides actionable recommendations.",
  zodSchema: diffAnalyzeSchema,
  prompt: {
    description: "Analyze code changes between git references to understand impact and risk",
  },
  category: 'analysis',
  execute: async (args, onProgress) => {
    const { path: repoPath, sourceRef, targetRef, includeImpact, maxDepth, focusFiles } = 
      args as z.infer<typeof diffAnalyzeSchema>;
    
    try {
      onProgress?.(`🔍 Analyzing diff: ${sourceRef}..${targetRef}`);
      onProgress?.(`📁 Repository: ${repoPath}`);
      
      // Verify it's a git repository
      try {
        await execGitCommand(repoPath, ['rev-parse', '--git-dir']);
      } catch {
        throw new Error(`Not a git repository: ${repoPath}`);
      }
      
      // Get the diff
      onProgress?.(`📊 Fetching git diff...`);
      const diffArgs = ['diff', sourceRef, targetRef, '--unified=3'];
      if (focusFiles && focusFiles.length > 0) {
        diffArgs.push('--', ...focusFiles);
      }
      
      const diffOutput = await execGitCommand(repoPath, diffArgs);
      
      if (!diffOutput.trim()) {
        return JSON.stringify({
          success: true,
          summary: {
            sourceRef,
            targetRef,
            totalFilesChanged: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            message: "No differences found between references",
          },
        }, null, 2);
      }
      
      // Parse the diff
      onProgress?.(`🔬 Parsing changes...`);
      const parsedFiles = parseGitDiff(diffOutput);
      
      // Get diff stats (for potential future use)
      await execGitCommand(repoPath, ['diff', sourceRef, targetRef, '--stat', '--stat-width=200']);
      
      // Analyze semantic changes
      onProgress?.(`🧠 Analyzing semantic changes...`);
      const semanticChanges = analyzeSemanticChanges(parsedFiles);
      
      // Categorize the changes
      const { category, confidence } = categorizeChanges(parsedFiles, semanticChanges);
      
      // Calculate totals
      const totalAdditions = parsedFiles.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = parsedFiles.reduce((sum, f) => sum + f.deletions, 0);
      
      // Build result
      const result: Record<string, unknown> = {
        success: true,
        summary: {
          sourceRef,
          targetRef,
          totalFilesChanged: parsedFiles.length,
          totalAdditions,
          totalDeletions,
          netChange: totalAdditions - totalDeletions,
          changeCategory: category,
          categoryConfidence: Math.round(confidence * 100) + '%',
        },
        files: parsedFiles.map(f => ({
          path: f.filePath,
          changeType: f.changeType,
          additions: f.additions,
          deletions: f.deletions,
        })),
        semanticChanges: semanticChanges.slice(0, 50).map(s => ({
          file: s.filePath,
          type: s.elementType,
          name: s.elementName,
          change: s.changeType,
        })),
      };
      
      // Impact analysis
      if (includeImpact) {
        onProgress?.(`⚡ Calculating impact (depth: ${maxDepth})...`);
        const impact = calculateImpact(parsedFiles, semanticChanges);
        result.impact = {
          riskScore: impact.riskScore,
          riskLevel: impact.riskLevel,
          impactedAreas: impact.impactedAreas,
          affectedTests: impact.testImpact,
          recommendations: impact.recommendations,
        };
      }
      
      // File type breakdown
      const fileTypes: Record<string, number> = {};
      for (const file of parsedFiles) {
        const ext = path.extname(file.filePath) || 'no-ext';
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      }
      result.fileTypeBreakdown = fileTypes;
      
      onProgress?.(`✅ Analysis complete`);
      
      return JSON.stringify(result, null, 2);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: errorMessage,
        hint: "Ensure the path is a valid git repository and both refs exist",
      }, null, 2);
    }
  }
};

// =============================================================================
// Tool: Generate Docs
// =============================================================================

export const generateDocsTool: UnifiedTool = {
  name: "generate-docs",
  description: "Auto-generate documentation from code analysis. Supports API docs, README generation, and architecture documentation in multiple formats.",
  zodSchema: generateDocsSchema,
  prompt: {
    description: "Generate documentation from code analysis",
  },
  category: 'documentation',
  execute: async (args, onProgress) => {
    const { path: codePath, outputFormat, docType, includeToc, projectName } = 
      args as z.infer<typeof generateDocsSchema>;
    
    try {
      onProgress?.(`📚 Generating ${docType} documentation...`);
      onProgress?.(`📁 Source: ${codePath}`);
      onProgress?.(`📄 Format: ${outputFormat}`);
      
      // Verify path exists
      if (!fs.existsSync(codePath)) {
        throw new Error(`Path does not exist: ${codePath}`);
      }
      
      // Scan for code files
      onProgress?.(`🔍 Scanning codebase...`);
      const codeFiles = scanDirectory(codePath);
      
      if (codeFiles.length === 0) {
        throw new Error(`No code files found in: ${codePath}`);
      }
      
      onProgress?.(`📊 Found ${codeFiles.length} code files`);
      
      // Extract definitions from all files
      onProgress?.(`🔬 Extracting code structure...`);
      const allDefinitions: Array<{
        file: string;
        relativePath: string;
        definitions: Array<{ name: string; type: string; line: number; exported: boolean }>;
      }> = [];
      
      for (const file of codeFiles.slice(0, 100)) {  // Limit to 100 files for performance
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const definitions = extractDefinitions(file, content);
          
          if (definitions.length > 0) {
            allDefinitions.push({
              file,
              relativePath: path.relative(codePath, file),
              definitions,
            });
          }
        } catch {
          // Skip files we can't read
        }
      }
      
      // Determine project name
      const resolvedProjectName = projectName || path.basename(codePath);
      
      // Generate documentation based on type
      let documentation = '';
      const sections: string[] = [];
      
      const timestamp = new Date().toISOString().split('T')[0];
      
      if (docType === 'api' || docType === 'all') {
        onProgress?.(`📝 Generating API documentation...`);
        
        documentation += `# ${resolvedProjectName} API Documentation\n\n`;
        documentation += `_Generated on ${timestamp}_\n\n`;
        sections.push('Header');
        
        if (includeToc) {
          documentation += `## Table of Contents\n\n`;
          for (const fileDef of allDefinitions.slice(0, 30)) {
            const anchor = fileDef.relativePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            documentation += `- [${fileDef.relativePath}](#${anchor})\n`;
          }
          documentation += `\n`;
          sections.push('Table of Contents');
        }
        
        // Group by directory
        const byDirectory: Record<string, typeof allDefinitions> = {};
        for (const fileDef of allDefinitions) {
          const dir = path.dirname(fileDef.relativePath) || '.';
          if (!byDirectory[dir]) byDirectory[dir] = [];
          byDirectory[dir].push(fileDef);
        }
        
        for (const [dir, files] of Object.entries(byDirectory)) {
          documentation += `---\n\n## ${dir === '.' ? 'Root' : dir}\n\n`;
          sections.push(dir === '.' ? 'Root' : dir);
          
          for (const fileDef of files) {
            const anchor = fileDef.relativePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            documentation += `### ${fileDef.relativePath} {#${anchor}}\n\n`;
            
            // Group definitions by type
            const classes = fileDef.definitions.filter(d => d.type === 'class');
            const functions = fileDef.definitions.filter(d => d.type === 'function');
            const interfaces = fileDef.definitions.filter(d => d.type === 'interface');
            const types = fileDef.definitions.filter(d => d.type === 'type');
            const constants = fileDef.definitions.filter(d => d.type === 'constant');
            
            if (classes.length > 0) {
              documentation += `**Classes:**\n`;
              for (const cls of classes) {
                const exported = cls.exported ? '🔓' : '🔒';
                documentation += `- ${exported} \`${cls.name}\` (line ${cls.line})\n`;
              }
              documentation += `\n`;
            }
            
            if (interfaces.length > 0) {
              documentation += `**Interfaces:**\n`;
              for (const iface of interfaces) {
                documentation += `- \`${iface.name}\` (line ${iface.line})\n`;
              }
              documentation += `\n`;
            }
            
            if (types.length > 0) {
              documentation += `**Types:**\n`;
              for (const t of types) {
                documentation += `- \`${t.name}\` (line ${t.line})\n`;
              }
              documentation += `\n`;
            }
            
            if (functions.length > 0) {
              documentation += `**Functions:**\n`;
              for (const func of functions) {
                const exported = func.exported ? '🔓' : '🔒';
                documentation += `- ${exported} \`${func.name}()\` (line ${func.line})\n`;
              }
              documentation += `\n`;
            }
            
            if (constants.length > 0) {
              documentation += `**Constants:**\n`;
              for (const c of constants) {
                documentation += `- \`${c.name}\` (line ${c.line})\n`;
              }
              documentation += `\n`;
            }
          }
        }
      }
      
      if (docType === 'readme' || docType === 'all') {
        onProgress?.(`📝 Generating README...`);
        
        if (docType === 'all') {
          documentation += `\n---\n\n`;
        }
        
        documentation += `# ${resolvedProjectName}\n\n`;
        documentation += `> Auto-generated project documentation\n\n`;
        sections.push('README');
        
        // Stats
        const totalClasses = allDefinitions.reduce((sum, f) => sum + f.definitions.filter(d => d.type === 'class').length, 0);
        const totalFunctions = allDefinitions.reduce((sum, f) => sum + f.definitions.filter(d => d.type === 'function').length, 0);
        const totalInterfaces = allDefinitions.reduce((sum, f) => sum + f.definitions.filter(d => d.type === 'interface').length, 0);
        
        documentation += `## Project Statistics\n\n`;
        documentation += `| Metric | Count |\n`;
        documentation += `|--------|-------|\n`;
        documentation += `| Files | ${codeFiles.length} |\n`;
        documentation += `| Classes | ${totalClasses} |\n`;
        documentation += `| Functions | ${totalFunctions} |\n`;
        documentation += `| Interfaces | ${totalInterfaces} |\n\n`;
        
        // File types
        const extensions: Record<string, number> = {};
        for (const file of codeFiles) {
          const ext = path.extname(file) || 'no-ext';
          extensions[ext] = (extensions[ext] || 0) + 1;
        }
        
        documentation += `## Languages\n\n`;
        for (const [ext, count] of Object.entries(extensions).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
          documentation += `- ${ext}: ${count} files\n`;
        }
        documentation += `\n`;
        
        // Structure
        documentation += `## Project Structure\n\n`;
        documentation += `\`\`\`\n`;
        const dirs = new Set<string>();
        for (const file of codeFiles.slice(0, 50)) {
          const rel = path.relative(codePath, file);
          const parts = rel.split(path.sep);
          let current = '';
          for (let i = 0; i < parts.length - 1; i++) {
            current = current ? `${current}/${parts[i]}` : parts[i];
            dirs.add(current);
          }
        }
        for (const dir of Array.from(dirs).sort().slice(0, 20)) {
          const depth = dir.split('/').length - 1;
          documentation += `${'  '.repeat(depth)}${path.basename(dir)}/\n`;
        }
        documentation += `\`\`\`\n\n`;
      }
      
      if (docType === 'architecture' || docType === 'all') {
        onProgress?.(`📝 Generating architecture documentation...`);
        
        if (docType === 'all') {
          documentation += `\n---\n\n`;
        }
        
        documentation += `# ${resolvedProjectName} Architecture\n\n`;
        sections.push('Architecture');
        
        // Analyze module structure
        const modules: Record<string, { files: number; classes: number; functions: number }> = {};
        
        for (const fileDef of allDefinitions) {
          const parts = fileDef.relativePath.split(path.sep);
          const module = parts.length > 1 ? parts[0] : 'root';
          
          if (!modules[module]) {
            modules[module] = { files: 0, classes: 0, functions: 0 };
          }
          
          modules[module].files++;
          modules[module].classes += fileDef.definitions.filter(d => d.type === 'class').length;
          modules[module].functions += fileDef.definitions.filter(d => d.type === 'function').length;
        }
        
        documentation += `## Module Overview\n\n`;
        documentation += `| Module | Files | Classes | Functions |\n`;
        documentation += `|--------|-------|---------|----------|\n`;
        
        for (const [mod, stats] of Object.entries(modules).sort((a, b) => b[1].files - a[1].files)) {
          documentation += `| ${mod} | ${stats.files} | ${stats.classes} | ${stats.functions} |\n`;
        }
        documentation += `\n`;
        
        // Entry points (exported items)
        const exportedItems = allDefinitions.flatMap(f => 
          f.definitions.filter(d => d.exported).map(d => ({
            ...d,
            file: f.relativePath,
          }))
        );
        
        documentation += `## Public API Surface\n\n`;
        documentation += `Total exported items: ${exportedItems.length}\n\n`;
        
        const exportedClasses = exportedItems.filter(e => e.type === 'class').slice(0, 15);
        if (exportedClasses.length > 0) {
          documentation += `### Key Classes\n\n`;
          for (const cls of exportedClasses) {
            documentation += `- \`${cls.name}\` - ${cls.file}:${cls.line}\n`;
          }
          documentation += `\n`;
        }
        
        const exportedFunctions = exportedItems.filter(e => e.type === 'function').slice(0, 15);
        if (exportedFunctions.length > 0) {
          documentation += `### Key Functions\n\n`;
          for (const func of exportedFunctions) {
            documentation += `- \`${func.name}()\` - ${func.file}:${func.line}\n`;
          }
          documentation += `\n`;
        }
      }
      
      // Convert format if needed
      let finalContent = documentation;
      if (outputFormat === 'json') {
        finalContent = JSON.stringify({
          projectName: resolvedProjectName,
          generatedAt: timestamp,
          docType,
          sections,
          files: allDefinitions.map(f => ({
            path: f.relativePath,
            definitions: f.definitions,
          })),
          stats: {
            totalFiles: codeFiles.length,
            documentedFiles: allDefinitions.length,
          },
          markdown: documentation,
        }, null, 2);
      } else if (outputFormat === 'html') {
        // Simple HTML conversion
        finalContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resolvedProjectName} Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 15px; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
    h1, h2, h3 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
  </style>
</head>
<body>
${documentation
  .replace(/^### (.*)/gm, '<h3>$1</h3>')
  .replace(/^## (.*)/gm, '<h2>$1</h2>')
  .replace(/^# (.*)/gm, '<h1>$1</h1>')
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/^- (.*)/gm, '<li>$1</li>')
  .replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>')
  .replace(/\n\n/g, '</p><p>')
  .replace(/```\n([\s\S]*?)```/g, '<pre>$1</pre>')}
</body>
</html>`;
      }
      
      onProgress?.(`✅ Documentation generated`);
      
      return JSON.stringify({
        success: true,
        format: outputFormat,
        docType,
        projectName: resolvedProjectName,
        stats: {
          filesScanned: codeFiles.length,
          filesDocumented: allDefinitions.length,
          sectionsGenerated: sections.length,
          wordCount: documentation.split(/\s+/).length,
          characterCount: documentation.length,
        },
        sections,
        content: finalContent,
        hint: outputFormat === 'markdown' 
          ? "Content is ready to save as a .md file" 
          : outputFormat === 'html'
            ? "Content is ready to save as a .html file"
            : "Structured JSON output",
      }, null, 2);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
};

// =============================================================================
// Tool: Forensic Scan
// =============================================================================

export const forensicScanTool: UnifiedTool = {
  name: "forensic-scan",
  description: "Deep forensic analysis to find dead code, technical debt, orphaned documentation, and code-doc discrepancies. Identifies unused functions, classes, and provides actionable cleanup recommendations.",
  zodSchema: forensicScanSchema,
  prompt: {
    description: "Perform forensic analysis to find dead code, tech debt, and orphans",
  },
  category: 'forensics',
  execute: async (args, onProgress) => {
    const { path: repoPath, scanType, includeGitHistory, minConfidence, excludePatterns, maxFileSize } = 
      args as z.infer<typeof forensicScanSchema>;
    
    try {
      onProgress?.(`🔬 Starting forensic scan: ${scanType}`);
      onProgress?.(`📁 Repository: ${repoPath}`);
      
      // Verify path exists
      if (!fs.existsSync(repoPath)) {
        throw new Error(`Path does not exist: ${repoPath}`);
      }
      
      // Build exclusion patterns
      const defaultExclusions = ['node_modules', '__pycache__', '.git', 'dist', 'build', 'venv', '.next', 'coverage'];
      const allExclusions = [...defaultExclusions, ...(excludePatterns || [])];
      
      // Scan for files
      onProgress?.(`🔍 Scanning repository...`);
      const codeFiles = scanDirectory(repoPath, undefined, allExclusions);
      const docFiles = scanDirectory(repoPath, ['.md', '.mdx', '.rst', '.txt'], allExclusions);
      
      onProgress?.(`📊 Found ${codeFiles.length} code files, ${docFiles.length} doc files`);
      
      // Limit files for performance
      const maxFiles = 200;
      const limitedCodeFiles = codeFiles.slice(0, maxFiles);
      const limitedDocFiles = docFiles.slice(0, 50);
      
      // Collect all definitions and build usage index
      onProgress?.(`🔬 Extracting definitions...`);
      const allDefinitions: Map<string, {
        name: string;
        type: string;
        file: string;
        line: number;
        exported: boolean;
        usageCount: number;
      }> = new Map();
      
      const fileContents: Map<string, string> = new Map();
      
      // First pass: collect all definitions
      for (const file of limitedCodeFiles) {
        try {
          const stat = fs.statSync(file);
          if (stat.size > maxFileSize * 1024 * 1024) continue;
          
          const content = fs.readFileSync(file, 'utf-8');
          fileContents.set(file, content);
          
          const defs = extractDefinitions(file, content);
          for (const def of defs) {
            const key = `${def.name}@${path.relative(repoPath, file)}`;
            allDefinitions.set(key, {
              ...def,
              file: path.relative(repoPath, file),
              usageCount: 0,
            });
          }
        } catch {
          // Skip files we can't read
        }
      }
      
      onProgress?.(`📈 Found ${allDefinitions.size} definitions`);
      
      // Second pass: count usages
      onProgress?.(`🔗 Analyzing usage patterns...`);
      const allContent = Array.from(fileContents.values()).join('\n');
      
      for (const [, def] of allDefinitions) {
        // Count usages across all files (subtract 1 for the definition itself)
        const usages = findUsages(allContent, def.name);
        def.usageCount = Math.max(0, usages - 1);
      }
      
      // Results containers
      const results: {
        deadCode: Array<{ file: string; name: string; type: string; line: number; confidence: number; reason: string }>;
        techDebt: Array<{ file: string; issue: string; severity: string; line?: number; recommendation: string }>;
        orphans: Array<{ type: string; path: string; description: string }>;
        discrepancies: Array<{ codeFile: string; docFile: string; issue: string }>;
      } = {
        deadCode: [],
        techDebt: [],
        orphans: [],
        discrepancies: [],
      };
      
      // Dead code detection
      if (scanType === 'dead-code' || scanType === 'full') {
        onProgress?.(`🗑️ Detecting dead code...`);
        
        // Ignore patterns for dead code (test files, dunder methods, etc.)
        const ignorePatterns = [
          /^test_/,
          /^Test/,
          /_test$/,
          /Spec$/,
          /^__\w+__$/,
          /^main$/,
          /^app$/,
          /^index$/,
          /^setup$/,
          /^configure$/,
        ];
        
        for (const [, def] of allDefinitions) {
          // Skip if matches ignore pattern
          if (ignorePatterns.some(p => p.test(def.name))) continue;
          
          // Skip test files
          if (def.file.includes('test') || def.file.includes('spec')) continue;
          
          // Check for potentially dead code
          if (def.usageCount === 0) {
            let confidence = 0.8;
            let reason = 'No usages found in codebase';
            
            // Lower confidence for exported items (might be used externally)
            if (def.exported) {
              confidence = 0.5;
              reason = 'No internal usages (exported, may be used externally)';
            }
            
            // Lower confidence for special names
            if (def.name.startsWith('_') && !def.name.startsWith('__')) {
              confidence = 0.6;
              reason = 'Private by convention, no usages found';
            }
            
            // Higher confidence for internal functions with no usages
            if (!def.exported && def.type === 'function') {
              confidence = 0.9;
              reason = 'Internal function with no usages';
            }
            
            if (confidence >= minConfidence) {
              results.deadCode.push({
                file: def.file,
                name: def.name,
                type: def.type,
                line: def.line,
                confidence: Math.round(confidence * 100) / 100,
                reason,
              });
            }
          }
        }
      }
      
      // Tech debt detection
      if (scanType === 'tech-debt' || scanType === 'full') {
        onProgress?.(`💳 Detecting technical debt...`);
        
        for (const [file, content] of fileContents) {
          const relPath = path.relative(repoPath, file);
          const lines = content.split('\n');
          
          // Check for TODO/FIXME/HACK comments
          lines.forEach((line, idx) => {
            const todoMatch = line.match(/(?:\/\/|#|\/\*|\*)\s*(TODO|FIXME|HACK|XXX|BUG)[\s:]+(.+)/i);
            if (todoMatch) {
              results.techDebt.push({
                file: relPath,
                issue: `${todoMatch[1]}: ${todoMatch[2].trim().slice(0, 100)}`,
                severity: todoMatch[1].toUpperCase() === 'FIXME' || todoMatch[1].toUpperCase() === 'BUG' ? 'high' : 'medium',
                line: idx + 1,
                recommendation: 'Address or create a tracked issue',
              });
            }
          });
          
          // Check for long files
          if (lines.length > 500) {
            results.techDebt.push({
              file: relPath,
              issue: `Large file with ${lines.length} lines`,
              severity: lines.length > 1000 ? 'high' : 'medium',
              recommendation: 'Consider splitting into smaller modules',
            });
          }
          
          // Check for deeply nested code (rough heuristic)
          const maxIndent = Math.max(...lines.map(l => {
            const match = l.match(/^(\s+)/);
            return match ? match[1].length : 0;
          }));
          
          if (maxIndent > 24) {  // More than 6 levels (assuming 4-space indent)
            results.techDebt.push({
              file: relPath,
              issue: `Deeply nested code detected (${Math.floor(maxIndent / 4)} levels)`,
              severity: 'medium',
              recommendation: 'Refactor to reduce nesting depth',
            });
          }
          
          // Check for duplicate/similar function names (potential copy-paste)
          const funcNames = extractDefinitions(file, content)
            .filter(d => d.type === 'function')
            .map(d => d.name);
          
          const nameCounts: Record<string, number> = {};
          for (const name of funcNames) {
            // Normalize name (remove numbers, common prefixes)
            const normalized = name.replace(/[0-9]+$/, '').replace(/^(get|set|is|has|do|handle|on)/, '');
            nameCounts[normalized] = (nameCounts[normalized] || 0) + 1;
          }
          
          for (const [name, count] of Object.entries(nameCounts)) {
            if (count > 2 && name.length > 3) {
              results.techDebt.push({
                file: relPath,
                issue: `Possible code duplication: ${count} similar functions (${name}*)`,
                severity: 'low',
                recommendation: 'Review for potential consolidation',
              });
            }
          }
        }
      }
      
      // Orphan detection (code without docs, docs without code)
      if (scanType === 'orphans' || scanType === 'full') {
        onProgress?.(`👻 Detecting orphans...`);
        
        // Check for undocumented modules
        const documentedInReadme = new Set<string>();
        
        for (const docFile of limitedDocFiles) {
          try {
            const content = fs.readFileSync(docFile, 'utf-8');
            
            // Extract mentioned file paths and names
            const codeRefs = content.match(/`[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-z]+)?`/g) || [];
            for (const ref of codeRefs) {
              documentedInReadme.add(ref.replace(/`/g, ''));
            }
          } catch {
            // Skip
          }
        }
        
        // Find major modules without documentation
        const moduleDirectories = new Set<string>();
        for (const file of limitedCodeFiles) {
          const rel = path.relative(repoPath, file);
          const parts = rel.split(path.sep);
          if (parts.length > 1) {
            moduleDirectories.add(parts[0]);
          }
        }
        
        // Check if README mentions each module
        for (const module of moduleDirectories) {
          // Skip common non-feature directories
          if (['test', 'tests', 'spec', 'docs', 'scripts', 'examples', 'config'].includes(module.toLowerCase())) {
            continue;
          }
          
          const isDocumented = Array.from(documentedInReadme).some(ref => 
            ref.toLowerCase().includes(module.toLowerCase())
          );
          
          if (!isDocumented && limitedDocFiles.length > 0) {
            results.orphans.push({
              type: 'undocumented-module',
              path: module,
              description: `Module "${module}" not mentioned in documentation`,
            });
          }
        }
        
        // Check for orphaned doc files (docs referencing non-existent code)
        for (const docFile of limitedDocFiles) {
          const docName = path.basename(docFile, path.extname(docFile)).toLowerCase();
          
          // Skip generic docs
          if (['readme', 'contributing', 'license', 'changelog', 'history', 'index'].includes(docName)) {
            continue;
          }
          
          // Check if there's corresponding code
          const hasCorrespondingCode = limitedCodeFiles.some(f => {
            const codeName = path.basename(f, path.extname(f)).toLowerCase();
            return codeName === docName || codeName.includes(docName) || docName.includes(codeName);
          });
          
          if (!hasCorrespondingCode) {
            results.orphans.push({
              type: 'orphaned-doc',
              path: path.relative(repoPath, docFile),
              description: `Documentation file may reference removed code`,
            });
          }
        }
      }
      
      // Git history analysis
      let gitStats = null;
      if (includeGitHistory) {
        onProgress?.(`📜 Analyzing git history...`);
        
        try {
          // Check if it's a git repo
          await execGitCommand(repoPath, ['rev-parse', '--git-dir']);
          
          // Get recent commit count
          const commitCount = await execGitCommand(repoPath, ['rev-list', '--count', 'HEAD']);
          
          // Get files not modified in a long time
          const logOutput = await execGitCommand(repoPath, [
            'log', '--all', '--format=%H', '--name-only', '--since=6 months ago'
          ]);
          
          const recentlyModified = new Set(
            logOutput.split('\n').filter(line => line && !line.match(/^[a-f0-9]{40}$/))
          );
          
          // Find stale files
          const staleFiles: string[] = [];
          for (const file of limitedCodeFiles.slice(0, 50)) {
            const relPath = path.relative(repoPath, file);
            if (!recentlyModified.has(relPath)) {
              staleFiles.push(relPath);
            }
          }
          
          gitStats = {
            totalCommits: parseInt(commitCount.trim(), 10) || 0,
            staleFiles: staleFiles.slice(0, 20),
            staleFileCount: staleFiles.length,
          };
          
          // Add stale files as tech debt if doing full scan
          if ((scanType === 'tech-debt' || scanType === 'full') && staleFiles.length > 0) {
            results.techDebt.push({
              file: '(multiple files)',
              issue: `${staleFiles.length} files not modified in 6+ months`,
              severity: 'low',
              recommendation: 'Review for relevance or potential removal',
            });
          }
        } catch {
          // Not a git repo or git command failed
          gitStats = { error: 'Not a git repository or git analysis failed' };
        }
      }
      
      // Calculate summary stats
      const summary = {
        filesScanned: limitedCodeFiles.length,
        definitionsAnalyzed: allDefinitions.size,
        deadCodeItems: results.deadCode.length,
        techDebtItems: results.techDebt.length,
        orphanItems: results.orphans.length,
        discrepancyItems: results.discrepancies.length,
        overallHealthScore: calculateHealthScore(results),
      };
      
      onProgress?.(`✅ Forensic scan complete`);
      
      return JSON.stringify({
        success: true,
        scanType,
        summary,
        deadCode: results.deadCode.slice(0, 50),
        techDebt: results.techDebt.slice(0, 50),
        orphans: results.orphans.slice(0, 30),
        discrepancies: results.discrepancies.slice(0, 20),
        gitAnalysis: gitStats,
        recommendations: generateRecommendations(results, summary),
      }, null, 2);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
};

/**
 * Calculate overall codebase health score
 */
function calculateHealthScore(results: {
  deadCode: unknown[];
  techDebt: unknown[];
  orphans: unknown[];
  discrepancies: unknown[];
}): number {
  let score = 100;
  
  // Deduct points for issues
  score -= Math.min(30, results.deadCode.length * 2);
  score -= Math.min(30, results.techDebt.length * 1);
  score -= Math.min(20, results.orphans.length * 3);
  score -= Math.min(20, results.discrepancies.length * 5);
  
  return Math.max(0, Math.round(score));
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  results: {
    deadCode: Array<{ type: string; confidence: number }>;
    techDebt: Array<{ severity: string; issue?: string }>;
    orphans: unknown[];
    discrepancies: unknown[];
  },
  summary: { overallHealthScore: number }
): string[] {
  const recommendations: string[] = [];
  
  if (summary.overallHealthScore < 50) {
    recommendations.push('🚨 Critical: Codebase health is low. Prioritize cleanup before new features.');
  }
  
  const highConfidenceDeadCode = results.deadCode.filter(d => d.confidence >= 0.8).length;
  if (highConfidenceDeadCode > 5) {
    recommendations.push(`🗑️ Remove ${highConfidenceDeadCode} high-confidence dead code items to reduce maintenance burden`);
  }
  
  const highSeverityDebt = results.techDebt.filter(d => d.severity === 'high').length;
  if (highSeverityDebt > 0) {
    recommendations.push(`⚠️ Address ${highSeverityDebt} high-severity tech debt items`);
  }
  
  if (results.orphans.length > 5) {
    recommendations.push(`📚 Update documentation to cover ${results.orphans.length} undocumented areas`);
  }
  
  const todoCount = results.techDebt.filter(d => d.issue?.includes('TODO') || d.issue?.includes('FIXME')).length;
  if (todoCount > 10) {
    recommendations.push(`✅ Convert ${todoCount} TODO/FIXME comments to tracked issues`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✨ Codebase is in good health! Keep up the good work.');
  }
  
  return recommendations;
}

// =============================================================================
// Export all enhanced tools
// =============================================================================

export const enhancedTools = [
  diffAnalyzeTool,
  generateDocsTool,
  forensicScanTool,
];
