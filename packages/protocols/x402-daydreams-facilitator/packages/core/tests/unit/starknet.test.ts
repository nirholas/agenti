import { describe, it, expect } from "bun:test";
import { x402Facilitator } from "@x402/core/facilitator";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

import {
  getStarknetNetwork,
  getStarknetNetworkCaip,
  resolveStarknetRpcUrl,
  validateStarknetNetworks,
} from "../../src/networks.js";
import { ExactStarknetScheme } from "../../src/starknet/exact/facilitator.js";

const baseStarknetConfig = {
  network: "starknet:SN_MAIN",
  rpcUrl: "https://starknet-mainnet.example.com",
  paymasterEndpoint: "https://starknet.paymaster.avnu.fi",
  sponsorAddress: "0xabc123",
} as const;

describe("Starknet network registry", () => {
  it("returns Starknet CAIP identifiers", () => {
    expect(getStarknetNetwork("starknet-mainnet")?.caip).toBe(
      "starknet:SN_MAIN"
    );
    expect(getStarknetNetworkCaip("starknet-sepolia")).toBe(
      "starknet:SN_SEPOLIA"
    );
  });

  it("resolves explicit Starknet RPC overrides", () => {
    const rpcUrl = resolveStarknetRpcUrl("starknet-mainnet", {
      explicitUrl: "https://override.example.com",
      alchemyApiKey: "should-not-use",
    });
    expect(rpcUrl).toBe("https://override.example.com");
  });

  it("resolves Alchemy Starknet RPC when API key is provided", () => {
    const rpcUrl = resolveStarknetRpcUrl("starknet-mainnet", {
      alchemyApiKey: "alchemy-key",
    });
    expect(rpcUrl).toBe("https://starknet-mainnet.g.alchemy.com/v2/alchemy-key");
  });

  it("falls back to public Starknet RPC when no overrides are set", () => {
    const rpcUrl = resolveStarknetRpcUrl("starknet-sepolia");
    expect(rpcUrl).toBe("https://starknet-sepolia.public.blastapi.io");
  });

  it("filters unknown Starknet networks", () => {
    const valid = validateStarknetNetworks([
      "starknet-mainnet",
      "starknet-unknown",
    ]);
    expect(valid).toEqual(["starknet-mainnet"]);
  });
});

describe("ExactStarknetScheme supported metadata", () => {
  it("exposes paymaster and sponsor signer data in /supported", () => {
    const facilitator = new x402Facilitator();
    facilitator.register(
      baseStarknetConfig.network,
      new ExactStarknetScheme(baseStarknetConfig)
    );

    const supported = facilitator.getSupported();
    const kind = supported.kinds.find(
      (entry) =>
        entry.network === baseStarknetConfig.network &&
        entry.scheme === "exact"
    );

    expect(kind).toBeDefined();
    expect(kind?.extra).toEqual({
      paymasterEndpoint: baseStarknetConfig.paymasterEndpoint,
      sponsorAddress: baseStarknetConfig.sponsorAddress,
    });
    expect(supported.signers["starknet:*"]).toEqual([
      baseStarknetConfig.sponsorAddress,
    ]);
  });
});

describe("ExactStarknetScheme typedData requirement", () => {
  const scheme = new ExactStarknetScheme(baseStarknetConfig);

  const requirements: PaymentRequirements = {
    scheme: "exact",
    network: "starknet:SN_MAIN",
    asset: "0xasset",
    amount: "1",
    payTo: "0xpayto",
    maxTimeoutSeconds: 60,
    extra: {},
  };

  const payload: PaymentPayload = {
    x402Version: 2,
    resource: {
      url: "https://example.com",
      description: "Example resource",
      mimeType: "application/json",
    },
    accepted: requirements,
    payload: {},
  };

  it("rejects verify when typedData is missing", async () => {
    const result = await scheme.verify(payload, requirements);
    expect(result.isValid).toBe(false);
    expect(result.invalidReason).toBe("invalid_payload");
  });

  it("rejects settle when typedData is missing", async () => {
    const result = await scheme.settle(payload, requirements);
    expect(result.success).toBe(false);
    expect(result.errorReason).toBe("invalid_payload");
  });
});
