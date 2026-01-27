/**
 * Playground Store - Shared state management for playground integration
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import { createContext, useContext, useCallback, useReducer, useEffect, ReactNode } from 'react';
import type { Tool, ConversionResult } from '@/types';
import { safeJsonParse } from '@/lib/utils';

// ===== Types =====

export interface PlaygroundState {
  /** Generated TypeScript MCP server code */
  generatedCode: string | null;
  /** Generated Python MCP server code */
  generatedPythonCode: string | null;
  /** Extracted tools from conversion */
  tools: Tool[];
  /** Repository name */
  repoName: string | null;
  /** Repository URL */
  repoUrl: string | null;
  /** Session ID for server connection */
  sessionId: string | null;
  /** Last conversion timestamp */
  lastConversion: Date | null;
  /** Full conversion result for reference */
  conversionResult: ConversionResult | null;
  /** Error state */
  error: PlaygroundError | null;
  /** Loading state */
  isLoading: boolean;
}

export interface PlaygroundError {
  type: 'syntax' | 'server' | 'execution' | 'network' | 'unknown';
  message: string;
  details?: string;
  recoverable: boolean;
  retryCount?: number;
}

// API interfaces for tool execution
export interface ExecuteToolRequest {
  generatedCode: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  sessionId?: string;
}

export interface ExecuteToolResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  sessionId: string;
  executionTime: number;
  logs?: string[];
}

type PlaygroundAction =
  | { type: 'SET_CONVERSION_RESULT'; payload: ConversionResult }
  | { type: 'SET_CODE'; payload: { typescript: string; python?: string } }
  | { type: 'SET_TOOLS'; payload: Tool[] }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_ERROR'; payload: PlaygroundError | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_STATE' }
  | { type: 'LOAD_FROM_STORAGE'; payload: Partial<PlaygroundState> }
  | { type: 'INCREMENT_RETRY' };

interface PlaygroundContextValue {
  state: PlaygroundState;
  dispatch: React.Dispatch<PlaygroundAction>;
  
  // Convenience methods
  setConversionResult: (result: ConversionResult) => void;
  setCode: (typescript: string, python?: string) => void;
  setError: (error: PlaygroundError | null) => void;
  clearState: () => void;
  
  // URL helpers
  generateShareableLink: () => string;
  loadFromUrl: (params: URLSearchParams) => Promise<void>;
  
  // Gist helpers
  loadFromGist: (gistId: string) => Promise<void>;
}

// ===== Initial State =====

const initialState: PlaygroundState = {
  generatedCode: null,
  generatedPythonCode: null,
  tools: [],
  repoName: null,
  repoUrl: null,
  sessionId: null,
  lastConversion: null,
  conversionResult: null,
  error: null,
  isLoading: false,
};

// ===== Storage Keys =====

const STORAGE_KEY = 'playground-state';
const SESSION_KEY = 'playground-session';

// ===== Reducer =====

