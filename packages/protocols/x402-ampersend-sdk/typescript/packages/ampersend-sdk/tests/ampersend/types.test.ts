import { Address, Caip2ID, TxHash } from "@/ampersend/types.ts"
import { Schema } from "effect"
import { describe, expect, it } from "vitest"

describe("Primitive Schema Validation Messages", () => {
  describe("Address", () => {
    it("should accept valid Ethereum addresses", () => {
      const validAddress = "0x1234567890123456789012345678901234567890"
      const result = Schema.decodeUnknownEither(Address)(validAddress)
      expect(result._tag).toBe("Right")
    })

    it("should reject invalid addresses with a user-friendly message", () => {
      // This is a 32-byte hash (64 hex chars), not a 20-byte address (40 hex chars)
      const invalidAddress = "0xcabe5e4df05692aea7ab8f0c5efda3c9852d2dcb54df97336241b12bfc909228"
      const result = Schema.decodeUnknownEither(Address)(invalidAddress)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        const errorMessage = String(result.left)
        expect(errorMessage).toContain("Must be a valid Ethereum address (0x followed by 40 hex characters)")
      }
    })

    it("should reject non-hex strings with a user-friendly message", () => {
      const invalidAddress = "not-an-address"
      const result = Schema.decodeUnknownEither(Address)(invalidAddress)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        const errorMessage = String(result.left)
        expect(errorMessage).toContain("Must be a valid Ethereum address (0x followed by 40 hex characters)")
      }
    })
  })

  describe("TxHash", () => {
    it("should accept valid transaction hashes", () => {
      const validHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      const result = Schema.decodeUnknownEither(TxHash)(validHash)
      expect(result._tag).toBe("Right")
    })

    it("should reject invalid hashes with a user-friendly message", () => {
      const invalidHash = "not-a-hash"
      const result = Schema.decodeUnknownEither(TxHash)(invalidHash)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        const errorMessage = String(result.left)
        expect(errorMessage).toContain("Must be a valid transaction hash (0x followed by hex characters)")
      }
    })
  })

  describe("Caip2ID", () => {
    it("should accept valid CAIP-2 chain IDs", () => {
      const validCaip2 = "eip155:1"
      const result = Schema.decodeUnknownEither(Caip2ID)(validCaip2)
      expect(result._tag).toBe("Right")
    })

    it("should accept Base mainnet CAIP-2 ID", () => {
      const validCaip2 = "eip155:8453"
      const result = Schema.decodeUnknownEither(Caip2ID)(validCaip2)
      expect(result._tag).toBe("Right")
    })

    it("should reject invalid CAIP-2 IDs with a user-friendly message", () => {
      const invalidCaip2 = "invalid-chain"
      const result = Schema.decodeUnknownEither(Caip2ID)(invalidCaip2)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        const errorMessage = String(result.left)
        expect(errorMessage).toContain("Must be a valid CAIP-2 chain ID (e.g., eip155:1)")
      }
    })

    it("should reject malformed CAIP-2 IDs with a user-friendly message", () => {
      const invalidCaip2 = "eip155:" // missing chain number
      const result = Schema.decodeUnknownEither(Caip2ID)(invalidCaip2)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        const errorMessage = String(result.left)
        expect(errorMessage).toContain("Must be a valid CAIP-2 chain ID (e.g., eip155:1)")
      }
    })
  })
})
