/**
 * @fileoverview Rust code extractor for extracting tools from Rust codebases
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { ExtractedTool, ParsedDocumentation } from '../types';

/**
 * Extracted Rust function information
 */
interface RustFunction {
  name: string;
  isPublic: boolean;
  isAsync: boolean;
  params: Array<{
    name: string;
    type: string;
    isMutable: boolean;
    isReference: boolean;
  }>;
  returnType: string | null;
  documentation: ParsedDocumentation | null;
  attributes: string[];
  line: number;
}

/**
 * Rust route handler info (for web frameworks)
 */
interface RustRouteHandler {
  method: string;
  path: string;
  handler: string;
  function: RustFunction | null;
}

/**
 * RustExtractor extracts tools from Rust codebases
 * Supports:
 * - Actix-web route handlers
 * - Axum handlers
 * - Rocket routes
 * - Regular public functions with doc comments
 */
export class RustExtractor {
  /**
   * Extract tools from Rust code
   */
  async extract(code: string, filename: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    // Extract from web framework routes
    const actixTools = this.extractActixRoutes(code, filename);
    const axumTools = this.extractAxumRoutes(code, filename);
    const rocketTools = this.extractRocketRoutes(code, filename);

    tools.push(...actixTools, ...axumTools, ...rocketTools);

    // Extract from public functions with documentation
    const publicFunctions = this.extractPublicFunctions(code, filename);
    tools.push(...publicFunctions);

    return tools;
  }

  /**
   * Extract Actix-web route handlers
   * Patterns:
   * - #[get("/path")]
   * - #[post("/path")]
   * - web::resource("/path").route(web::get().to(handler))
   */
  private extractActixRoutes(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');

    // Pattern for attribute-based routes
    const routeAttrPattern = /#\[(get|post|put|delete|patch|head|options)\s*\(\s*"([^"]+)"\s*(?:,\s*[^)]+)?\)\]/gi;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      routeAttrPattern.lastIndex = 0;
      while ((match = routeAttrPattern.exec(line)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];

        // Look for the function definition on the next lines
        const funcInfo = this.findNextFunction(lines, i + 1);
        
        if (funcInfo) {
          const toolName = this.generateToolName(method, path, funcInfo.name);
          const description = funcInfo.documentation?.description || 
            `${method} ${path} - ${funcInfo.name}`;

          tools.push({
            name: toolName,
            description,
            inputSchema: this.buildInputSchema(funcInfo, path),
            source: {
              type: 'code',
              file: filename,
              line: i + 1
            },
            confidence: 0.8,
            confidenceFactors: {
              documentation: funcInfo.documentation ? 0.9 : 0.5,
              types: 0.8,
              examples: funcInfo.documentation?.examples?.length ? 0.8 : 0.3,
              source: 0.9
            }
          });
        }
      }
    }

