/**
 * @fileoverview JSON Schema generation from function signatures
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * Represents a parameter for schema generation
 */
interface SchemaParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: any;
  enumValues?: string[];
}

/**
 * JSON Schema type definitions
 */
interface JsonSchemaProperty {
  type: string | string[];
  description?: string;
  default?: any;
  enum?: any[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  oneOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

/**
 * Generated JSON Schema
 */
interface GeneratedSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  additionalProperties?: boolean;
}

/**
 * Schema Generator - converts function signatures to JSON Schema
 */
export class SchemaGenerator {
  /**
   * Generate JSON Schema from parameters
   */
  generateFromParameters(params: SchemaParameter[]): GeneratedSchema {
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];

    for (const param of params) {
      properties[param.name] = this.parameterToProperty(param);
      if (param.required && param.defaultValue === undefined) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required
    };
  }

  /**
   * Convert a parameter to a JSON Schema property
   */
  private parameterToProperty(param: SchemaParameter): JsonSchemaProperty {
    const property = this.typeToJsonSchema(param.type);
    
    if (param.description) {
      property.description = param.description;
    }
    
    if (param.defaultValue !== undefined) {
      property.default = param.defaultValue;
    }
    
    if (param.enumValues && param.enumValues.length > 0) {
      property.enum = param.enumValues;
    }
    
    return property;
  }

  /**
   * Convert a type string to JSON Schema property
   */
  typeToJsonSchema(typeStr: string): JsonSchemaProperty {
    const normalized = typeStr.trim();
    
    // Handle TypeScript types
    if (this.isTypeScriptType(normalized)) {
      return this.parseTypeScriptType(normalized);
    }
    
    // Handle Python types
    if (this.isPythonType(normalized)) {
      return this.parsePythonType(normalized);
    }
    
    // Handle Go types
    if (this.isGoType(normalized)) {
      return this.parseGoType(normalized);
    }
    
    // Handle Rust types
    if (this.isRustType(normalized)) {
      return this.parseRustType(normalized);
    }
    
    // Default fallback
    return { type: 'string' };
  }

  // ===================== TypeScript Type Parsing =====================

  private isTypeScriptType(type: string): boolean {
    const tsIndicators = ['string', 'number', 'boolean', 'object', 'any', 'unknown', 
                         'Array<', 'Record<', 'Map<', 'Set<', '[]', '|', '&', 
                         'Promise<', 'Partial<', 'Required<', 'Readonly<'];
    return tsIndicators.some(i => type.includes(i)) || /^[A-Z]/.test(type);
  }

  private parseTypeScriptType(type: string): JsonSchemaProperty {
    const normalized = type.trim();
    
    // Primitive types
    if (normalized === 'string') return { type: 'string' };
    if (normalized === 'number') return { type: 'number' };
    if (normalized === 'boolean') return { type: 'boolean' };
    if (normalized === 'null' || normalized === 'undefined') return { type: 'null' };
    if (normalized === 'any' || normalized === 'unknown') return { type: 'string' };
    if (normalized === 'object') return { type: 'object' };
    
    // Array types: string[] or Array<string>
    if (normalized.endsWith('[]')) {
      const itemType = normalized.slice(0, -2);
      return {
        type: 'array',
        items: this.parseTypeScriptType(itemType)
      };
    }
    
    const arrayMatch = normalized.match(/^Array<(.+)>$/);
    if (arrayMatch) {
      return {
        type: 'array',
        items: this.parseTypeScriptType(arrayMatch[1])
      };
    }
    
    // Record<string, T> -> object with additionalProperties
    const recordMatch = normalized.match(/^Record<string,\s*(.+)>$/);
    if (recordMatch) {
      return {
        type: 'object',
        additionalProperties: this.parseTypeScriptType(recordMatch[1])
      };
    }
    
    // Map<K, V> -> object
    if (normalized.startsWith('Map<')) {
      return { type: 'object' };
    }
    
    // Set<T> -> array with unique items
    const setMatch = normalized.match(/^Set<(.+)>$/);
    if (setMatch) {
      return {
        type: 'array',
        items: this.parseTypeScriptType(setMatch[1])
      };
    }
    
    // Union types: string | number
    if (normalized.includes(' | ')) {
      const types = this.splitUnion(normalized);
      
      // Check for nullable: T | null
      const nullableIdx = types.findIndex(t => t === 'null' || t === 'undefined');
      if (nullableIdx !== -1) {
        types.splice(nullableIdx, 1);
        if (types.length === 1) {
          const baseSchema = this.parseTypeScriptType(types[0]);
          baseSchema.type = [baseSchema.type as string, 'null'];
          return baseSchema;
        }
      }
      
      // Multiple non-null types
      return {
        type: 'string', // Fallback
        anyOf: types.map(t => this.parseTypeScriptType(t))
      };
    }
    
    // Literal types: "value" or 'value' or number literals
    if (normalized.startsWith('"') || normalized.startsWith("'")) {
      return {
        type: 'string',
        enum: [normalized.slice(1, -1)]
      };
    }
    if (/^\d+$/.test(normalized)) {
      return {
        type: 'number',
        enum: [parseInt(normalized)]
      };
    }
    
    // Object type with properties: { name: string; age: number }
    if (normalized.startsWith('{') && normalized.endsWith('}')) {
      return this.parseInlineObjectType(normalized);
    }
    
    // Interface/Type reference - treat as object
    return { type: 'object' };
  }

