export type ParamType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'json'
export type ParamVisibility = 'user-or-llm' | 'user-only' | 'llm-only' | 'hidden'
export type SubBlockType =
  | 'short-input'
  | 'long-input'
  | 'code'
  | 'dropdown'
  | 'switch'
  | 'slider'

export interface ToolParamDefinition {
  type: ParamType
  required?: boolean
  description?: string
  default?: unknown
  visibility?: ParamVisibility
}

export interface ToolResponse {
  success: boolean
  output: Record<string, unknown>
  error?: string
  timing?: { startTime: string; endTime: string; duration: number }
}

export interface ToolRequestConfig<P = Record<string, unknown>> {
  url: string | ((params: P) => string)
  method?: string
  headers?: () => Record<string, string>
  body?: (params: P) => unknown
}

export interface ToolConfig<P = Record<string, unknown>, R extends ToolResponse = ToolResponse> {
  id: string
  name: string
  description: string
  version: string
  params: Record<string, ToolParamDefinition>
  request: ToolRequestConfig<P>
  transformResponse?: (response: Response, params: P) => Promise<R>
  outputs: Record<string, { type: string; description?: string }>
}

export interface ConditionalLogic {
  field: string
  value: string | string[]
  not?: boolean
}

export interface OptionDefinition {
  label: string
  value: string
}

export interface SubBlockConfig {
  id: string
  title: string
  type: SubBlockType
  required?: boolean | ConditionalLogic
  condition?: ConditionalLogic
  defaultValue?: unknown
  placeholder?: string
  options?: OptionDefinition[]
}

export interface BlockConfig {
  type: string
  name: string
  description: string
  category: 'tools' | 'blocks' | 'triggers'
  bgColor: string
  tags?: string[]
  subBlocks: SubBlockConfig[]
  tools: {
    access: string[]
    config?: {
      tool?: (params: Record<string, unknown>) => string
      params?: (params: Record<string, unknown>) => Record<string, unknown>
    }
  }
  inputs: Record<string, { type: string; description?: string }>
  outputs: Record<string, { type: string; description?: string }>
}
