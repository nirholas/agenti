/**
 * @fileoverview code-extractor module implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * Code Extractor
 * Extract tools from SDK source code
 */

import { ExtractedTool, SdkMethod } from './types';
import { GoExtractor } from './extractors/go-extractor';
import { JavaExtractor } from './extractors/java-extractor';
import { RustExtractor } from './extractors/rust-extractor';

export class CodeExtractor {
  private goExtractor: GoExtractor;
  private javaExtractor: JavaExtractor;
  private rustExtractor: RustExtractor;

  constructor() {
    this.goExtractor = new GoExtractor();
    this.javaExtractor = new JavaExtractor();
    this.rustExtractor = new RustExtractor();
  }

  /**
   * Extract tools from code files
   */
  async extract(code: string, filename: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    // Detect language
    const lang = this.detectLanguage(filename);

    if (lang === 'typescript' || lang === 'javascript') {
      const methods = this.extractMethods(code, filename);
      tools.push(...methods.map(m => this.methodToTool(m)));
    } else if (lang === 'python') {
      const pythonTools = this.extractPythonMcpTools(code, filename);
      tools.push(...pythonTools);
    } else if (lang === 'go') {
      const goTools = await this.goExtractor.extract(code, filename);
      tools.push(...goTools);
    } else if (lang === 'java' || lang === 'kotlin') {
      const javaTools = await this.javaExtractor.extract(code, filename);
      tools.push(...javaTools);
    } else if (lang === 'rust') {
      const rustTools = await this.rustExtractor.extract(code, filename);
      tools.push(...rustTools);
    }

    return tools;
  }

