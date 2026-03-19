import { describe, it, expect, beforeAll, vi, afterAll } from "vitest";
import { Address, Cell, beginCell, loadMessage } from "@ton/core";
import { mnemonicNew } from "@ton/crypto";
import { ClientTonSigner } from "../../src/signer";
import { TON_MAINNET, USDT_MAINNET_MASTER, JETTON_TRANSFER_OP } from "../../src/constants";
import type { TonExtra } from "../../src/types";

const MOCK_JETTON_WALLET =
  "0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

// Build a mock TONAPI estimate response with realistic messages
function buildMockEstimateResponse(jettonWallet: string) {
  // Message 1: the actual jetton transfer (echoed back)
  const body1 = beginCell()
    .storeUint(JETTON_TRANSFER_OP, 32)
    .storeUint(0, 64)
    .storeCoins(1000000n)
    .storeAddress(Address.parse("0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"))
    .storeAddress(Address.parse(MOCK_JETTON_WALLET))
    .storeBit(0)
    .storeCoins(1n)
    .storeBit(0)
    .endCell();

  // Message 2: commission transfer to relay
  const body2 = beginCell()
    .storeUint(JETTON_TRANSFER_OP, 32)
    .storeUint(0, 64)
    .storeCoins(120000n) // commission
    .storeAddress(Address.parse("0:7ae5056c3fd9406f9bbbe7c7089cd4c40801d9075486cbedb7ce12df119eacf1"))
    .storeAddress(Address.parse(MOCK_JETTON_WALLET))
    .storeBit(0)
    .storeCoins(1n)
    .storeBit(0)
    .endCell();

  return {
    protocol_name: "gasless",
    relay_address: "0:7ae5056c3fd9406f9bbbe7c7089cd4c40801d9075486cbedb7ce12df119eacf1",
    commission: "120000",
    from: MOCK_JETTON_WALLET,
    valid_until: Math.floor(Date.now() / 1000) + 120,
    messages: [
      {
        address: jettonWallet,
        amount: "100000000",
        payload: body1.toBoc().toString("hex"),
      },
      {
        address: jettonWallet,
        amount: "25000000",
        payload: body2.toBoc().toString("hex"),
      },
    ],
  };
}

// Mock TonClient to avoid real network calls
vi.mock("@ton/ton", async () => {
  const actual = await vi.importActual("@ton/ton");
  return {
    ...actual,
    TonClient: vi.fn().mockImplementation(() => ({
      open: vi.fn().mockReturnValue({
        getSeqno: vi.fn().mockResolvedValue(5),
      }),
      runMethod: vi.fn().mockResolvedValue({
        stack: {
          readAddress: vi.fn().mockReturnValue(
            Address.parse(MOCK_JETTON_WALLET),
          ),
        },
      }),
    })),
  };
});

// Import SchemeNetworkClient after mock is set up
const { SchemeNetworkClient } = await import(
  "../../src/exact/client/scheme"
);

