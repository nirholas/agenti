import { parseEnvConfig } from "@/ampersend/env.ts"
import { OWNABLE_VALIDATOR } from "@/smart-account/constants.ts"
import { afterEach, describe, expect, it } from "vitest"

describe("Ampersend Env Config", () => {
  afterEach(() => {
    // Clean up env vars
    delete process.env.AMPERSEND_AGENT_SECRET
    delete process.env.AMPERSEND_AGENT_ACCOUNT
    delete process.env.AMPERSEND_AGENT_KEY
    delete process.env.AMPERSEND_VALIDATOR_ADDRESS
    delete process.env.AMPERSEND_NETWORK
    delete process.env.AMPERSEND_API_URL
  })

  describe("parseEnvConfig", () => {
    describe("combined format (AMPERSEND_AGENT_SECRET)", () => {
      it("should parse valid combined format", () => {
        process.env.AMPERSEND_AGENT_SECRET =
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890:::0x1234567890123456789012345678901234567890"

        const config = parseEnvConfig()

        expect(config.AGENT_ACCOUNT).toBe("0x1234567890123456789012345678901234567890")
        expect(config.AGENT_KEY).toBe("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
        expect(config.NETWORK).toBe("base") // default
        expect(config.VALIDATOR_ADDRESS).toBe(OWNABLE_VALIDATOR) // default
      })

      it("should throw on invalid separator count", () => {
        process.env.AMPERSEND_AGENT_SECRET = "0x123:::0xabc:::0xdef"

        expect(() => parseEnvConfig()).toThrow("got 3 parts")
      })

      it("should throw on missing separator", () => {
        process.env.AMPERSEND_AGENT_SECRET = "0x1234567890123456789012345678901234567890"

        expect(() => parseEnvConfig()).toThrow("got 1 parts")
      })

      it("should throw if agent key does not start with 0x", () => {
        process.env.AMPERSEND_AGENT_SECRET = "abcdef:::0x1234567890123456789012345678901234567890"

        expect(() => parseEnvConfig()).toThrow("agent key must start with 0x")
      })

      it("should throw if agent account does not start with 0x", () => {
        process.env.AMPERSEND_AGENT_SECRET = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890:::1234"

        expect(() => parseEnvConfig()).toThrow("agent account must start with 0x")
      })
    })

    describe("separate format (AMPERSEND_AGENT_ACCOUNT + AMPERSEND_AGENT_KEY)", () => {
      it("should parse valid separate format", () => {
        process.env.AMPERSEND_AGENT_ACCOUNT = "0x1234567890123456789012345678901234567890"
        process.env.AMPERSEND_AGENT_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

        const config = parseEnvConfig()

        expect(config.AGENT_ACCOUNT).toBe("0x1234567890123456789012345678901234567890")
        expect(config.AGENT_KEY).toBe("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
      })

      it("should throw if only account is provided", () => {
        process.env.AMPERSEND_AGENT_ACCOUNT = "0x1234567890123456789012345678901234567890"

        expect(() => parseEnvConfig()).toThrow("Missing wallet configuration")
      })

      it("should throw if only agent key is provided", () => {
        process.env.AMPERSEND_AGENT_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

        expect(() => parseEnvConfig()).toThrow("Missing wallet configuration")
      })
    })

    describe("conflicting configuration", () => {
      it("should throw if both formats are provided", () => {
        process.env.AMPERSEND_AGENT_SECRET = "0xaaaa:::0x1111111111111111111111111111111111111111"
        process.env.AMPERSEND_AGENT_ACCOUNT = "0x2222222222222222222222222222222222222222"

        expect(() => parseEnvConfig()).toThrow("Cannot use both")
      })

      it("should throw if AGENT_SECRET and AGENT_KEY are both provided", () => {
        process.env.AMPERSEND_AGENT_SECRET = "0xaaaa:::0x1111111111111111111111111111111111111111"
        process.env.AMPERSEND_AGENT_KEY = "0xbbbb"

        expect(() => parseEnvConfig()).toThrow("Cannot use both")
      })
    })

    describe("optional fields", () => {
      it("should use custom network", () => {
        process.env.AMPERSEND_AGENT_ACCOUNT = "0x1234567890123456789012345678901234567890"
        process.env.AMPERSEND_AGENT_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        process.env.AMPERSEND_NETWORK = "base-sepolia"

        const config = parseEnvConfig()

        expect(config.NETWORK).toBe("base-sepolia")
      })

      it("should reject invalid network", () => {
        process.env.AMPERSEND_AGENT_ACCOUNT = "0x1234567890123456789012345678901234567890"
        process.env.AMPERSEND_AGENT_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        process.env.AMPERSEND_NETWORK = "invalid-network"

        expect(() => parseEnvConfig()).toThrow()
      })

      it("should use custom validator address", () => {
        process.env.AMPERSEND_AGENT_ACCOUNT = "0x1234567890123456789012345678901234567890"
        process.env.AMPERSEND_AGENT_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        process.env.AMPERSEND_VALIDATOR_ADDRESS = "0xcccccccccccccccccccccccccccccccccccccccc"

        const config = parseEnvConfig()

        expect(config.VALIDATOR_ADDRESS).toBe("0xcccccccccccccccccccccccccccccccccccccccc")
      })

      it("should use custom API URL", () => {
        process.env.AMPERSEND_AGENT_ACCOUNT = "0x1234567890123456789012345678901234567890"
        process.env.AMPERSEND_AGENT_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        process.env.AMPERSEND_API_URL = "https://api.staging.ampersend.ai"

        const config = parseEnvConfig()

        expect(config.API_URL).toBe("https://api.staging.ampersend.ai")
      })

      it("should reject invalid API URL", () => {
        process.env.AMPERSEND_AGENT_ACCOUNT = "0x1234567890123456789012345678901234567890"
        process.env.AMPERSEND_AGENT_KEY = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        process.env.AMPERSEND_API_URL = "not-a-url"

        expect(() => parseEnvConfig()).toThrow()
      })
    })

    describe("missing configuration", () => {
      it("should throw with helpful message when nothing is configured", () => {
        expect(() => parseEnvConfig()).toThrow("Missing wallet configuration")
      })
    })
  })
})
