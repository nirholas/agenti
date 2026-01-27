/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Stay curious, keep creating 💡
 */

/**
 * Lyra Compiler Service
 * 
 * A lightweight wrapper around solc (Solidity Compiler) for browser-based compilation.
 * Uses official Ethereum Foundation solc binaries from CDN.
 * 
 * No external dependencies beyond solc itself - 100% Lyra owned code.
 */

// CDN for official solc binaries
const SOLC_BIN_CDN = 'https://binaries.soliditylang.org/bin';
const SOLC_LIST_URL = `${SOLC_BIN_CDN}/list.json`;

// Import CDNs for OpenZeppelin and other common libraries
const IMPORT_CDNS: Record<string, string> = {
  '@openzeppelin/contracts': 'https://unpkg.com/@openzeppelin/contracts@5.0.0',
  '@openzeppelin/contracts-upgradeable': 'https://unpkg.com/@openzeppelin/contracts-upgradeable@5.0.0',
};

export interface CompileInput {
  source: string;
  filename?: string;
  version?: string;
  optimize?: boolean;
  runs?: number;
}

export interface CompileOutput {
  success: boolean;
  contracts: CompiledContract[];
  errors: CompileError[];
  warnings: CompileError[];
}

export interface CompiledContract {
  name: string;
  abi: any[];
  bytecode: string;
  deployedBytecode: string;
  gasEstimates?: {
    creation: { codeDepositCost: string; executionCost: string; totalCost: string };
  };
}

export interface CompileError {
  type: 'error' | 'warning';
  message: string;
  severity: string;
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
  formattedMessage?: string;
}

export interface SolcVersion {
  version: string;
  longVersion: string;
  path: string;
  keccak256?: string;
}

// Cache for loaded compiler instances
const compilerCache: Map<string, any> = new Map();
const importCache: Map<string, string> = new Map();

/**
 * LyraCompiler - Browser-based Solidity compilation
 */
export class LyraCompiler {
  private currentVersion: string | null = null;
  private solc: any = null;
  private onProgress?: (message: string) => void;

  constructor(options?: { onProgress?: (message: string) => void }) {
    this.onProgress = options?.onProgress;
  }

  private log(message: string) {
    this.onProgress?.(message);
  }

  /**
   * Get list of available Solidity versions
   */
  async getVersions(): Promise<SolcVersion[]> {
    try {
      const response = await fetch(SOLC_LIST_URL);
      const data = await response.json();
      
      // Return releases (stable versions)
      const releases = data.releases || {};
      return Object.entries(releases).map(([version, path]) => ({
        version,
        longVersion: version,
        path: path as string,
      }));
    } catch (error) {
      console.error('Failed to fetch solc versions:', error);
      // Return common fallback versions
      return [
        { version: '0.8.20', longVersion: '0.8.20', path: 'soljson-v0.8.20+commit.a1b79de6.js' },
        { version: '0.8.19', longVersion: '0.8.19', path: 'soljson-v0.8.19+commit.7dd6d404.js' },
        { version: '0.8.17', longVersion: '0.8.17', path: 'soljson-v0.8.17+commit.8df45f5f.js' },
      ];
    }
  }

