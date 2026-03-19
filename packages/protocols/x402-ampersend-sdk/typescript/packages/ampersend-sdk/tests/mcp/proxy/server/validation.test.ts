import { URLValidationError, validateTargetURL } from "@/mcp/proxy/server/validation.ts"
import { describe, expect, it } from "vitest"

describe("URL Validation", () => {
  describe("valid URLs", () => {
    it("should accept http URLs", () => {
      const url = validateTargetURL("http://localhost:8080/mcp")
      expect(url.href).toBe("http://localhost:8080/mcp")
    })

    it("should accept https URLs", () => {
      const url = validateTargetURL("https://api.example.com/mcp")
      expect(url.href).toBe("https://api.example.com/mcp")
    })

    it("should accept private IPs (192.168.x.x)", () => {
      const url = validateTargetURL("http://192.168.1.10:8080")
      expect(url.href).toBe("http://192.168.1.10:8080/")
    })

    it("should accept private IPs (10.x.x.x)", () => {
      const url = validateTargetURL("http://10.0.0.1:8080")
      expect(url.href).toBe("http://10.0.0.1:8080/")
    })

    it("should accept private IPs (172.16-31.x.x)", () => {
      const url = validateTargetURL("http://172.16.0.1:8080")
      expect(url.href).toBe("http://172.16.0.1:8080/")
    })

    it("should accept localhost hostname", () => {
      const url = validateTargetURL("http://localhost:3000")
      expect(url.href).toBe("http://localhost:3000/")
    })

    it("should accept loopback IP (127.0.0.1)", () => {
      const url = validateTargetURL("http://127.0.0.1:8080")
      expect(url.href).toBe("http://127.0.0.1:8080/")
    })

    it("should accept public domains", () => {
      const url = validateTargetURL("https://mcp-server.example.com/api/mcp")
      expect(url.href).toBe("https://mcp-server.example.com/api/mcp")
    })

    it("should accept URLs with query parameters", () => {
      const url = validateTargetURL("http://localhost:8080/mcp?foo=bar")
      expect(url.href).toBe("http://localhost:8080/mcp?foo=bar")
    })

    it("should accept URLs with ports", () => {
      const url = validateTargetURL("http://example.com:9090/mcp")
      expect(url.href).toBe("http://example.com:9090/mcp")
    })
  })

  describe("invalid URLs", () => {
    it("should reject malformed URLs", () => {
      expect(() => validateTargetURL("not a url")).toThrow(URLValidationError)
      expect(() => validateTargetURL("not a url")).toThrow(/Invalid URL format/)
    })

    it("should reject empty strings", () => {
      expect(() => validateTargetURL("")).toThrow(URLValidationError)
    })

    it("should reject URLs without protocol", () => {
      expect(() => validateTargetURL("example.com/mcp")).toThrow(URLValidationError)
    })

    it("should reject file protocol", () => {
      expect(() => validateTargetURL("file:///etc/passwd")).toThrow(URLValidationError)
      expect(() => validateTargetURL("file:///etc/passwd")).toThrow(/Protocol "file:" not supported/)
    })

    it("should reject ftp protocol", () => {
      expect(() => validateTargetURL("ftp://example.com")).toThrow(URLValidationError)
      expect(() => validateTargetURL("ftp://example.com")).toThrow(/not supported/)
    })

    it("should reject javascript protocol", () => {
      expect(() => validateTargetURL("javascript:alert(1)")).toThrow(URLValidationError)
    })

    it("should reject data protocol", () => {
      expect(() => validateTargetURL("data:text/html,<h1>test</h1>")).toThrow(URLValidationError)
    })

    it("should reject custom protocols", () => {
      expect(() => validateTargetURL("custom://something")).toThrow(URLValidationError)
    })
  })

  describe("error codes", () => {
    it("should use INVALID_URL code for malformed URLs", () => {
      try {
        validateTargetURL("not a url")
        expect.fail("Should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(URLValidationError)
        expect((err as URLValidationError).code).toBe("INVALID_URL")
      }
    })

    it("should use INVALID_PROTOCOL code for wrong protocols", () => {
      try {
        validateTargetURL("file:///etc/passwd")
        expect.fail("Should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(URLValidationError)
        expect((err as URLValidationError).code).toBe("INVALID_PROTOCOL")
      }
    })
  })
})
