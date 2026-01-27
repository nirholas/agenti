/**
 * @fileoverview Multi-language documentation parsers
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { ParsedDocumentation, ExtractedTool, ConfidenceFactors } from './types';

/**
 * Base class for language-specific documentation parsers
 */
abstract class BaseDocParser {
  abstract parseDocumentation(code: string, position: number): ParsedDocumentation | null;
  abstract extractFunctions(code: string, filename: string): ExtractedTool[];

  /**
   * Calculate confidence score based on documentation quality
   */
  protected calculateConfidence(
    doc: ParsedDocumentation | null,
    hasTypeInfo: boolean,
    sourceType: string
  ): { confidence: number; factors: ConfidenceFactors } {
    const factors: ConfidenceFactors = {
      documentation: 0,
      types: 0,
      examples: 0,
      source: 0
    };

    // Documentation factor
    if (doc) {
      let docScore = 0;
      if (doc.description && doc.description.length > 10) docScore += 0.4;
      if (doc.params.length > 0) {
        const paramsWithDesc = doc.params.filter(p => p.description).length;
        docScore += 0.3 * (paramsWithDesc / doc.params.length);
      }
      if (doc.returns?.description) docScore += 0.2;
      if (doc.params.every(p => p.type)) docScore += 0.1;
      factors.documentation = Math.min(1, docScore);
    }

    // Types factor
    factors.types = hasTypeInfo ? 0.8 : 0.2;
    if (doc?.params.every(p => p.type)) factors.types = 1;

    // Examples factor
    factors.examples = doc?.examples && doc.examples.length > 0 ? 1 : 0;

    // Source reliability factor
    const sourceScores: Record<string, number> = {
      'mcp-introspect': 1.0,
      'openapi': 0.95,
      'graphql': 0.9,
      'code': 0.7,
      'tests': 0.6,
      'docs': 0.5,
      'examples': 0.5,
      'readme': 0.4,
      'universal': 0.3
    };
    factors.source = sourceScores[sourceType] || 0.5;

    // Calculate overall confidence
    const confidence = (
      factors.documentation * 0.35 +
      factors.types * 0.25 +
      factors.examples * 0.15 +
      factors.source * 0.25
    );

    return { confidence: Math.round(confidence * 100) / 100, factors };
  }

  /**
   * Convert type string to JSON Schema type
   */
  protected toJsonSchemaType(type: string): string {
    const normalized = type.toLowerCase().trim();
    
    if (normalized.includes('str') || normalized === 'string') return 'string';
    if (normalized.includes('int') || normalized.includes('number') || normalized.includes('float')) return 'number';
    if (normalized.includes('bool')) return 'boolean';
    if (normalized.includes('list') || normalized.includes('array') || normalized.includes('[]')) return 'array';
    if (normalized.includes('dict') || normalized.includes('object') || normalized.includes('map') || normalized.includes('hash')) return 'object';
    if (normalized === 'null' || normalized === 'nil' || normalized === 'none') return 'null';
    
    return 'string';
  }
}

/**
 * Python docstring parser supporting Google, NumPy, and Sphinx styles
 */