  private splitUnion(type: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    
    for (const char of type) {
      if (char === '<' || char === '(' || char === '[' || char === '{') depth++;
      if (char === '>' || char === ')' || char === ']' || char === '}') depth--;
      if (char === '|' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) parts.push(current.trim());
    
    return parts;
  }

  private parseInlineObjectType(type: string): JsonSchemaProperty {
    const content = type.slice(1, -1).trim();
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];
    
    // Split by ; or ,
    const parts = content.split(/[;,]/).map(p => p.trim()).filter(p => p);
    
    for (const part of parts) {
      const match = part.match(/^(\w+)(\??):\s*(.+)$/);
      if (match) {
        const [, name, optional, propType] = match;
        properties[name] = this.parseTypeScriptType(propType.trim());
        if (!optional) {
          required.push(name);
        }
      }
    }
    
    return {
      type: 'object',
      properties,
      required
    };
  }

  // ===================== Python Type Parsing =====================

  private isPythonType(type: string): boolean {
    const pyIndicators = ['str', 'int', 'float', 'bool', 'None', 'List[', 'Dict[', 
                         'Optional[', 'Union[', 'Tuple[', 'Set[', 'Any', 'Callable'];
    return pyIndicators.some(i => type.includes(i));
  }

  private parsePythonType(type: string): JsonSchemaProperty {
    const normalized = type.trim();
    
    // Primitive types
    if (normalized === 'str') return { type: 'string' };
    if (normalized === 'int') return { type: 'integer' };
    if (normalized === 'float') return { type: 'number' };
    if (normalized === 'bool') return { type: 'boolean' };
    if (normalized === 'None') return { type: 'null' };
    if (normalized === 'Any') return { type: 'string' };
    
    // Optional[T] -> nullable T
    const optionalMatch = normalized.match(/^Optional\[(.+)\]$/);
    if (optionalMatch) {
      const baseSchema = this.parsePythonType(optionalMatch[1]);
      baseSchema.type = [baseSchema.type as string, 'null'];
      return baseSchema;
    }
    
    // List[T] -> array
    const listMatch = normalized.match(/^(?:List|list)\[(.+)\]$/);
    if (listMatch) {
      return {
        type: 'array',
        items: this.parsePythonType(listMatch[1])
      };
    }
    
    // Dict[K, V] -> object
    const dictMatch = normalized.match(/^(?:Dict|dict)\[(?:str),\s*(.+)\]$/);
    if (dictMatch) {
      return {
        type: 'object',
        additionalProperties: this.parsePythonType(dictMatch[1])
      };
    }
    
    // Set[T] -> array
    const setMatch = normalized.match(/^(?:Set|set)\[(.+)\]$/);
    if (setMatch) {
      return {
        type: 'array',
        items: this.parsePythonType(setMatch[1])
      };
    }
    
    // Tuple[T, ...] -> array
    if (normalized.startsWith('Tuple[') || normalized.startsWith('tuple[')) {
      return { type: 'array' };
    }
    
    // Union[T1, T2] -> anyOf
    const unionMatch = normalized.match(/^Union\[(.+)\]$/);
    if (unionMatch) {
      const types = this.splitGenericArgs(unionMatch[1]);
      
      // Check for Optional pattern: Union[T, None]
      const noneIdx = types.findIndex(t => t === 'None');
      if (noneIdx !== -1 && types.length === 2) {
        types.splice(noneIdx, 1);
        const baseSchema = this.parsePythonType(types[0]);
        baseSchema.type = [baseSchema.type as string, 'null'];
        return baseSchema;
      }
      
      return {
        type: 'string',
        anyOf: types.map(t => this.parsePythonType(t))
      };
    }
    
    // Literal['a', 'b'] -> enum
    const literalMatch = normalized.match(/^Literal\[(.+)\]$/);
    if (literalMatch) {
      const values = literalMatch[1]
        .split(',')
        .map(v => v.trim())
        .map(v => v.startsWith("'") || v.startsWith('"') ? v.slice(1, -1) : v);
      return {
        type: 'string',
        enum: values
      };
    }
    
    // Class/TypedDict reference -> object
    return { type: 'object' };
  }

