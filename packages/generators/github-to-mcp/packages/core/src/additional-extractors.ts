/**
 * @fileoverview Additional source extractors for tools
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { ExtractedTool, ConfidenceFactors } from './types';

/**
 * Calculate confidence score for extracted tools
 */
function calculateConfidence(
  hasDescription: boolean,
  hasParams: boolean,
  sourceType: string
): { confidence: number; factors: ConfidenceFactors } {
  const factors: ConfidenceFactors = {
    documentation: hasDescription ? 0.7 : 0.2,
    types: hasParams ? 0.5 : 0.2,
    examples: 0, // Scripts typically don't have examples
    source: sourceType === 'code' ? 0.6 : 0.4
  };

  const confidence = (
    factors.documentation * 0.35 +
    factors.types * 0.25 +
    factors.examples * 0.15 +
    factors.source * 0.25
  );

  return { confidence: Math.round(confidence * 100) / 100, factors };
}

/**
 * Extract development tools from CONTRIBUTING.md
 */
export function extractFromContributing(content: string, filename: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  const lines = content.split('\n');
  
  let inCodeBlock = false;
  let currentCommand = '';
  let currentDescription = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (!inCodeBlock && currentCommand) {
        const tool = parseCommandTool(currentCommand, currentDescription, filename, i);
        if (tool) tools.push(tool);
        currentCommand = '';
        currentDescription = '';
      }
      continue;
    }
    
    if (inCodeBlock) {
      // Look for commands
      const cmdMatch = line.match(/^\s*(?:\$\s+)?(npm\s+run\s+\w+|make\s+\w+|pnpm\s+\w+|yarn\s+\w+|cargo\s+\w+|go\s+\w+)/);
      if (cmdMatch) {
        currentCommand = cmdMatch[1];
      }
    } else {
      // Look for descriptions before code blocks
      if (line.trim() && !line.startsWith('#')) {
        currentDescription = line.trim();
      }
    }
  }
  
  return tools;
}

/**
 * Parse a command into a tool
 */
function parseCommandTool(
  command: string,
  description: string,
  filename: string,
  line: number
): ExtractedTool | null {
  const parts = command.split(/\s+/);
  if (parts.length < 2) return null;
  
  const runner = parts[0]; // npm, make, yarn, etc.
  const taskName = parts.slice(1).join('_');
  
  const name = `run_${taskName}`;
  const { confidence, factors } = calculateConfidence(!!description, false, 'docs');
  
  return {
    name,
    description: description || `Run ${command}`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    source: {
      type: 'docs',
      file: filename,
      line
    },
    confidence,
    confidenceFactors: factors
  };
}

/**
 * Extract tools from Makefile targets
 */
export function extractFromMakefile(content: string, filename: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  const lines = content.split('\n');
  
  let currentComment = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Capture comments
    if (line.startsWith('#')) {
      currentComment = line.substring(1).trim();
      continue;
    }
    
    // Match target definitions
    const targetMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/);
    if (targetMatch) {
      const targetName = targetMatch[1];
      
      // Skip common internal targets
      if (targetName.startsWith('.') || ['all', 'default'].includes(targetName)) {
        currentComment = '';
        continue;
      }
      
      const { confidence, factors } = calculateConfidence(!!currentComment, false, 'code');
      
      tools.push({
        name: `make_${targetName}`,
        description: currentComment || `Run make target: ${targetName}`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        source: {
          type: 'code',
          file: filename,
          line: i + 1
        },
        confidence,
        confidenceFactors: factors
      });
      
      currentComment = '';
    }
  }
  
  return tools;
}

/**
 * Extract tools from package.json scripts
 */
export function extractFromPackageJson(content: string, filename: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  
  try {
    const pkg = JSON.parse(content);
    const scripts = pkg.scripts || {};
    
    for (const [name, command] of Object.entries(scripts)) {
      if (typeof command !== 'string') continue;
      
      // Skip lifecycle scripts
      if (name.startsWith('pre') || name.startsWith('post')) continue;
      
      // Try to extract description from comments in command or script name
      const description = getScriptDescription(name, command as string);
      const { confidence, factors } = calculateConfidence(true, false, 'code');
      
      tools.push({
        name: `npm_run_${name.replace(/[:-]/g, '_')}`,
        description,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        source: {
          type: 'code',
          file: filename
        },
        confidence,
        confidenceFactors: factors
      });
    }
  } catch {
    // Invalid JSON
  }
  
  return tools;
}

/**
 * Get description for a script based on its name and command
 */
function getScriptDescription(name: string, command: string): string {
  // Common script patterns
  const descriptions: Record<string, string> = {
    'build': 'Build the project',
    'test': 'Run tests',
    'dev': 'Start development server',
    'start': 'Start the application',
    'lint': 'Run linter',
    'format': 'Format code',
    'clean': 'Clean build artifacts',
    'typecheck': 'Run type checker',
    'watch': 'Watch for changes and rebuild',
    'deploy': 'Deploy the application',
    'docs': 'Generate documentation',
    'serve': 'Serve the application',
    'coverage': 'Run tests with coverage'
  };
  
  // Check for exact match
  if (descriptions[name]) {
    return descriptions[name];
  }
  
  // Check for partial match
  for (const [key, desc] of Object.entries(descriptions)) {
    if (name.includes(key)) {
      return desc;
    }
  }
  
  // Generate from command
  if (command.includes('tsc')) return 'Compile TypeScript';
  if (command.includes('jest') || command.includes('vitest') || command.includes('mocha')) return 'Run tests';
  if (command.includes('eslint')) return 'Run ESLint';
  if (command.includes('prettier')) return 'Format code with Prettier';
  if (command.includes('webpack') || command.includes('vite') || command.includes('tsup')) return 'Build with bundler';
  
  return `Run npm script: ${name}`;
}

/**
 * Extract tools from pyproject.toml scripts
 */
export function extractFromPyprojectToml(content: string, filename: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  
  // Simple parsing for [project.scripts] or [tool.poetry.scripts]
  const sections = content.split(/\n\[/);
  
  for (const section of sections) {
    if (!section.includes('scripts]') && !section.includes('scripts.')) continue;
    
    const lines = section.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('[') || !line.includes('=')) continue;
      
      const match = line.match(/^(\w+)\s*=\s*"?([^"]+)"?/);
      if (match) {
        const [, name, value] = match;
        const { confidence, factors } = calculateConfidence(false, false, 'code');
        
        tools.push({
          name: `python_${name}`,
          description: `Run Python script: ${name}`,
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          },
          source: {
            type: 'code',
            file: filename
          },
          confidence,
          confidenceFactors: factors
        });
      }
    }
  }
  
  return tools;
}

/**
 * Extract tools from setup.py console_scripts
 */
export function extractFromSetupPy(content: string, filename: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  
  // Look for console_scripts entry points
  const consoleScriptsMatch = content.match(/console_scripts\s*=\s*\[([\s\S]*?)\]/);
  if (!consoleScriptsMatch) return tools;
  
  const scriptsBlock = consoleScriptsMatch[1];
  const scriptMatches = scriptsBlock.matchAll(/["'](\w+)\s*=\s*([^"']+)["']/g);
  
  for (const match of scriptMatches) {
    const [, name, entryPoint] = match;
    const { confidence, factors } = calculateConfidence(false, false, 'code');
    
    tools.push({
      name: `python_${name}`,
      description: `Run Python CLI: ${name}`,
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      source: {
        type: 'code',
        file: filename
      },
      confidence,
      confidenceFactors: factors
    });
  }
  
  return tools;
}