export class PythonDocParser extends BaseDocParser {
  /**
   * Parse Python docstring at a given position
   */
  parseDocumentation(code: string, position: number): ParsedDocumentation | null {
    // Find docstring after function definition
    const codeFromPos = code.substring(position);
    
    // Match triple-quoted docstrings
    const docMatch = codeFromPos.match(/^[^"']*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
    if (!docMatch) return null;
    
    const docstring = (docMatch[1] || docMatch[2]).trim();
    return this.parseDocstring(docstring);
  }

  /**
   * Parse a Python docstring in various formats
   */
  private parseDocstring(docstring: string): ParsedDocumentation {
    const result: ParsedDocumentation = {
      params: [],
      examples: []
    };

    const lines = docstring.split('\n');
    let currentSection = 'description';
    let descriptionLines: string[] = [];
    let currentParam: { name: string; type?: string; description: string } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect section headers (Google/NumPy style)
      if (/^(Args|Arguments|Parameters):?\s*$/i.test(trimmed)) {
        currentSection = 'params';
        continue;
      }
      if (/^(Returns?|Yields?):?\s*$/i.test(trimmed)) {
        currentSection = 'returns';
        continue;
      }
      if (/^(Examples?):?\s*$/i.test(trimmed)) {
        currentSection = 'examples';
        continue;
      }
      if (/^(Raises?|Throws?|Exceptions?):?\s*$/i.test(trimmed)) {
        currentSection = 'raises';
        continue;
      }

      // Parse based on current section
      if (currentSection === 'description') {
        // Check for Sphinx-style :param:
        const sphinxParam = trimmed.match(/^:param\s+(\w+):\s*(.+)$/);
        if (sphinxParam) {
          result.params.push({
            name: sphinxParam[1],
            description: sphinxParam[2],
            required: true
          });
          continue;
        }
        
        const sphinxType = trimmed.match(/^:type\s+(\w+):\s*(.+)$/);
        if (sphinxType) {
          const param = result.params.find(p => p.name === sphinxType[1]);
          if (param) param.type = sphinxType[2];
          continue;
        }
        
        const sphinxReturn = trimmed.match(/^:returns?:\s*(.+)$/);
        if (sphinxReturn) {
          result.returns = { description: sphinxReturn[1] };
          continue;
        }
        
        const sphinxRtype = trimmed.match(/^:rtype:\s*(.+)$/);
        if (sphinxRtype) {
          if (!result.returns) result.returns = {};
          result.returns.type = sphinxRtype[1];
          continue;
        }

        descriptionLines.push(trimmed);
      } else if (currentSection === 'params') {
        // Google style: name (type): description
        // NumPy style: name : type\n    description
        const googleMatch = trimmed.match(/^(\w+)\s*\(([^)]+)\)\s*:\s*(.*)$/);
        if (googleMatch) {
          if (currentParam) result.params.push(currentParam);
          currentParam = {
            name: googleMatch[1],
            type: googleMatch[2],
            description: googleMatch[3]
          };
          continue;
        }
        
        const simpleMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
        if (simpleMatch) {
          if (currentParam) result.params.push(currentParam);
          // Check if it's type or description
          const isType = /^[A-Za-z\[\]|,\s]+$/.test(simpleMatch[2]);
          currentParam = {
            name: simpleMatch[1],
            type: isType ? simpleMatch[2] : undefined,
            description: isType ? '' : simpleMatch[2]
          };
          continue;
        }
        
        // Continuation line
        if (currentParam && trimmed && line.startsWith('    ')) {
          currentParam.description += ' ' + trimmed;
        }
      } else if (currentSection === 'returns') {
        if (trimmed) {
          const typeMatch = trimmed.match(/^([A-Za-z\[\]|,\s]+):\s*(.*)$/);
          if (typeMatch) {
            result.returns = {
              type: typeMatch[1],
              description: typeMatch[2]
            };
          } else {
            result.returns = { description: trimmed };
          }
        }
      } else if (currentSection === 'examples') {
        if (trimmed.startsWith('>>>') || trimmed.startsWith('```')) {
          result.examples!.push(trimmed);
        }
      } else if (currentSection === 'raises') {
        if (!result.throws) result.throws = [];
        if (trimmed) result.throws.push(trimmed);
      }
    }

    if (currentParam) result.params.push(currentParam);
    
    // Clean up description
    result.description = descriptionLines
      .filter(l => l.length > 0)
      .join(' ')
      .trim();

    // Mark params as required/optional
    result.params = result.params.map(p => ({
      ...p,
      required: !p.type?.toLowerCase().includes('optional') && p.defaultValue === undefined
    }));

    return result;
  }

  /**
   * Extract function definitions with docstrings from Python code
   */
  extractFunctions(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    
    // Match function definitions with optional async and decorators
    const funcPattern = /(?:@[\w.]+\s*(?:\([^)]*\))?\s*\n\s*)*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/g;
    
    let match;
    while ((match = funcPattern.exec(code)) !== null) {
      const [fullMatch, funcName, paramsStr, returnType] = match;
      
      // Skip private/dunder methods
      if (funcName.startsWith('_') && !funcName.startsWith('__')) continue;
      if (funcName === '__init__') continue;
      
      const doc = this.parseDocumentation(code, match.index + fullMatch.length);
      const params = this.parseParameters(paramsStr, doc);
      const hasTypeInfo = returnType !== undefined || params.some(p => p.type !== undefined);
      
      const { confidence, factors } = this.calculateConfidence(doc, hasTypeInfo, 'code');
      
      const lineNum = code.substring(0, match.index).split('\n').length;
      
      tools.push({
        name: funcName,
        description: doc?.description || `Python function: ${funcName}`,
        inputSchema: {
          type: 'object',
          properties: this.paramsToProperties(params),
          required: params.filter(p => p.required).map(p => p.name)
        },
        examples: doc?.examples,
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence,
        confidenceFactors: factors
      });
    }
    
