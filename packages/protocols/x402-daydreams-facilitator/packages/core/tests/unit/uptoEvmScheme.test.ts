import { describe, it, expect, beforeEach, mock } from "bun:test";
import { UptoEvmScheme } from "../../src/upto/evm/facilitator.js";
import type { FacilitatorEvmSigner } from "@x402/evm";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

const MOCK_OWNER = "0x1234567890123456789012345678901234567890" as const;
const MOCK_SPENDER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const MOCK_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

const createMockSigner = (
  overrides: Partial<FacilitatorEvmSigner> = {}
): FacilitatorEvmSigner =>
  ({
    getAddresses: () => [MOCK_SPENDER],
    verifyTypedData: mock(() => Promise.resolve(true)),
    readContract: mock(() => Promise.resolve(1000000n)),
    writeContract: mock(() => Promise.resolve("0xtxhash")),
    waitForTransactionReceipt: mock(() =>
      Promise.resolve({ status: "success" })
    ),
    ...overrides,
  }) as unknown as FacilitatorEvmSigner;

const createValidPayload = (
  overrides: Partial<PaymentPayload> = {}
): PaymentPayload =>
  ({
    accepted: {
      scheme: "upto",
      network: "eip155:8453",
      ...overrides.accepted,
    },
    payload: {
      authorization: {
        from: MOCK_OWNER,
        to: MOCK_SPENDER,
        value: "1000000",
        validBefore: String(Math.floor(Date.now() / 1000) + 3600),
        nonce: "0",
      },
      signature:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b",
      ...overrides.payload,
    },
  }) as PaymentPayload;

const createValidRequirements = (
  overrides: Partial<PaymentRequirements> = {}
): PaymentRequirements =>
  ({
    scheme: "upto",
    network: "eip155:8453",
    asset: MOCK_ASSET,
    amount: "100000",
    payTo: MOCK_SPENDER,
    extra: {
      name: "USD Coin",
      version: "2",
    },
    ...overrides,
  }) as PaymentRequirements;