function playgroundReducer(state: PlaygroundState, action: PlaygroundAction): PlaygroundState {
  switch (action.type) {
    case 'SET_CONVERSION_RESULT': {
      const result = action.payload;
      return {
        ...state,
        generatedCode: result.code,
        generatedPythonCode: result.pythonCode || null,
        tools: result.tools,
        repoName: result.name,
        repoUrl: result.repository?.url || null,
        lastConversion: new Date(),
        conversionResult: result,
        error: null,
      };
    }
    
    case 'SET_CODE':
      return {
        ...state,
        generatedCode: action.payload.typescript,
        generatedPythonCode: action.payload.python || null,
      };
    
    case 'SET_TOOLS':
      return {
        ...state,
        tools: action.payload,
      };
    
    case 'SET_SESSION_ID':
      return {
        ...state,
        sessionId: action.payload,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'CLEAR_STATE':
      return {
        ...initialState,
      };
    
    case 'LOAD_FROM_STORAGE':
      return {
        ...state,
        ...action.payload,
      };
    
    case 'INCREMENT_RETRY':
      return {
        ...state,
        error: state.error
          ? { ...state.error, retryCount: (state.error.retryCount || 0) + 1 }
          : null,
      };
    
    default:
      return state;
  }
}

// ===== Context =====

const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

// ===== Provider =====

interface PlaygroundProviderProps {
  children: ReactNode;
}

export function PlaygroundProvider({ children }: PlaygroundProviderProps) {
  const [state, dispatch] = useReducer(playgroundReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = safeJsonParse<Partial<PlaygroundState>>(stored, {});
        if (parsed.lastConversion) {
          parsed.lastConversion = new Date(parsed.lastConversion);
        }
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: parsed });
      }
    } catch (error) {
      console.warn('Failed to load playground state from storage:', error);
    }
  }, []);

  // Persist to localStorage on state change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!state.generatedCode && !state.tools.length) return;

    try {
      const toStore = {
        generatedCode: state.generatedCode,
        generatedPythonCode: state.generatedPythonCode,
        tools: state.tools,
        repoName: state.repoName,
        repoUrl: state.repoUrl,
        lastConversion: state.lastConversion?.toISOString(),
        conversionResult: state.conversionResult,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.warn('Failed to persist playground state:', error);
    }
  }, [state.generatedCode, state.generatedPythonCode, state.tools, state.repoName, state.repoUrl, state.lastConversion, state.conversionResult]);

  // Convenience methods
  const setConversionResult = useCallback((result: ConversionResult) => {
    dispatch({ type: 'SET_CONVERSION_RESULT', payload: result });
  }, []);

  const setCode = useCallback((typescript: string, python?: string) => {
    dispatch({ type: 'SET_CODE', payload: { typescript, python } });
  }, []);

  const setError = useCallback((error: PlaygroundError | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearState = useCallback(() => {
    dispatch({ type: 'CLEAR_STATE' });
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // Generate a shareable link with base64-encoded code
  const generateShareableLink = useCallback(() => {
    if (typeof window === 'undefined' || !state.generatedCode) {
      return '';
    }

    const baseUrl = window.location.origin;
    
    // For large code, we truncate and suggest using gist
    if (state.generatedCode.length > 10000) {
      console.warn('Code too large for URL encoding. Consider using a Gist.');
    }

    try {
      const encoded = btoa(encodeURIComponent(state.generatedCode));
      const params = new URLSearchParams();
      params.set('code', encoded);
      
      if (state.repoName) {
        params.set('name', state.repoName);
      }
      
      return `${baseUrl}/playground?${params.toString()}`;
    } catch (error) {
      console.error('Failed to generate shareable link:', error);
      return '';
    }
  }, [state.generatedCode, state.repoName]);

  // Load code from URL parameters
  const loadFromUrl = useCallback(async (params: URLSearchParams) => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Check for base64-encoded code
      const encodedCode = params.get('code');
      if (encodedCode) {
        // Validate base64 encoding
        if (!isValidBase64(encodedCode)) {
          dispatch({
            type: 'SET_ERROR',
            payload: {
              type: 'syntax',
              message: 'Invalid code parameter',
              details: 'The code parameter is not valid base64 encoding',
              recoverable: false,
            },
          });
          return;
        }

        try {
          const decoded = decodeURIComponent(atob(encodedCode));
          
          // Validate the decoded content looks like code
          if (!decoded.trim() || decoded.length < 10) {
            dispatch({
              type: 'SET_ERROR',
              payload: {
                type: 'syntax',
                message: 'Invalid code content',
                details: 'The shared code appears to be empty or too short',
                recoverable: false,
              },
            });
            return;
          }

          const name = params.get('name') || 'Shared Code';
          
          dispatch({
            type: 'SET_CODE',
            payload: { typescript: decoded },
          });
          
          // Try to extract tools from the code
          const extractedTools = extractToolsFromCode(decoded);
          if (extractedTools.length > 0) {
            dispatch({ type: 'SET_TOOLS', payload: extractedTools });
          }
          
          dispatch({ type: 'SET_LOADING', payload: false });
          return;
        } catch (decodeError) {
          dispatch({
            type: 'SET_ERROR',
            payload: {
              type: 'syntax',
              message: 'Failed to decode shared code',
              details: decodeError instanceof Error ? decodeError.message : 'Invalid encoding',
              recoverable: false,
            },
          });
          return;
        }
      }

      // Check for Gist ID
      const gistId = params.get('gist');
      if (gistId) {
        // Validate Gist ID format (alphanumeric, 20-32 chars typically)
        if (!isValidGistId(gistId)) {
          dispatch({
            type: 'SET_ERROR',
            payload: {
              type: 'syntax',
              message: 'Invalid Gist ID',
              details: 'The Gist ID format is invalid. It should be alphanumeric.',
              recoverable: false,
            },
          });
          return;
        }
        
        await loadFromGistInternal(gistId, dispatch);
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({
        type: 'SET_ERROR',
        payload: {
          type: 'network',
          message: 'Failed to load code from URL',
          details: errorMessage,
          recoverable: true,
        },
      });
    }
  }, []);

  // Load code from GitHub Gist
  const loadFromGist = useCallback(async (gistId: string) => {
    // Validate Gist ID before making API call
    if (!isValidGistId(gistId)) {
      dispatch({
        type: 'SET_ERROR',
        payload: {
          type: 'syntax',
          message: 'Invalid Gist ID',
          details: 'The Gist ID format is invalid. It should be alphanumeric.',
          recoverable: false,
        },
      });
      return;
    }
    await loadFromGistInternal(gistId, dispatch);
  }, []);

  const value: PlaygroundContextValue = {
    state,
    dispatch,
    setConversionResult,
    setCode,
    setError,
    clearState,
    generateShareableLink,
    loadFromUrl,
    loadFromGist,
  };

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
    </PlaygroundContext.Provider>
  );
}

// ===== Hook =====

export function usePlaygroundStore(): PlaygroundContextValue {
  const context = useContext(PlaygroundContext);
  if (!context) {
    throw new Error('usePlaygroundStore must be used within a PlaygroundProvider');
  }
  return context;
}

// ===== Validation Helpers =====

/**
 * Validate base64 encoding
 */
function isValidBase64(str: string): boolean {
  if (!str || str.length === 0) return false;
  
  // Check for valid base64 characters
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(str)) return false;
  
  // Try to decode to verify
  try {
    atob(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate GitHub Gist ID format
 * Gist IDs are alphanumeric strings, typically 20-32 characters
 */
function isValidGistId(gistId: string): boolean {
  if (!gistId || typeof gistId !== 'string') return false;
  
  // Gist IDs are alphanumeric, typically 20-32 chars (but can vary)
  // They don't contain special characters
  const gistIdRegex = /^[a-f0-9]{20,40}$/i;
  return gistIdRegex.test(gistId);
}

/**
 * Validate GitHub URL format
 */
export function isValidGitHubUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const isGithub = parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com';
    if (!isGithub) return false;
    
    // Check for owner/repo pattern
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    return pathParts.length >= 2;
  } catch {
    return false;
  }
}

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  if (!isValidGitHubUrl(url)) return null;
  
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      return {
        owner: pathParts[0],
        repo: pathParts[1].replace(/\.git$/, ''),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

// ===== Helper Functions =====

async function loadFromGistInternal(
  gistId: string,
  dispatch: React.Dispatch<PlaygroundAction>
): Promise<void> {
  dispatch({ type: 'SET_LOADING', payload: true });

  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Gist not found. It may have been deleted or is private.');
      }
      if (response.status === 403) {
        throw new Error('Rate limited by GitHub API. Please try again in a few minutes.');
      }
      throw new Error(`Failed to fetch Gist: ${response.status} ${response.statusText}`);
    }

    const gist = await response.json();
    const files = Object.values(gist.files) as Array<{
      filename: string;
      content: string;
      language?: string;
    }>;

    // Look for TypeScript or Python files
    const tsFile = files.find(f => f.filename.endsWith('.ts') || f.language === 'TypeScript');
    const pyFile = files.find(f => f.filename.endsWith('.py') || f.language === 'Python');

    if (!tsFile && !pyFile) {
      throw new Error('No TypeScript or Python file found in Gist. Please share a Gist containing a .ts or .py file.');
    }

    dispatch({
      type: 'SET_CODE',
      payload: {
        typescript: tsFile?.content || '',
        python: pyFile?.content,
      },
    });

    // Try to extract tools from the code
    const code = tsFile?.content || pyFile?.content || '';
    const extractedTools = extractToolsFromCode(code);
    if (extractedTools.length > 0) {
      dispatch({ type: 'SET_TOOLS', payload: extractedTools });
    }

    dispatch({ type: 'SET_LOADING', payload: false });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dispatch({
      type: 'SET_ERROR',
      payload: {
        type: 'network',
        message: 'Failed to load Gist',
        details: errorMessage,
        recoverable: true,
      },
    });
  }
}