    return tools;
  }

  /**
   * Parse function parameters from signature
   */
  private parseParameters(paramsStr: string, doc: ParsedDocumentation | null): Array<{
    name: string;
    type?: string;
    description?: string;
    required: boolean;
    defaultValue?: any;
  }> {
    const params: Array<{
      name: string;
      type?: string;
      description?: string;
      required: boolean;
      defaultValue?: any;
    }> = [];
    
    // Skip empty or self-only
    if (!paramsStr.trim() || paramsStr.trim() === 'self') return params;
    
    // Split handling nested brackets
    const paramParts = this.splitParams(paramsStr);
    
    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === 'self' || trimmed === 'cls') continue;
      if (trimmed.startsWith('*')) continue; // Skip *args, **kwargs
      
      // Parse: name: Type = default
      const paramMatch = trimmed.match(/^(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?$/);
      if (paramMatch) {
        const [, name, type, defaultVal] = paramMatch;
        const docParam = doc?.params.find(p => p.name === name);
        
        params.push({
          name,
          type: type?.trim() || docParam?.type,
          description: docParam?.description,
          required: defaultVal === undefined && !type?.toLowerCase().includes('optional'),
          defaultValue: defaultVal !== undefined ? this.parseDefaultValue(defaultVal) : undefined
        });
      }
    }
    
    return params;
  }

  /**
   * Split parameters handling nested brackets
   */
  private splitParams(paramsStr: string): string[] {
    const params: string[] = [];
    let depth = 0;
    let current = '';
    
    for (const char of paramsStr) {
      if (char === '(' || char === '[' || char === '{') depth++;
      if (char === ')' || char === ']' || char === '}') depth--;
      if (char === ',' && depth === 0) {
        params.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) params.push(current);
    
    return params;
  }

  /**
   * Parse Python default value
   */
  private parseDefaultValue(value: string): any {
    const v = value.trim();
    if (v === 'None') return null;
    if (v === 'True') return true;
    if (v === 'False') return false;
    if (/^["']/.test(v)) return v.slice(1, -1);
    if (/^\d+$/.test(v)) return parseInt(v);
    if (/^\d+\.\d+$/.test(v)) return parseFloat(v);
    if (v === '[]') return [];
    if (v === '{}') return {};
    return v;
  }

  /**
   * Convert params to JSON Schema properties
   */
  private paramsToProperties(params: Array<{
    name: string;
    type?: string;
    description?: string;
  }>): Record<string, any> {
    const props: Record<string, any> = {};
    
    for (const param of params) {
      props[param.name] = {
        type: param.type ? this.toJsonSchemaType(param.type) : 'string',
        description: param.description || `${param.name} parameter`
      };
    }
    
    return props;
  }
}

/**
 * Rust doc comment parser
 */
export class RustDocParser extends BaseDocParser {
  parseDocumentation(code: string, position: number): ParsedDocumentation | null {
    const codeBeforePos = code.substring(0, position);
    const lines = codeBeforePos.split('\n');
    
    const docLines: string[] = [];
    
    // Walk backwards to collect doc comments
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('///')) {
        docLines.unshift(line.substring(3).trim());
      } else if (line.startsWith('#[doc = "')) {
        const match = line.match(/#\[doc = "(.+)"\]/);
        if (match) docLines.unshift(match[1]);
      } else if (line === '' || line.startsWith('#[')) {
        continue;
      } else {
        break;
      }
    }
    
    if (docLines.length === 0) return null;
    
    return this.parseRustDoc(docLines);
  }

  private parseRustDoc(lines: string[]): ParsedDocumentation {
    const result: ParsedDocumentation = {
      params: [],
      examples: []
    };
    
    let currentSection = 'description';
    const descLines: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('# Arguments') || line.startsWith('# Parameters')) {
        currentSection = 'params';
        continue;
      }
      if (line.startsWith('# Returns')) {
        currentSection = 'returns';
        continue;
      }
      if (line.startsWith('# Examples') || line.startsWith('# Example')) {
        currentSection = 'examples';
        continue;
      }
      if (line.startsWith('# Panics') || line.startsWith('# Errors')) {
        currentSection = 'errors';
        continue;
      }
      
      if (currentSection === 'description') {
        descLines.push(line);
      } else if (currentSection === 'params') {
        // Format: * `name` - description
        const paramMatch = line.match(/^\*\s*`(\w+)`\s*-\s*(.+)$/);
        if (paramMatch) {
          result.params.push({
            name: paramMatch[1],
            description: paramMatch[2],
            required: true
          });
        }
      } else if (currentSection === 'returns') {
        result.returns = { description: line };
      } else if (currentSection === 'examples') {
        result.examples!.push(line);
      }
    }
    
    result.description = descLines.join(' ').trim();
    
    return result;
  }

  extractFunctions(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    
    // Match pub fn definitions
    const funcPattern = /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*\{/g;
    
    let match;
    while ((match = funcPattern.exec(code)) !== null) {
      const [fullMatch, funcName, paramsStr, returnType] = match;
      
      // Skip private functions
      if (funcName.startsWith('_')) continue;
      
      const doc = this.parseDocumentation(code, match.index);
      const params = this.parseRustParams(paramsStr, doc);
      const hasTypeInfo = returnType !== undefined || params.some(p => p.type !== undefined);
      
      const { confidence, factors } = this.calculateConfidence(doc, hasTypeInfo, 'code');
      const lineNum = code.substring(0, match.index).split('\n').length;
      
      tools.push({
        name: funcName,
        description: doc?.description || `Rust function: ${funcName}`,
        inputSchema: {
          type: 'object',
          properties: this.rustParamsToProperties(params),
          required: params.filter(p => !p.type?.includes('Option')).map(p => p.name)
        },
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence,
        confidenceFactors: factors
      });
    }
    
    return tools;
  }

  private parseRustParams(paramsStr: string, doc: ParsedDocumentation | null): Array<{
    name: string;
    type?: string;
    description?: string;
  }> {
    const params: Array<{ name: string; type?: string; description?: string }> = [];
    
    const parts = paramsStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === 'self' || trimmed === '&self' || trimmed === '&mut self') continue;
      
      // Format: name: Type
      const match = trimmed.match(/(\w+)\s*:\s*(.+)/);
      if (match) {
        const docParam = doc?.params.find(p => p.name === match[1]);
        params.push({
          name: match[1],
          type: match[2].trim(),
          description: docParam?.description
        });
      }
    }
    
    return params;
  }

  private rustParamsToProperties(params: Array<{ name: string; type?: string; description?: string }>): Record<string, any> {
    const props: Record<string, any> = {};
    
    for (const param of params) {
      props[param.name] = {
        type: this.rustTypeToJson(param.type || ''),
        description: param.description || `${param.name} parameter`
      };
    }
    
    return props;
  }

  private rustTypeToJson(rustType: string): string {
    const t = rustType.toLowerCase();
    if (t.includes('string') || t.includes('str')) return 'string';
    if (t.includes('i32') || t.includes('i64') || t.includes('u32') || t.includes('u64') || t.includes('usize') || t.includes('isize')) return 'integer';
    if (t.includes('f32') || t.includes('f64')) return 'number';
    if (t.includes('bool')) return 'boolean';
    if (t.includes('vec') || t.includes('array')) return 'array';
    if (t.includes('hashmap') || t.includes('btreemap')) return 'object';
    return 'string';
  }
}