describe("UptoEvmScheme", () => {
  let scheme: UptoEvmScheme;
  let mockSigner: FacilitatorEvmSigner;

  beforeEach(() => {
    mockSigner = createMockSigner();
    scheme = new UptoEvmScheme(mockSigner);
  });

  describe("properties", () => {
    it("has scheme set to upto", () => {
      expect(scheme.scheme).toBe("upto");
    });

    it("has caipFamily set to eip155:*", () => {
      expect(scheme.caipFamily).toBe("eip155:*");
    });
  });

  describe("getExtra", () => {
    it("returns undefined for any network", () => {
      expect(scheme.getExtra("eip155:8453")).toBeUndefined();
      expect(scheme.getExtra("eip155:1")).toBeUndefined();
    });
  });

  describe("getSigners", () => {
    it("returns signer addresses", () => {
      const signers = scheme.getSigners("eip155:8453");
      expect(signers).toContain(MOCK_SPENDER);
    });
  });

  describe("verify", () => {
    describe("scheme validation", () => {
      it("rejects unsupported payload scheme", async () => {
        const payload = createValidPayload();
        payload.accepted.scheme = "exact";
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("unsupported_scheme");
      });

      it("rejects unsupported requirements scheme", async () => {
        const payload = createValidPayload();
        const requirements = createValidRequirements();
        requirements.scheme = "exact";

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("unsupported_scheme");
      });
    });

    describe("payload validation", () => {
      it("rejects missing authorization", async () => {
        const payload = createValidPayload();
        (payload.payload as Record<string, unknown>).authorization = undefined;
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_upto_evm_payload");
      });

      it("rejects missing signature", async () => {
        const payload = createValidPayload();
        (payload.payload as Record<string, unknown>).signature = undefined;
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_upto_evm_payload");
      });

      it("rejects missing owner (from)", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.from = undefined;
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_upto_evm_payload");
      });

      it("rejects missing nonce", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.nonce = undefined;
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_upto_evm_payload");
      });

      it("rejects missing validBefore", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.validBefore = undefined;
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_upto_evm_payload");
      });

      it("rejects missing value", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.value = undefined;
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_upto_evm_payload");
      });
    });

    describe("network validation", () => {
      it("rejects network mismatch", async () => {
        const payload = createValidPayload();
        payload.accepted.network = "eip155:1";
        const requirements = createValidRequirements();
        requirements.network = "eip155:8453";

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("network_mismatch");
      });
    });

    describe("EIP-712 domain validation", () => {
      it("rejects missing name in extra", async () => {
        const payload = createValidPayload();
        const requirements = createValidRequirements();
        requirements.extra = { version: "2" };

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("missing_eip712_domain");
      });

      it("rejects missing version in extra", async () => {
        const payload = createValidPayload();
        const requirements = createValidRequirements();
        requirements.extra = { name: "USD Coin" };

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("missing_eip712_domain");
      });
    });

    describe("recipient validation", () => {
      it("allows different payTo from authorization.to (facilitator transfers to merchant)", async () => {
        // In upto scheme: authorization.to = facilitator (spender), payTo = merchant (recipient)
        // These are meant to be different - facilitator gets allowance, then transfers to payTo
        const payload = createValidPayload();
        const requirements = createValidRequirements();
        requirements.payTo = "0x9999999999999999999999999999999999999999";

        const result = await scheme.verify(payload, requirements);

        // Valid because authorization.to (facilitator) is still in signer addresses
        expect(result.isValid).toBe(true);
      });

      it("rejects when spender (authorization.to) is not the facilitator", async () => {
        // The permit spender must be the facilitator who will call transferFrom
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.to = "0x9999999999999999999999999999999999999999"; // not the facilitator
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("spender_not_facilitator");
      });
    });

    describe("cap validation", () => {
      it("rejects when cap is below required amount", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.value = "50000"; // cap = 50000
        const requirements = createValidRequirements();
        requirements.amount = "100000"; // required = 100000

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("cap_too_low");
      });

      it("accepts when cap equals required amount", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.value = "100000";
        const requirements = createValidRequirements();
        requirements.amount = "100000";

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(true);
      });

      it("rejects when cap is below maxAmountRequired", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.value = "500000"; // cap
        const requirements = createValidRequirements();
        requirements.amount = "100000";
        (requirements.extra as Record<string, unknown>).maxAmountRequired =
          "1000000";

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("cap_below_required_max");
      });
    });

    describe("expiration validation", () => {
      it("rejects expired authorization", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.validBefore = String(Math.floor(Date.now() / 1000) - 100); // expired
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("authorization_expired");
      });

      it("rejects authorization expiring within 6 seconds", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.validBefore = String(Math.floor(Date.now() / 1000) + 3); // 3 seconds from now
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("authorization_expired");
      });
    });

    describe("chain ID validation", () => {
      it("rejects invalid chain ID format", async () => {
        const payload = createValidPayload();
        payload.accepted.network = "eip155:invalid";
        const requirements = createValidRequirements();
        requirements.network = "eip155:invalid";

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_chain_id");
      });
    });

    describe("signature verification", () => {
      it("rejects invalid permit signature", async () => {
        mockSigner = createMockSigner({
          verifyTypedData: mock(() => Promise.resolve(false)),
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_permit_signature");
      });

      it("handles signature verification exception", async () => {
        mockSigner = createMockSigner({
          verifyTypedData: mock(() =>
            Promise.reject(new Error("Verification error"))
          ),
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_permit_signature");
      });

      it("returns valid for correct signature", async () => {
        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(true);
        expect(result.payer).toBe(MOCK_OWNER);
      });
    });

    describe("balance preflight", () => {
      it("rejects underfunded payer when balance check is enabled", async () => {
        mockSigner = createMockSigner({
          readContract: mock(() => Promise.resolve(50n)),
        });
        scheme = new UptoEvmScheme(mockSigner, {
          verifyBalanceCheck: true,
        });

        const payload = createValidPayload();
        const requirements = createValidRequirements();
        requirements.amount = "100000";

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("insufficient_balance");
      });

      it("returns balance_check_failed when balance preflight RPC call fails", async () => {
        mockSigner = createMockSigner({
          readContract: mock(() => Promise.reject(new Error("RPC unavailable"))),
        });
        scheme = new UptoEvmScheme(mockSigner, {
          verifyBalanceCheck: true,
        });

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("balance_check_failed");
      });

      it("does not run balance preflight when signature is invalid", async () => {
        const readContractMock = mock(() => Promise.resolve(1000000n));
        mockSigner = createMockSigner({
          readContract: readContractMock,
          verifyTypedData: mock(() => Promise.resolve(false)),
        });
        scheme = new UptoEvmScheme(mockSigner, {
          verifyBalanceCheck: true,
        });

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("invalid_permit_signature");
        expect(readContractMock).not.toHaveBeenCalled();
      });

      it("does not run balance preflight when authorization is expired", async () => {
        const readContractMock = mock(() => Promise.resolve(1000000n));
        mockSigner = createMockSigner({
          readContract: readContractMock,
        });
        scheme = new UptoEvmScheme(mockSigner, {
          verifyBalanceCheck: true,
        });

        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.validBefore = String(Math.floor(Date.now() / 1000) - 100);
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.invalidReason).toBe("authorization_expired");
        expect(readContractMock).not.toHaveBeenCalled();
      });
    });

    describe("payer extraction", () => {
      it("includes payer in response even on failure", async () => {
        const payload = createValidPayload();
        payload.accepted.scheme = "exact"; // will fail
        const requirements = createValidRequirements();

        const result = await scheme.verify(payload, requirements);

        expect(result.isValid).toBe(false);
        expect(result.payer).toBe(MOCK_OWNER);
      });
    });
  });

  describe("settle", () => {
    describe("verification failure", () => {
      it("returns error when verification fails", async () => {
        const payload = createValidPayload();
        payload.accepted.scheme = "exact"; // will fail verification
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(false);
        expect(result.errorReason).toBe("unsupported_scheme");
      });
    });

    describe("cap validation", () => {
      it("rejects when total exceeds cap", async () => {
        const payload = createValidPayload();
        const auth = (payload.payload as Record<string, unknown>)
          .authorization as Record<string, unknown>;
        auth.value = "100000"; // cap
        const requirements = createValidRequirements();
        requirements.amount = "200000"; // exceeds cap

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(false);
        expect(result.errorReason).toBe("cap_too_low");
      });
    });

    describe("signature parsing", () => {
      it("rejects unsupported signature type", async () => {
        const payload = createValidPayload();
        (payload.payload as Record<string, unknown>).signature = "0x"; // invalid signature
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(false);
        expect(result.errorReason).toBe("unsupported_signature_type");
      });
    });

    describe("permit execution", () => {
      it("calls writeContract with permit function", async () => {
        const writeContractMock = mock(() =>
          Promise.resolve("0xpermittx" as `0x${string}`)
        );
        mockSigner = createMockSigner({
          writeContract: writeContractMock,
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        await scheme.settle(payload, requirements);

        expect(writeContractMock).toHaveBeenCalled();
        const firstCall = writeContractMock.mock.calls[0][0] as {
          functionName: string;
        };
        expect(firstCall.functionName).toBe("permit");
      });
    });

    describe("permit fallback to allowance", () => {
      it("checks allowance when permit fails", async () => {
        const readContractMock = mock(() => Promise.resolve(1000000n));
        const writeContractMock = mock()
          .mockImplementationOnce(() =>
            Promise.reject(new Error("Permit failed"))
          )
          .mockImplementation(() => Promise.resolve("0xtx" as `0x${string}`));

        mockSigner = createMockSigner({
          readContract: readContractMock,
          writeContract: writeContractMock,
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(readContractMock).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });

      it("returns insufficient_allowance when allowance is too low", async () => {
        const readContractMock = mock(() => Promise.resolve(50n)); // low allowance
        const writeContractMock = mock(() =>
          Promise.reject(new Error("Permit failed"))
        );

        mockSigner = createMockSigner({
          readContract: readContractMock,
          writeContract: writeContractMock,
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(false);
        expect(result.errorReason).toBe("insufficient_allowance");
      });

      it("returns permit_failed when allowance check throws", async () => {
        const writeContractMock = mock(() =>
          Promise.reject(new Error("Permit failed"))
        );
        const readContractMock = mock(() =>
          Promise.reject(new Error("Read failed"))
        );

        mockSigner = createMockSigner({
          readContract: readContractMock,
          writeContract: writeContractMock,
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(false);
        expect(result.errorReason).toBe("permit_failed");
      });
    });

    describe("transferFrom execution", () => {
      it("executes transferFrom after successful permit", async () => {
        const writeContractMock = mock(() =>
          Promise.resolve("0xtx" as `0x${string}`)
        );
        mockSigner = createMockSigner({
          writeContract: writeContractMock,
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        await scheme.settle(payload, requirements);

        // Should be called twice: permit and transferFrom
        expect(writeContractMock.mock.calls.length).toBeGreaterThanOrEqual(2);
        const secondCall = writeContractMock.mock.calls[1][0] as {
          functionName: string;
        };
        expect(secondCall.functionName).toBe("transferFrom");
      });

      it("returns transaction hash on success", async () => {
        mockSigner = createMockSigner({
          writeContract: mock(() =>
            Promise.resolve("0xsuccesstx" as `0x${string}`)
          ),
          waitForTransactionReceipt: mock(() =>
            Promise.resolve({ status: "success" })
          ),
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(true);
        expect(result.transaction).toBe("0xsuccesstx");
      });

      it("returns invalid_transaction_state when receipt status is not success", async () => {
        mockSigner = createMockSigner({
          waitForTransactionReceipt: mock(() =>
            Promise.resolve({ status: "reverted" })
          ),
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(false);
        expect(result.errorReason).toBe("invalid_transaction_state");
      });

      it("returns transaction_failed when transferFrom throws", async () => {
        const writeContractMock = mock()
          .mockImplementationOnce(() =>
            Promise.resolve("0xpermittx" as `0x${string}`)
          )
          .mockImplementationOnce(() =>
            Promise.reject(new Error("Transfer failed"))
          );

        mockSigner = createMockSigner({
          writeContract: writeContractMock,
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(false);
        expect(result.errorReason).toBe("transaction_failed");
      });

      it("returns insufficient_balance when transferFrom reverts for low balance", async () => {
        const writeContractMock = mock()
          .mockImplementationOnce(() =>
            Promise.resolve("0xpermittx" as `0x${string}`)
          )
          .mockImplementationOnce(() =>
            Promise.reject(
              new Error("ERC20: transfer amount exceeds balance")
            )
          );

        mockSigner = createMockSigner({
          writeContract: writeContractMock,
        });
        scheme = new UptoEvmScheme(mockSigner);

        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.success).toBe(false);
        expect(result.errorReason).toBe("insufficient_balance");
      });
    });

    describe("response fields", () => {
      it("includes network in response", async () => {
        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.network).toBe("eip155:8453");
      });

      it("includes payer in response", async () => {
        const payload = createValidPayload();
        const requirements = createValidRequirements();

        const result = await scheme.settle(payload, requirements);

        expect(result.payer).toBeDefined();
      });
    });
  });
});
