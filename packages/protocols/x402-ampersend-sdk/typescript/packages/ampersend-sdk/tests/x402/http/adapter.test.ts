import { wrapWithAmpersend } from "@/x402/http/adapter.ts"
import type { Authorization, PaymentContext, X402Treasurer } from "@/x402/treasurer.ts"
import type {
  PaymentCreatedContext,
  PaymentCreationContext,
  PaymentCreationFailureContext,
  x402Client,
} from "@x402/core/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PaymentPayload, PaymentRequirements } from "x402/types"

function createMockRequirements(): PaymentRequirements {
  return {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "1000000",
    resource: "https://api.example.com/resource",
    description: "Test payment",
    mimeType: "application/json",
    payTo: "0x1234567890123456789012345678901234567890",
    maxTimeoutSeconds: 300,
    asset: "USDC",
  }
}

function createMockPaymentPayload(): PaymentPayload {
  return {
    x402Version: 1,
    scheme: "exact",
    network: "base-sepolia",
    payload: {
      signature: "0xmocksignature",
      authorization: {
        from: "0xfrom",
        to: "0xto",
        value: "1000000",
        validAfter: "0",
        validBefore: "999999999999",
        nonce: "0xnonce",
      },
    },
  }
}

function createMockAuthorization(payment: PaymentPayload): Authorization {
  return {
    payment,
    authorizationId: "test-auth-id",
  }
}