/**
 * Go godoc comment parser
 */
export class GoDocParser extends BaseDocParser {
  parseDocumentation(code: string, position: number): ParsedDocumentation | null {
    const codeBeforePos = code.substring(0, position);
    const lines = codeBeforePos.split('\n');
    
    const docLines: string[] = [];
    
    // Walk backwards to collect comments
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('//')) {
        docLines.unshift(line.substring(2).trim());
      } else if (line === '') {
        continue;
      } else {
        break;
      }
    }
    
    if (docLines.length === 0) return null;
    
    return {
      description: docLines.join(' ').trim(),
      params: []
    };
  }

  extractFunctions(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    
    // Match exported function definitions (capitalized)
    const funcPattern = /func\s+(?:\([^)]+\)\s+)?([A-Z]\w*)\s*\(([^)]*)\)(?:\s*(?:\([^)]*\)|[^{]+))?\s*\{/g;
    
    let match;
    while ((match = funcPattern.exec(code)) !== null) {
      const [, funcName, paramsStr] = match;
      
      const doc = this.parseDocumentation(code, match.index);
      const params = this.parseGoParams(paramsStr);
      
      const { confidence, factors } = this.calculateConfidence(doc, params.some(p => p.type !== undefined), 'code');
      const lineNum = code.substring(0, match.index).split('\n').length;
      
      tools.push({
        name: funcName,
        description: doc?.description || `Go function: ${funcName}`,
        inputSchema: {
          type: 'object',
          properties: this.goParamsToProperties(params),
          required: params.map(p => p.name)
        },
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence,
        confidenceFactors: factors
      });
    }
    
    return tools;
  }

  private parseGoParams(paramsStr: string): Array<{ name: string; type?: string }> {
    const params: Array<{ name: string; type?: string }> = [];
    
    // Go params: name type, name type or name, name type
    const parts = paramsStr.split(',');
    let pendingType: string | undefined;
    const pendingNames: string[] = [];
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 2) {
        // Last token is type, rest are names for this type
        const type = tokens.pop()!;
        for (const name of tokens) {
          params.push({ name, type });
        }
        // Also apply to pending names
        for (const name of pendingNames) {
          params.push({ name, type });
        }
        pendingNames.length = 0;
      } else if (tokens.length === 1) {
        // Just a name, type comes later
        pendingNames.push(tokens[0]);
      }
    }
    
    return params;
  }

  private goParamsToProperties(params: Array<{ name: string; type?: string }>): Record<string, any> {
    const props: Record<string, any> = {};
    
    for (const param of params) {
      props[param.name] = {
        type: this.goTypeToJson(param.type || ''),
        description: `${param.name} parameter`
      };
    }
    
    return props;
  }

  private goTypeToJson(goType: string): string {
    const t = goType.toLowerCase();
    if (t === 'string') return 'string';
    if (t.includes('int') || t.includes('byte') || t.includes('rune')) return 'integer';
    if (t.includes('float')) return 'number';
    if (t === 'bool') return 'boolean';
    if (t.startsWith('[]') || t.startsWith('...')) return 'array';
    if (t.startsWith('map[')) return 'object';
    return 'string';
  }
}

