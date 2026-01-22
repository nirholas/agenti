/**
 * Custom Vitest Matchers for MCP Response Validation
 * 
 * Provides custom assertions for testing MCP tool responses,
 * making tests more readable and consistent.
 * 
 * Usage:
 *   expect(result).toBeSuccessfulToolResponse()
 *   expect(result).toHaveJsonContent({ key: "value" })
 *   expect(result).toContainToolError("Invalid address")
 * 
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { expect } from "vitest"

// ============================================================================
// Types
// ============================================================================

/**
 * Standard MCP tool response structure
 */
export interface MCPToolResponse {
  content: Array<{
    type: string
    text: string
  }>
  isError?: boolean
}

/**
 * Parsed content from MCP tool response
 */
export interface ParsedToolContent<T = unknown> {
  type: string
  data: T
  raw: string
}

// ============================================================================
// Matchers Interface Extension
// ============================================================================

interface CustomMatchers<R = unknown> {
  /**
   * Assert that the response is a successful MCP tool response
   */
  toBeSuccessfulToolResponse(): R

  /**
   * Assert that the response is an error MCP tool response
   */
  toBeErrorToolResponse(): R

  /**
   * Assert that the response contains valid JSON content
   */
  toHaveValidJsonContent(): R

  /**
   * Assert that the response JSON content matches expected object
   */
  toHaveJsonContent(expected: Record<string, unknown>): R

  /**
   * Assert that the response JSON content contains a specific property
   */
  toHaveJsonProperty(property: string, value?: unknown): R

  /**
   * Assert that the response contains an error message matching the pattern
   */
  toContainToolError(errorPattern: string | RegExp): R

  /**
   * Assert that the response text contains the expected string
   */
  toContainText(expectedText: string): R

  /**
   * Assert that the response has the expected content type
   */
  toHaveContentType(type: string): R

  /**
   * Assert that the response is an array with expected length
   */
  toHaveArrayContent(minLength?: number): R

  /**
   * Assert that the response contains a valid Ethereum address
   */
  toContainValidAddress(): R

  /**
   * Assert that the response contains a valid transaction hash
   */
  toContainValidTxHash(): R

  /**
   * Assert that the response contains valid numeric values
   */
  toContainValidNumericField(field: string): R
}

declare module "vitest" {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if value is a valid MCP tool response
 */
function isMCPToolResponse(value: unknown): value is MCPToolResponse {
  if (!value || typeof value !== "object") return false
  const response = value as MCPToolResponse
  return Array.isArray(response.content)
}

/**
 * Get text content from MCP response
 */
function getTextContent(response: MCPToolResponse): string | null {
  const textItem = response.content.find((c) => c.type === "text")
  return textItem?.text ?? null
}

/**
 * Parse JSON from MCP response text
 */
function parseJsonContent<T = unknown>(response: MCPToolResponse): T | null {
  const text = getTextContent(response)
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/**
 * Check if string is a valid Ethereum address
 */
function isValidAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

/**
 * Check if string is a valid transaction hash
 */
function isValidTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

// ============================================================================
// Custom Matchers Implementation
// ============================================================================

expect.extend({
  /**
   * Assert that the response is a successful MCP tool response
   */
  toBeSuccessfulToolResponse(received: unknown) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response with content array`
      }
    }

    if (received.isError === true) {
      const errorText = getTextContent(received) || "Unknown error"
      return {
        pass: false,
        message: () => `Expected successful tool response, but got error: ${errorText}`
      }
    }

    if (received.content.length === 0) {
      return {
        pass: false,
        message: () => `Expected tool response to have content, but content array is empty`
      }
    }

    return {
      pass: true,
      message: () => `Expected value not to be a successful tool response`
    }
  },

  /**
   * Assert that the response is an error MCP tool response
   */
  toBeErrorToolResponse(received: unknown) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response with content array`
      }
    }

    const isError = received.isError === true || 
      getTextContent(received)?.toLowerCase().includes("error")

    return {
      pass: isError,
      message: () => isError 
        ? `Expected value not to be an error tool response`
        : `Expected value to be an error tool response`
    }
  },

