import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Facilitator, DEFAULT_MIN_CONFIRMATIONS } from "../src/index";
import { baseSepolia, base, mainnet } from "viem/chains";

const TEST_KEY =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// Mock the x402 module
const mockVerify = mock(() => Promise.resolve({ isValid: true, payer: "0xabc" }));
const mockSettle = mock(() =>
  Promise.resolve({
    success: true,
    transaction: "0x123abc",
    network: "base-sepolia",
    payer: "0xabc",
  })
);
const mockCreateConnectedClient = mock(() => ({}));
const mockCreateSigner = mock(() => Promise.resolve({}));

// Mock the x402 imports
mock.module("x402/facilitator", () => ({
  verify: mockVerify,
  settle: mockSettle,
}));

mock.module("x402/types", () => ({
  createConnectedClient: mockCreateConnectedClient,
  createSigner: mockCreateSigner,
  SupportedEVMNetworks: [
    "base",
    "base-sepolia",
    "ethereum",
    "arbitrum",
    "optimism",
    "polygon",
  ],
}));

describe("Facilitator - Constructor", () => {
  it("constructs successfully with valid options", () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    expect(facilitator).toBeDefined();
  });

  it("constructs with custom minConfirmations", () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
      minConfirmations: 3,
    });

    expect(facilitator).toBeDefined();
  });

  it("uses default minConfirmations when not specified", () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    expect(DEFAULT_MIN_CONFIRMATIONS).toBe(1);
    expect(facilitator).toBeDefined();
  });

  it("constructs with multiple networks", () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia, base],
    });

    expect(facilitator).toBeDefined();
  });

  it("throws if constructed with empty networks array", () => {
    expect(() => {
      new Facilitator({
        evmPrivateKey: TEST_KEY,
        networks: [],
      });
    }).toThrow("at least one EVM network is required");
  });

  it("throws if constructed without evmPrivateKey", () => {
    expect(() => {
      new Facilitator({
        evmPrivateKey: "",
        networks: [baseSepolia],
      });
    }).toThrow("evmPrivateKey is required");
  });

  it("throws if evmPrivateKey is missing", () => {
    expect(() => {
      new Facilitator({
        evmPrivateKey: undefined as any,
        networks: [baseSepolia],
      });
    }).toThrow("evmPrivateKey is required");
  });

  it("throws if networks is missing", () => {
    expect(() => {
      new Facilitator({
        evmPrivateKey: TEST_KEY,
        networks: undefined as any,
      });
    }).toThrow("at least one EVM network is required");
  });
});

describe("Facilitator.listSupportedKinds", () => {
  it("returns supported kinds in the expected shape for single network", () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = facilitator.listSupportedKinds();

    // basic structure
    expect(result).toHaveProperty("kinds");
    expect(Array.isArray(result.kinds)).toBe(true);
    expect(result.kinds.length).toBe(1);

    const first = result.kinds[0];

    // required fields
    expect(first.x402Version).toBe(1);
    expect(first.scheme).toBe("exact");
    expect(first.network).toBe("base-sepolia");
  });

  it("returns multiple kinds for multiple networks", () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia, base],
    });

    const result = facilitator.listSupportedKinds();

    expect(result.kinds.length).toBe(2);

    // Check first network
    expect(result.kinds[0]).toEqual({
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
    });

    // Check second network
    expect(result.kinds[1]).toEqual({
      x402Version: 1,
      scheme: "exact",
      network: "base",
    });
  });

  it("correctly maps viem chain to x402 network name", () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [base],
    });

    const result = facilitator.listSupportedKinds();

    expect(result.kinds[0].network).toBe("base");
  });

  it("handles networks with spaces in names", () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [mainnet],
    });

    const result = facilitator.listSupportedKinds();

    // mainnet should be transformed properly
    expect(result.kinds[0].network).toBeDefined();
  });
});

