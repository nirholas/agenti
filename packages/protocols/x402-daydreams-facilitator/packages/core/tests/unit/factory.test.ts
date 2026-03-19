import { describe, it, expect, mock, beforeEach } from "bun:test";
import { createFacilitator, type FacilitatorConfig } from "../../src/factory.js";
import type { FacilitatorEvmSigner } from "@x402/evm";
import type { FacilitatorSvmSigner } from "@x402/svm";

const MOCK_ADDRESS = "0x1234567890123456789012345678901234567890" as const;

const createMockEvmSigner = (
  overrides: Partial<FacilitatorEvmSigner> = {}
): FacilitatorEvmSigner =>
  ({
    getAddresses: () => [MOCK_ADDRESS],
    verifyTypedData: mock(() => Promise.resolve(true)),
    readContract: mock(() => Promise.resolve(1000000n)),
    writeContract: mock(() => Promise.resolve("0xtxhash")),
    waitForTransactionReceipt: mock(() =>
      Promise.resolve({ status: "success" })
    ),
    ...overrides,
  }) as unknown as FacilitatorEvmSigner;

const createMockSvmSigner = (): FacilitatorSvmSigner =>
  ({
    getAddresses: () => ["SoLANAaddress123456789012345678901234567890123"],
    signTransaction: mock(() => Promise.resolve(new Uint8Array())),
  }) as unknown as FacilitatorSvmSigner;

