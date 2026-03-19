import { err, ok, type JsonEnvelope } from "@/cli/envelope.ts"
import { describe, expect, it } from "vitest"

describe("CLI Envelope", () => {
  describe("ok", () => {
    it("should create success envelope with data", () => {
      const result = ok({ foo: "bar" })
      expect(result).toEqual({ ok: true, data: { foo: "bar" } })
    })

    it("should handle primitive data", () => {
      const result = ok("hello")
      expect(result).toEqual({ ok: true, data: "hello" })
    })

    it("should handle null data", () => {
      const result = ok(null)
      expect(result).toEqual({ ok: true, data: null })
    })
  })

  describe("err", () => {
    it("should create error envelope with code and message", () => {
      const result = err("TEST_ERROR", "Something went wrong")
      expect(result).toEqual({
        ok: false,
        error: { code: "TEST_ERROR", message: "Something went wrong" },
      })
    })

    it("should include status when provided", () => {
      const result = err("NOT_CONFIGURED", "Run init", { status: "not_initialized" })
      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_CONFIGURED", message: "Run init", status: "not_initialized" },
      })
    })

    it("should include agentKeyAddress when provided", () => {
      const result = err("SETUP_INCOMPLETE", "Complete setup", {
        status: "pending_agent",
        agentKeyAddress: "0x1234567890123456789012345678901234567890",
      })
      expect(result).toEqual({
        ok: false,
        error: {
          code: "SETUP_INCOMPLETE",
          message: "Complete setup",
          status: "pending_agent",
          agentKeyAddress: "0x1234567890123456789012345678901234567890",
        },
      })
    })
  })

  describe("type discrimination", () => {
    it("should allow discriminating between ok and err", () => {
      const success: JsonEnvelope<{ value: number }> = ok({ value: 42 })
      const failure: JsonEnvelope<{ value: number }> = err("ERROR", "failed")

      if (success.ok) {
        expect(success.data.value).toBe(42)
      }

      if (!failure.ok) {
        expect(failure.error.code).toBe("ERROR")
      }
    })
  })
})