describe("Facilitator.verifyPayment", () => {
  beforeEach(() => {
    mockVerify.mockClear();
    mockCreateConnectedClient.mockClear();
  });

  it("returns valid:true when x402Verify returns isValid:true", async () => {
    mockVerify.mockResolvedValueOnce({
      isValid: true,
      payer: "0xtest",
    });

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.verifyPayment(
      { txHash: "0xabc" },
      { network: "base-sepolia" }
    );

    expect(result.isValid).toBe(true);
    expect(mockCreateConnectedClient).toHaveBeenCalledWith("base-sepolia");
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it("returns valid:false when x402Verify returns isValid:false", async () => {
    mockVerify.mockResolvedValueOnce({
      isValid: false,
      payer: "0xtest",
    });

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.verifyPayment(
      { txHash: "0xabc" },
      { network: "base-sepolia" }
    );

    expect(result.isValid).toBe(false);
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it("passes correct parameters to x402Verify", async () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const payload = { txHash: "0xabc", amount: "100" };
    const requirements = { network: "base-sepolia", expectedAmount: "100" };

    await facilitator.verifyPayment(payload, requirements);

    expect(mockVerify).toHaveBeenCalledWith(
      expect.anything(), // client
      payload,
      requirements,
      undefined // config
    );
  });

  it("returns valid:false for unsupported network (not in networks array)", async () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.verifyPayment(
      { txHash: "0xabc" },
      { network: "fantom" }
    );

    expect(result.isValid).toBe(false);
    // Should not call x402Verify for unsupported network
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("returns valid:false for non-EVM network", async () => {
    // Even if we somehow add a non-EVM network to our networks array,
    // it should be rejected by the SupportedEVMNetworks check
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.verifyPayment(
      { txHash: "0xabc" },
      { network: "solana" }
    );

    expect(result.isValid).toBe(false);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("works with multiple configured networks", async () => {
    mockVerify.mockResolvedValueOnce({ isValid: true, payer: "0xtest1" });

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia, base],
    });

    // Test with second network
    const result = await facilitator.verifyPayment(
      { txHash: "0xdef" },
      { network: "base" }
    );

    expect(result.isValid).toBe(true);
    expect(mockCreateConnectedClient).toHaveBeenCalledWith("base");
  });

  it("handles verification errors gracefully", async () => {
    mockVerify.mockRejectedValueOnce(new Error("Network error"));

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    await expect(
      facilitator.verifyPayment(
        { txHash: "0xabc" },
        { network: "base-sepolia" }
      )
    ).rejects.toThrow("Network error");
  });
});

describe("Facilitator.settlePayment", () => {
  beforeEach(() => {
    mockSettle.mockClear();
    mockCreateSigner.mockClear();
  });

  it("returns success:true and transaction when x402Settle succeeds", async () => {
    mockSettle.mockResolvedValueOnce({
      success: true,
      transaction: "0x123abc456def",
      network: "base-sepolia",
      payer: "0xtest",
    });

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.settlePayment(
      { amount: "100" },
      { network: "base-sepolia" }
    );

    expect(result.success).toBe(true);
    expect(result.transaction).toBe("0x123abc456def");
    expect(mockCreateSigner).toHaveBeenCalledWith("base-sepolia", TEST_KEY);
    expect(mockSettle).toHaveBeenCalledTimes(1);
  });

  it("returns success:false when x402Settle fails", async () => {
    mockSettle.mockResolvedValueOnce({
      success: false,
      transaction: "",
      network: "base-sepolia",
      payer: "0xtest",
    });

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.settlePayment(
      { amount: "100" },
      { network: "base-sepolia" }
    );

    expect(result.success).toBe(false);
    // When success is false, the transaction should be empty or undefined
    expect(result.transaction).toBeFalsy();
  });

  it("passes correct parameters to x402Settle", async () => {
    mockSettle.mockResolvedValueOnce({
      success: true,
      transaction: "0xabc",
      network: "base-sepolia",
      payer: "0xtest",
    });

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const payload = { amount: "100", recipient: "0xrecipient" };
    const requirements = { network: "base-sepolia" };

    await facilitator.settlePayment(payload, requirements);

    expect(mockSettle).toHaveBeenCalledWith(
      expect.anything(), // signer
      payload,
      requirements,
      undefined // config
    );
  });

  it("returns success:false for unsupported network (not in networks array)", async () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.settlePayment(
      { amount: "100" },
      { network: "fantom" }
    );

    expect(result.success).toBe(false);
    expect(result.transaction).toBeFalsy();
    // Should not call x402Settle for unsupported network
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("returns success:false for non-EVM network", async () => {
    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.settlePayment(
      { amount: "100" },
      { network: "solana" }
    );

    expect(result.success).toBe(false);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("works with multiple configured networks", async () => {
    mockSettle.mockResolvedValueOnce({
      success: true,
      transaction: "0xmultinet",
      network: "base",
      payer: "0xtest",
    });

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia, base],
    });

    // Test with second network
    const result = await facilitator.settlePayment(
      { amount: "100" },
      { network: "base" }
    );

    expect(result.success).toBe(true);
    expect(result.transaction).toBe("0xmultinet");
    expect(mockCreateSigner).toHaveBeenCalledWith("base", TEST_KEY);
  });

  it("uses the configured evmPrivateKey for signing", async () => {
    const customKey = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    
    mockSettle.mockResolvedValueOnce({
      success: true,
      transaction: "0xsigned",
      network: "base-sepolia",
      payer: "0xtest",
    });

    const facilitator = new Facilitator({
      evmPrivateKey: customKey,
      networks: [baseSepolia],
    });

    await facilitator.settlePayment(
      { amount: "100" },
      { network: "base-sepolia" }
    );

    expect(mockCreateSigner).toHaveBeenCalledWith("base-sepolia", customKey);
  });

  it("handles settlement errors gracefully", async () => {
    mockSettle.mockRejectedValueOnce(new Error("Transaction failed"));

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    await expect(
      facilitator.settlePayment(
        { amount: "100" },
        { network: "base-sepolia" }
      )
    ).rejects.toThrow("Transaction failed");
  });

  it("correctly formats transaction as 0x-prefixed string", async () => {
    mockSettle.mockResolvedValueOnce({
      success: true,
      transaction: "0x1234567890abcdef",
      network: "base-sepolia",
      payer: "0xtest",
    });

    const facilitator = new Facilitator({
      evmPrivateKey: TEST_KEY,
      networks: [baseSepolia],
    });

    const result = await facilitator.settlePayment(
      { amount: "100" },
      { network: "base-sepolia" }
    );

    expect(result.transaction).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});