  private splitGenericArgs(argsStr: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let current = '';
    
    for (const char of argsStr) {
      if (char === '[') depth++;
      if (char === ']') depth--;
      if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) args.push(current.trim());
    
    return args;
  }

  // ===================== Go Type Parsing =====================

  private isGoType(type: string): boolean {
    const goIndicators = ['string', 'int', 'int32', 'int64', 'float32', 'float64',
                         'bool', 'byte', 'rune', 'error', 'interface{}', 
                         '[]', 'map[', '*'];
    return goIndicators.some(i => type.includes(i));
  }

  private parseGoType(type: string): JsonSchemaProperty {
    const normalized = type.trim();
    
    // Pointer types: *T -> T (nullable in schema)
    if (normalized.startsWith('*')) {
      return this.parseGoType(normalized.slice(1));
    }
    
    // Primitives
    if (normalized === 'string') return { type: 'string' };
    if (normalized.match(/^u?int\d*$/) || normalized === 'byte' || normalized === 'rune') {
      return { type: 'integer' };
    }
    if (normalized.match(/^float\d+$/)) return { type: 'number' };
    if (normalized === 'bool') return { type: 'boolean' };
    
    // Slice: []T
    if (normalized.startsWith('[]')) {
      return {
        type: 'array',
        items: this.parseGoType(normalized.slice(2))
      };
    }
    
    // Variadic: ...T -> array
    if (normalized.startsWith('...')) {
      return {
        type: 'array',
        items: this.parseGoType(normalized.slice(3))
      };
    }
    
    // Map: map[K]V
    const mapMatch = normalized.match(/^map\[(\w+)\](.+)$/);
    if (mapMatch) {
      return {
        type: 'object',
        additionalProperties: this.parseGoType(mapMatch[2])
      };
    }
    
    // interface{} or any -> any type
    if (normalized === 'interface{}' || normalized === 'any') {
      return { type: 'string' };
    }
    
    // Struct reference -> object
    return { type: 'object' };
  }

  // ===================== Rust Type Parsing =====================

  private isRustType(type: string): boolean {
    const rustIndicators = ['String', '&str', 'i32', 'i64', 'u32', 'u64', 'f32', 'f64',
                           'bool', 'Vec<', 'HashMap<', 'Option<', 'Result<', 
                           'Box<', '&', '\''];
    return rustIndicators.some(i => type.includes(i));
  }

  private parseRustType(type: string): JsonSchemaProperty {
    const normalized = type.trim();
    
    // References: &T, &mut T -> T
    if (normalized.startsWith('&')) {
      const inner = normalized.replace(/^&(?:mut\s+)?/, '');
      return this.parseRustType(inner);
    }
    
    // Primitives
    if (normalized === 'String' || normalized === '&str') return { type: 'string' };
    if (normalized.match(/^[iu]\d+$/) || normalized === 'usize' || normalized === 'isize') {
      return { type: 'integer' };
    }
    if (normalized.match(/^f\d+$/)) return { type: 'number' };
    if (normalized === 'bool') return { type: 'boolean' };
    if (normalized === '()') return { type: 'null' };
    
    // Option<T> -> nullable T
    const optionMatch = normalized.match(/^Option<(.+)>$/);
    if (optionMatch) {
      const baseSchema = this.parseRustType(optionMatch[1]);
      baseSchema.type = [baseSchema.type as string, 'null'];
      return baseSchema;
    }
    
    // Vec<T> -> array
    const vecMatch = normalized.match(/^Vec<(.+)>$/);
    if (vecMatch) {
      return {
        type: 'array',
        items: this.parseRustType(vecMatch[1])
      };
    }
    
    // HashMap<K, V> -> object
    const hashMapMatch = normalized.match(/^(?:HashMap|BTreeMap)<String,\s*(.+)>$/);
    if (hashMapMatch) {
      return {
        type: 'object',
        additionalProperties: this.parseRustType(hashMapMatch[1])
      };
    }
    
    // Result<T, E> -> T (ignore error type for schema)
    const resultMatch = normalized.match(/^Result<(.+?),/);
    if (resultMatch) {
      return this.parseRustType(resultMatch[1]);
    }
    
    // Box<T>, Rc<T>, Arc<T> -> T
    const boxMatch = normalized.match(/^(?:Box|Rc|Arc)<(.+)>$/);
    if (boxMatch) {
      return this.parseRustType(boxMatch[1]);
    }
    
    // Struct reference -> object
    return { type: 'object' };
  }