describe("wrapWithAmpersend", () => {
  let mockClient: x402Client & {
    _beforeHooks: Array<(ctx: PaymentCreationContext) => Promise<{ abort: true; reason: string } | void>>
    _afterHooks: Array<(ctx: PaymentCreatedContext) => Promise<void>>
    _failureHooks: Array<(ctx: PaymentCreationFailureContext) => Promise<{ recovered: true; payload: any } | void>>
    _registeredSchemesV1: Map<string, any>
    _registeredSchemesV2: Map<string, any>
  }
  let mockTreasurer: X402Treasurer & {
    onPaymentRequired: ReturnType<typeof vi.fn>
    onStatus: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Create mock client that captures hooks
    const beforeHooks: typeof mockClient._beforeHooks = []
    const afterHooks: typeof mockClient._afterHooks = []
    const failureHooks: typeof mockClient._failureHooks = []
    const registeredSchemesV1 = new Map<string, any>()
    const registeredSchemesV2 = new Map<string, any>()

    mockClient = {
      _beforeHooks: beforeHooks,
      _afterHooks: afterHooks,
      _failureHooks: failureHooks,
      _registeredSchemesV1: registeredSchemesV1,
      _registeredSchemesV2: registeredSchemesV2,
      registerV1: vi.fn((network: string, schemeClient: any) => {
        registeredSchemesV1.set(network, schemeClient)
        return mockClient
      }),
      register: vi.fn((network: string, schemeClient: any) => {
        registeredSchemesV2.set(network, schemeClient)
        return mockClient
      }),
      onBeforePaymentCreation: vi.fn((hook) => {
        beforeHooks.push(hook)
        return mockClient
      }),
      onAfterPaymentCreation: vi.fn((hook) => {
        afterHooks.push(hook)
        return mockClient
      }),
      onPaymentCreationFailure: vi.fn((hook) => {
        failureHooks.push(hook)
        return mockClient
      }),
    } as any

    mockTreasurer = {
      onPaymentRequired: vi.fn(),
      onStatus: vi.fn(),
    }
  })

  describe("registration", () => {
    it("registers v1 scheme client on all specified networks", () => {
      wrapWithAmpersend(mockClient, mockTreasurer, ["base", "base-sepolia"])

      expect(mockClient.registerV1).toHaveBeenCalledTimes(2)
      expect(mockClient._registeredSchemesV1.has("base")).toBe(true)
      expect(mockClient._registeredSchemesV1.has("base-sepolia")).toBe(true)
    })

    it("registers v2 scheme client on CAIP-2 networks", () => {
      wrapWithAmpersend(mockClient, mockTreasurer, ["base", "base-sepolia"])

      expect(mockClient.register).toHaveBeenCalledTimes(2)
      expect(mockClient._registeredSchemesV2.has("eip155:8453")).toBe(true)
      expect(mockClient._registeredSchemesV2.has("eip155:84532")).toBe(true)
    })

    it("uses same v1 scheme client instance for all networks", () => {
      wrapWithAmpersend(mockClient, mockTreasurer, ["base", "base-sepolia"])

      const baseClient = mockClient._registeredSchemesV1.get("base")
      const sepoliaClient = mockClient._registeredSchemesV1.get("base-sepolia")
      expect(baseClient).toBe(sepoliaClient)
    })

    it("uses same v2 scheme client instance for all networks", () => {
      wrapWithAmpersend(mockClient, mockTreasurer, ["base", "base-sepolia"])

      const baseClient = mockClient._registeredSchemesV2.get("eip155:8453")
      const sepoliaClient = mockClient._registeredSchemesV2.get("eip155:84532")
      expect(baseClient).toBe(sepoliaClient)
    })

    it("scheme client has correct scheme property", () => {
      wrapWithAmpersend(mockClient, mockTreasurer, ["base"])

      const schemeClientV1 = mockClient._registeredSchemesV1.get("base")
      const schemeClientV2 = mockClient._registeredSchemesV2.get("eip155:8453")
      expect(schemeClientV1.scheme).toBe("exact")
      expect(schemeClientV2.scheme).toBe("exact")
    })
  })

  describe("happy path - payment approved", () => {
    it("calls treasurer with requirements and context", async () => {
      const requirements = createMockRequirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const context: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      await mockClient._beforeHooks[0](context)

      expect(mockTreasurer.onPaymentRequired).toHaveBeenCalledWith([requirements], {
        method: "http",
        params: {
          resource: "https://api.example.com/resource",
        },
      })
    })

    it("scheme client retrieves payment payload from store", async () => {
      const requirements = createMockRequirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const context: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      // Store authorization via hook
      await mockClient._beforeHooks[0](context)

      // Retrieve via scheme client
      const schemeClient = mockClient._registeredSchemesV1.get("base-sepolia")
      const result = await schemeClient.createPaymentPayload(1, requirements)

      expect(result).toEqual({
        x402Version: 1,
        scheme: payment.scheme,
        network: payment.network,
        payload: payment.payload,
      })
    })

    it("calls onStatus with sending after payment created", async () => {
      const requirements = createMockRequirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const beforeContext: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      // Trigger before hook to store authorization
      await mockClient._beforeHooks[0](beforeContext)

      const afterContext: PaymentCreatedContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
        paymentPayload: payment,
      } as any

      await mockClient._afterHooks[0](afterContext)

      expect(mockTreasurer.onStatus).toHaveBeenCalledWith("sending", authorization, {
        method: "http",
        params: {
          resource: "https://api.example.com/resource",
        },
      })
    })
  })

  describe("treasurer declines", () => {
    it("returns abort when treasurer returns null", async () => {
      const requirements = createMockRequirements()

      mockTreasurer.onPaymentRequired.mockResolvedValue(null)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const context: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      const result = await mockClient._beforeHooks[0](context)

      expect(result).toEqual({
        abort: true,
        reason: "Payment declined by treasurer",
      })
    })

    it("does not call onStatus when declined", async () => {
      const requirements = createMockRequirements()

      mockTreasurer.onPaymentRequired.mockResolvedValue(null)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const context: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      await mockClient._beforeHooks[0](context)

      expect(mockTreasurer.onStatus).not.toHaveBeenCalled()
    })
  })

  describe("treasurer throws", () => {
    it("propagates error from treasurer", async () => {
      const requirements = createMockRequirements()
      const error = new Error("Treasurer error")

      mockTreasurer.onPaymentRequired.mockRejectedValue(error)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const context: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      await expect(mockClient._beforeHooks[0](context)).rejects.toThrow("Treasurer error")
    })
  })

  describe("payment creation failure", () => {
    it("calls onStatus with error status", async () => {
      const requirements = createMockRequirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      // First store authorization via before hook
      const beforeContext: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      await mockClient._beforeHooks[0](beforeContext)

      // Then trigger failure
      const failureContext: PaymentCreationFailureContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
        error: new Error("Payment failed"),
      } as any

      await mockClient._failureHooks[0](failureContext)

      expect(mockTreasurer.onStatus).toHaveBeenCalledWith("error", authorization, {
        method: "http",
        params: {
          resource: "https://api.example.com/resource",
          error: "Payment failed",
        },
      })
    })

    it("does not recover from failure", async () => {
      const requirements = createMockRequirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      // Store authorization
      const beforeContext: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      await mockClient._beforeHooks[0](beforeContext)

      const failureContext: PaymentCreationFailureContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
        error: new Error("Payment failed"),
      } as any

      const result = await mockClient._failureHooks[0](failureContext)

      // Should return undefined (no recovery)
      expect(result).toBeUndefined()
    })
  })

  describe("missing authorization in store", () => {
    it("throws when authorization not found", async () => {
      const requirements = createMockRequirements()

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const schemeClient = mockClient._registeredSchemesV1.get("base-sepolia")

      // Try to get payload without storing authorization first
      await expect(schemeClient.createPaymentPayload(1, requirements)).rejects.toThrow(
        "No payment authorization found for requirements",
      )
    })
  })

  describe("context shape", () => {
    it("passes correct context structure to treasurer", async () => {
      const requirements = createMockRequirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const context: PaymentCreationContext = {
        paymentRequired: {
          x402Version: 1,
          accepts: [requirements],
          resource: "https://api.example.com/resource",
        },
        selectedRequirements: requirements,
      } as any

      await mockClient._beforeHooks[0](context)

      const calledContext = mockTreasurer.onPaymentRequired.mock.calls[0][1] as PaymentContext
      expect(calledContext.method).toBe("http")
      expect(calledContext.params).toEqual({
        resource: "https://api.example.com/resource",
      })
    })
  })

  describe("v2 protocol support", () => {
    function createMockV2Requirements() {
      return {
        scheme: "exact",
        network: "eip155:84532", // CAIP-2 format
        amount: "1000000",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
        payTo: "0x1234567890123456789012345678901234567890",
        maxTimeoutSeconds: 300,
        extra: {},
      }
    }

    function createMockV2PaymentRequired() {
      return {
        x402Version: 2,
        resource: {
          url: "https://api.example.com/resource",
          description: "Test resource",
          mimeType: "application/json",
        },
        accepts: [createMockV2Requirements()],
      }
    }

    it("converts v2 requirements to v1 for treasurer", async () => {
      const v2Requirements = createMockV2Requirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const context: PaymentCreationContext = {
        paymentRequired: createMockV2PaymentRequired(),
        selectedRequirements: v2Requirements,
      } as any

      await mockClient._beforeHooks[0](context)

      // Treasurer should receive v1-converted requirements
      const [requirements] = mockTreasurer.onPaymentRequired.mock.calls[0][0]
      expect(requirements.network).toBe("base-sepolia") // v1 format
      expect(requirements.maxAmountRequired).toBe("1000000") // v1 field name
      expect(requirements.resource).toBe("https://api.example.com/resource")
    })

    it("v2 scheme client returns v2 payload format", async () => {
      const v2Requirements = createMockV2Requirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const context: PaymentCreationContext = {
        paymentRequired: createMockV2PaymentRequired(),
        selectedRequirements: v2Requirements,
      } as any

      // Store authorization via hook
      await mockClient._beforeHooks[0](context)

      // Retrieve via v2 scheme client
      const schemeClient = mockClient._registeredSchemesV2.get("eip155:84532")
      const result = await schemeClient.createPaymentPayload(2, v2Requirements)

      expect(result.x402Version).toBe(2)
      expect(result.resource).toEqual({
        url: "https://api.example.com/resource",
        description: "Test resource",
        mimeType: "application/json",
      })
      expect(result.accepted).toEqual(v2Requirements)
      expect(result.payload).toEqual(payment.payload)
    })

    it("extracts resource URL from v2 format for status callbacks", async () => {
      const v2Requirements = createMockV2Requirements()
      const payment = createMockPaymentPayload()
      const authorization = createMockAuthorization(payment)

      mockTreasurer.onPaymentRequired.mockResolvedValue(authorization)

      wrapWithAmpersend(mockClient, mockTreasurer, ["base-sepolia"])

      const v2PaymentRequired = createMockV2PaymentRequired()

      // Store authorization via before hook
      const beforeContext: PaymentCreationContext = {
        paymentRequired: v2PaymentRequired,
        selectedRequirements: v2Requirements,
      } as any

      await mockClient._beforeHooks[0](beforeContext)

      // Trigger after hook
      const afterContext = {
        paymentRequired: v2PaymentRequired,
        selectedRequirements: v2Requirements,
        paymentPayload: payment,
      } as any

      await mockClient._afterHooks[0](afterContext)

      expect(mockTreasurer.onStatus).toHaveBeenCalledWith("sending", authorization, {
        method: "http",
        params: {
          resource: "https://api.example.com/resource",
        },
      })
    })
  })
})