/**
 * Extract tool definitions from MCP server code.
 * Supports multiple patterns for both TypeScript and Python MCP servers.
 */
function extractToolsFromCode(code: string): Tool[] {
  const tools: Tool[] = [];
  const seenNames = new Set<string>();

  // Extract TypeScript tools
  extractTypeScriptTools(code, tools, seenNames);
  
  // Extract Python tools
  extractPythonTools(code, tools, seenNames);

  return tools;
}

/**
 * Extract TypeScript MCP tool definitions
 */
function extractTypeScriptTools(code: string, tools: Tool[], seenNames: Set<string>): void {
  // Pattern 1: server.tool("name", "description", schema, handler)
  const pattern1 = /server\.tool\(\s*(['"`])(\w+)\1\s*,\s*(['"`])([\s\S]*?)\3\s*,\s*(\{[\s\S]*?\})\s*,/g;
  
  // Pattern 2: server.tool({ name: "...", description: "...", inputSchema: {...} })
  const pattern2 = /server\.tool\(\s*\{[\s\S]*?name\s*:\s*(['"`])(\w+)\1[\s\S]*?description\s*:\s*(['"`])([\s\S]*?)\3[\s\S]*?inputSchema\s*:\s*(\{[\s\S]*?\})\s*[\s\S]*?\}\s*\)/g;
  
  // Pattern 3: .tool("name", { description, inputSchema })
  const pattern3 = /\.tool\(\s*(['"`])(\w+)\1\s*,\s*\{[\s\S]*?description\s*:\s*(['"`])([\s\S]*?)\3/g;

  let match;

  // Process Pattern 1
  while ((match = pattern1.exec(code)) !== null) {
    const [, , name, , description, schemaStr] = match;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    
    tools.push({
      name,
      description: cleanDescription(description),
      inputSchema: parseSchemaString(schemaStr),
      source: { type: 'code', file: 'loaded' },
    });
  }

  // Process Pattern 2
  while ((match = pattern2.exec(code)) !== null) {
    const [, , name, , description, schemaStr] = match;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    
    tools.push({
      name,
      description: cleanDescription(description),
      inputSchema: parseSchemaString(schemaStr),
      source: { type: 'code', file: 'loaded' },
    });
  }

  // Process Pattern 3 (partial - no schema)
  while ((match = pattern3.exec(code)) !== null) {
    const [, , name, , description] = match;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    
    tools.push({
      name,
      description: cleanDescription(description),
      inputSchema: { type: 'object', properties: {}, required: [] },
      source: { type: 'code', file: 'loaded' },
    });
  }

  // Pattern 4: Look for z.object schemas with tool names nearby
  const zodPattern = /const\s+(\w+)Schema\s*=\s*z\.object\(\s*(\{[\s\S]*?\})\s*\)/g;
  const zodSchemas = new Map<string, string>();
  
  while ((match = zodPattern.exec(code)) !== null) {
    const [, schemaName, schemaBody] = match;
    zodSchemas.set(schemaName.toLowerCase(), schemaBody);
  }

  // Try to match Zod schemas to tools that don't have schemas yet
  for (const tool of tools) {
    if (Object.keys(tool.inputSchema.properties || {}).length === 0) {
      const schemaBody = zodSchemas.get(tool.name.toLowerCase()) || 
                         zodSchemas.get(tool.name.replace(/_/g, '').toLowerCase());
      if (schemaBody) {
        tool.inputSchema = parseZodSchema(schemaBody);
      }
    }
  }
}

/**
 * Extract Python MCP tool definitions
 */
function extractPythonTools(code: string, tools: Tool[], seenNames: Set<string>): void {
  // Pattern 1: @server.tool() or @mcp.tool() decorator
  const decoratorPattern = /@(?:server|mcp)\.tool\s*\(\s*\)\s*\n\s*(?:async\s+)?def\s+(\w+)\s*\(([\s\S]*?)\)\s*(?:->[\s\S]*?)?:\s*\n\s*(?:['"`]{3}([\s\S]*?)['"`]{3}|['"`]([\s\S]*?)['"`])?/g;
  
  // Pattern 2: @tool decorator (from mcp.server.tool)
  const toolDecoratorPattern = /@tool\s*\(\s*(?:name\s*=\s*)?(['"`])?(\w+)\1?\s*(?:,\s*description\s*=\s*(['"`])([\s\S]*?)\3)?\s*\)\s*\n\s*(?:async\s+)?def\s+(\w+)/g;

  // Pattern 3: server.add_tool or mcp.add_tool
  const addToolPattern = /(?:server|mcp)\.add_tool\(\s*['"`](\w+)['"`]\s*,\s*(?:description\s*=\s*)?['"`]([\s\S]*?)['"`]/g;

  let match;

  // Process Pattern 1 (decorator with docstring)
  while ((match = decoratorPattern.exec(code)) !== null) {
    const [, funcName, params, tripleQuoteDoc, singleQuoteDoc] = match;
    if (seenNames.has(funcName)) continue;
    seenNames.add(funcName);
    
    const description = tripleQuoteDoc || singleQuoteDoc || `Tool: ${funcName}`;
    
    tools.push({
      name: funcName,
      description: cleanDescription(description),
      inputSchema: parsePythonParams(params),
      source: { type: 'python-mcp', file: 'loaded' },
    });
  }

  // Process Pattern 2 (tool decorator with name)
  while ((match = toolDecoratorPattern.exec(code)) !== null) {
    const [, , decoratorName, , description, funcName] = match;
    const name = decoratorName || funcName;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    
    tools.push({
      name,
      description: cleanDescription(description || `Tool: ${name}`),
      inputSchema: { type: 'object', properties: {}, required: [] },
      source: { type: 'python-mcp', file: 'loaded' },
    });
  }

  // Process Pattern 3 (add_tool)
  while ((match = addToolPattern.exec(code)) !== null) {
    const [, name, description] = match;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    
    tools.push({
      name,
      description: cleanDescription(description),
      inputSchema: { type: 'object', properties: {}, required: [] },
      source: { type: 'python-mcp', file: 'loaded' },
    });
  }

  // Pattern 4: Look for Pydantic models that might be tool inputs
  const pydanticPattern = /class\s+(\w+)(?:Input|Params|Args|Request)\s*\((?:BaseModel|TypedDict)\):\s*([\s\S]*?)(?=\n(?:class|def|@|\Z))/g;
  const pydanticModels = new Map<string, string>();
  
  while ((match = pydanticPattern.exec(code)) !== null) {
    const [, modelName, modelBody] = match;
    pydanticModels.set(modelName.toLowerCase().replace(/input|params|args|request/i, ''), modelBody);
  }

  // Try to match Pydantic models to tools
  for (const tool of tools) {
    if (Object.keys(tool.inputSchema.properties || {}).length === 0) {
      const modelBody = pydanticModels.get(tool.name.toLowerCase()) ||
                       pydanticModels.get(tool.name.replace(/_/g, '').toLowerCase());
      if (modelBody) {
        tool.inputSchema = parsePydanticModel(modelBody);
      }
    }
  }
}

/**
 * Clean and normalize description text
 */
function cleanDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .trim()
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^['"`]+|['"`]+$/g, '')
    .trim();
}

/**
 * Parse a JSON-like schema string into an inputSchema object
 */
function parseSchemaString(schemaStr: string): Tool['inputSchema'] {
  const schema: Tool['inputSchema'] = {
    type: 'object',
    properties: {},
    required: [],
  };

  try {
    // Try direct JSON parse first (for well-formed schemas)
    const parsed = JSON.parse(schemaStr);
    if (parsed.properties) {
      schema.properties = parsed.properties;
    }
    if (parsed.required) {
      schema.required = parsed.required;
    }
    return schema;
  } catch {
    // Fall back to regex-based extraction
  }

  // Extract properties using regex
  const propsMatch = schemaStr.match(/properties\s*:\s*\{([\s\S]*?)\}(?=\s*,?\s*(?:required|additionalProperties|\}))/);
  if (propsMatch) {
    const propsStr = propsMatch[1];
    
    // Match individual property definitions
    const propPattern = /(\w+)\s*:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let propMatch;
    
    while ((propMatch = propPattern.exec(propsStr)) !== null) {
      const [, propName, propDef] = propMatch;
      const prop: { type: string; description?: string; enum?: string[]; default?: unknown } = {
        type: 'string' // default type
      };
      
      // Extract type
      const typeMatch = propDef.match(/type\s*:\s*['"`]?(\w+)['"`]?/);
      if (typeMatch) {
        prop.type = typeMatch[1];
      }
      
      // Extract description
      const descMatch = propDef.match(/description\s*:\s*(['"`])([\s\S]*?)\1/);
      if (descMatch) {
        prop.description = descMatch[2];
      }
      
      // Extract enum values
      const enumMatch = propDef.match(/enum\s*:\s*\[([\s\S]*?)\]/);
      if (enumMatch) {
        const enumValues = enumMatch[1].match(/['"`]([^'"`]+)['"`]/g);
        if (enumValues) {
          prop.enum = enumValues.map(v => v.replace(/['"`]/g, ''));
        }
      }
      
      // Extract default value
      const defaultMatch = propDef.match(/default\s*:\s*(['"`]?)([^,}\s]+)\1/);
      if (defaultMatch) {
        const val = defaultMatch[2];
        prop.default = val === 'true' ? true : val === 'false' ? false : isNaN(Number(val)) ? val : Number(val);
      }
      
      schema.properties![propName] = prop;
    }
  }

  // Extract required array
  const requiredMatch = schemaStr.match(/required\s*:\s*\[([\s\S]*?)\]/);
  if (requiredMatch) {
    const requiredItems = requiredMatch[1].match(/['"`](\w+)['"`]/g);
    if (requiredItems) {
      schema.required = requiredItems.map(r => r.replace(/['"`]/g, ''));
    }
  }

  return schema;
}

/**
 * Parse Zod schema definition to extract properties
 */
function parseZodSchema(schemaBody: string): Tool['inputSchema'] {
  const schema: Tool['inputSchema'] = {
    type: 'object',
    properties: {},
    required: [],
  };

  // Match Zod property definitions
  const propPattern = /(\w+)\s*:\s*z\.(string|number|boolean|array|object|enum)\s*\(\s*(?:\[([\s\S]*?)\])?\s*\)(?:\.describe\(\s*(['"`])([\s\S]*?)\4\s*\))?(?:\.optional\(\))?(?:\.default\(([^)]+)\))?/g;
  let match;

  while ((match = propPattern.exec(schemaBody)) !== null) {
    const [fullMatch, propName, zodType, enumValues, , description, defaultValue] = match;
    
    const prop: { type: string; description?: string; enum?: string[]; default?: unknown } = {
      type: zodType === 'array' ? 'array' : zodType === 'enum' ? 'string' : zodType,
    };
    
    if (description) {
      prop.description = description;
    }
    
    if (enumValues) {
      const values = enumValues.match(/['"`]([^'"`]+)['"`]/g);
      if (values) {
        prop.enum = values.map(v => v.replace(/['"`]/g, ''));
      }
    }
    
    if (defaultValue !== undefined) {
      const val = defaultValue.trim();
      prop.default = val === 'true' ? true : val === 'false' ? false : isNaN(Number(val)) ? val.replace(/['"`]/g, '') : Number(val);
    }
    
    schema.properties![propName] = prop;
    
    // If not optional, add to required
    if (!fullMatch.includes('.optional()')) {
      schema.required!.push(propName);
    }
  }

  return schema;
}

/**
 * Parse Python function parameters to extract schema
 */
function parsePythonParams(params: string): Tool['inputSchema'] {
  const schema: Tool['inputSchema'] = {
    type: 'object',
    properties: {},
    required: [],
  };

  if (!params || params.trim() === '' || params.trim() === 'self') {
    return schema;
  }

  // Split parameters, handling nested types
  const paramList = splitPythonParams(params);

  for (const param of paramList) {
    const trimmed = param.trim();
    if (!trimmed || trimmed === 'self' || trimmed === 'cls' || trimmed.startsWith('*')) {
      continue;
    }

    // Match: name: Type = default or name: Type or name = default or just name
    const paramMatch = trimmed.match(/^(\w+)\s*(?::\s*([\w\[\],\s|]+))?\s*(?:=\s*(.+))?$/);
    if (!paramMatch) continue;

    const [, paramName, typeHint, defaultValue] = paramMatch;
    
    const prop: { type: string; description?: string; enum?: string[]; default?: unknown } = {
      type: 'string' // Default type
    };
    
    // Convert Python type hints to JSON Schema types
    if (typeHint) {
      prop.type = pythonTypeToJsonType(typeHint.trim());
    }
    
    if (defaultValue !== undefined && defaultValue.trim() !== 'None') {
      const val = defaultValue.trim();
      if (val === 'True') {
        prop.default = true;
      } else if (val === 'False') {
        prop.default = false;
      } else if (!isNaN(Number(val))) {
        prop.default = Number(val);
      } else {
        prop.default = val.replace(/^['"`]|['"`]$/g, '');
      }
    }
    
    schema.properties![paramName] = prop;
    
    // If no default value (and not None), it's required
    if (defaultValue === undefined) {
      schema.required!.push(paramName);
    }
  }

  return schema;
}

/**
 * Split Python parameters handling nested brackets
 */
function splitPythonParams(params: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of params) {
    if (char === '[' || char === '(') {
      depth++;
      current += char;
    } else if (char === ']' || char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    result.push(current);
  }
  
  return result;
}

/**
 * Convert Python type hint to JSON Schema type
 */
function pythonTypeToJsonType(typeHint: string): string {
  const normalized = typeHint.toLowerCase().replace(/\s/g, '');
  
  if (normalized.includes('str')) return 'string';
  if (normalized.includes('int')) return 'integer';
  if (normalized.includes('float')) return 'number';
  if (normalized.includes('bool')) return 'boolean';
  if (normalized.includes('list') || normalized.includes('array')) return 'array';
  if (normalized.includes('dict') || normalized.includes('object')) return 'object';
  if (normalized.includes('none') || normalized.includes('null')) return 'null';
  
  return 'string'; // Default fallback
}

/**
 * Parse Pydantic model body to extract properties
 */
function parsePydanticModel(modelBody: string): Tool['inputSchema'] {
  const schema: Tool['inputSchema'] = {
    type: 'object',
    properties: {},
    required: [],
  };

  // Match Pydantic field definitions
  // Pattern: field_name: Type = Field(...) or field_name: Type = default
  const fieldPattern = /(\w+)\s*:\s*([\w\[\],\s|]+)\s*(?:=\s*(?:Field\(([\s\S]*?)\)|([^#\n]+)))?/g;
  let match;

  while ((match = fieldPattern.exec(modelBody)) !== null) {
    const [, fieldName, typeHint, fieldArgs, defaultValue] = match;
    
    // Skip private fields
    if (fieldName.startsWith('_')) continue;
    
    const prop: { type: string; description?: string; enum?: string[]; default?: unknown } = {
      type: pythonTypeToJsonType(typeHint.trim()),
    };
    
    // Parse Field() arguments
    if (fieldArgs) {
      const descMatch = fieldArgs.match(/description\s*=\s*(['"`])([\s\S]*?)\1/);
      if (descMatch) {
        prop.description = descMatch[2];
      }
      
      const defaultMatch = fieldArgs.match(/default\s*=\s*([^,)]+)/);
      if (defaultMatch) {
        const val = defaultMatch[1].trim();
        if (val !== '...' && val !== 'None') {
          prop.default = val === 'True' ? true : val === 'False' ? false : 
                         isNaN(Number(val)) ? val.replace(/['"`]/g, '') : Number(val);
        }
      }
      
      // If default is ... or not present in Field(), it's required
      if (!fieldArgs.includes('default=') || fieldArgs.includes('default=...')) {
        schema.required!.push(fieldName);
      }
    } else if (defaultValue !== undefined) {
      // Handle inline default values
      const val = defaultValue.trim();
      if (val && val !== 'None') {
        prop.default = val === 'True' ? true : val === 'False' ? false :
                       isNaN(Number(val)) ? val.replace(/['"`]/g, '') : Number(val);
      }
    } else {
      // No default = required
      schema.required!.push(fieldName);
    }
    
    schema.properties![fieldName] = prop;
  }

  return schema;
}

// ===== Error Helpers =====

export function createPlaygroundError(
  type: PlaygroundError['type'],
  message: string,
  details?: string,
  recoverable = true
): PlaygroundError {
  return {
    type,
    message,
    details,
    recoverable,
    retryCount: 0,
  };
}

export function isSyntaxError(error: PlaygroundError | null): boolean {
  return error?.type === 'syntax';
}

export function isServerError(error: PlaygroundError | null): boolean {
  return error?.type === 'server';
}

export function isRecoverable(error: PlaygroundError | null): boolean {
  return error?.recoverable ?? false;
}

// ===== Analytics Helpers (Optional) =====

export interface PlaygroundAnalytics {
  trackToolExecution: (toolName: string, success: boolean, executionTime: number) => void;
  trackError: (error: PlaygroundError) => void;
  trackShare: (method: 'url' | 'gist') => void;
}

export function createAnalyticsTracker(): PlaygroundAnalytics {
  return {
    trackToolExecution: (toolName, success, executionTime) => {
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', 'playground_tool_execution', {
          tool_name: toolName,
          success,
          execution_time: executionTime,
        });
      }
      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Tool execution:', { toolName, success, executionTime });
      }
    },
    trackError: (error) => {
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', 'playground_error', {
          error_type: error.type,
          error_message: error.message,
          recoverable: error.recoverable,
        });
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Error:', error);
      }
    },
    trackShare: (method) => {
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', 'playground_share', {
          method,
        });
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] Share:', method);
      }
    },
  };
}
