import { describe, it, expect } from "bun:test";
import { createFacilitator } from "../../src/factory.js";
import type { StarknetConfig } from "../../src/starknet/exact/facilitator.js";

describe("Starknet smoke test", () => {
  it("registers mainnet + sepolia with supported metadata", () => {
    const mainnetConfig: StarknetConfig = {
      network: "starknet:SN_MAIN",
      rpcUrl: "https://starknet-mainnet.example.com",
      paymasterEndpoint: "https://starknet.paymaster.avnu.fi",
      sponsorAddress: "0xmainnet-sponsor",
    };

    const sepoliaConfig: StarknetConfig = {
      network: "starknet:SN_SEPOLIA",
      rpcUrl: "https://starknet-sepolia.example.com",
      paymasterEndpoint: "http://localhost:12777",
      sponsorAddress: "0xsepolia-sponsor",
    };

    const facilitator = createFacilitator({
      starknetConfigs: [mainnetConfig, sepoliaConfig],
    });

    const supported = facilitator.getSupported();

    const mainnetKind = supported.kinds.find(
      (entry) =>
        entry.network === mainnetConfig.network && entry.scheme === "exact"
    );
    const sepoliaKind = supported.kinds.find(
      (entry) =>
        entry.network === sepoliaConfig.network && entry.scheme === "exact"
    );

    expect(mainnetKind?.extra).toEqual({
      paymasterEndpoint: mainnetConfig.paymasterEndpoint,
      sponsorAddress: mainnetConfig.sponsorAddress,
    });
    expect(sepoliaKind?.extra).toEqual({
      paymasterEndpoint: sepoliaConfig.paymasterEndpoint,
      sponsorAddress: sepoliaConfig.sponsorAddress,
    });

    const signers = supported.signers["starknet:*"] ?? [];
    expect(signers.includes(mainnetConfig.sponsorAddress)).toBe(true);
    expect(signers.includes(sepoliaConfig.sponsorAddress)).toBe(true);
  });
});