  /**
   * Assert that the response contains valid JSON content
   */
  toHaveValidJsonContent(received: unknown) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const json = parseJsonContent(received)
    return {
      pass: json !== null,
      message: () => json !== null
        ? `Expected response not to contain valid JSON`
        : `Expected response to contain valid JSON, but could not parse: ${getTextContent(received)}`
    }
  },

  /**
   * Assert that the response JSON content matches expected object
   */
  toHaveJsonContent(received: unknown, expected: Record<string, unknown>) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const json = parseJsonContent<Record<string, unknown>>(received)
    if (!json) {
      return {
        pass: false,
        message: () => `Expected response to contain valid JSON`
      }
    }

    // Check if all expected properties exist and match
    const missingKeys: string[] = []
    const mismatchedKeys: string[] = []

    for (const [key, value] of Object.entries(expected)) {
      if (!(key in json)) {
        missingKeys.push(key)
      } else if (JSON.stringify(json[key]) !== JSON.stringify(value)) {
        mismatchedKeys.push(`${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(json[key])}`)
      }
    }

    const pass = missingKeys.length === 0 && mismatchedKeys.length === 0
    return {
      pass,
      message: () => pass
        ? `Expected response not to match JSON content`
        : `JSON content mismatch:\n  Missing keys: ${missingKeys.join(", ") || "none"}\n  Mismatched: ${mismatchedKeys.join("; ") || "none"}`
    }
  },

  /**
   * Assert that the response JSON content contains a specific property
   */
  toHaveJsonProperty(received: unknown, property: string, value?: unknown) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const json = parseJsonContent<Record<string, unknown>>(received)
    if (!json) {
      return {
        pass: false,
        message: () => `Expected response to contain valid JSON`
      }
    }

    // Support nested properties with dot notation
    const properties = property.split(".")
    let current: unknown = json
    for (const prop of properties) {
      if (current === null || typeof current !== "object") {
        return {
          pass: false,
          message: () => `Property path "${property}" is invalid - cannot access "${prop}" on non-object`
        }
      }
      current = (current as Record<string, unknown>)[prop]
    }

    const hasProperty = current !== undefined
    const valueMatches = value === undefined || JSON.stringify(current) === JSON.stringify(value)

    const pass = hasProperty && valueMatches
    return {
      pass,
      message: () => {
        if (!hasProperty) {
          return `Expected response to have property "${property}"`
        }
        if (!valueMatches) {
          return `Expected property "${property}" to equal ${JSON.stringify(value)}, but got ${JSON.stringify(current)}`
        }
        return `Expected response not to have property "${property}"`
      }
    }
  },

  /**
   * Assert that the response contains an error message matching the pattern
   */
  toContainToolError(received: unknown, errorPattern: string | RegExp) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const text = getTextContent(received) || ""
    const matches = typeof errorPattern === "string"
      ? text.toLowerCase().includes(errorPattern.toLowerCase())
      : errorPattern.test(text)

    return {
      pass: matches,
      message: () => matches
        ? `Expected response not to contain error matching "${errorPattern}"`
        : `Expected response to contain error matching "${errorPattern}", got: ${text}`
    }
  },

  /**
   * Assert that the response text contains the expected string
   */
  toContainText(received: unknown, expectedText: string) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const text = getTextContent(received) || ""
    const pass = text.includes(expectedText)

    return {
      pass,
      message: () => pass
        ? `Expected response not to contain "${expectedText}"`
        : `Expected response to contain "${expectedText}", got: ${text.substring(0, 200)}...`
    }
  },

  /**
   * Assert that the response has the expected content type
   */
  toHaveContentType(received: unknown, type: string) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const hasType = received.content.some((c) => c.type === type)
    return {
      pass: hasType,
      message: () => hasType
        ? `Expected response not to have content type "${type}"`
        : `Expected response to have content type "${type}", found: ${received.content.map((c) => c.type).join(", ")}`
    }
  },

  /**
   * Assert that the response contains an array with expected length
   */
  toHaveArrayContent(received: unknown, minLength?: number) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const json = parseJsonContent(received)
    if (!Array.isArray(json)) {
      // Check if it's an object with an array property
      if (json && typeof json === "object") {
        const arrayProps = Object.values(json as Record<string, unknown>).filter(Array.isArray)
        if (arrayProps.length > 0) {
          const arr = arrayProps[0] as unknown[]
          const pass = minLength === undefined || arr.length >= minLength
          return {
            pass,
            message: () => pass
              ? `Expected response not to contain array with ${minLength ? `at least ${minLength}` : "any"} items`
              : `Expected array to have at least ${minLength} items, got ${arr.length}`
          }
        }
      }
      return {
        pass: false,
        message: () => `Expected response to contain an array`
      }
    }

    const pass = minLength === undefined || json.length >= minLength
    return {
      pass,
      message: () => pass
        ? `Expected response not to contain array with ${minLength ? `at least ${minLength}` : "any"} items`
        : `Expected array to have at least ${minLength} items, got ${json.length}`
    }
  },

  /**
   * Assert that the response contains a valid Ethereum address
   */
  toContainValidAddress(received: unknown) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const text = getTextContent(received) || ""
    const addressRegex = /0x[a-fA-F0-9]{40}/g
    const addresses = text.match(addressRegex) || []
    const validAddresses = addresses.filter(isValidAddress)

    return {
      pass: validAddresses.length > 0,
      message: () => validAddresses.length > 0
        ? `Expected response not to contain valid Ethereum address`
        : `Expected response to contain valid Ethereum address`
    }
  },

  /**
   * Assert that the response contains a valid transaction hash
   */
  toContainValidTxHash(received: unknown) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const text = getTextContent(received) || ""
    const hashRegex = /0x[a-fA-F0-9]{64}/g
    const hashes = text.match(hashRegex) || []
    const validHashes = hashes.filter(isValidTxHash)

    return {
      pass: validHashes.length > 0,
      message: () => validHashes.length > 0
        ? `Expected response not to contain valid transaction hash`
        : `Expected response to contain valid transaction hash`
    }
  },

  /**
   * Assert that the response contains valid numeric values for a field
   */
  toContainValidNumericField(received: unknown, field: string) {
    if (!isMCPToolResponse(received)) {
      return {
        pass: false,
        message: () => `Expected value to be an MCP tool response`
      }
    }

    const json = parseJsonContent<Record<string, unknown>>(received)
    if (!json) {
      return {
        pass: false,
        message: () => `Expected response to contain valid JSON`
      }
    }

    // Support nested properties
    const properties = field.split(".")
    let current: unknown = json
    for (const prop of properties) {
      if (current === null || typeof current !== "object") {
        return {
          pass: false,
          message: () => `Property path "${field}" is invalid`
        }
      }
      current = (current as Record<string, unknown>)[prop]
    }

    const isValidNumeric = 
      typeof current === "number" ||
      (typeof current === "string" && !isNaN(parseFloat(current)))

    return {
      pass: isValidNumeric,
      message: () => isValidNumeric
        ? `Expected field "${field}" not to be a valid numeric value`
        : `Expected field "${field}" to be a valid numeric value, got: ${current}`
    }
  }
})

