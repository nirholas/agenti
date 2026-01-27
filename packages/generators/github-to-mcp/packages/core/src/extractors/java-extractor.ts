/**
 * @fileoverview Java code extractor for extracting tools from Java codebases
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import { ExtractedTool, ParsedDocumentation } from '../types';

/**
 * Extracted Java method information
 */
interface JavaMethod {
  name: string;
  className: string;
  visibility: 'public' | 'protected' | 'private' | 'package';
  isStatic: boolean;
  returnType: string;
  params: Array<{
    name: string;
    type: string;
    annotations: string[];
  }>;
  annotations: string[];
  documentation: ParsedDocumentation | null;
  line: number;
}

/**
 * Java endpoint info (for Spring/JAX-RS)
 */
interface JavaEndpoint {
  method: string;
  path: string;
  handler: JavaMethod | null;
  produces?: string[];
  consumes?: string[];
}

/**
 * JavaExtractor extracts tools from Java codebases
 * Supports:
 * - Spring Boot @RequestMapping, @GetMapping, etc.
 * - JAX-RS @Path, @GET, @POST, etc.
 * - Micronaut @Controller routes
 * - Public methods with Javadoc
 */
export class JavaExtractor {
  /**
   * Extract tools from Java code
   */
  async extract(code: string, filename: string): Promise<ExtractedTool[]> {
    const tools: ExtractedTool[] = [];

    // Extract from web framework annotations
    const springTools = this.extractSpringEndpoints(code, filename);
    const jaxrsTools = this.extractJaxRsEndpoints(code, filename);
    const micronautTools = this.extractMicronautEndpoints(code, filename);

    tools.push(...springTools, ...jaxrsTools, ...micronautTools);

    // Extract from public methods with Javadoc
    const publicMethods = this.extractPublicMethods(code, filename);
    tools.push(...publicMethods);

    return tools;
  }

  /**
   * Extract Spring Boot endpoints
   * Annotations:
   * - @RequestMapping
   * - @GetMapping, @PostMapping, @PutMapping, @DeleteMapping, @PatchMapping
   * - @RestController, @Controller
   */
  private extractSpringEndpoints(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');

    // Find class-level @RequestMapping for base path
    let basePath = '';
    const classRequestMapping = code.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/);
    if (classRequestMapping) {
      basePath = classRequestMapping[1];
    }

