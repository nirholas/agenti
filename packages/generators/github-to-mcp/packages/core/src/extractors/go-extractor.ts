/**
 * @fileoverview Go code extractor for extracting tools from Go codebases
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { ExtractedTool, ParsedDocumentation } from '../types';

/**
 * Extracted Go function information
 */
interface GoFunction {
  name: string;
  receiver?: {
    name: string;
    type: string;
    isPointer: boolean;
  };
  params: Array<{
    name: string;
    type: string;
  }>;
  returns: Array<{
    name?: string;
    type: string;
  }>;
  documentation: ParsedDocumentation | null;
  line: number;
}

/**
 * Go route handler info
 */
interface GoRouteHandler {
  method: string;
  path: string;
  handler: string;
  framework: 'gin' | 'echo' | 'chi' | 'gorilla' | 'fiber' | 'net/http';
}

/**
 * GoExtractor extracts tools from Go codebases
 * Supports:
 * - Gin routes
 * - Echo routes
 * - Chi routes
 * - Gorilla mux routes
 * - Fiber routes
 * - net/http handlers
 * - Public functions with doc comments
 */
export class GoExtractor {
  /**
   * Extract tools from Go code
   */
  async extract(code: string, filename: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    // Extract from web framework routes
    const ginTools = this.extractGinRoutes(code, filename);
    const echoTools = this.extractEchoRoutes(code, filename);
    const chiTools = this.extractChiRoutes(code, filename);
    const gorillaTools = this.extractGorillaRoutes(code, filename);
    const fiberTools = this.extractFiberRoutes(code, filename);
    const httpTools = this.extractNetHttpHandlers(code, filename);

    tools.push(...ginTools, ...echoTools, ...chiTools, ...gorillaTools, ...fiberTools, ...httpTools);

    // Extract from exported functions with documentation
    const exportedFunctions = this.extractExportedFunctions(code, filename);
    tools.push(...exportedFunctions);

    return tools;
  }

