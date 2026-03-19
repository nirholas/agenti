import { privateKeyToAccount } from "viem/accounts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AmpersendManagementClient } from "../../src/ampersend/management.ts"

// Deterministic test key (same as Python tests)
const TEST_PRIVATE_KEY = `0x${"ab".repeat(32)}` as const
const TEST_ACCOUNT = privateKeyToAccount(TEST_PRIVATE_KEY)
const TEST_ADDRESS = TEST_ACCOUNT.address

// Mock uses camelCase to match actual API response format
const MOCK_AGENT_RESPONSE = {
  address: "0x1111111111111111111111111111111111111111",
  name: "test-agent",
  userId: "user-123",
  balance: "0",
  initData: {},
  nonce: "12345",
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("AmpersendManagementClient", () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("createAgent calls single endpoint with agent_key_address", async () => {
    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      expect(init?.method).toBe("POST")
      expect(url).toContain("/api/v1/sdk/agents")
      expect(url).not.toContain("/prepare")
      const body = JSON.parse(init?.body as string)
      expect(body.agent_key_address).toBe(TEST_ADDRESS)
      expect(body.name).toBe("test-agent")
      expect(body.spend_config).toBeNull()
      expect(body.authorized_sellers).toBeNull()
      return jsonResponse(MOCK_AGENT_RESPONSE)
    })

    const client = new AmpersendManagementClient({ apiKey: "sk_test_123" })
    const result = await client.createAgent({
      name: "test-agent",
      privateKey: TEST_PRIVATE_KEY,
    })

    expect(result.address).toBe(MOCK_AGENT_RESPONSE.address)
    expect(result.name).toBe("test-agent")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("createAgent passes spend config and authorized sellers", async () => {
    let submittedPayload: Record<string, unknown> = {}

    fetchSpy.mockImplementation(async (_url: string, init?: RequestInit) => {
      submittedPayload = JSON.parse(init?.body as string)
      return jsonResponse(MOCK_AGENT_RESPONSE)
    })

    const client = new AmpersendManagementClient({ apiKey: "sk_test_123" })
    await client.createAgent({
      name: "test-agent",
      privateKey: TEST_PRIVATE_KEY,
      spendConfig: {
        dailyLimit: 1000000n,
        perTransactionLimit: 50000n,
      },
      authorizedSellers: ["0x3333333333333333333333333333333333333333"],
    })

    expect(submittedPayload.agent_key_address).toBe(TEST_ADDRESS)
    const sc = submittedPayload.spend_config as Record<string, unknown>
    expect(sc.daily_limit).toBe("1000000")
    expect(sc.per_transaction_limit).toBe("50000")
    expect(sc.monthly_limit).toBeNull()
    expect(sc.auto_topup_allowed).toBe(false)
    expect(submittedPayload.authorized_sellers).toEqual(["0x3333333333333333333333333333333333333333"])
  })

  it("listAgents returns a list of agent records", async () => {
    // API returns paginated response
    const paginatedResponse = {
      items: [MOCK_AGENT_RESPONSE, { ...MOCK_AGENT_RESPONSE, name: "agent-2" }],
      total: 2,
      limit: 50,
      offset: 0,
    }

    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      expect(init?.method).toBe("GET")
      expect(url).toContain("/api/v1/sdk/agents")
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization).toBe("Bearer sk_test_123")
      return jsonResponse(paginatedResponse)
    })

    const client = new AmpersendManagementClient({ apiKey: "sk_test_123" })
    const result = await client.listAgents()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe("test-agent")
    expect(result[1].name).toBe("agent-2")
  })

  it("throws ApiError on HTTP error response", async () => {
    fetchSpy.mockResolvedValue(new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }))

    const client = new AmpersendManagementClient({ apiKey: "bad_key" })
    await expect(client.listAgents()).rejects.toThrow("HTTP 401 Unauthorized")
  })
})
