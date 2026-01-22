/**
 * MCP Server mock utilities for testing
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { vi } from "vitest"

// Store registered tools for testing
interface RegisteredTool {
  name: string
  description: string
  inputSchema: unknown
  handler: (args: unknown) => Promise<unknown>
}

// Mock MCP Server
export class MockMcpServer {
  private tools: Map<string, RegisteredTool> = new Map()
  private resources: Map<string, unknown> = new Map()
  private prompts: Map<string, unknown> = new Map()

  name = "Test MCP Server"
  version = "1.0.0"

  // Tool registration
  tool(
    name: string,
    description: string,
    inputSchema: unknown,
    handler: (args: unknown) => Promise<unknown>
  ) {
    this.tools.set(name, { name, description, inputSchema, handler })
  }

  // Resource registration
  resource(name: string, uri: string, handler: unknown) {
    this.resources.set(name, { name, uri, handler })
  }

  // Prompt registration
  prompt(name: string, description: string, handler: unknown) {
    this.prompts.set(name, { name, description, handler })
  }

  // Get registered tool
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name)
  }

  // Get all tools
  getAllTools(): RegisteredTool[] {
    return Array.from(this.tools.values())
  }

  // Get tool names
  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  // Execute a tool by name
  async executeTool(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }
    return tool.handler(args)
  }

  // Get all resources
  getAllResources() {
    return Array.from(this.resources.values())
  }

  // Get all prompts
  getAllPrompts() {
    return Array.from(this.prompts.values())
  }

  // Clear all registrations
  clear() {
    this.tools.clear()
    this.resources.clear()
    this.prompts.clear()
  }

  // Mock server methods
  connect = vi.fn()
  close = vi.fn()
}

// Create a fresh mock server
export const createMockMcpServer = () => new MockMcpServer()

// Mock tool response helpers
export const createSuccessResponse = (data: unknown) => ({
  content: [
    {
      type: "text",
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2)
    }
  ]
})

export const createErrorResponse = (error: string) => ({
  content: [
    {
      type: "text",
      text: `Error: ${error}`
    }
  ],
  isError: true
})

// Validate tool input schema
export const validateToolInput = (
  tool: RegisteredTool,
  input: unknown
): boolean => {
  // Basic validation - in real tests you might use zod
  if (!tool.inputSchema) return true
  const schema = tool.inputSchema as { required?: string[]; properties?: Record<string, unknown> }
  
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (!(input as Record<string, unknown>)[field]) {
        return false
      }
    }
  }
  return true
}