  /**
   * Load a specific version of the Solidity compiler
   */
  async loadVersion(version: string): Promise<void> {
    // Check cache first
    if (compilerCache.has(version)) {
      this.solc = compilerCache.get(version);
      this.currentVersion = version;
      this.log(`Using cached compiler v${version}`);
      return;
    }

    this.log(`Loading Solidity compiler v${version}...`);

    try {
      // Get the full path for this version
      const versions = await this.getVersions();
      const versionInfo = versions.find(v => v.version === version || v.version.startsWith(version));
      
      if (!versionInfo) {
        throw new Error(`Version ${version} not found`);
      }

      const url = `${SOLC_BIN_CDN}/${versionInfo.path}`;
      
      // Load the compiler script
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch compiler: ${response.statusText}`);
      }
      
      const script = await response.text();
      
      // Execute in a sandboxed context
      // eslint-disable-next-line no-new-func
      const solcModule = new Function('module', 'exports', script + '\nreturn Module;');
      const module = { exports: {} };
      const Module = solcModule(module, module.exports);
      
      // Wrap with standard JSON interface
      this.solc = {
        compile: (input: string) => Module.cwrap('solidity_compile', 'string', ['string'])(input),
        version: () => Module.cwrap('solidity_version', 'string', [])(),
      };
      
      // Cache the compiler
      compilerCache.set(version, this.solc);
      this.currentVersion = version;
      
      this.log(`Compiler v${version} loaded successfully`);
    } catch (error: any) {
      this.log(`Failed to load compiler: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect Solidity version from pragma statement
   */
  detectVersion(source: string): string {
    const pragmaMatch = source.match(/pragma\s+solidity\s+[\^~>=<]*(\d+\.\d+\.\d+)/);
    if (pragmaMatch) {
      return pragmaMatch[1];
    }
    return '0.8.20'; // Default to latest stable
  }

  /**
   * Resolve import paths (OpenZeppelin, etc.)
   */
  private async resolveImport(path: string): Promise<string> {
    // Check cache
    if (importCache.has(path)) {
      return importCache.get(path)!;
    }

    this.log(`Resolving import: ${path}`);

    // Handle npm-style imports
    for (const [prefix, cdn] of Object.entries(IMPORT_CDNS)) {
      if (path.startsWith(prefix)) {
        const relativePath = path.slice(prefix.length);
        const url = `${cdn}${relativePath}`;
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
          }
          const content = await response.text();
          importCache.set(path, content);
          return content;
        } catch (error) {
          console.error(`Failed to resolve import ${path}:`, error);
          throw new Error(`Cannot resolve import: ${path}`);
        }
      }
    }

    // Handle GitHub raw imports
    if (path.startsWith('https://')) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
      }
      const content = await response.text();
      importCache.set(path, content);
      return content;
    }

    throw new Error(`Cannot resolve import: ${path}. Only @openzeppelin/* and https:// imports are supported.`);
  }

  /**
   * Find all imports in source code
   */
  private findImports(source: string): string[] {
    const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["']([^"']+)["']/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(source)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * Recursively resolve all imports
   */
  private async resolveAllImports(
    source: string,
    sources: Record<string, { content: string }>,
    resolved: Set<string>
  ): Promise<void> {
    const imports = this.findImports(source);
    
    for (const importPath of imports) {
      if (resolved.has(importPath)) continue;
      resolved.add(importPath);
      
      try {
        const content = await this.resolveImport(importPath);
        sources[importPath] = { content };
        
        // Recursively resolve nested imports
        await this.resolveAllImports(content, sources, resolved);
      } catch (error) {
        console.warn(`Could not resolve import: ${importPath}`);
      }
    }
  }

  /**
   * Compile Solidity source code
   */
  async compile(input: CompileInput): Promise<CompileOutput> {
    const {
      source,
      filename = 'Contract.sol',
      version,
      optimize = true,
      runs = 200,
    } = input;

    // Detect or use specified version
    const targetVersion = version || this.detectVersion(source);
    
    // Load compiler if needed
    if (!this.solc || this.currentVersion !== targetVersion) {
      await this.loadVersion(targetVersion);
    }

    this.log('Resolving imports...');

    // Build sources object with resolved imports
    const sources: Record<string, { content: string }> = {
      [filename]: { content: source },
    };
    
    await this.resolveAllImports(source, sources, new Set());

    this.log(`Compiling with solc v${targetVersion}...`);

    // Build standard JSON input
    const compilerInput = {
      language: 'Solidity',
      sources,
      settings: {
        optimizer: {
          enabled: optimize,
          runs,
        },
        outputSelection: {
          '*': {
            '*': [
              'abi',
              'evm.bytecode.object',
              'evm.deployedBytecode.object',
              'evm.gasEstimates',
            ],
          },
        },
      },
    };

    // Compile
    const outputJson = this.solc.compile(JSON.stringify(compilerInput));
    const output = JSON.parse(outputJson);

    // Parse errors and warnings
    const errors: CompileError[] = [];
    const warnings: CompileError[] = [];

    if (output.errors) {
      for (const err of output.errors) {
        const compileError: CompileError = {
          type: err.severity === 'error' ? 'error' : 'warning',
          message: err.message,
          severity: err.severity,
          sourceLocation: err.sourceLocation,
          formattedMessage: err.formattedMessage,
        };

        if (err.severity === 'error') {
          errors.push(compileError);
        } else {
          warnings.push(compileError);
        }
      }
    }

    // Extract compiled contracts
    const contracts: CompiledContract[] = [];

    if (output.contracts && output.contracts[filename]) {
      for (const [name, contract] of Object.entries(output.contracts[filename])) {
        const c = contract as any;
        contracts.push({
          name,
          abi: c.abi || [],
          bytecode: c.evm?.bytecode?.object ? `0x${c.evm.bytecode.object}` : '',
          deployedBytecode: c.evm?.deployedBytecode?.object ? `0x${c.evm.deployedBytecode.object}` : '',
          gasEstimates: c.evm?.gasEstimates?.creation,
        });
      }
    }

    const success = errors.length === 0 && contracts.length > 0;

    this.log(success 
      ? `✓ Compiled ${contracts.length} contract(s) successfully` 
      : `✗ Compilation failed with ${errors.length} error(s)`
    );

    return {
      success,
      contracts,
      errors,
      warnings,
    };
  }

  /**
   * Quick compile check - validates syntax without full compilation
   */
  async quickCheck(source: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for pragma
    if (!source.includes('pragma solidity')) {
      errors.push('Missing pragma solidity statement');
    }

    // Check for contract/interface/library definition
    if (!source.match(/\b(contract|interface|library)\s+\w+/)) {
      errors.push('No contract, interface, or library definition found');
    }

    // Check for balanced braces
    const openBraces = (source.match(/{/g) || []).length;
    const closeBraces = (source.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for common syntax errors
    if (source.includes('function ()')) {
      errors.push('Empty function name - use "receive()" or "fallback()" for fallback functions');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get current loaded compiler version
   */
  getLoadedVersion(): string | null {
    return this.currentVersion;
  }

  /**
   * Clear the compiler cache
   */
  static clearCache(): void {
    compilerCache.clear();
    importCache.clear();
  }
}

// Export singleton instance for convenience
export const lyraCompiler = new LyraCompiler();

// Export helper function for simple usage
export async function compileCode(source: string, options?: Partial<CompileInput>): Promise<CompileOutput> {
  return lyraCompiler.compile({ source, ...options });
}