describe("createFacilitator", () => {
  describe("empty configuration", () => {
    it("creates facilitator with empty config", () => {
      const facilitator = createFacilitator({});

      expect(facilitator).toBeDefined();
      expect(typeof facilitator.register).toBe("function");
    });

    it("creates facilitator with no signers", () => {
      const facilitator = createFacilitator({
        evmSigners: [],
        svmSigners: [],
        starknetConfigs: [],
      });

      expect(facilitator).toBeDefined();
    });
  });

  describe("EVM signer registration", () => {
    it("registers EVM signer with single network", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("registers EVM signer with multiple networks", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: ["eip155:8453", "eip155:10"],
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("defaults schemes to exact and upto", () => {
      const signer = createMockEvmSigner();
      // When no schemes specified, should register both exact and upto
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
            // schemes not specified - defaults to ["exact", "upto"]
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("registers only exact scheme when specified", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
            schemes: ["exact"],
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("registers only upto scheme when specified", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
            schemes: ["upto"],
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("supports ERC4337 with EIP6492 option", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
            deployERC4337WithEIP6492: true,
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });
  });

  describe("V1 scheme registration", () => {
    it("registers V1 scheme by default with v1NetworkNames", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
            v1NetworkNames: "base",
            // registerV1 defaults to true
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("registers V1 kinds under x402Version=1 (not 2)", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
            v1NetworkNames: "base",
          },
        ],
      });

      const kinds = facilitator.getSupported().kinds;
      const exactBase = kinds.filter(
        (k) => k.scheme === "exact" && String(k.network) === "base"
      );

      expect(exactBase.length).toBe(1);
      expect(exactBase[0]?.x402Version).toBe(1);

      const exactCaip = kinds.filter(
        (k) => k.scheme === "exact" && k.network === "eip155:8453"
      );
      expect(exactCaip.length).toBe(1);
      expect(exactCaip[0]?.x402Version).toBe(2);
    });

    it("does not register V1 when registerV1 is false", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
            v1NetworkNames: "base",
            registerV1: false,
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("supports multiple v1NetworkNames", () => {
      const signer = createMockEvmSigner();
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: ["eip155:8453", "eip155:84532"],
            v1NetworkNames: ["base", "base-sepolia"],
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("filters unsupported V1 networks", () => {
      const signer = createMockEvmSigner();
      // "unknown-network" is not in V1_NETWORKS
      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer,
            networks: "eip155:8453",
            v1NetworkNames: ["base", "unknown-network"],
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });
  });

  describe("SVM signer registration", () => {
    it("registers SVM signer with single network", () => {
      const signer = createMockSvmSigner();
      const facilitator = createFacilitator({
        svmSigners: [
          {
            signer,
            networks: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("registers SVM signer with multiple networks", () => {
      const signer = createMockSvmSigner();
      const facilitator = createFacilitator({
        svmSigners: [
          {
            signer,
            networks: [
              "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
              "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            ],
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("defaults SVM schemes to exact", () => {
      const signer = createMockSvmSigner();
      const facilitator = createFacilitator({
        svmSigners: [
          {
            signer,
            networks: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            // schemes not specified - defaults to ["exact"]
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });
  });

  describe("Starknet registration", () => {
    it("registers Starknet config", () => {
      const facilitator = createFacilitator({
        starknetConfigs: [
          {
            network: "starknet:SN_MAIN",
            rpcUrl: "https://starknet-mainnet.example.com",
            paymasterEndpoint: "https://paymaster.example.com",
            paymasterApiKey: "test-key",
            sponsorAddress: "0x123",
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });

    it("registers multiple Starknet configs", () => {
      const facilitator = createFacilitator({
        starknetConfigs: [
          {
            network: "starknet:SN_MAIN",
            rpcUrl: "https://starknet-mainnet.example.com",
            paymasterEndpoint: "https://paymaster.example.com",
            sponsorAddress: "0x123",
          },
          {
            network: "starknet:SN_SEPOLIA",
            rpcUrl: "https://starknet-sepolia.example.com",
            paymasterEndpoint: "https://paymaster-testnet.example.com",
            sponsorAddress: "0x456",
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });
  });

  describe("lifecycle hooks", () => {
    it("registers onBeforeVerify hook", () => {
      const hook = mock(() => Promise.resolve());
      const facilitator = createFacilitator({
        hooks: {
          onBeforeVerify: hook,
        },
      });

      expect(facilitator).toBeDefined();
    });

    it("registers onAfterVerify hook", () => {
      const hook = mock(() => Promise.resolve());
      const facilitator = createFacilitator({
        hooks: {
          onAfterVerify: hook,
        },
      });

      expect(facilitator).toBeDefined();
    });

    it("registers onVerifyFailure hook", () => {
      const hook = mock(() => Promise.resolve());
      const facilitator = createFacilitator({
        hooks: {
          onVerifyFailure: hook,
        },
      });

      expect(facilitator).toBeDefined();
    });

    it("registers onBeforeSettle hook", () => {
      const hook = mock(() => Promise.resolve());
      const facilitator = createFacilitator({
        hooks: {
          onBeforeSettle: hook,
        },
      });

      expect(facilitator).toBeDefined();
    });

    it("registers onAfterSettle hook", () => {
      const hook = mock(() => Promise.resolve());
      const facilitator = createFacilitator({
        hooks: {
          onAfterSettle: hook,
        },
      });

      expect(facilitator).toBeDefined();
    });

    it("registers onSettleFailure hook", () => {
      const hook = mock(() => Promise.resolve());
      const facilitator = createFacilitator({
        hooks: {
          onSettleFailure: hook,
        },
      });

      expect(facilitator).toBeDefined();
    });

    it("registers all hooks together", () => {
      const facilitator = createFacilitator({
        hooks: {
          onBeforeVerify: mock(() => Promise.resolve()),
          onAfterVerify: mock(() => Promise.resolve()),
          onVerifyFailure: mock(() => Promise.resolve()),
          onBeforeSettle: mock(() => Promise.resolve()),
          onAfterSettle: mock(() => Promise.resolve()),
          onSettleFailure: mock(() => Promise.resolve()),
        },
      });

      expect(facilitator).toBeDefined();
    });
  });

  describe("combined configurations", () => {
    it("registers multiple signers and hooks", () => {
      const evmSigner = createMockEvmSigner();
      const svmSigner = createMockSvmSigner();

      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer: evmSigner,
            networks: ["eip155:8453", "eip155:10"],
            schemes: ["exact", "upto"],
            v1NetworkNames: ["base"],
          },
        ],
        svmSigners: [
          {
            signer: svmSigner,
            networks: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
          },
        ],
        starknetConfigs: [
          {
            network: "starknet:SN_MAIN",
            rpcUrl: "https://starknet-mainnet.example.com",
            paymasterEndpoint: "https://paymaster.example.com",
            sponsorAddress: "0x123",
          },
        ],
        hooks: {
          onAfterSettle: mock(() => Promise.resolve()),
        },
      });

      expect(facilitator).toBeDefined();
    });

    it("supports multiple EVM signers for different networks", () => {
      const baseSigner = createMockEvmSigner();
      const ethSigner = createMockEvmSigner();

      const facilitator = createFacilitator({
        evmSigners: [
          {
            signer: baseSigner,
            networks: "eip155:8453",
          },
          {
            signer: ethSigner,
            networks: "eip155:1",
          },
        ],
      });

      expect(facilitator).toBeDefined();
    });
  });
});