// ============================================================================
// Standalone Assertion Functions
// ============================================================================

/**
 * Assert that a tool response is successful and return parsed JSON
 */
export function assertSuccessAndParse<T = unknown>(result: unknown): T {
  if (!isMCPToolResponse(result)) {
    throw new Error("Expected value to be an MCP tool response")
  }

  if (result.isError === true) {
    const errorText = getTextContent(result) || "Unknown error"
    throw new Error(`Tool returned error: ${errorText}`)
  }

  const json = parseJsonContent<T>(result)
  if (json === null) {
    throw new Error(`Failed to parse JSON from response: ${getTextContent(result)}`)
  }

  return json
}

/**
 * Assert that a tool response is an error
 */
export function assertError(result: unknown, expectedError?: string | RegExp): void {
  if (!isMCPToolResponse(result)) {
    throw new Error("Expected value to be an MCP tool response")
  }

  const text = getTextContent(result) || ""
  const isError = result.isError === true || text.toLowerCase().includes("error")

  if (!isError) {
    throw new Error(`Expected error response, got: ${text.substring(0, 200)}`)
  }

  if (expectedError) {
    const matches = typeof expectedError === "string"
      ? text.toLowerCase().includes(expectedError.toLowerCase())
      : expectedError.test(text)

    if (!matches) {
      throw new Error(`Expected error matching "${expectedError}", got: ${text}`)
    }
  }
}

/**
 * Get text content from response or throw
 */
export function getTextOrThrow(result: unknown): string {
  if (!isMCPToolResponse(result)) {
    throw new Error("Expected value to be an MCP tool response")
  }

  const text = getTextContent(result)
  if (!text) {
    throw new Error("Response has no text content")
  }

  return text
}

/**
 * Parse and validate response against a schema
 */
export function parseAndValidate<T>(
  result: unknown,
  validator: (data: unknown) => data is T
): T {
  const json = assertSuccessAndParse(result)
  if (!validator(json)) {
    throw new Error(`Response does not match expected schema: ${JSON.stringify(json)}`)
  }
  return json
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for checking if response has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return obj !== null && typeof obj === "object" && key in obj
}

/**
 * Type guard for numeric string
 */
export function isNumericString(value: unknown): value is string {
  return typeof value === "string" && !isNaN(parseFloat(value))
}

/**
 * Type guard for valid address string
 */
export function isAddressString(value: unknown): value is `0x${string}` {
  return typeof value === "string" && isValidAddress(value)
}

/**
 * Type guard for valid tx hash string
 */
export function isTxHashString(value: unknown): value is `0x${string}` {
  return typeof value === "string" && isValidTxHash(value)
}

// Export for use in setup
export { isMCPToolResponse, getTextContent, parseJsonContent }