describe("SchemeNetworkClient", () => {
  let signer: ClientTonSigner;
  let client: InstanceType<typeof SchemeNetworkClient>;
  const vendorAddress =
    "0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const relayAddress =
    "0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  const extraWithRelay: TonExtra = {
    relayAddress,
    maxRelayCommission: "50000",
    assetDecimals: 9,
    assetSymbol: "TON",
  };

  const extraNoRelay: TonExtra = {
    assetDecimals: 9,
    assetSymbol: "TON",
  };

  // Mock fetch for TONAPI gasless estimate
  const originalFetch = globalThis.fetch;
  beforeAll(async () => {
    const mnemonic = await mnemonicNew(24);
    signer = new ClientTonSigner(mnemonic);
    await signer.init();
    client = new SchemeNetworkClient(signer);

    // Mock global fetch for TONAPI estimate calls
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/v2/gasless/estimate/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(buildMockEstimateResponse(MOCK_JETTON_WALLET)),
          text: () => Promise.resolve(""),
        });
      }
      return originalFetch(url);
    }) as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('scheme property is "exact"', () => {
    expect(client.scheme).toBe("exact");
  });

  it("createPaymentPayload for native TON returns valid ExactTonPayload", async () => {
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000", // 1 TON in nanotons
      "native",
      vendorAddress,
      120,
    );

    expect(payload).toBeDefined();
    expect(payload.signedBoc).toBeTruthy();
    expect(payload.walletPublicKey).toBeTruthy();
    expect(payload.walletAddress).toMatch(/^0:[0-9a-f]{64}$/);
    expect(payload.seqno).toBe(5);
    expect(payload.validUntil).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("createPaymentPayload for USDT with gasless returns valid ExactTonPayload", async () => {
    const extraUsdt: TonExtra = {
      relayAddress,
      maxRelayCommission: "10000",
      assetDecimals: 6,
      assetSymbol: "USDT",
    };
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000", // 1 USDT
      USDT_MAINNET_MASTER,
      vendorAddress,
      120,
      extraUsdt,
    );

    expect(payload).toBeDefined();
    expect(payload.signedBoc).toBeTruthy();
    expect(payload.walletPublicKey).toBeTruthy();
    expect(payload.walletAddress).toMatch(/^0:[0-9a-f]{64}$/);
    expect(payload.seqno).toBe(5);
    expect(payload.validUntil).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("returned signedBoc is valid base64", async () => {
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
    );

    // Should not throw when decoding base64
    const decoded = Buffer.from(payload.signedBoc, "base64");
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("returned walletPublicKey matches signer", async () => {
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
    );

    expect(payload.walletPublicKey).toBe(signer.getPublicKey());
  });

  it("returned walletAddress matches signer address", async () => {
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
    );

    expect(payload.walletAddress).toBe(signer.getAddress());
  });

  it("seqno is included in payload", async () => {
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
    );

    expect(typeof payload.seqno).toBe("number");
    expect(payload.seqno).toBe(5);
  });

  it("validUntil is approximately now + maxTimeoutSeconds", async () => {
    const before = Math.floor(Date.now() / 1000);
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
    );
    const after = Math.floor(Date.now() / 1000);

    expect(payload.validUntil).toBeGreaterThanOrEqual(before + 120);
    expect(payload.validUntil).toBeLessThanOrEqual(after + 120);
  });

  it("native TON with relay commission creates valid payload", async () => {
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
      extraWithRelay,
    );

    expect(payload.signedBoc).toBeTruthy();
    const decoded = Buffer.from(payload.signedBoc, "base64");
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("native TON with zero relay commission skips commission message", async () => {
    const extraZeroCommission: TonExtra = {
      relayAddress,
      maxRelayCommission: "0",
      assetDecimals: 9,
      assetSymbol: "TON",
    };
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
      extraZeroCommission,
    );

    expect(payload.signedBoc).toBeTruthy();
  });

  it("native TON without relay extra creates valid payload", async () => {
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
      extraNoRelay,
    );

    expect(payload.signedBoc).toBeTruthy();
  });

  it("USDT gasless with relay creates valid payload", async () => {
    const extraUsdt: TonExtra = {
      relayAddress,
      maxRelayCommission: "10000",
      assetDecimals: 6,
      assetSymbol: "USDT",
    };
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000",
      USDT_MAINNET_MASTER,
      vendorAddress,
      120,
      extraUsdt,
    );

    expect(payload.signedBoc).toBeTruthy();
    const decoded = Buffer.from(payload.signedBoc, "base64");
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("extra is optional (no relay)", async () => {
    const payload = await client.createPaymentPayload(
      TON_MAINNET,
      "1000000000",
      "native",
      vendorAddress,
      120,
    );

    expect(payload.signedBoc).toBeTruthy();
  });

  it("unsupported network throws error", async () => {
    await expect(
      client.createPaymentPayload(
        "tvm:-999",
        "1000000000",
        "native",
        vendorAddress,
        120,
      ),
    ).rejects.toThrow("Unsupported network: tvm:-999");
  });

  describe("gasless with seqno=0", () => {
    it("throws when gasless signing is requested with seqno=0 (undeployed wallet)", async () => {
      // Re-mock TonClient to return seqno=0
      const { TonClient: MockedTonClient } = await import("@ton/ton");
      const mockImpl = vi.mocked(MockedTonClient);
      mockImpl.mockImplementationOnce(() => ({
        open: vi.fn().mockReturnValue({
          getSeqno: vi.fn().mockResolvedValue(0),
        }),
        runMethod: vi.fn().mockResolvedValue({
          stack: {
            readAddress: vi.fn().mockReturnValue(
              Address.parse(MOCK_JETTON_WALLET),
            ),
          },
        }),
      }) as unknown as InstanceType<typeof MockedTonClient>);

      // Create a fresh client with the seqno=0 mock
      const freshClient = new SchemeNetworkClient(signer);

      const extraUsdt: TonExtra = {
        relayAddress:
          "0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        maxRelayCommission: "10000",
        assetDecimals: 6,
        assetSymbol: "USDT",
      };

      // Non-native asset + relayAddress → gasless mode → seqno=0 should throw
      await expect(
        freshClient.createPaymentPayload(
          TON_MAINNET,
          "1000000",
          "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe",
          vendorAddress,
          120,
          extraUsdt,
        ),
      ).rejects.toThrow("Gasless signing requires a deployed wallet");
    });
  });

  describe("auto-detection of gasless auth", () => {
    it("USDT + relayAddress auto-detects internal auth (opcode 0x73696e74 in BOC)", async () => {
      const extraUsdt: TonExtra = {
        relayAddress,
        maxRelayCommission: "10000",
        assetDecimals: 6,
        assetSymbol: "USDT",
      };
      const payload = await client.createPaymentPayload(
        TON_MAINNET,
        "1000000",
        USDT_MAINNET_MASTER,
        vendorAddress,
        120,
        extraUsdt,
      );

      expect(payload.signedBoc).toBeTruthy();
      expect(payload.walletPublicKey).toBeTruthy();
      expect(payload.walletAddress).toMatch(/^0:[0-9a-f]{64}$/);
      expect(payload.seqno).toBe(5);

      // signedBoc is always external-in — decode and check opcode
      const rootCell = Cell.fromBoc(Buffer.from(payload.signedBoc, "base64"))[0]!;
      const msg = loadMessage(rootCell.beginParse());
      expect(msg.info.type).toBe("external-in");

      // Extract opcode from signed body (bits before 512-bit signature)
      const bodySlice = msg.body.beginParse();
      const bodyBitLength = bodySlice.remainingBits - 512;
      const bodyBits = bodySlice.loadBits(bodyBitLength);
      const signedBody = beginCell().storeBits(bodyBits).endCell();
      const opcode = signedBody.beginParse().loadUint(32);
      // 0x73696e74 = internal auth (gasless)
      expect(opcode).toBe(0x73696e74);
    });

    it("USDT + relayAddress payload has no gasless field", async () => {
      const extraUsdt: TonExtra = {
        relayAddress,
        maxRelayCommission: "10000",
        assetDecimals: 6,
        assetSymbol: "USDT",
      };
      const payload = await client.createPaymentPayload(
        TON_MAINNET,
        "1000000",
        USDT_MAINNET_MASTER,
        vendorAddress,
        120,
        extraUsdt,
      );

      expect((payload as Record<string, unknown>)["gasless"]).toBeUndefined();
    });

    it("native TON + relayAddress uses external auth (not internal)", async () => {
      const payload = await client.createPaymentPayload(
        TON_MAINNET,
        "1000000000",
        "native",
        vendorAddress,
        120,
        extraWithRelay,
      );

      expect(payload.signedBoc).toBeTruthy();

      // Decode and check opcode is external (0x7369676e), not internal
      const rootCell = Cell.fromBoc(Buffer.from(payload.signedBoc, "base64"))[0]!;
      const msg = loadMessage(rootCell.beginParse());
      expect(msg.info.type).toBe("external-in");

      const bodySlice = msg.body.beginParse();
      const bodyBitLength = bodySlice.remainingBits - 512;
      const bodyBits = bodySlice.loadBits(bodyBitLength);
      const signedBody = beginCell().storeBits(bodyBits).endCell();
      const opcode = signedBody.beginParse().loadUint(32);
      // 0x7369676e = external auth (not gasless — native TON never uses internal auth)
      expect(opcode).toBe(0x7369676e);
    });

    it("all payloads are wrapped in external-in message", async () => {
      const nativePayload = await client.createPaymentPayload(
        TON_MAINNET,
        "1000000000",
        "native",
        vendorAddress,
        120,
      );
      const nativeRoot = Cell.fromBoc(Buffer.from(nativePayload.signedBoc, "base64"))[0]!;
      expect(loadMessage(nativeRoot.beginParse()).info.type).toBe("external-in");

      const extraUsdt: TonExtra = {
        relayAddress,
        maxRelayCommission: "10000",
        assetDecimals: 6,
        assetSymbol: "USDT",
      };
      const usdtPayload = await client.createPaymentPayload(
        TON_MAINNET,
        "1000000",
        USDT_MAINNET_MASTER,
        vendorAddress,
        120,
        extraUsdt,
      );
      const usdtRoot = Cell.fromBoc(Buffer.from(usdtPayload.signedBoc, "base64"))[0]!;
      expect(loadMessage(usdtRoot.beginParse()).info.type).toBe("external-in");
    });
  });

  describe("TONAPI gasless estimate integration", () => {
    it("calls TONAPI /v2/gasless/estimate for USDT+relayAddress", async () => {
      const extraUsdt: TonExtra = {
        relayAddress,
        maxRelayCommission: "10000",
        assetDecimals: 6,
        assetSymbol: "USDT",
      };
      await client.createPaymentPayload(
        TON_MAINNET,
        "1000000",
        USDT_MAINNET_MASTER,
        vendorAddress,
        120,
        extraUsdt,
      );

      // Verify fetch was called with the estimate endpoint
      const fetchMock = vi.mocked(globalThis.fetch);
      const estimateCall = fetchMock.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("/v2/gasless/estimate/"),
      );
      expect(estimateCall).toBeDefined();
      expect(estimateCall![0]).toContain(USDT_MAINNET_MASTER);
    });

    it("does NOT call TONAPI for native TON transfers", async () => {
      const fetchMock = vi.mocked(globalThis.fetch);
      fetchMock.mockClear();

      await client.createPaymentPayload(
        TON_MAINNET,
        "1000000000",
        "native",
        vendorAddress,
        120,
      );

      const estimateCall = fetchMock.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("/v2/gasless/estimate/"),
      );
      expect(estimateCall).toBeUndefined();
    });
  });
});