    // Method-level mapping annotations
    const mappingAnnotations = [
      { pattern: /@GetMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/, method: 'GET' },
      { pattern: /@PostMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/, method: 'POST' },
      { pattern: /@PutMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/, method: 'PUT' },
      { pattern: /@DeleteMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/, method: 'DELETE' },
      { pattern: /@PatchMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/, method: 'PATCH' },
      { pattern: /@GetMapping\s*(?:\(\s*\))?(?!\s*\()/, method: 'GET', noPath: true },
      { pattern: /@PostMapping\s*(?:\(\s*\))?(?!\s*\()/, method: 'POST', noPath: true },
      { pattern: /@PutMapping\s*(?:\(\s*\))?(?!\s*\()/, method: 'PUT', noPath: true },
      { pattern: /@DeleteMapping\s*(?:\(\s*\))?(?!\s*\()/, method: 'DELETE', noPath: true },
      { pattern: /@PatchMapping\s*(?:\(\s*\))?(?!\s*\()/, method: 'PATCH', noPath: true },
    ];

    // Also handle @RequestMapping with method attribute
    const requestMappingPattern = /@RequestMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"(?:\s*,\s*method\s*=\s*RequestMethod\.(\w+))?/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for specific mapping annotations
      for (const { pattern, method, noPath } of mappingAnnotations) {
        const match = line.match(pattern);
        if (match) {
          const path = noPath ? '' : (match[1] || '');
          const fullPath = this.joinPaths(basePath, path);
          
          // Find the method definition
          const methodInfo = this.findNextMethod(lines, i + 1);
          
          if (methodInfo) {
            tools.push({
              name: this.generateToolName(method, fullPath, methodInfo.name),
              description: methodInfo.documentation?.description || `${method} ${fullPath}`,
              inputSchema: this.buildSpringInputSchema(methodInfo, fullPath),
              source: {
                type: 'code',
                file: filename,
                line: i + 1
              },
              confidence: 0.85
            });
          }
        }
      }

      // Check for @RequestMapping
      requestMappingPattern.lastIndex = 0;
      const rmMatch = requestMappingPattern.exec(line);
      if (rmMatch && !line.includes('@interface') && !this.isClassLevel(lines, i)) {
        const path = rmMatch[1] || '';
        const method = rmMatch[2] || 'GET';
        const fullPath = this.joinPaths(basePath, path);
        
        const methodInfo = this.findNextMethod(lines, i + 1);
        
        if (methodInfo) {
          tools.push({
            name: this.generateToolName(method, fullPath, methodInfo.name),
            description: methodInfo.documentation?.description || `${method} ${fullPath}`,
            inputSchema: this.buildSpringInputSchema(methodInfo, fullPath),
            source: {
              type: 'code',
              file: filename,
              line: i + 1
            },
            confidence: 0.85
          });
        }
      }
    }

    return tools;
  }

  /**
   * Extract JAX-RS endpoints
   * Annotations:
   * - @Path
   * - @GET, @POST, @PUT, @DELETE, @PATCH, @HEAD, @OPTIONS
   * - @Produces, @Consumes
   */
  private extractJaxRsEndpoints(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');

    // Find class-level @Path
    let basePath = '';
    const classPath = code.match(/@Path\s*\(\s*"([^"]+)"\s*\)/);
    if (classPath) {
      basePath = classPath[1];
    }

    // Check if this is a JAX-RS file
    if (!code.includes('@Path') && !code.includes('@GET') && !code.includes('@POST')) {
      return tools;
    }

    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for HTTP method annotations
      for (const httpMethod of httpMethods) {
        if (line.includes(`@${httpMethod}`)) {
          // Find @Path annotation near this line
          let methodPath = '';
          for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
            const pathMatch = lines[j].match(/@Path\s*\(\s*"([^"]+)"\s*\)/);
            if (pathMatch && j !== this.getClassPathLine(lines)) {
              methodPath = pathMatch[1];
              break;
            }
          }

          const fullPath = this.joinPaths(basePath, methodPath);
          const methodInfo = this.findNextMethod(lines, i + 1);

          if (methodInfo) {
            tools.push({
              name: this.generateToolName(httpMethod, fullPath, methodInfo.name),
              description: methodInfo.documentation?.description || `${httpMethod} ${fullPath}`,
              inputSchema: this.buildJaxRsInputSchema(methodInfo, fullPath),
              source: {
                type: 'code',
                file: filename,
                line: i + 1
              },
              confidence: 0.85
            });
          }
          break;
        }
      }
    }

    return tools;
  }

  /**
   * Extract Micronaut endpoints
   * Annotations:
   * - @Controller
   * - @Get, @Post, @Put, @Delete, @Patch
   */
  private extractMicronautEndpoints(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');

    // Check if this is a Micronaut file
    if (!code.includes('@Controller') && !code.includes('io.micronaut')) {
      return tools;
    }

    // Find class-level @Controller path
    let basePath = '';
    const controllerMatch = code.match(/@Controller\s*\(\s*"([^"]+)"\s*\)/);
    if (controllerMatch) {
      basePath = controllerMatch[1];
    }

    const mappingAnnotations = [
      { pattern: /@Get\s*\(\s*"([^"]+)"\s*\)/, method: 'GET' },
      { pattern: /@Post\s*\(\s*"([^"]+)"\s*\)/, method: 'POST' },
      { pattern: /@Put\s*\(\s*"([^"]+)"\s*\)/, method: 'PUT' },
      { pattern: /@Delete\s*\(\s*"([^"]+)"\s*\)/, method: 'DELETE' },
      { pattern: /@Patch\s*\(\s*"([^"]+)"\s*\)/, method: 'PATCH' },
      { pattern: /@Get\s*(?:\(\s*\))?(?!\s*\()/, method: 'GET', noPath: true },
      { pattern: /@Post\s*(?:\(\s*\))?(?!\s*\()/, method: 'POST', noPath: true },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const { pattern, method, noPath } of mappingAnnotations) {
        const match = line.match(pattern);
        if (match) {
          const path = noPath ? '' : (match[1] || '');
          const fullPath = this.joinPaths(basePath, path);
          
          const methodInfo = this.findNextMethod(lines, i + 1);
          
          if (methodInfo) {
            tools.push({
              name: this.generateToolName(method, fullPath, methodInfo.name),
              description: methodInfo.documentation?.description || `${method} ${fullPath}`,
              inputSchema: this.buildMicronautInputSchema(methodInfo, fullPath),
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
    }

    return tools;
  }

  /**
   * Extract public methods with Javadoc
   */
  private extractPublicMethods(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for public method declarations
      if (/^\s*public\s+(?:static\s+)?(?!class|interface|enum)[\w<>\[\],\s]+\s+\w+\s*\(/.test(line)) {
        // Skip if it has web framework annotations (already processed)
        let hasWebAnnotation = false;
        for (let j = Math.max(0, i - 5); j < i; j++) {
          if (/@(Get|Post|Put|Delete|Patch|RequestMapping|Path|GET|POST|PUT|DELETE)/.test(lines[j])) {
            hasWebAnnotation = true;
            break;
          }
        }

        if (hasWebAnnotation) continue;

        const methodInfo = this.parseMethod(lines, i);
        
        if (methodInfo && methodInfo.documentation && methodInfo.visibility === 'public') {
          tools.push({
            name: methodInfo.name,
            description: methodInfo.documentation.description || methodInfo.name,
            inputSchema: this.buildMethodInputSchema(methodInfo),
            source: {
              type: 'code',
              file: filename,
              line: i + 1
            },
            confidence: 0.6,
            confidenceFactors: {
              documentation: 0.8,
              types: 0.9,
              examples: methodInfo.documentation.examples?.length ? 0.7 : 0.2,
              source: 0.7
            }
          });
        }
      }
    }

    return tools;
  }

  /**
   * Find the next method definition
   */
  private findNextMethod(lines: string[], startLine: number): JavaMethod | null {
    for (let i = startLine; i < Math.min(startLine + 10, lines.length); i++) {
      const line = lines[i];
      // Look for method signature (not class/interface declaration)
      if (/^\s*(public|protected|private)?\s*(static\s+)?[\w<>\[\],\s]+\s+\w+\s*\(/.test(line) &&
          !line.includes('class ') && !line.includes('interface ') && !line.includes('enum ')) {
        return this.parseMethod(lines, i);
      }
    }
    return null;
  }

  /**
   * Parse a Java method definition
   */
  private parseMethod(lines: string[], lineIndex: number): JavaMethod | null {
    let methodLine = lines[lineIndex];
    
    // Handle multi-line signatures
    let parenDepth = 0;
    let i = lineIndex;
    while (i < lines.length) {
      for (const char of lines[i]) {
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
      }
      if (parenDepth === 0 && i > lineIndex) {
        methodLine = lines.slice(lineIndex, i + 1).join(' ');
        break;
      }
      if (parenDepth === 0) break;
      i++;
    }

    // Parse method signature - but need to handle params with nested parens
    // First, extract the header part (before opening paren)
    const headerMatch = methodLine.match(
      /^\s*(public|protected|private)?\s*(static\s+)?([\w<>\[\],\s]+)\s+(\w+)\s*\(/
    );

    if (!headerMatch) return null;

    const [headerPart, visibility, isStatic, returnType, name] = headerMatch;

    // Extract parameters by finding the matching closing paren
    let paramsStart = headerPart.length;
    let depth = 1;
    let paramsEnd = paramsStart;
    
    for (let idx = paramsStart; idx < methodLine.length; idx++) {
      const char = methodLine[idx];
      if (char === '(') depth++;
      else if (char === ')') {
        depth--;
        if (depth === 0) {
          paramsEnd = idx;
          break;
        }
      }
    }

    const paramsStr = methodLine.substring(paramsStart, paramsEnd);

    // Parse parameters
    const params = this.parseParameters(paramsStr, lines, lineIndex);

    // Get class name from file
    const classMatch = lines.join('\n').match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'Unknown';

    // Get annotations
    const annotations = this.getAnnotations(lines, lineIndex);

    // Get Javadoc
    const documentation = this.parseJavadoc(lines, lineIndex);

    return {
      name,
      className,
      visibility: (visibility as JavaMethod['visibility']) || 'package',
      isStatic: !!isStatic,
      returnType: returnType.trim(),
      params,
      annotations,
      documentation,
      line: lineIndex + 1
    };
  }

  /**
   * Parse method parameters
   */
  private parseParameters(
    paramsStr: string,
    lines: string[],
    methodLine: number
  ): JavaMethod['params'] {
    const params: JavaMethod['params'] = [];
    if (!paramsStr.trim()) return params;

    // Split by comma, handling generics
    const paramParts = this.splitParams(paramsStr);

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Extract annotations
      const annotations: string[] = [];
      let cleanPart = trimmed;
      
      const annotationMatches = trimmed.matchAll(/@(\w+)(?:\([^)]*\))?\s*/g);
      for (const match of annotationMatches) {
        annotations.push(match[0].trim());
        cleanPart = cleanPart.replace(match[0], '');
      }

      // Parse type and name
      const paramMatch = cleanPart.trim().match(/^([\w<>\[\],\s.]+)\s+(\w+)$/);
      if (paramMatch) {
        params.push({
          type: paramMatch[1].trim(),
          name: paramMatch[2],
          annotations
        });
      }
    }

    return params;
  }

  /**
   * Split parameters handling generics
   */
  private splitParams(paramsStr: string): string[] {
    const params: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of paramsStr) {
      if (char === '<' || char === '(' || char === '[') {
        depth++;
        current += char;
      } else if (char === '>' || char === ')' || char === ']') {
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
   * Get annotations above a method
   */
  private getAnnotations(lines: string[], methodLine: number): string[] {
    const annotations: string[] = [];
    let i = methodLine - 1;

    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith('@')) {
        annotations.unshift(line);
        i--;
      } else if (line === '' || line.startsWith('*') || line.startsWith('/*') || line.startsWith('//')) {
        i--;
      } else {
        break;
      }
    }

    return annotations;
  }

  /**
   * Parse Javadoc comments
   */
  private parseJavadoc(lines: string[], methodLine: number): ParsedDocumentation | null {
    // Find start of Javadoc
    let javadocEnd = -1;
    let i = methodLine - 1;

    // Skip annotations
    while (i >= 0 && (lines[i].trim().startsWith('@') || lines[i].trim() === '')) {
      i--;
    }

    // Look for */
    while (i >= 0) {
      if (lines[i].includes('*/')) {
        javadocEnd = i;
        break;
      }
      if (!lines[i].trim().startsWith('*') && !lines[i].trim().startsWith('@') && lines[i].trim() !== '') {
        return null; // No Javadoc
      }
      i--;
    }

    if (javadocEnd === -1) return null;

    // Find start /**
    let javadocStart = javadocEnd;
    while (javadocStart >= 0) {
      if (lines[javadocStart].includes('/**')) {
        break;
      }
      javadocStart--;
    }

    if (javadocStart < 0) return null;

    // Parse Javadoc content
    const javadocLines: string[] = [];
    for (let j = javadocStart; j <= javadocEnd; j++) {
      let line = lines[j]
        .replace(/\/\*\*/, '')
        .replace(/\*\//, '')
        .replace(/^\s*\*\s?/, '')
        .trim();
      if (line) {
        javadocLines.push(line);
      }
    }

    return this.parseDocumentation(javadocLines);
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
    let inDescription = true;

    for (const line of docLines) {
      // @param tag
      const paramMatch = line.match(/^@param\s+(\w+)\s+(.*)/);
      if (paramMatch) {
        inDescription = false;
        doc.params.push({
          name: paramMatch[1],
          description: paramMatch[2]
        });
        continue;
      }

      // @return tag
      const returnMatch = line.match(/^@returns?\s+(.*)/);
      if (returnMatch) {
        inDescription = false;
        doc.returns = { description: returnMatch[1] };
        continue;
      }

      // @throws/@exception tag
      const throwsMatch = line.match(/^@(?:throws|exception)\s+(.*)/);
      if (throwsMatch) {
        inDescription = false;
        if (!doc.throws) doc.throws = [];
        doc.throws.push(throwsMatch[1]);
        continue;
      }

      // @deprecated tag
      if (line.startsWith('@deprecated')) {
        inDescription = false;
        doc.deprecated = true;
        continue;
      }

      // @since tag
      const sinceMatch = line.match(/^@since\s+(.*)/);
      if (sinceMatch) {
        inDescription = false;
        doc.since = sinceMatch[1];
        continue;
      }

      // Skip other @ tags
      if (line.startsWith('@')) {
        inDescription = false;
        continue;
      }

      // Add to description
      if (inDescription) {
        description += (description ? ' ' : '') + line;
      }
    }

    doc.description = description.trim() || undefined;
    return doc;
  }

  /**
   * Check if current line is class-level (not method-level)
   */
  private isClassLevel(lines: string[], lineIndex: number): boolean {
    // Look ahead for class keyword before next method
    for (let i = lineIndex + 1; i < Math.min(lineIndex + 10, lines.length); i++) {
      if (/^\s*public\s+class\s+/.test(lines[i])) {
        return true;
      }
      if (/^\s*(public|protected|private)?\s*(static\s+)?[\w<>\[\],\s]+\s+\w+\s*\(/.test(lines[i])) {
        return false;
      }
    }
    return false;
  }

  /**
   * Get line number of class-level @Path annotation
   */
  private getClassPathLine(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('@Path') && this.isClassLevel(lines, i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Join path segments
   */
  private joinPaths(base: string, path: string): string {
    if (!base && !path) return '/';
    if (!base) return path.startsWith('/') ? path : '/' + path;
    if (!path) return base.startsWith('/') ? base : '/' + base;

    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const normalizedPath = path.startsWith('/') ? path : '/' + path;

    return (normalizedBase.startsWith('/') ? '' : '/') + normalizedBase + normalizedPath;
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

    // Convert method name from camelCase to snake_case
    return handlerName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Build input schema for Spring endpoints
   */
  private buildSpringInputSchema(
    methodInfo: JavaMethod,
    path: string
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Extract path parameters
    const pathParams = path.match(/\{(\w+)\}/g) || [];
    for (const param of pathParams) {
      const name = param.slice(1, -1);
      properties[name] = {
        type: 'string',
        description: `Path parameter: ${name}`
      };
      required.push(name);
    }

    // Add method parameters
    for (const param of methodInfo.params) {
      // Skip framework types
      if (this.isSpringFrameworkType(param.type)) continue;

      // Check for @RequestBody, @RequestParam, @PathVariable annotations
      const isPathVariable = param.annotations.some(a => a.includes('@PathVariable'));
      const isRequestBody = param.annotations.some(a => a.includes('@RequestBody'));
      const isRequestParam = param.annotations.some(a => a.includes('@RequestParam'));

      if (isPathVariable) continue; // Already handled

      const paramDescription = methodInfo.documentation?.params.find(p => p.name === param.name)?.description;

      if (isRequestBody) {
        properties[param.name] = {
          type: 'object',
          description: paramDescription || `Request body: ${param.name}`
        };
        required.push(param.name);
      } else if (isRequestParam) {
        // Check if required
        const reqMatch = param.annotations.find(a => a.includes('@RequestParam'))?.match(/required\s*=\s*(true|false)/);
        const isRequired = !reqMatch || reqMatch[1] === 'true';

        properties[param.name] = {
          type: this.javaTypeToJsonSchema(param.type),
          description: paramDescription || param.name
        };

        if (isRequired) {
          required.push(param.name);
        }
      }
    }

    return { type: 'object', properties, required };
  }

  /**
   * Build input schema for JAX-RS endpoints
   */
  private buildJaxRsInputSchema(
    methodInfo: JavaMethod,
    path: string
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Extract path parameters
    const pathParams = path.match(/\{(\w+)\}/g) || [];
    for (const param of pathParams) {
      const name = param.slice(1, -1);
      properties[name] = {
        type: 'string',
        description: `Path parameter: ${name}`
      };
      required.push(name);
    }

    // Add method parameters
    for (const param of methodInfo.params) {
      const isPathParam = param.annotations.some(a => a.includes('@PathParam'));
      const isQueryParam = param.annotations.some(a => a.includes('@QueryParam'));
      const isFormParam = param.annotations.some(a => a.includes('@FormParam'));

      if (isPathParam) continue;

      const paramDescription = methodInfo.documentation?.params.find(p => p.name === param.name)?.description;

      if (isQueryParam || isFormParam) {
        properties[param.name] = {
          type: this.javaTypeToJsonSchema(param.type),
          description: paramDescription || param.name
        };
      } else if (!this.isJaxRsFrameworkType(param.type)) {
        // Assume it's a request body
        properties[param.name] = {
          type: 'object',
          description: paramDescription || `Request body: ${param.name}`
        };
        required.push(param.name);
      }
    }

    return { type: 'object', properties, required };
  }

  /**
   * Build input schema for Micronaut endpoints
   */
  private buildMicronautInputSchema(
    methodInfo: JavaMethod,
    path: string
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    // Micronaut is similar to Spring
    return this.buildSpringInputSchema(methodInfo, path);
  }

  /**
   * Build input schema from method parameters
   */
  private buildMethodInputSchema(
    methodInfo: JavaMethod
  ): { type: 'object'; properties: Record<string, any>; required: string[] } {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of methodInfo.params) {
      const paramDescription = methodInfo.documentation?.params.find(p => p.name === param.name)?.description;

      properties[param.name] = {
        type: this.javaTypeToJsonSchema(param.type),
        description: paramDescription || param.name
      };

      // Primitive types are required, objects are optional
      if (!param.type.includes('.') && !param.type.startsWith('Optional')) {
        required.push(param.name);
      }
    }

    return { type: 'object', properties, required };
  }

  /**
   * Check if type is a Spring framework type
   */
  private isSpringFrameworkType(type: string): boolean {
    const frameworkTypes = [
      'HttpServletRequest', 'HttpServletResponse',
      'Model', 'ModelMap', 'ModelAndView',
      'BindingResult', 'Errors',
      'RedirectAttributes', 'SessionStatus',
      'Principal', 'Authentication',
      'UriComponentsBuilder', 'HttpEntity',
      'MultipartFile'
    ];
    return frameworkTypes.some(ft => type.includes(ft));
  }

  /**
   * Check if type is a JAX-RS framework type
   */
  private isJaxRsFrameworkType(type: string): boolean {
    const frameworkTypes = [
      'HttpServletRequest', 'HttpServletResponse',
      'UriInfo', 'HttpHeaders', 'SecurityContext',
      'Request', 'Response', 'ContainerRequestContext'
    ];
    return frameworkTypes.some(ft => type.includes(ft));
  }

  /**
   * Convert Java type to JSON Schema type
   */
  private javaTypeToJsonSchema(javaType: string): string {
    const type = javaType.trim();

    // Handle arrays
    if (type.endsWith('[]') || type.startsWith('List<') || type.startsWith('Set<') || type.startsWith('Collection<')) {
      return 'array';
    }

    // Handle maps
    if (type.startsWith('Map<') || type.startsWith('HashMap<')) {
      return 'object';
    }

    // Handle Optional
    if (type.startsWith('Optional<')) {
      const inner = type.match(/Optional<(.+)>/);
      if (inner) return this.javaTypeToJsonSchema(inner[1]);
    }

    // Primitive and wrapper type mapping
    const typeMap: Record<string, string> = {
      'String': 'string',
      'CharSequence': 'string',
      'int': 'integer',
      'Integer': 'integer',
      'long': 'integer',
      'Long': 'integer',
      'short': 'integer',
      'Short': 'integer',
      'byte': 'integer',
      'Byte': 'integer',
      'BigInteger': 'integer',
      'float': 'number',
      'Float': 'number',
      'double': 'number',
      'Double': 'number',
      'BigDecimal': 'number',
      'boolean': 'boolean',
      'Boolean': 'boolean',
      'char': 'string',
      'Character': 'string'
    };

    if (typeMap[type]) {
      return typeMap[type];
    }

    // Default to object for complex types
    return 'object';
  }
}