  // ===================== Struct/Interface Parsing =====================

  /**
   * Parse TypeScript interface/type definition to JSON Schema
   */
  parseTypeScriptInterface(code: string): GeneratedSchema | null {
    const interfaceMatch = code.match(/(?:interface|type)\s+\w+\s*(?:=\s*)?\{([\s\S]+)\}/);
    if (!interfaceMatch) return null;
    
    const body = interfaceMatch[1];
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];
    
    // Match property definitions
    const propPattern = /(\w+)(\??):\s*([^;]+);?/g;
    let match;
    
    while ((match = propPattern.exec(body)) !== null) {
      const [, name, optional, type] = match;
      properties[name] = this.parseTypeScriptType(type.trim());
      if (!optional) {
        required.push(name);
      }
    }
    
    return { type: 'object', properties, required };
  }

  /**
   * Parse Python TypedDict or dataclass to JSON Schema
   */
  parsePythonClass(code: string): GeneratedSchema | null {
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];
    
    // Match field definitions: name: Type or name: Type = default
    const fieldPattern = /(\w+):\s*([^=\n]+)(?:\s*=\s*([^\n]+))?/g;
    let match;
    
    while ((match = fieldPattern.exec(code)) !== null) {
      const [, name, type, defaultVal] = match;
      if (name === 'class' || name === 'def') continue;
      
      properties[name] = this.parsePythonType(type.trim());
      if (!defaultVal && !type.includes('Optional')) {
        required.push(name);
      }
    }
    
    if (Object.keys(properties).length === 0) return null;
    
    return { type: 'object', properties, required };
  }

  /**
   * Parse Go struct to JSON Schema
   */
  parseGoStruct(code: string): GeneratedSchema | null {
    const structMatch = code.match(/type\s+\w+\s+struct\s*\{([\s\S]+?)\}/);
    if (!structMatch) return null;
    
    const body = structMatch[1];
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];
    
    // Match field definitions: Name Type `json:"name"`
    const fieldPattern = /(\w+)\s+([^\s`]+)(?:\s+`json:"([^"]+)"`)?/g;
    let match;
    
    while ((match = fieldPattern.exec(body)) !== null) {
      const [, fieldName, type, jsonTag] = match;
      const name = jsonTag?.split(',')[0] || this.camelToSnake(fieldName);
      const isOptional = jsonTag?.includes('omitempty');
      
      properties[name] = this.parseGoType(type.trim());
      if (!isOptional && !type.startsWith('*')) {
        required.push(name);
      }
    }
    
    if (Object.keys(properties).length === 0) return null;
    
    return { type: 'object', properties, required };
  }

  /**
   * Parse Rust struct to JSON Schema
   */
  parseRustStruct(code: string): GeneratedSchema | null {
    const structMatch = code.match(/struct\s+\w+\s*\{([\s\S]+?)\}/);
    if (!structMatch) return null;
    
    const body = structMatch[1];
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];
    
    // Match field definitions: name: Type,
    const fieldPattern = /(\w+):\s*([^,\n]+)/g;
    let match;
    
    while ((match = fieldPattern.exec(body)) !== null) {
      const [, name, type] = match;
      properties[name] = this.parseRustType(type.trim());
      if (!type.includes('Option<')) {
        required.push(name);
      }
    }
    
    if (Object.keys(properties).length === 0) return null;
    
    return { type: 'object', properties, required };
  }

  private camelToSnake(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}