    // Pattern for web::scope and web::resource
    const resourcePattern = /web::(resource|scope)\s*\(\s*"([^"]+)"\s*\)/g;
    const routeToPattern = /\.route\s*\(\s*web::(get|post|put|delete|patch)\s*\(\s*\)\s*\.to\s*\(\s*(\w+)\s*\)\s*\)/gi;

    let resourceMatch;
    while ((resourceMatch = resourcePattern.exec(code)) !== null) {
      const basePath = resourceMatch[2];
      const lineNum = code.substring(0, resourceMatch.index).split('\n').length;

      // Find route definitions that follow
      const remainingCode = code.substring(resourceMatch.index);
      let routeMatch;
      
      while ((routeMatch = routeToPattern.exec(remainingCode)) !== null) {
        const method = routeMatch[1].toUpperCase();
        const handlerName = routeMatch[2];

        // Try to find the handler function
        const funcInfo = this.findFunctionByName(code, handlerName);

        tools.push({
          name: this.generateToolName(method, basePath, handlerName),
          description: funcInfo?.documentation?.description || `${method} ${basePath}`,
          inputSchema: funcInfo ? this.buildInputSchema(funcInfo, basePath) : { type: 'object', properties: {}, required: [] },
          source: {
            type: 'code',
            file: filename,
            line: lineNum
          },
          confidence: 0.7
        });
      }
    }

    return tools;
  }

  /**
   * Extract Axum route handlers
   * Patterns:
   * - Router::new().route("/path", get(handler))
   * - .route("/path", post(handler))
   */
  private extractAxumRoutes(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Pattern for .route() calls
    const routePattern = /\.route\s*\(\s*"([^"]+)"\s*,\s*(get|post|put|delete|patch|head|options)\s*\(\s*(\w+)\s*\)/gi;

    let match;
    while ((match = routePattern.exec(code)) !== null) {
      const path = match[1];
      const method = match[2].toUpperCase();
      const handlerName = match[3];
      const lineNum = code.substring(0, match.index).split('\n').length;

      const funcInfo = this.findFunctionByName(code, handlerName);

      tools.push({
        name: this.generateToolName(method, path, handlerName),
        description: funcInfo?.documentation?.description || `${method} ${path}`,
        inputSchema: funcInfo ? this.buildInputSchema(funcInfo, path) : { type: 'object', properties: {}, required: [] },
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence: 0.8
      });
    }

    // Axum also supports method routing with handler attributes
    const axumAttrPattern = /#\[axum::(debug_handler|handler)]/gi;
    
    // Look for #[debug_handler] followed by async fn
    const debugHandlerMatches = code.matchAll(/#\[debug_handler\]\s*(?:pub\s+)?async\s+fn\s+(\w+)/g);
    for (const match of debugHandlerMatches) {
      const handlerName = match[1];
      const lineNum = code.substring(0, match.index!).split('\n').length;
      const funcInfo = this.findFunctionByName(code, handlerName);

      if (funcInfo) {
        tools.push({
          name: handlerName,
          description: funcInfo.documentation?.description || `Axum handler: ${handlerName}`,
          inputSchema: this.buildInputSchema(funcInfo, ''),
          source: {
            type: 'code',
            file: filename,
            line: lineNum
          },
          confidence: 0.7
        });
      }
    }

    return tools;
  }

  /**
   * Extract Rocket route handlers
   * Patterns:
   * - #[get("/path")]
   * - #[post("/path", data = "<input>")]
   */
  private extractRocketRoutes(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');

    // Rocket uses similar attribute syntax but with more options
    const rocketRoutePattern = /#\[(get|post|put|delete|patch|head|options)\s*\(\s*"([^"]+)"(?:\s*,\s*([^)]+))?\)\]/gi;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      rocketRoutePattern.lastIndex = 0;
      while ((match = rocketRoutePattern.exec(line)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        const options = match[3] || '';

        // Parse data parameter if present
        const dataMatch = options.match(/data\s*=\s*"<(\w+)>"/);
        const dataParam = dataMatch ? dataMatch[1] : null;

        // Find the function
        const funcInfo = this.findNextFunction(lines, i + 1);

        if (funcInfo) {
          tools.push({
            name: this.generateToolName(method, path, funcInfo.name),
            description: funcInfo.documentation?.description || `${method} ${path}`,
            inputSchema: this.buildInputSchema(funcInfo, path, dataParam),
            source: {
              type: 'code',
              file: filename,
              line: i + 1
            },
            confidence: 0.8
          });
        }
      }
    }

    return tools;
  }

  /**
   * Extract public functions with doc comments
   */
  private extractPublicFunctions(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for pub fn or pub async fn with preceding doc comments
      if (/^\s*pub\s+(async\s+)?fn\s+\w+/.test(line)) {
        // Check if this function has route attributes (already processed)
        if (i > 0) {
          const prevLine = lines[i - 1];
          if (/#\[(get|post|put|delete|patch|head|options|route)/.test(prevLine)) {
            continue; // Skip, already handled by route extractors
          }
        }

        const funcInfo = this.parseFunction(lines, i);
        if (funcInfo && funcInfo.documentation) {
          // Only include functions with documentation
          tools.push({
            name: funcInfo.name,
            description: funcInfo.documentation.description || funcInfo.name,
            inputSchema: this.buildInputSchemaFromFunction(funcInfo),
            source: {
              type: 'code',
              file: filename,
              line: i + 1
            },
            confidence: 0.6,
            confidenceFactors: {
              documentation: 0.8,
              types: 0.9,
              examples: funcInfo.documentation.examples?.length ? 0.7 : 0.2,
              source: 0.7
            }
          });
        }
      }
    }

    return tools;
  }

  /**
   * Find the next function definition after the given line
   */
  private findNextFunction(lines: string[], startLine: number): RustFunction | null {
    for (let i = startLine; i < Math.min(startLine + 5, lines.length); i++) {
      const line = lines[i];
      if (/^\s*(pub\s+)?(async\s+)?fn\s+\w+/.test(line)) {
        return this.parseFunction(lines, i);
      }
    }
    return null;
  }

  /**
   * Find a function by name in the code
   */
  private findFunctionByName(code: string, name: string): RustFunction | null {
    const lines = code.split('\n');
    const pattern = new RegExp(`^\\s*(pub\\s+)?(async\\s+)?fn\\s+${name}\\s*[<(]`);

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return this.parseFunction(lines, i);
      }
    }
    return null;
  }

  /**
   * Parse a Rust function definition
   */
  private parseFunction(lines: string[], lineIndex: number): RustFunction | null {
    const line = lines[lineIndex];
    
    // First, try to match single-line function signature
    let funcMatch = line.match(/^\s*(pub\s+)?(async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*(.+?))?(?:\s*(?:where|{))?/);
    
    // If no match, try multi-line function signature
    if (!funcMatch) {
      // Get the function name and check for multi-line signature
      const headerMatch = line.match(/^\s*(pub\s+)?(async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(/);
      if (!headerMatch) return null;

      // Collect lines until we find the closing paren
      let combinedParams = '';
      let returnType: string | undefined;
      let depth = 1;
      
      // Get params from first line after the opening paren
      const afterParen = line.substring(line.indexOf('(') + 1);
      combinedParams += afterParen;
      
      for (let i = lineIndex + 1; i < lines.length && depth > 0; i++) {
        const currentLine = lines[i];
        for (const char of currentLine) {
          if (char === '(') depth++;
          else if (char === ')') depth--;
        }
        
        if (depth > 0) {
          combinedParams += ' ' + currentLine.trim();
        } else {
          // Found the closing paren - extract up to it and check for return type
          const closingIdx = currentLine.indexOf(')');
          combinedParams += ' ' + currentLine.substring(0, closingIdx).trim();
          
          // Check for return type
          const afterClose = currentLine.substring(closingIdx + 1);
          const returnMatch = afterClose.match(/^\s*->\s*(.+?)(?:\s*(?:where|{))?$/);
          if (returnMatch) {
            returnType = returnMatch[1].trim();
          }
          break;
        }
      }
      
      funcMatch = [
        line,
        headerMatch[1],
        headerMatch[2],
        headerMatch[3],
        combinedParams,
        returnType
      ] as RegExpMatchArray;
    }
    
    if (!funcMatch) return null;

    const [, pubKw, asyncKw, name, paramsStr, returnTypeStr] = funcMatch;

    // Parse parameters
    const params = this.parseParameters(paramsStr);

    // Look for doc comments above the function
    const documentation = this.parseDocComments(lines, lineIndex);

    // Look for attributes
    const attributes = this.parseAttributes(lines, lineIndex);

    return {
      name,
      isPublic: !!pubKw,
      isAsync: !!asyncKw,
      params,
      returnType: returnTypeStr?.trim() || null,
      documentation,
      attributes,
      line: lineIndex + 1
    };
  }

  /**
   * Parse function parameters
   */
  private parseParameters(paramsStr: string): RustFunction['params'] {
    const params: RustFunction['params'] = [];
    if (!paramsStr.trim()) return params;

    // Handle multi-line and complex types
    const paramParts = this.splitParams(paramsStr);

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === 'self' || trimmed === '&self' || trimmed === '&mut self') {
        continue;
      }

      // Match: name: Type or mut name: Type or &name: Type
      const paramMatch = trimmed.match(/^(&)?(\s*mut\s+)?(\w+)\s*:\s*(.+)$/);
      if (paramMatch) {
        const [, isRef, isMut, name, type] = paramMatch;
        params.push({
          name,
          type: type.trim(),
          isMutable: !!isMut,
          isReference: !!isRef
        });
      }
    }

    return params;
  }

  /**
   * Split parameters handling nested generics
   */
  private splitParams(paramsStr: string): string[] {
    const params: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of paramsStr) {
      if (char === '<' || char === '(' || char === '[' || char === '{') {
        depth++;
        current += char;
      } else if (char === '>' || char === ')' || char === ']' || char === '}') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        params.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(current.trim());
    }

    return params;
  }

  /**
   * Parse doc comments (///) above a function
   */
  private parseDocComments(lines: string[], funcLineIndex: number): ParsedDocumentation | null {
    const docLines: string[] = [];
    let i = funcLineIndex - 1;

    // Skip attributes
    while (i >= 0 && lines[i].trim().startsWith('#[')) {
      i--;
    }

    // Collect doc comments
    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith('///')) {
        docLines.unshift(line.substring(3).trim());
        i--;
      } else if (line.startsWith('//!') || line === '') {
        i--;
      } else {
        break;
      }
    }

    if (docLines.length === 0) return null;

    return this.parseDocumentation(docLines);
  }

  /**
   * Parse documentation content
   */
  private parseDocumentation(docLines: string[]): ParsedDocumentation {
    const doc: ParsedDocumentation = {
      params: [],
      examples: []
    };

    let description = '';
    let inExample = false;
    let currentExample = '';

    for (const line of docLines) {
      // Check for argument documentation
      const argMatch = line.match(/^#?\s*(?:Arguments?|Params?)\s*$/i);
      if (argMatch) continue;

      const paramMatch = line.match(/^\*?\s*`(\w+)`\s*[-:]?\s*(.+)/);
      if (paramMatch) {
        doc.params.push({
          name: paramMatch[1],
          description: paramMatch[2]
        });
        continue;
      }

      // Check for examples
      if (line.match(/^#?\s*(?:Example|Examples)\s*$/i)) {
        inExample = true;
        continue;
      }

      if (line.startsWith('```')) {
        if (inExample && currentExample) {
          doc.examples!.push(currentExample.trim());
          currentExample = '';
        }
        inExample = !inExample;
        continue;
      }

      if (inExample) {
        currentExample += line + '\n';
      } else if (!line.startsWith('#')) {
        description += (description ? ' ' : '') + line;
      }
    }

    doc.description = description.trim() || undefined;
    return doc;
  }

  /**
   * Parse attributes above a function
   */
  private parseAttributes(lines: string[], funcLineIndex: number): string[] {
    const attributes: string[] = [];
    let i = funcLineIndex - 1;

    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith('#[')) {
        attributes.unshift(line);
        i--;
      } else if (line.startsWith('///') || line === '') {
        i--;
      } else {
        break;
      }
    }

    return attributes;
  }

  /**
   * Generate a tool name from HTTP method, path, and handler name
   */
  private generateToolName(method: string, path: string, handlerName: string): string {
    // Convert path to snake_case parts
    const pathParts = path
      .split('/')
      .filter(p => p && !p.startsWith('{') && !p.startsWith('<') && !p.startsWith(':'))
      .map(p => p.replace(/-/g, '_').toLowerCase());

    if (pathParts.length > 0) {
      return `${method.toLowerCase()}_${pathParts.join('_')}`;
    }

    return handlerName;
  }

  /**
   * Build input schema from function info and route path
   */
  private buildInputSchema(
    funcInfo: RustFunction,
    path: string,
    dataParam?: string | null
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Extract path parameters
    const pathParams = path.match(/\{(\w+)\}|<(\w+)>|:(\w+)/g) || [];
    for (const param of pathParams) {
      const name = param.replace(/[{}<>:]/g, '');
      properties[name] = {
        type: 'string',
        description: `Path parameter: ${name}`
      };
      required.push(name);
    }

    // Add function parameters (excluding web framework types)
    for (const param of funcInfo.params) {
      if (this.isWebFrameworkType(param.type)) continue;
      if (pathParams.some(p => p.includes(param.name))) continue;

      properties[param.name] = {
        type: this.rustTypeToJsonSchema(param.type),
        description: funcInfo.documentation?.params.find(p => p.name === param.name)?.description || param.name
      };

      // If it's the data parameter or not Option, it's required
      if (param.name === dataParam || !param.type.startsWith('Option<')) {
        required.push(param.name);
      }
    }

    return { type: 'object', properties, required };
  }

  /**
   * Build input schema from function only (no route info)
   */
  private buildInputSchemaFromFunction(
    funcInfo: RustFunction
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of funcInfo.params) {
      const isOptional = param.type.startsWith('Option<');
      
      properties[param.name] = {
        type: this.rustTypeToJsonSchema(param.type),
        description: funcInfo.documentation?.params.find(p => p.name === param.name)?.description || param.name
      };

      if (!isOptional) {
        required.push(param.name);
      }
    }

    return { type: 'object', properties, required };
  }

  /**
   * Check if a type is a web framework type that should be ignored
   */
  private isWebFrameworkType(type: string): boolean {
    const frameworkTypes = [
      'HttpRequest', 'HttpResponse', 'Request', 'Response',
      'State', 'Data', 'Query', 'Path', 'Json', 'Form',
      'Extension', 'Headers', 'Cookies', 'Session',
      'web::Data', 'web::Path', 'web::Query', 'web::Json',
      'actix_web::', 'axum::', 'rocket::'
    ];

    return frameworkTypes.some(ft => type.includes(ft));
  }

  /**
   * Convert Rust type to JSON Schema type
   */
  private rustTypeToJsonSchema(rustType: string): string {
    const type = rustType.trim();

    // Handle Option<T>
    if (type.startsWith('Option<')) {
      const inner = type.match(/Option<(.+)>$/);
      if (inner) return this.rustTypeToJsonSchema(inner[1]);
    }

    // Handle Vec<T>
    if (type.startsWith('Vec<') || type.startsWith('&[') || type.includes('[]')) {
      return 'array';
    }

    // Handle HashMap, BTreeMap
    if (type.includes('Map<') || type.includes('map<')) {
      return 'object';
    }

    // Primitive types
    const typeMap: Record<string, string> = {
      'String': 'string',
      '&str': 'string',
      'str': 'string',
      'i8': 'integer',
      'i16': 'integer',
      'i32': 'integer',
      'i64': 'integer',
      'i128': 'integer',
      'isize': 'integer',
      'u8': 'integer',
      'u16': 'integer',
      'u32': 'integer',
      'u64': 'integer',
      'u128': 'integer',
      'usize': 'integer',
      'f32': 'number',
      'f64': 'number',
      'bool': 'boolean',
      'char': 'string'
    };

    for (const [rust, json] of Object.entries(typeMap)) {
      if (type === rust || type.endsWith(`::${rust}`)) {
        return json;
      }
    }

    // Default to object for complex types
    return 'object';
  }
}