  /**
   * Extract MCP tools from Python code using @mcp.tool decorators
   */
  private extractPythonMcpTools(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');
    
    // Pattern for @mcp.tool decorator with various formats
    const decoratorPatterns = [
      // @mcp.tool(name="ToolName", description="...")
      /@(?:mcp|server|app)\.tool\s*\(\s*name\s*=\s*["']([^"']+)["']\s*,\s*description\s*=\s*["']([^"']+)["']/g,
      // @mcp.tool(description="...", name="ToolName")
      /@(?:mcp|server|app)\.tool\s*\(\s*description\s*=\s*["']([^"']+)["']\s*,\s*name\s*=\s*["']([^"']+)["']/g,
      // @server.tool("ToolName")
      /@(?:mcp|server|app)\.tool\s*\(\s*["']([^"']+)["']\s*(?:,\s*description\s*=\s*["']([^"']+)["'])?\s*\)/g,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of decoratorPatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match) {
          // Extract function signature on next lines
          const funcInfo = this.extractPythonFunction(lines, i + 1);
          
          // Handle different match groups based on pattern
          let name: string;
          let description: string | undefined;
          
          if (match[1] && match[2]) {
            // Check which pattern matched
            if (line.includes('name=') && line.indexOf('name=') < line.indexOf('description=')) {
              name = match[1];
              description = match[2];
            } else if (line.includes('description=') && line.indexOf('description=') < line.indexOf('name=')) {
              description = match[1];
              name = match[2];
            } else {
              name = match[1];
              description = match[2];
            }
          } else {
            name = match[1];
            description = match[2];
          }

          tools.push({
            name,
            description: description || funcInfo.docstring || `${name} tool`,
            inputSchema: {
              type: 'object',
              properties: this.pythonParamsToSchema(funcInfo.params),
              required: funcInfo.required
            },
            source: {
              type: 'code',
              file: filename,
              line: i + 1
            }
          });
        }
      }
    }

    // Also look for Tool class instantiations
    const toolClassPattern = /Tool\s*\(\s*name\s*=\s*["']([^"']+)["']\s*,\s*description\s*=\s*["']([^"']+)["']/g;
    let match;
    while ((match = toolClassPattern.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split('\n').length;
      tools.push({
        name: match[1],
        description: match[2],
        inputSchema: { type: 'object', properties: {}, required: [] },
        source: { type: 'code', file: filename, line: lineNum }
      });
    }

    return tools;
  }

  /**
   * Extract Python function info from lines after decorator
   */
  private extractPythonFunction(lines: string[], startLine: number): {
    name: string;
    params: Array<{ name: string; type: string; default?: string }>;
    required: string[];
    docstring?: string;
  } {
    const result = {
      name: '',
      params: [] as Array<{ name: string; type: string; default?: string }>,
      required: [] as string[],
      docstring: undefined as string | undefined
    };

    // Find async def or def line and collect full function signature (may span multiple lines)
    let funcSignature = '';
    let funcStartLine = -1;
    let parenDepth = 0;
    let foundDef = false;
    
    for (let i = startLine; i < Math.min(startLine + 20, lines.length); i++) {
      const line = lines[i];
      
      if (!foundDef) {
        const defMatch = line.match(/(?:async\s+)?def\s+(\w+)\s*\(/);
        if (defMatch) {
          foundDef = true;
          funcStartLine = i;
          result.name = defMatch[1];
          funcSignature = line;
          // Count parentheses
          for (const char of line) {
            if (char === '(') parenDepth++;
            if (char === ')') parenDepth--;
          }
          if (parenDepth === 0) break;
          continue;
        }
      } else {
        funcSignature += ' ' + line.trim();
        for (const char of line) {
          if (char === '(') parenDepth++;
          if (char === ')') parenDepth--;
        }
        if (parenDepth === 0) break;
      }
    }
    
    // Extract params from the full signature
    if (funcSignature) {
      const paramsMatch = funcSignature.match(/\(([^)]*)\)/);
      if (paramsMatch) {
        const paramsStr = paramsMatch[1];
        
        // Parse parameters using bracket-aware splitting (skip 'self' and context params)
        const params = this.splitPythonParams(paramsStr).filter(p => 
          p && !p.startsWith('self') && !p.includes('Context') && !p.includes('ctx')
        );
        
        for (const param of params) {
          // Parse: name: type = default or name = default or just name
          const paramMatch = param.match(/(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?/);
          if (paramMatch) {
            const [, name, type, defaultVal] = paramMatch;
            result.params.push({
              name,
              type: type?.trim() || 'string',
              default: defaultVal?.trim()
            });
            
            if (!defaultVal) {
              result.required.push(name);
            }
          }
        }
      }
      
      // Look for docstring after function definition
      const docstringStartLine = funcStartLine >= 0 ? funcStartLine + 1 : startLine + 1;
      for (let j = docstringStartLine; j < Math.min(docstringStartLine + 10, lines.length); j++) {
        const docLine = lines[j].trim();
        if (docLine.startsWith('"""') || docLine.startsWith("'''")) {
          // Single line docstring
          const docMatch = docLine.match(/['"]{3}(.+?)['"]{3}/);
          if (docMatch) {
            result.docstring = docMatch[1].trim();
          } else {
            // Multi-line docstring - get first line
            result.docstring = docLine.replace(/^['"]{3}/, '').trim();
          }
          break;
        }
      }
    }

    return result;
  }

  /**
   * Convert Python params to JSON schema properties
   */
  private pythonParamsToSchema(params: Array<{ name: string; type: string; default?: string }>): Record<string, any> {
    const properties: Record<string, any> = {};
    
    for (const param of params) {
      properties[param.name] = {
        type: this.pythonTypeToJsonSchema(param.type),
        description: `${param.name} parameter`
      };
      
      if (param.default !== undefined) {
        properties[param.name].default = this.parsePythonDefault(param.default);
      }
    }
    
    return properties;
  }

  /**
   * Convert Python type to JSON schema type
   * Handles complex typing patterns including:
   * - Container types: List, Dict, Set, Tuple, Sequence, Mapping
   * - Union types: Union[X, Y], X | Y (Python 3.10+)
   * - Optional: Optional[X] (equivalent to Union[X, None])
   * - Literal types: Literal["a", "b"]
   * - Any, None types
   * - Nested generics: List[Dict[str, int]]
   */
  private pythonTypeToJsonSchema(pythonType: string): string {
    const type = pythonType.toLowerCase().trim();
    
    // Handle empty or whitespace-only types
    if (!type) return 'string';
    
    // Check container types first (they may contain other type names like 'str')
    // List-like types
    if (type.startsWith('list[') || type === 'list' ||
        type.startsWith('sequence[') || type === 'sequence' ||
        type.startsWith('set[') || type === 'set' ||
        type.startsWith('frozenset[') || type === 'frozenset' ||
        type.startsWith('tuple[') || type === 'tuple' ||
        type.startsWith('iterable[') || type === 'iterable' ||
        type.includes('[]')) {
      return 'array';
    }
    
    // Dict-like types
    if (type.startsWith('dict[') || type === 'dict' ||
        type.startsWith('mapping[') || type === 'mapping' ||
        type.startsWith('mutablemapping[') || type === 'mutablemapping' ||
        type.startsWith('typeddict') || type === 'typeddict' ||
        type.startsWith('record[')) {
      return 'object';
    }
    
    // Handle Optional[X] - extract inner type
    if (type.startsWith('optional[')) {
      const inner = type.match(/optional\[(.+)\]$/i);
      if (inner) return this.pythonTypeToJsonSchema(inner[1]);
      return 'string';
    }
    
    // Handle Union[X, Y, ...] - return type of first non-None type
    if (type.startsWith('union[')) {
      const inner = type.match(/union\[(.+)\]$/i);
      if (inner) {
        const types = this.splitGenericArgs(inner[1]);
        const nonNoneType = types.find(t => t.trim().toLowerCase() !== 'none');
        if (nonNoneType) return this.pythonTypeToJsonSchema(nonNoneType);
      }
      return 'string';
    }
    
    // Handle Python 3.10+ union syntax: X | Y
    if (type.includes(' | ')) {
      const types = type.split('|').map(t => t.trim());
      const nonNoneType = types.find(t => t !== 'none');
      if (nonNoneType) return this.pythonTypeToJsonSchema(nonNoneType);
      return 'string';
    }
    
    // Handle Literal["a", "b"] - these are strings with enum constraint
    if (type.startsWith('literal[')) {
      // Check what's inside the literal
      const inner = type.match(/literal\[(.+)\]/i);
      if (inner) {
        const firstValue = inner[1].split(',')[0].trim();
        // Check for quoted strings
        if (firstValue.startsWith('"') || firstValue.startsWith("'")) return 'string';
        // Check for numeric values (including negative numbers and floats)
        if (/^-?\d+(\.\d+)?$/.test(firstValue)) return 'number';
        // Check for boolean values (case-insensitive since we lowercased)
        if (firstValue === 'true' || firstValue === 'false') return 'boolean';
      }
      return 'string';
    }
    
    // Handle Callable - return 'string' as we can't represent functions in JSON Schema
    if (type.startsWith('callable[') || type === 'callable') {
      return 'string';
    }
    
    // Handle None/NoneType
    if (type === 'none' || type === 'nonetype') {
      return 'null';
    }
    
    // Handle Any
    if (type === 'any') {
      return 'object';
    }
    
    // Check primitive types - use exact match or startsWith for type annotations with whitespace
    // String types
    if (type === 'str' || type === 'string' || type === 'text' ||
        type === 'bytes' || type === 'bytearray') {
      return 'string';
    }
    
    // Integer types (map to 'number' for JSON Schema compatibility)
    if (type === 'int' || type === 'integer') {
      return 'number';
    }
    
    // Float/decimal types
    if (type === 'float' || type === 'double' || type === 'decimal' ||
        type === 'number' || type === 'complex') {
      return 'number';
    }
    
    // Boolean type
    if (type === 'bool' || type === 'boolean') {
      return 'boolean';
    }
    
    // Object types
    if (type === 'object' || type === 'jsonobject') {
      return 'object';
    }
    
    // Path types - treat as strings
    if (type === 'path' || type === 'pathlike' || type.startsWith('path[')) {
      return 'string';
    }
    
    // UUID - treat as string
    if (type === 'uuid') {
      return 'string';
    }
    
    // Date/time types - treat as strings (ISO format)
    if (type === 'datetime' || type === 'date' || type === 'time' || 
        type === 'timedelta' || type === 'timestamp') {
      return 'string';
    }
    
    // Default to string for unknown types
    return 'string';
  }
  
  /**
   * Split generic type arguments, handling nested brackets
   * e.g., "str, Dict[str, int], bool" -> ["str", "Dict[str, int]", "bool"]
   */
  private splitGenericArgs(args: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    
    for (const char of args) {
      if (char === '[') {
        depth++;
        current += char;
      } else if (char === ']') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }
    
    return result;
  }
  
  /**
   * Split Python function parameters, handling nested brackets and quotes
   * This correctly handles types like List[str], Dict[str, int], Literal["a", "b"]
   * e.g., "name: str, items: List[int], status: Literal['a', 'b']" 
   *    -> ["name: str", "items: List[int]", "status: Literal['a', 'b']"]
   */
  private splitPythonParams(paramsStr: string): string[] {
    const result: string[] = [];
    let current = '';
    let bracketDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    
    for (let i = 0; i < paramsStr.length; i++) {
      const char = paramsStr[i];
      const prevChar = i > 0 ? paramsStr[i - 1] : '';
      
      // Track quotes (but not escaped ones)
      if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
      
      // Track bracket depth (only when not in quotes)
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '[' || char === '(' || char === '{') {
          bracketDepth++;
        } else if (char === ']' || char === ')' || char === '}') {
          bracketDepth--;
        }
      }
      
      // Split on comma only at top level (depth 0, not in quotes)
      if (char === ',' && bracketDepth === 0 && !inSingleQuote && !inDoubleQuote) {
        const trimmed = current.trim();
        if (trimmed) {
          result.push(trimmed);
        }
        current = '';
      } else {
        current += char;
      }
    }
    
    // Don't forget the last param
    const trimmed = current.trim();
    if (trimmed) {
      result.push(trimmed);
    }
    
    return result;
  }

  /**
   * Parse Python default value
   */
  private parsePythonDefault(value: string): any {
    if (value === 'None' || value === 'null') return null;
    if (value === 'True') return true;
    if (value === 'False') return false;
    if (/^["']/.test(value)) return value.slice(1, -1);
    if (/^\d+$/.test(value)) return parseInt(value);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }

  /**
   * Detect programming language
   */
  private detectLanguage(filename: string): string {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
    if (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.mjs')) return 'javascript';
    if (filename.endsWith('.py') || filename.endsWith('.pyi')) return 'python';
    if (filename.endsWith('.go')) return 'go';
    if (filename.endsWith('.java')) return 'java';
    if (filename.endsWith('.kt') || filename.endsWith('.kts')) return 'kotlin';
    if (filename.endsWith('.rs')) return 'rust';
    if (filename.endsWith('.proto')) return 'protobuf';
    return 'unknown';
  }

  /**
   * Extract methods from TypeScript/JavaScript
   */
  private extractMethods(code: string, filename: string): SdkMethod[] {
    const methods: SdkMethod[] = [];

    // Match class methods
    const methodPattern = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*([^{]+)\s*\{/g;

    let match;
    let lineNumber = 1;

    while ((match = methodPattern.exec(code)) !== null) {
      const [fullMatch, name, paramsStr, returnType] = match;

      // Skip constructors and private methods
      if (name === 'constructor' || name.startsWith('_')) {
        continue;
      }

      // Parse parameters
      const parameters = this.parseParameters(paramsStr);

      // Get description from JSDoc
      const description = this.extractJsDoc(code, match.index);

      // Calculate line number
      const codeBeforeMatch = code.substring(0, match.index);
      lineNumber = (codeBeforeMatch.match(/\n/g) || []).length + 1;

      methods.push({
        name,
        parameters,
        returnType: returnType.trim(),
        description,
        file: filename,
        line: lineNumber
      });
    }

    return methods;
  }

  /**
   * Parse function parameters
   */
  private parseParameters(paramsStr: string): Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }> {
    if (!paramsStr.trim()) {
      return [];
    }

    const params = paramsStr.split(',').map(p => p.trim());
    
    return params.map(param => {
      // Parse: "name: type" or "name?: type" or "name: type = default"
      const match = param.match(/(\w+)(\??):\s*([^=]+)(?:\s*=\s*(.+))?/);
      
      if (!match) {
        return {
          name: param,
          type: 'any',
          required: true
        };
      }

      const [, name, optional, type, defaultValue] = match;

      return {
        name,
        type: type.trim(),
        required: !optional && !defaultValue,
        description: undefined
      };
    });
  }

  /**
   * Extract JSDoc comment before code
   */
  private extractJsDoc(code: string, index: number): string | undefined {
    const codeBeforeMethod = code.substring(0, index);
    const jsdocMatch = codeBeforeMethod.match(/\/\*\*\s*([\s\S]*?)\s*\*\/\s*$/);

    if (jsdocMatch) {
      const jsdoc = jsdocMatch[1];
      
      // Extract description (first line before @tags)
      const lines = jsdoc.split('\n').map(l => l.replace(/^\s*\*\s?/, ''));
      const descriptionLines = [];

      for (const line of lines) {
        if (line.startsWith('@')) break;
        descriptionLines.push(line);
      }

      return descriptionLines.join(' ').trim();
    }

    return undefined;
  }

  /**
   * Convert SDK method to MCP tool
   */
  private methodToTool(method: SdkMethod): ExtractedTool {
    // Build input schema
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of method.parameters) {
      properties[param.name] = {
        type: this.typeScriptToJsonSchema(param.type),
        description: param.description || `${param.name} parameter`
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    // Generate implementation
    const implementation = this.generateImplementation(method);

    return {
      name: this.toToolName(method.name),
      description: method.description || `Call ${method.name}`,
      inputSchema: {
        type: 'object',
        properties,
        required
      },
      implementation,
      source: {
        type: 'code',
        file: method.file,
        line: method.line
      }
    };
  }

  /**
   * Convert TypeScript type to JSON Schema type
   */
  private typeScriptToJsonSchema(tsType: string): string {
    const type = tsType.toLowerCase();

    if (type.includes('string')) return 'string';
    if (type.includes('number')) return 'number';
    if (type.includes('boolean')) return 'boolean';
    if (type.includes('array') || type.includes('[]')) return 'array';
    if (type.includes('object') || type.includes('{}')) return 'object';

    return 'string'; // Default
  }

  /**
   * Convert method name to tool name
   */
  private toToolName(methodName: string): string {
    return methodName.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /**
   * Generate implementation code
   */
  private generateImplementation(method: SdkMethod): string {
    const paramNames = method.parameters.map(p => p.name);
    
    return `async function ${method.name}(args: any) {
  const { ${paramNames.join(', ')} } = args;
  
  // Call SDK method
  const result = await sdk.${method.name}(${paramNames.join(', ')});
  
  return result;
}`;
  }
}
