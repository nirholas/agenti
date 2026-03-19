import {
  caip2ToV1Network,
  parseCaip2ChainId,
  v1NetworkToCaip2,
  v1PayloadToV2,
  v2RequirementsToV1,
} from "@/x402/http/v2-adapter.ts"
import { describe, expect, it } from "vitest"
import type { PaymentPayload } from "x402/types"

describe("v2-adapter", () => {
  describe("v1NetworkToCaip2", () => {
    it("converts base-sepolia to eip155:84532", () => {
      expect(v1NetworkToCaip2("base-sepolia")).toBe("eip155:84532")
    })

    it("converts base to eip155:8453", () => {
      expect(v1NetworkToCaip2("base")).toBe("eip155:8453")
    })

    it("throws for unknown network", () => {
      expect(() => v1NetworkToCaip2("unknown-network")).toThrow("Unknown v1 network")
    })
  })

  describe("parseCaip2ChainId", () => {
    it("extracts chain ID from CAIP-2 format", () => {
      expect(parseCaip2ChainId("eip155:8453")).toBe(8453)
      expect(parseCaip2ChainId("eip155:84532")).toBe(84532)
    })

    it("handles plain chain ID string", () => {
      expect(parseCaip2ChainId("8453")).toBe(8453)
    })
  })

  describe("caip2ToV1Network", () => {
    it("converts eip155:84532 to base-sepolia", () => {
      expect(caip2ToV1Network("eip155:84532")).toBe("base-sepolia")
    })

    it("converts eip155:8453 to base", () => {
      expect(caip2ToV1Network("eip155:8453")).toBe("base")
    })

    it("throws for unknown chain ID", () => {
      expect(() => caip2ToV1Network("eip155:999999")).toThrow("Unknown chain ID")
    })
  })

  describe("v2RequirementsToV1", () => {
    const v2Requirements = {
      scheme: "exact",
      network: "eip155:84532" as `eip155:${number}`,
      amount: "1000000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x1234567890123456789012345678901234567890",
      maxTimeoutSeconds: 300,
      extra: { customField: "value" },
    }

    const v2Resource = {
      url: "https://api.example.com/resource",
      description: "Test resource",
      mimeType: "application/json",
    }

    it("converts network from CAIP-2 to v1 name", () => {
      const v1Req = v2RequirementsToV1(v2Requirements, v2Resource)
      expect(v1Req.network).toBe("base-sepolia")
    })

    it("maps amount to maxAmountRequired", () => {
      const v1Req = v2RequirementsToV1(v2Requirements, v2Resource)
      expect(v1Req.maxAmountRequired).toBe("1000000")
    })

    it("extracts resource URL from resource object", () => {
      const v1Req = v2RequirementsToV1(v2Requirements, v2Resource)
      expect(v1Req.resource).toBe("https://api.example.com/resource")
    })

    it("uses description from resource", () => {
      const v1Req = v2RequirementsToV1(v2Requirements, v2Resource)
      expect(v1Req.description).toBe("Test resource")
    })

    it("preserves extra fields", () => {
      const v1Req = v2RequirementsToV1(v2Requirements, v2Resource)
      expect(v1Req.extra).toEqual({ customField: "value" })
    })

    it("uses default timeout when not specified", () => {
      const reqWithoutTimeout = { ...v2Requirements }
      delete (reqWithoutTimeout as any).maxTimeoutSeconds
      const v1Req = v2RequirementsToV1(reqWithoutTimeout, v2Resource)
      expect(v1Req.maxTimeoutSeconds).toBe(300)
    })
  })

  describe("v1PayloadToV2", () => {
    const v1Payload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: {
        signature: "0xmocksignature",
        authorization: {
          from: "0xfrom",
          to: "0xto",
          value: "1000000",
        },
      },
    }

    const v2Context = {
      resource: {
        url: "https://api.example.com/resource",
        description: "Test resource",
        mimeType: "application/json",
      },
      originalRequirements: {
        scheme: "exact",
        network: "eip155:84532" as `eip155:${number}`,
        amount: "1000000",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1234567890123456789012345678901234567890",
        maxTimeoutSeconds: 300,
        extra: {},
      },
    }

    it("sets x402Version to 2", () => {
      const v2Payload = v1PayloadToV2(v1Payload, v2Context)
      expect(v2Payload.x402Version).toBe(2)
    })

    it("includes resource from context", () => {
      const v2Payload = v1PayloadToV2(v1Payload, v2Context)
      expect(v2Payload.resource).toEqual(v2Context.resource)
    })

    it("includes accepted from context", () => {
      const v2Payload = v1PayloadToV2(v1Payload, v2Context)
      expect(v2Payload.accepted).toEqual(v2Context.originalRequirements)
    })

    it("preserves payload from v1", () => {
      const v2Payload = v1PayloadToV2(v1Payload, v2Context)
      expect(v2Payload.payload).toEqual(v1Payload.payload)
    })
  })
})
