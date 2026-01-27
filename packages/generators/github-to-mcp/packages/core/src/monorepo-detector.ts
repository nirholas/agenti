/**
 * @fileoverview Monorepo detection and processing
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { MonorepoInfo, MonorepoType, MonorepoPackage } from './types';
import type { GithubClient } from './github-client';

/**
 * Detects and processes monorepo structures
 */
export class MonorepoDetector {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  /**
   * Detect if repository is a monorepo and identify its structure
   */
  async detect(
    github: GithubClient,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<MonorepoInfo | null> {
    // Try each detection method in order of specificity
    const detectors: Array<() => Promise<MonorepoInfo | null>> = [
      () => this.detectLerna(github, owner, repo, branch),
      () => this.detectNx(github, owner, repo, branch),
      () => this.detectTurborepo(github, owner, repo, branch),
      () => this.detectPnpmWorkspace(github, owner, repo, branch),
      () => this.detectNpmYarnWorkspace(github, owner, repo, branch),
      () => this.detectCustomLayout(github, owner, repo, branch)
    ];

    for (const detector of detectors) {
      const result = await detector();
      if (result && result.packages.length > 0) {
        if (this.verbose) {
          console.log(`[Monorepo] Detected ${result.type} monorepo with ${result.packages.length} packages`);
        }
        return result;
      }
    }

    return null;
  }

  /**
   * Detect Lerna monorepo (lerna.json)
   */
  private async detectLerna(
    github: GithubClient,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<MonorepoInfo | null> {
    const lernaConfig = await github.getFileContent(owner, repo, 'lerna.json', branch);
    if (!lernaConfig) return null;

    try {
      const config = JSON.parse(lernaConfig.content);
      const packagePatterns = config.packages || ['packages/*'];
      const packages = await this.resolvePackagePatterns(github, owner, repo, packagePatterns, branch);

      return {
        type: 'lerna',
        packages,
        rootPath: ''
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect Nx monorepo (nx.json)
   */
  private async detectNx(
    github: GithubClient,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<MonorepoInfo | null> {
    const nxConfig = await github.getFileContent(owner, repo, 'nx.json', branch);
    if (!nxConfig) return null;

    try {
      // Nx typically uses apps/ and libs/ directories
      const patterns = ['apps/*', 'libs/*', 'packages/*'];
      const packages = await this.resolvePackagePatterns(github, owner, repo, patterns, branch);

      return {
        type: 'nx',
        packages,
        rootPath: ''
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect Turborepo monorepo (turbo.json)
   */
  private async detectTurborepo(
    github: GithubClient,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<MonorepoInfo | null> {
    const turboConfig = await github.getFileContent(owner, repo, 'turbo.json', branch);
    if (!turboConfig) return null;

    try {
      // Turborepo typically uses packages/ and apps/ directories
      const patterns = ['packages/*', 'apps/*'];
      const packages = await this.resolvePackagePatterns(github, owner, repo, patterns, branch);

      return {
        type: 'turborepo',
        packages,
        rootPath: ''
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect pnpm workspace (pnpm-workspace.yaml)
   */
  private async detectPnpmWorkspace(
    github: GithubClient,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<MonorepoInfo | null> {
    const pnpmConfig = await github.getFileContent(owner, repo, 'pnpm-workspace.yaml', branch);
    if (!pnpmConfig) return null;

    try {
      // Simple YAML parsing for packages array
      const patterns = this.parseYamlPackages(pnpmConfig.content);
      if (patterns.length === 0) return null;

      const packages = await this.resolvePackagePatterns(github, owner, repo, patterns, branch);

      return {
        type: 'pnpm',
        packages,
        rootPath: ''
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect npm/yarn workspaces from package.json
   */
  private async detectNpmYarnWorkspace(
    github: GithubClient,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<MonorepoInfo | null> {
    const packageJson = await github.getFileContent(owner, repo, 'package.json', branch);
    if (!packageJson) return null;

    try {
      const pkg = JSON.parse(packageJson.content);
      const workspaces = pkg.workspaces;

      if (!workspaces) return null;

      // Handle both array format and object format (yarn)
      const patterns = Array.isArray(workspaces) 
        ? workspaces 
        : (workspaces.packages || []);

      if (patterns.length === 0) return null;

      const packages = await this.resolvePackagePatterns(github, owner, repo, patterns, branch);

      // Detect yarn.lock vs package-lock.json
      const yarnLock = await github.getFileContent(owner, repo, 'yarn.lock', branch);
      const type = yarnLock ? 'yarn' : 'npm';

      return {
        type,
        packages,
        rootPath: ''
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect custom directory layout (packages/*, apps/*, libs/*)
   */
  private async detectCustomLayout(
    github: GithubClient,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<MonorepoInfo | null> {
    const patterns = ['packages/*', 'apps/*', 'libs/*', 'modules/*'];
    const packages = await this.resolvePackagePatterns(github, owner, repo, patterns, branch);

    if (packages.length < 2) return null; // Need at least 2 packages to be a monorepo

    return {
      type: 'custom',
      packages,
      rootPath: ''
    };
  }

  /**
   * Parse packages from pnpm-workspace.yaml
   */
  private parseYamlPackages(yamlContent: string): string[] {
    const patterns: string[] = [];
    const lines = yamlContent.split('\n');
    let inPackages = false;

    for (const line of lines) {
      if (line.trim() === 'packages:') {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        if (line.match(/^\s+-\s+["']?(.+?)["']?\s*$/)) {
          const match = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
          if (match) {
            patterns.push(match[1]);
          }
        } else if (!line.startsWith(' ') && !line.startsWith('-') && line.trim()) {
          break; // New section started
        }
      }
    }

    return patterns;
  }

  /**
   * Resolve package patterns to actual packages
   */
  private async resolvePackagePatterns(
    github: GithubClient,
    owner: string,
    repo: string,
    patterns: string[],
    branch?: string
  ): Promise<MonorepoPackage[]> {
    const packages: MonorepoPackage[] = [];
    const seen = new Set<string>();

    for (const pattern of patterns) {
      // Handle simple patterns like "packages/*"
      const basePath = pattern.replace(/\/\*.*$/, '');
      
      try {
        const dirs = await github.listDirectory(owner, repo, basePath, branch);
        
        for (const dir of dirs) {
          if (dir.type !== 'dir') continue;
          if (seen.has(dir.path)) continue;
          seen.add(dir.path);

          // Try to get package name from package.json or Cargo.toml or similar
          const packageInfo = await this.getPackageInfo(github, owner, repo, dir.path, branch);
          
          if (packageInfo) {
            packages.push({
              name: packageInfo.name,
              path: dir.path,
              language: packageInfo.language
            });
          }
        }
      } catch {
        // Directory doesn't exist or can't be listed
        continue;
      }
    }

    return packages;
  }

  /**
   * Get package info from manifest file
   */
  private async getPackageInfo(
    github: GithubClient,
    owner: string,
    repo: string,
    packagePath: string,
    branch?: string
  ): Promise<{ name: string; language?: string } | null> {
    // Try package.json (Node.js)
    const packageJson = await github.getFileContent(owner, repo, `${packagePath}/package.json`, branch);
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson.content);
        const name = pkg.name || packagePath.split('/').pop()!;
        return { name, language: 'typescript' };
      } catch {}
    }

    // Try Cargo.toml (Rust)
    const cargoToml = await github.getFileContent(owner, repo, `${packagePath}/Cargo.toml`, branch);
    if (cargoToml) {
      const nameMatch = cargoToml.content.match(/name\s*=\s*"([^"]+)"/);
      return { 
        name: nameMatch?.[1] || packagePath.split('/').pop()!, 
        language: 'rust' 
      };
    }

    // Try pyproject.toml (Python)
    const pyprojectToml = await github.getFileContent(owner, repo, `${packagePath}/pyproject.toml`, branch);
    if (pyprojectToml) {
      const nameMatch = pyprojectToml.content.match(/name\s*=\s*"([^"]+)"/);
      return { 
        name: nameMatch?.[1] || packagePath.split('/').pop()!, 
        language: 'python' 
      };
    }

    // Try setup.py (Python legacy)
    const setupPy = await github.getFileContent(owner, repo, `${packagePath}/setup.py`, branch);
    if (setupPy) {
      const nameMatch = setupPy.content.match(/name\s*=\s*["']([^"']+)["']/);
      return { 
        name: nameMatch?.[1] || packagePath.split('/').pop()!, 
        language: 'python' 
      };
    }

    // Try go.mod (Go)
    const goMod = await github.getFileContent(owner, repo, `${packagePath}/go.mod`, branch);
    if (goMod) {
      const moduleMatch = goMod.content.match(/module\s+(\S+)/);
      const name = moduleMatch?.[1].split('/').pop() || packagePath.split('/').pop()!;
      return { name, language: 'go' };
    }

    // Try looking for main source file
    const contents = await github.listDirectory(owner, repo, packagePath, branch);
    for (const item of contents) {
      if (item.path.endsWith('.gemspec')) {
        return { name: packagePath.split('/').pop()!, language: 'ruby' };
      }
    }

    // Fallback: use directory name
    return { name: packagePath.split('/').pop()! };
  }

  /**
   * Add namespace prefix to tool names for monorepo packages
   */
  addNamespacePrefix(toolName: string, packageName: string): string {
    // Clean package name for use as prefix
    const prefix = packageName
      .replace(/^@[^/]+\//, '') // Remove scope like @org/
      .replace(/[^a-zA-Z0-9]/g, '_'); // Replace special chars

    return `${prefix}/${toolName}`;
  }
}
