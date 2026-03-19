import { buildRequestInit, decodeBase64Header, headersToObject, parseHeaders } from "@/cli/commands/fetch.ts"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("CLI Fetch Helpers", () => {
  describe("parseHeaders", () => {
    // Mock process.exit to capture calls without actually exiting
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called")
    })
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    afterEach(() => {
      mockExit.mockClear()
      mockConsoleError.mockClear()
    })

    it("should return empty Headers for undefined input", () => {
      const headers = parseHeaders(undefined)
      expect([...headers.entries()]).toEqual([])
    })

    it("should return empty Headers for empty array", () => {
      const headers = parseHeaders([])
      expect([...headers.entries()]).toEqual([])
    })

    it("should parse single header", () => {
      const headers = parseHeaders(["Content-Type: application/json"])
      expect(headers.get("content-type")).toBe("application/json")
    })

    it("should parse multiple headers", () => {
      const headers = parseHeaders(["Content-Type: application/json", "Authorization: Bearer token123"])
      expect(headers.get("content-type")).toBe("application/json")
      expect(headers.get("authorization")).toBe("Bearer token123")
    })

    it("should handle header values with colons", () => {
      const headers = parseHeaders(["X-Custom: value:with:colons"])
      expect(headers.get("x-custom")).toBe("value:with:colons")
    })

    it("should trim whitespace from key and value", () => {
      const headers = parseHeaders(["  Content-Type  :  application/json  "])
      expect(headers.get("content-type")).toBe("application/json")
    })

    it("should exit on invalid header format", () => {
      expect(() => parseHeaders(["InvalidHeader"])).toThrow("process.exit called")
      expect(mockConsoleError).toHaveBeenCalledWith('Invalid header format: InvalidHeader (expected "Key: Value")')
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe("headersToObject", () => {
    it("should convert empty Headers to empty object", () => {
      const headers = new Headers()
      const obj = headersToObject(headers)
      expect(obj).toEqual({})
    })

    it("should convert Headers to object", () => {
      const headers = new Headers()
      headers.set("Content-Type", "application/json")
      headers.set("Authorization", "Bearer token")

      const obj = headersToObject(headers)

      expect(obj).toEqual({
        "content-type": "application/json",
        authorization: "Bearer token",
      })
    })
  })

  describe("decodeBase64Header", () => {
    it("should decode base64 JSON to object", () => {
      const payload = { foo: "bar", num: 42 }
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64")

      const decoded = decodeBase64Header(encoded)

      expect(decoded).toEqual(payload)
    })

    it("should handle nested objects", () => {
      const payload = { nested: { deep: { value: "test" } } }
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64")

      const decoded = decodeBase64Header(encoded)

      expect(decoded).toEqual(payload)
    })

    it("should throw on invalid base64", () => {
      // Invalid base64 that decodes to invalid JSON
      const invalidBase64 = Buffer.from("not json").toString("base64")

      expect(() => decodeBase64Header(invalidBase64)).toThrow()
    })

    it("should handle x402 payment requirements format", () => {
      const paymentRequirements = {
        scheme: "exact",
        network: "base",
        maxAmountRequired: "1000000",
        resource: "https://api.example.com/endpoint",
        description: "API access fee",
        mimeType: "application/json",
        payTo: "0x1234567890123456789012345678901234567890",
        maxTimeoutSeconds: 300,
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        outputSchema: null,
        extra: null,
      }
      const encoded = Buffer.from(JSON.stringify(paymentRequirements)).toString("base64")

      const decoded = decodeBase64Header(encoded)

      expect(decoded).toEqual(paymentRequirements)
    })
  })

  describe("buildRequestInit", () => {
    it("should build GET request without body", () => {
      const headers = new Headers()
      headers.set("Accept", "application/json")

      const init = buildRequestInit({ method: "GET", inspect: false, raw: false, headers: false }, headers)

      expect(init.method).toBe("GET")
      expect(init.headers).toBe(headers)
      expect(init.body).toBeUndefined()
    })

    it("should build POST request with body", () => {
      const headers = new Headers()
      headers.set("Content-Type", "application/json")

      const init = buildRequestInit(
        { method: "POST", data: '{"key":"value"}', inspect: false, raw: false, headers: false },
        headers,
      )

      expect(init.method).toBe("POST")
      expect(init.body).toBe('{"key":"value"}')
    })

    it("should handle empty string data as body", () => {
      const headers = new Headers()

      const init = buildRequestInit({ method: "POST", data: "", inspect: false, raw: false, headers: false }, headers)

      expect(init.body).toBe("")
    })

    it("should not include body when data is undefined", () => {
      const headers = new Headers()

      const init = buildRequestInit(
        { method: "POST", data: undefined, inspect: false, raw: false, headers: false },
        headers,
      )

      expect("body" in init).toBe(false)
    })
  })
})