  /**
   * Extract Gin framework routes
   * Patterns:
   * - r.GET("/path", handler)
   * - router.POST("/path", handler)
   * - group.PUT("/path", handler)
   */
  private extractGinRoutes(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Pattern for Gin routes
    const routePattern = /(\w+)\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*"([^"]+)"\s*,\s*(\w+(?:\.\w+)?)/gi;

    let match;
    while ((match = routePattern.exec(code)) !== null) {
      const [, , method, path, handler] = match;
      const lineNum = code.substring(0, match.index).split('\n').length;

      // Try to find the handler function
      const funcInfo = this.findFunctionByName(code, handler);

      tools.push({
        name: this.generateToolName(method, path, handler),
        description: funcInfo?.documentation?.description || `${method} ${path}`,
        inputSchema: this.buildGinInputSchema(funcInfo, path),
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence: 0.8
      });
    }

    // Also check for gin.H response patterns to infer response types
    // r.JSON(200, gin.H{"message": "success"})

    return tools;
  }

  /**
   * Extract Echo framework routes
   * Patterns:
   * - e.GET("/path", handler)
   * - g.POST("/path", handler)
   */
  private extractEchoRoutes(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Echo uses similar syntax to Gin
    const routePattern = /(\w+)\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*"([^"]+)"\s*,\s*(\w+(?:\.\w+)?)/gi;

    // Check if this is an Echo project
    if (!code.includes('echo.') && !code.includes('"github.com/labstack/echo')) {
      return tools;
    }

    let match;
    while ((match = routePattern.exec(code)) !== null) {
      const [, , method, path, handler] = match;
      const lineNum = code.substring(0, match.index).split('\n').length;

      const funcInfo = this.findFunctionByName(code, handler);

      tools.push({
        name: this.generateToolName(method, path, handler),
        description: funcInfo?.documentation?.description || `${method} ${path}`,
        inputSchema: this.buildEchoInputSchema(funcInfo, path),
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence: 0.8
      });
    }

    return tools;
  }

  /**
   * Extract Chi router routes
   * Patterns:
   * - r.Get("/path", handler)
   * - r.Post("/path", handler)
   * - r.Route("/path", func(r chi.Router) {...})
   */
  private extractChiRoutes(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Check if this is a Chi project (handle chi/v5 and older versions)
    if (!code.includes('chi.') && !code.includes('go-chi/chi')) {
      return tools;
    }

    // Chi uses PascalCase methods
    const routePattern = /(\w+)\.(Get|Post|Put|Delete|Patch|Head|Options)\s*\(\s*"([^"]+)"\s*,\s*(\w+(?:\.\w+)?)/gi;

    let match;
    while ((match = routePattern.exec(code)) !== null) {
      const [, , method, path, handler] = match;
      const lineNum = code.substring(0, match.index).split('\n').length;

      const funcInfo = this.findFunctionByName(code, handler);

      tools.push({
        name: this.generateToolName(method.toUpperCase(), path, handler),
        description: funcInfo?.documentation?.description || `${method.toUpperCase()} ${path}`,
        inputSchema: this.buildChiInputSchema(funcInfo, path),
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence: 0.8
      });
    }

    return tools;
  }

  /**
   * Extract Gorilla mux routes
   * Patterns:
   * - r.HandleFunc("/path", handler).Methods("GET")
   * - r.HandleFunc("/path", handler).Methods("GET", "POST")
   */
  private extractGorillaRoutes(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Check if this is a Gorilla project
    if (!code.includes('mux.') && !code.includes('"github.com/gorilla/mux')) {
      return tools;
    }

    // Gorilla HandleFunc pattern
    const routePattern = /(\w+)\.HandleFunc\s*\(\s*"([^"]+)"\s*,\s*(\w+(?:\.\w+)?)\s*\)(?:\.Methods\s*\(\s*"([^"]+)")?/gi;

    let match;
    while ((match = routePattern.exec(code)) !== null) {
      const [, , path, handler, method] = match;
      const lineNum = code.substring(0, match.index).split('\n').length;
      const httpMethod = method?.toUpperCase() || 'GET';

      const funcInfo = this.findFunctionByName(code, handler);

      tools.push({
        name: this.generateToolName(httpMethod, path, handler),
        description: funcInfo?.documentation?.description || `${httpMethod} ${path}`,
        inputSchema: this.buildHttpInputSchema(funcInfo, path),
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence: 0.7
      });
    }

    return tools;
  }

  /**
   * Extract Fiber framework routes
   * Patterns:
   * - app.Get("/path", handler)
   * - api.Post("/path", handler)
   */
  private extractFiberRoutes(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // Check if this is a Fiber project
    if (!code.includes('fiber.') && !code.includes('"github.com/gofiber/fiber')) {
      return tools;
    }

    // Fiber uses PascalCase methods
    const routePattern = /(\w+)\.(Get|Post|Put|Delete|Patch|Head|Options)\s*\(\s*"([^"]+)"\s*,\s*(\w+(?:\.\w+)?)/gi;

    let match;
    while ((match = routePattern.exec(code)) !== null) {
      const [, , method, path, handler] = match;
      const lineNum = code.substring(0, match.index).split('\n').length;

      const funcInfo = this.findFunctionByName(code, handler);

      tools.push({
        name: this.generateToolName(method.toUpperCase(), path, handler),
        description: funcInfo?.documentation?.description || `${method.toUpperCase()} ${path}`,
        inputSchema: this.buildFiberInputSchema(funcInfo, path),
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence: 0.8
      });
    }

    return tools;
  }

  /**
   * Extract net/http handlers
   * Patterns:
   * - http.HandleFunc("/path", handler)
   * - mux.Handle("/path", handler)
   */
  private extractNetHttpHandlers(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];

    // http.HandleFunc pattern
    const handleFuncPattern = /http\.HandleFunc\s*\(\s*"([^"]+)"\s*,\s*(\w+(?:\.\w+)?)/gi;

    let match;
    while ((match = handleFuncPattern.exec(code)) !== null) {
      const [, path, handler] = match;
      const lineNum = code.substring(0, match.index).split('\n').length;

      const funcInfo = this.findFunctionByName(code, handler);

      tools.push({
        name: this.generateToolName('ANY', path, handler),
        description: funcInfo?.documentation?.description || `HTTP handler: ${path}`,
        inputSchema: this.buildHttpInputSchema(funcInfo, path),
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence: 0.6
      });
    }

    return tools;
  }

  /**
   * Extract exported functions with documentation
   */
  private extractExportedFunctions(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Go exported functions start with uppercase letter
      if (/^\s*func\s+(?:\([^)]+\)\s+)?[A-Z]\w*\s*\(/.test(line)) {
        // Check if this is a handler function (already processed)
        const funcInfo = this.parseFunction(lines, i);
        
        if (funcInfo && funcInfo.documentation && !this.isHttpHandler(funcInfo)) {
          tools.push({
            name: funcInfo.name,
            description: funcInfo.documentation.description || funcInfo.name,
            inputSchema: this.buildFunctionInputSchema(funcInfo),
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
   * Find a function by name
   */
  private findFunctionByName(code: string, name: string): GoFunction | null {
    const lines = code.split('\n');
    
    // Handle method notation (e.g., "ctrl.Handler")
    const funcName = name.includes('.') ? name.split('.').pop()! : name;
    
    const pattern = new RegExp(`^\\s*func\\s+(?:\\([^)]+\\)\\s+)?${funcName}\\s*\\(`);

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return this.parseFunction(lines, i);
      }
    }
    return null;
  }

  /**
   * Parse a Go function definition
   */
  private parseFunction(lines: string[], lineIndex: number): GoFunction | null {
    const line = lines[lineIndex];
    
    // Match function signature
    // func Name(params) (returns)
    // func (r *Receiver) Name(params) (returns)
    const funcMatch = line.match(/^\s*func\s+(?:\((\w+)\s+(\*?)(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]+)\)|\s*(\w+))?/);
    
    if (!funcMatch) return null;

    const [, receiverName, isPointer, receiverType, name, paramsStr, multiReturns, singleReturn] = funcMatch;

    // Parse receiver if present
    const receiver = receiverName ? {
      name: receiverName,
      type: receiverType,
      isPointer: isPointer === '*'
    } : undefined;

    // Parse parameters
    const params = this.parseParameters(paramsStr);

    // Parse return types
    const returns = this.parseReturns(multiReturns || singleReturn || '');

    // Look for doc comments
    const documentation = this.parseDocComments(lines, lineIndex);

    return {
      name,
      receiver,
      params,
      returns,
      documentation,
      line: lineIndex + 1
    };
  }

  /**
   * Parse function parameters
   */
  private parseParameters(paramsStr: string): GoFunction['params'] {
    const params: GoFunction['params'] = [];
    if (!paramsStr.trim()) return params;

    // Split by comma, handling complex types
    const paramParts = this.splitParams(paramsStr);

    // Go allows grouping params with same type: a, b int
    let lastType = '';
    const parsedParams: Array<{ names: string[]; type: string }> = [];

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Check if this part has a type
      const match = trimmed.match(/^([\w,\s]+)\s+(.+)$/);
      
      if (match) {
        const names = match[1].split(',').map(n => n.trim()).filter(Boolean);
        const type = match[2].trim();
        parsedParams.push({ names, type });
        lastType = type;
      } else {
        // This might be a name without type (uses next param's type)
        parsedParams.push({ names: [trimmed], type: '' });
      }
    }

    // Fill in missing types (Go allows a, b int syntax)
    for (let i = parsedParams.length - 1; i >= 0; i--) {
      if (parsedParams[i].type === '' && i < parsedParams.length - 1) {
        parsedParams[i].type = parsedParams[i + 1].type;
      }
    }

    // Flatten into params array
    for (const p of parsedParams) {
      for (const name of p.names) {
        if (name && p.type) {
          params.push({ name, type: p.type });
        }
      }
    }

    return params;
  }

  /**
   * Split parameters handling nested types
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
   * Parse return types
   */
  private parseReturns(returnsStr: string): GoFunction['returns'] {
    const returns: GoFunction['returns'] = [];
    if (!returnsStr.trim()) return returns;

    const parts = this.splitParams(returnsStr);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Check for named return: name Type
      const namedMatch = trimmed.match(/^(\w+)\s+(.+)$/);
      if (namedMatch) {
        returns.push({ name: namedMatch[1], type: namedMatch[2] });
      } else {
        returns.push({ type: trimmed });
      }
    }

    return returns;
  }

  /**
   * Parse doc comments
   */
  private parseDocComments(lines: string[], funcLineIndex: number): ParsedDocumentation | null {
    const docLines: string[] = [];
    let i = funcLineIndex - 1;

    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith('//')) {
        docLines.unshift(line.substring(2).trim());
        i--;
      } else if (line === '') {
        // Allow one blank line
        if (i > 0 && lines[i - 1].trim().startsWith('//')) {
          i--;
        } else {
          break;
        }
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

    for (const line of docLines) {
      // Go doc doesn't have formal param syntax, but we can detect patterns
      // @param name description (if someone uses it)
      const paramMatch = line.match(/^@param\s+(\w+)\s+(.+)/i);
      if (paramMatch) {
        doc.params.push({
          name: paramMatch[1],
          description: paramMatch[2]
        });
        continue;
      }

      // Example: line detection
      if (line.toLowerCase().startsWith('example:')) {
        doc.examples!.push(line.substring(8).trim());
        continue;
      }

      description += (description ? ' ' : '') + line;
    }

    doc.description = description.trim() || undefined;
    return doc;
  }

  /**
   * Check if function is an HTTP handler
   */
  private isHttpHandler(funcInfo: GoFunction): boolean {
    // HTTP handlers typically have specific parameter patterns
    const handlerParams = [
      'http.ResponseWriter',
      '*http.Request',
      '*gin.Context',
      'echo.Context',
      '*fiber.Ctx',
      'http.Handler'
    ];

    return funcInfo.params.some(p => 
      handlerParams.some(hp => p.type.includes(hp.replace('*', '')))
    );
  }

  /**
   * Generate tool name
   */
  private generateToolName(method: string, path: string, handlerName: string): string {
    const pathParts = path
      .split('/')
      .filter(p => p && !p.startsWith('{') && !p.startsWith(':'))
      .map(p => p.replace(/-/g, '_').toLowerCase());

    if (pathParts.length > 0) {
      return `${method.toLowerCase()}_${pathParts.join('_')}`;
    }

    // Use handler name, converting from PascalCase to snake_case
    return handlerName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/\._/g, '_');
  }

  /**
   * Build input schema for Gin handlers
   */
  private buildGinInputSchema(
    funcInfo: GoFunction | null,
    path: string
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Extract path parameters (Gin uses :param syntax)
    const pathParams = path.match(/:(\w+)/g) || [];
    for (const param of pathParams) {
      const name = param.substring(1);
      properties[name] = {
        type: 'string',
        description: `Path parameter: ${name}`
      };
      required.push(name);
    }

    return { type: 'object', properties, required };
  }

  /**
   * Build input schema for Echo handlers
   */
  private buildEchoInputSchema(
    funcInfo: GoFunction | null,
    path: string
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    // Echo uses :param syntax like Gin
    return this.buildGinInputSchema(funcInfo, path);
  }

  /**
   * Build input schema for Chi handlers
   */
  private buildChiInputSchema(
    funcInfo: GoFunction | null,
    path: string
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Chi uses {param} syntax
    const pathParams = path.match(/\{(\w+)\}/g) || [];
    for (const param of pathParams) {
      const name = param.slice(1, -1);
      properties[name] = {
        type: 'string',
        description: `Path parameter: ${name}`
      };
      required.push(name);
    }

    return { type: 'object', properties, required };
  }

  /**
   * Build input schema for Fiber handlers
   */
  private buildFiberInputSchema(
    funcInfo: GoFunction | null,
    path: string
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Fiber uses :param syntax
    const pathParams = path.match(/:(\w+)/g) || [];
    for (const param of pathParams) {
      const name = param.substring(1);
      properties[name] = {
        type: 'string',
        description: `Path parameter: ${name}`
      };
      required.push(name);
    }

    return { type: 'object', properties, required };
  }

  /**
   * Build input schema for net/http handlers
   */
  private buildHttpInputSchema(
    funcInfo: GoFunction | null,
    path: string
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    // net/http doesn't have built-in path params
    return { type: 'object', properties: {}, required: [] };
  }

  /**
   * Build input schema from function params
   */
  private buildFunctionInputSchema(
    funcInfo: GoFunction
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of funcInfo.params) {
      // Skip context parameters
      if (param.type.includes('context.Context') || param.type.includes('Context')) {
        continue;
      }

      const isPointer = param.type.startsWith('*');
      
      properties[param.name] = {
        type: this.goTypeToJsonSchema(param.type),
        description: funcInfo.documentation?.params.find(p => p.name === param.name)?.description || param.name
      };

      if (!isPointer) {
        required.push(param.name);
      }
    }

    return { type: 'object', properties, required };
  }

  /**
   * Convert Go type to JSON Schema type
   */
  private goTypeToJsonSchema(goType: string): string {
    const type = goType.trim().replace(/^\*/, ''); // Remove pointer

    // Array/slice types
    if (type.startsWith('[]')) {
      return 'array';
    }

    // Map types
    if (type.startsWith('map[')) {
      return 'object';
    }

    // Primitive type mapping
    const typeMap: Record<string, string> = {
      'string': 'string',
      'int': 'integer',
      'int8': 'integer',
      'int16': 'integer',
      'int32': 'integer',
      'int64': 'integer',
      'uint': 'integer',
      'uint8': 'integer',
      'uint16': 'integer',
      'uint32': 'integer',
      'uint64': 'integer',
      'float32': 'number',
      'float64': 'number',
      'bool': 'boolean',
      'byte': 'integer',
      'rune': 'integer'
    };

    if (typeMap[type]) {
      return typeMap[type];
    }

    // Default to object for structs and interfaces
    return 'object';
  }
}