/**
 * Ruby YARD documentation parser
 */
export class RubyDocParser extends BaseDocParser {
  parseDocumentation(code: string, position: number): ParsedDocumentation | null {
    const codeBeforePos = code.substring(0, position);
    const lines = codeBeforePos.split('\n');
    
    const docLines: string[] = [];
    
    // Walk backwards to collect comments
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('#')) {
        docLines.unshift(line.substring(1).trim());
      } else if (line === '') {
        continue;
      } else {
        break;
      }
    }
    
    if (docLines.length === 0) return null;
    
    return this.parseYardDoc(docLines);
  }

  private parseYardDoc(lines: string[]): ParsedDocumentation {
    const result: ParsedDocumentation = {
      params: [],
      examples: []
    };
    
    const descLines: string[] = [];
    let inExample = false;
    
    for (const line of lines) {
      // YARD tags
      const paramMatch = line.match(/^@param\s+(?:\[([^\]]+)\]\s+)?(\w+)\s+(.*)$/);
      if (paramMatch) {
        result.params.push({
          name: paramMatch[2],
          type: paramMatch[1],
          description: paramMatch[3],
          required: !paramMatch[1]?.includes('nil')
        });
        continue;
      }
      
      const returnMatch = line.match(/^@return\s+(?:\[([^\]]+)\]\s+)?(.*)$/);
      if (returnMatch) {
        result.returns = {
          type: returnMatch[1],
          description: returnMatch[2]
        };
        continue;
      }
      
      if (line.startsWith('@example')) {
        inExample = true;
        continue;
      }
      
      if (line.startsWith('@')) {
        inExample = false;
        continue;
      }
      
      if (inExample) {
        result.examples!.push(line);
      } else if (!line.startsWith('@')) {
        descLines.push(line);
      }
    }
    
    result.description = descLines.join(' ').trim();
    
    return result;
  }

  extractFunctions(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    
    // Match Ruby method definitions
    const methodPattern = /def\s+(\w+[?!]?)(?:\s*\(([^)]*)\))?/g;
    
    let match;
    while ((match = methodPattern.exec(code)) !== null) {
      const [, methodName, paramsStr] = match;
      
      // Skip private methods
      if (methodName.startsWith('_')) continue;
      
      const doc = this.parseDocumentation(code, match.index);
      const params = this.parseRubyParams(paramsStr || '', doc);
      
      const { confidence, factors } = this.calculateConfidence(doc, doc?.params.some(p => p.type !== undefined) || false, 'code');
      const lineNum = code.substring(0, match.index).split('\n').length;
      
      tools.push({
        name: methodName,
        description: doc?.description || `Ruby method: ${methodName}`,
        inputSchema: {
          type: 'object',
          properties: this.rubyParamsToProperties(params),
          required: params.filter(p => !p.hasDefault).map(p => p.name)
        },
        source: {
          type: 'code',
          file: filename,
          line: lineNum
        },
        confidence,
        confidenceFactors: factors
      });
    }
    
    return tools;
  }

  private parseRubyParams(paramsStr: string, doc: ParsedDocumentation | null): Array<{
    name: string;
    type?: string;
    hasDefault: boolean;
  }> {
    const params: Array<{ name: string; type?: string; hasDefault: boolean }> = [];
    
    const parts = paramsStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Handle keyword args: name:, name: default
      const keywordMatch = trimmed.match(/^(\w+):\s*(.*)$/);
      if (keywordMatch) {
        const docParam = doc?.params.find(p => p.name === keywordMatch[1]);
        params.push({
          name: keywordMatch[1],
          type: docParam?.type,
          hasDefault: keywordMatch[2] !== ''
        });
        continue;
      }
      
      // Handle positional: name, name = default
      const posMatch = trimmed.match(/^(\w+)(?:\s*=\s*.+)?$/);
      if (posMatch) {
        const docParam = doc?.params.find(p => p.name === posMatch[1]);
        params.push({
          name: posMatch[1],
          type: docParam?.type,
          hasDefault: trimmed.includes('=')
        });
      }
    }
    
    return params;
  }

  private rubyParamsToProperties(params: Array<{ name: string; type?: string }>): Record<string, any> {
    const props: Record<string, any> = {};
    
    for (const param of params) {
      props[param.name] = {
        type: this.rubyTypeToJson(param.type || ''),
        description: `${param.name} parameter`
      };
    }
    
    return props;
  }

  private rubyTypeToJson(rubyType: string): string {
    const t = rubyType.toLowerCase();
    if (t.includes('string')) return 'string';
    if (t.includes('integer') || t.includes('fixnum')) return 'integer';
    if (t.includes('float') || t.includes('numeric')) return 'number';
    if (t.includes('bool') || t.includes('trueclass') || t.includes('falseclass')) return 'boolean';
    if (t.includes('array')) return 'array';
    if (t.includes('hash')) return 'object';
    return 'string';
  }
}

