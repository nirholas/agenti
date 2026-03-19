import { existsSync, rmSync } from "node:fs"
import { join } from "node:path"

import {
  clearApiUrl,
  generateConfigName,
  getStatus,
  initConfig,
  readConfig,
  setAgent,
  setApiUrl,
} from "@/cli/config.ts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Get temp dir before mocking
const TEMP_DIR = process.env.TMPDIR ?? "/tmp"

vi.mock("node:os", () => ({
  homedir: () => process.env.TMPDIR ?? "/tmp",
  tmpdir: () => process.env.TMPDIR ?? "/tmp",
}))

describe("CLI Config", () => {
  const configDir = join(TEMP_DIR, ".ampersend")

  beforeEach(() => {
    // Ensure clean state
    if (existsSync(configDir)) {
      rmSync(configDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up
    if (existsSync(configDir)) {
      rmSync(configDir, { recursive: true })
    }
    // Clear env vars
    delete process.env.AMPERSEND_AGENT_SECRET
    delete process.env.AMPERSEND_AGENT_ACCOUNT
    delete process.env.AMPERSEND_AGENT_KEY
    delete process.env.AMPERSEND_API_URL
  })

  describe("initConfig", () => {
    it("should create config with new agent key", () => {
      const result = initConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("pending_agent")
        expect(result.data.agentKeyAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      }
    })

    it("should store config with version field", () => {
      initConfig()

      const config = readConfig()
      expect(config).not.toBeNull()
      expect(config?.version).toBe(1)
      expect(config?.agentKey).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it("should return existing pending config", () => {
      // First init
      const first = initConfig()
      expect(first.ok).toBe(true)

      // Second init should return same address
      const second = initConfig()
      expect(second.ok).toBe(true)
      if (first.ok && second.ok) {
        expect(second.data.agentKeyAddress).toBe(first.data.agentKeyAddress)
      }
    })

    it("should error if already fully configured", () => {
      // Init and set agent
      initConfig()
      setAgent("0x1234567890123456789012345678901234567890")

      // Try to init again
      const result = initConfig()
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("ALREADY_CONFIGURED")
      }
    })
  })

  describe("setAgent", () => {
    it("should error if not initialized", () => {
      const result = setAgent("0x1234567890123456789012345678901234567890")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_INITIALIZED")
      }
    })

    it("should reject invalid address format", () => {
      initConfig()
      const result = setAgent("not-an-address")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_ADDRESS")
      }
    })

    it("should reject address with wrong length", () => {
      initConfig()
      const result = setAgent("0x1234") // too short

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_ADDRESS")
      }
    })

    it("should accept valid address and complete setup with configName", () => {
      const initResult = initConfig()
      expect(initResult.ok).toBe(true)
      if (!initResult.ok) return

      const result = setAgent("0x1234567890123456789012345678901234567890")

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("ready")
        expect(result.data.agentAccount).toBe("0x1234567890123456789012345678901234567890")
        expect(result.data.configName).toBe(
          generateConfigName(initResult.data.agentKeyAddress, "0x1234567890123456789012345678901234567890"),
        )
      }
    })

    it("should preserve version in config after setAgent", () => {
      initConfig()
      setAgent("0x1234567890123456789012345678901234567890")

      const config = readConfig()
      expect(config?.version).toBe(1)
      expect(config?.agentAccount).toBe("0x1234567890123456789012345678901234567890")
    })
  })

  describe("setApiUrl", () => {
    it("should error if not initialized", () => {
      const result = setApiUrl("https://example.com")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_INITIALIZED")
      }
    })

    it("should reject invalid URL", () => {
      initConfig()
      const result = setApiUrl("not-a-url")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_URL")
      }
    })

    it("should accept valid URL", () => {
      initConfig()
      const result = setApiUrl("https://api.staging.ampersend.ai")

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.apiUrl).toBe("https://api.staging.ampersend.ai")
      }
    })
  })

  describe("clearApiUrl", () => {
    it("should error if not initialized", () => {
      const result = clearApiUrl()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_INITIALIZED")
      }
    })

    it("should clear API URL and return default", () => {
      initConfig()
      setApiUrl("https://api.staging.ampersend.ai")

      const result = clearApiUrl()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.apiUrl).toBe("https://api.ampersend.ai")
      }

      // Verify it's actually cleared from storage
      const config = readConfig()
      expect(config?.apiUrl).toBeUndefined()
    })
  })

  describe("getStatus", () => {
    it("should return not_initialized when no config exists", () => {
      const result = getStatus()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("not_initialized")
        expect(result.data.source).toBe("none")
      }
    })

    it("should return pending_agent status without addresses by default", () => {
      initConfig()
      const result = getStatus()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("pending_agent")
        expect(result.data.source).toBe("file")
        expect(result.data.agentKeyAddress).toBeUndefined()
      }
    })

    it("should include addresses with verbose flag", () => {
      initConfig()
      const result = getStatus({ verbose: true })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("pending_agent")
        expect(result.data.source).toBe("file")
        expect(result.data.agentKeyAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      }
    })

    it("should return ready status without addresses by default", () => {
      const initResult = initConfig()
      expect(initResult.ok).toBe(true)
      if (!initResult.ok) return

      setAgent("0x1234567890123456789012345678901234567890")

      const result = getStatus()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("ready")
        expect(result.data.source).toBe("file")
        expect(result.data.configName).toBe(
          generateConfigName(initResult.data.agentKeyAddress, "0x1234567890123456789012345678901234567890"),
        )
        expect(result.data.agentAccount).toBeUndefined()
        expect(result.data.agentKeyAddress).toBeUndefined()
      }
    })

    it("should include full details with verbose flag when ready", () => {
      const initResult = initConfig()
      expect(initResult.ok).toBe(true)
      if (!initResult.ok) return

      setAgent("0x1234567890123456789012345678901234567890")

      const result = getStatus({ verbose: true })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("ready")
        expect(result.data.source).toBe("file")
        expect(result.data.configName).toBe(
          generateConfigName(initResult.data.agentKeyAddress, "0x1234567890123456789012345678901234567890"),
        )
        expect(result.data.agentAccount).toBe("0x1234567890123456789012345678901234567890")
        expect(result.data.agentKeyAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      }
    })

    it("should prefer env vars over file config", () => {
      // Set up file config
      initConfig()
      setAgent("0x1111111111111111111111111111111111111111")

      // Set env vars
      process.env.AMPERSEND_AGENT_SECRET =
        "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef:::0x2222222222222222222222222222222222222222"

      const result = getStatus()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("ready")
        expect(result.data.source).toBe("env")
        // configName is always included when ready
        expect(result.data.configName).toBeDefined()
        // Addresses not included without verbose flag
        expect(result.data.agentAccount).toBeUndefined()
      }
    })

    it("should include env addresses with verbose flag", () => {
      process.env.AMPERSEND_AGENT_SECRET =
        "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef:::0x2222222222222222222222222222222222222222"

      const result = getStatus({ verbose: true })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.status).toBe("ready")
        expect(result.data.source).toBe("env")
        expect(result.data.configName).toBeDefined()
        expect(result.data.agentAccount).toBe("0x2222222222222222222222222222222222222222")
        expect(result.data.agentKeyAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      }
    })

    it("should only include apiUrl when different from production default", () => {
      initConfig()
      setAgent("0x1234567890123456789012345678901234567890")

      // Without custom API URL
      let result = getStatus({ verbose: true })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.apiUrl).toBeUndefined()
      }

      // With custom API URL
      setApiUrl("https://api.staging.ampersend.ai")
      result = getStatus({ verbose: true })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.apiUrl).toBe("https://api.staging.ampersend.ai")
      }
    })
  })
})