/**
 * Enhanced TypeScript/JavaScript JSDoc/TSDoc parser
 */
export class TypeScriptDocParser extends BaseDocParser {
  parseDocumentation(code: string, position: number): ParsedDocumentation | null {
    const codeBeforePos = code.substring(0, position);
    
    // Find JSDoc comment before position
    const jsdocMatch = codeBeforePos.match(/\/\*\*\s*([\s\S]*?)\s*\*\/\s*$/);
    if (!jsdocMatch) return null;
    
    return this.parseJsDoc(jsdocMatch[1]);
  }

  private parseJsDoc(jsdoc: string): ParsedDocumentation {
    const result: ParsedDocumentation = {
      params: [],
      examples: []
    };
    
    const lines = jsdoc.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim());
    const descLines: string[] = [];
    
    for (const line of lines) {
      // @param {type} name - description or @param name {type} description
      const paramMatch = line.match(/^@param\s+(?:\{([^}]+)\}\s+)?(\w+)\s*(?:-\s*)?(.*)$/) ||
                        line.match(/^@param\s+(\w+)\s+\{([^}]+)\}\s+(.*)$/);
      if (paramMatch) {
        const type = paramMatch[1]?.includes('}') ? paramMatch[2] : paramMatch[1];
        const name = paramMatch[1]?.includes('}') ? paramMatch[1] : paramMatch[2];
        result.params.push({
          name,
          type,
          description: paramMatch[3],
          required: !type?.includes('?') && !type?.includes('undefined')
        });
        continue;
      }
      
      const returnMatch = line.match(/^@returns?\s+(?:\{([^}]+)\}\s+)?(.*)$/);
      if (returnMatch) {
        result.returns = {
          type: returnMatch[1],
          description: returnMatch[2]
        };
        continue;
      }
      
      if (line.startsWith('@example')) {
        continue; // Example content follows
      }
      
      if (line.startsWith('@')) {
        // Other tags - skip
        continue;
      }
      
      descLines.push(line);
    }
    
    result.description = descLines.filter(l => l).join(' ').trim();
    
    return result;
  }

  extractFunctions(code: string, filename: string): ExtractedTool[] {
    const tools: ExtractedTool[] = [];
    
    // Match function/method definitions
    const patterns = [
      // async function name(params): ReturnType
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g,
      // const name = (params): ReturnType =>
      /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=]+))?\s*=>/g,
      // class method: async name(params): ReturnType
      /(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const [, funcName, paramsStr, returnType] = match;
        
        // Skip constructors, private, and lifecycle methods
        if (funcName === 'constructor' || funcName.startsWith('_')) continue;
        if (['if', 'for', 'while', 'switch', 'catch'].includes(funcName)) continue;
        
        const doc = this.parseDocumentation(code, match.index);
        const params = this.parseTypeScriptParams(paramsStr, doc);
        
        const { confidence, factors } = this.calculateConfidence(
          doc, 
          returnType !== undefined || params.some(p => p.type !== undefined), 
          'code'
        );
        const lineNum = code.substring(0, match.index).split('\n').length;
        
        tools.push({
          name: funcName,
          description: doc?.description || `Function: ${funcName}`,
          inputSchema: {
            type: 'object',
            properties: this.tsParamsToProperties(params),
            required: params.filter(p => p.required).map(p => p.name)
          },
          source: {
            type: 'code',
            file: filename,
            line: lineNum
          },
          confidence,
          confidenceFactors: factors
        });
      }
    }
    
    return tools;
  }

  private parseTypeScriptParams(paramsStr: string, doc: ParsedDocumentation | null): Array<{
    name: string;
    type?: string;
    required: boolean;
  }> {
    const params: Array<{ name: string; type?: string; required: boolean }> = [];
    
    if (!paramsStr.trim()) return params;
    
    // Split handling generics
    const parts = this.splitParams(paramsStr);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Match: name?: Type = default or destructured { a, b }: Type
      if (trimmed.startsWith('{')) continue; // Skip destructured for now
      
      const match = trimmed.match(/^(\w+)(\??)(?:\s*:\s*([^=]+))?(?:\s*=\s*.+)?$/);
      if (match) {
        const [, name, optional, type] = match;
        const docParam = doc?.params.find(p => p.name === name);
        
        params.push({
          name,
          type: type?.trim() || docParam?.type,
          required: !optional && !trimmed.includes('=')
        });
      }
    }
    
    return params;
  }

  private splitParams(paramsStr: string): string[] {
    const params: string[] = [];
    let depth = 0;
    let current = '';
    
    for (const char of paramsStr) {
      if (char === '<' || char === '(' || char === '[' || char === '{') depth++;
      if (char === '>' || char === ')' || char === ']' || char === '}') depth--;
      if (char === ',' && depth === 0) {
        params.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) params.push(current);
    
    return params;
  }

  private tsParamsToProperties(params: Array<{ name: string; type?: string }>): Record<string, any> {
    const props: Record<string, any> = {};
    
    for (const param of params) {
      props[param.name] = {
        type: this.tsTypeToJson(param.type || ''),
        description: `${param.name} parameter`
      };
    }
    
    return props;
  }

  private tsTypeToJson(tsType: string): string {
    const t = tsType.toLowerCase().trim();
    if (t === 'string') return 'string';
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t.includes('[]') || t.startsWith('array')) return 'array';
    if (t === 'object' || t.startsWith('{')) return 'object';
    if (t === 'any' || t === 'unknown') return 'string';
    return 'string';
  }
}

/**
 * Get appropriate parser for a file extension
 */
export function getParserForLanguage(filename: string): BaseDocParser | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'py':
      return new PythonDocParser();
    case 'rs':
      return new RustDocParser();
    case 'go':
      return new GoDocParser();
    case 'rb':
      return new RubyDocParser();
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return new TypeScriptDocParser();
    default:
      return null;
  }
}
