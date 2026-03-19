#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  adaptRequirementsV1ToV2,
  adaptRequirementsV2ToV1,
  adaptVerifyResponseV2ToV1,
  adaptSettleResponseV2ToV1,
  adaptSettleResponseV1ToV2,
  adaptSupportedKindV2ToV1,
  adaptSupportedKindV1ToV2,
  adaptPayloadV1ToV2,
} from "@faremeter/facilitator";
import type { NetworkTranslator } from "@faremeter/types/x402-adapters";
import type { x402PaymentRequirements as x402PaymentRequirementsV1 } from "@faremeter/types/x402";
import type {
  x402PaymentRequirements,
  x402ResourceInfo,
} from "@faremeter/types/x402v2";

const identity: NetworkTranslator = (n) => n;

await t.test("x402 v1/v2 adapter roundtrip tests", async (t) => {
  await t.test("requirements v1 -> v2 conversion", async (t) => {
    const v1Req: x402PaymentRequirementsV1 = {
      scheme: "exact-evm",
      network: "eip155:84532",
      maxAmountRequired: "1000000",
      resource: "https://example.com/api",
      description: "Test resource",
      mimeType: "application/json",
      payTo: "0x1234567890abcdef",
      maxTimeoutSeconds: 60,
      asset: "0xUSDC",
      extra: { customField: "value" },
    };

    const v2Req = adaptRequirementsV1ToV2(v1Req, identity);

    t.equal(v2Req.scheme, v1Req.scheme, "scheme should match");
    t.equal(v2Req.network, v1Req.network, "network should match");
    t.equal(
      v2Req.amount,
      v1Req.maxAmountRequired,
      "amount should equal maxAmountRequired",
    );
    t.equal(v2Req.asset, v1Req.asset, "asset should match");
    t.equal(v2Req.payTo, v1Req.payTo, "payTo should match");
    t.equal(
      v2Req.maxTimeoutSeconds,
      v1Req.maxTimeoutSeconds,
      "maxTimeoutSeconds should match",
    );
    t.same(v2Req.extra, v1Req.extra, "extra should match");

    t.end();
  });

  await t.test("requirements v2 -> v1 conversion", async (t) => {
    const v2Req: x402PaymentRequirements = {
      scheme: "exact-evm",
      network: "eip155:84532",
      amount: "1000000",
      payTo: "0x1234567890abcdef",
      maxTimeoutSeconds: 60,
      asset: "0xUSDC",
      extra: { customField: "value" },
    };

    const resourceInfo = {
      url: "https://example.com/api",
      description: "Test resource",
      mimeType: "application/json",
    };

    const v1Req = adaptRequirementsV2ToV1(v2Req, resourceInfo);

    t.equal(v1Req.scheme, v2Req.scheme, "scheme should match");
    t.equal(v1Req.network, v2Req.network, "network should match");
    t.equal(
      v1Req.maxAmountRequired,
      v2Req.amount,
      "maxAmountRequired should equal amount",
    );
    t.equal(v1Req.resource, resourceInfo.url, "resource should match URL");
    t.equal(
      v1Req.description,
      resourceInfo.description,
      "description should match",
    );
    t.equal(v1Req.mimeType, resourceInfo.mimeType, "mimeType should match");
    t.equal(v1Req.asset, v2Req.asset, "asset should match");
    t.equal(v1Req.payTo, v2Req.payTo, "payTo should match");
    t.equal(
      v1Req.maxTimeoutSeconds,
      v2Req.maxTimeoutSeconds,
      "maxTimeoutSeconds should match",
    );
    t.same(v1Req.extra, v2Req.extra, "extra should match");

    t.end();
  });

  await t.test(
    "requirements v1 -> v2 -> v1 roundtrip preserves data",
    async (t) => {
      const originalV1: x402PaymentRequirementsV1 = {
        scheme: "exact-solana",
        network: "solana:devnet",
        maxAmountRequired: "5000000",
        resource: "https://api.example.com/resource",
        description: "API access",
        mimeType: "application/json",
        payTo: "someWalletAddress",
        maxTimeoutSeconds: 120,
        asset: "USDC",
        extra: { tier: "premium" },
      };

      const v2 = adaptRequirementsV1ToV2(originalV1, identity);
      const resourceInfo: x402ResourceInfo = {
        url: originalV1.resource,
        description: originalV1.description,
      };
      if (originalV1.mimeType) {
        resourceInfo.mimeType = originalV1.mimeType;
      }
      const roundtripV1 = adaptRequirementsV2ToV1(v2, resourceInfo);

      t.equal(roundtripV1.scheme, originalV1.scheme, "scheme preserved");
      t.equal(roundtripV1.network, originalV1.network, "network preserved");
      t.equal(
        roundtripV1.maxAmountRequired,
        originalV1.maxAmountRequired,
        "maxAmountRequired preserved",
      );
      t.equal(roundtripV1.resource, originalV1.resource, "resource preserved");
      t.equal(
        roundtripV1.description,
        originalV1.description,
        "description preserved",
      );
      t.equal(roundtripV1.mimeType, originalV1.mimeType, "mimeType preserved");
      t.equal(roundtripV1.asset, originalV1.asset, "asset preserved");
      t.equal(roundtripV1.payTo, originalV1.payTo, "payTo preserved");
      t.equal(
        roundtripV1.maxTimeoutSeconds,
        originalV1.maxTimeoutSeconds,
        "maxTimeoutSeconds preserved",
      );
      t.same(roundtripV1.extra, originalV1.extra, "extra preserved");

      t.end();
    },
  );

  await t.test("verify response v2 -> v1 conversion", async (t) => {
    const v2Valid = { isValid: true as const, payer: "0xPayer" };
    const v1Valid = adaptVerifyResponseV2ToV1(v2Valid);

    t.equal(v1Valid.isValid, true, "isValid should be true");

    const v2Invalid = {
      isValid: false as const,
      invalidReason: "signature_expired",
    };
    const v1Invalid = adaptVerifyResponseV2ToV1(v2Invalid);

    t.equal(v1Invalid.isValid, false, "isValid should be false");
    t.equal(
      v1Invalid.invalidReason,
      "signature_expired",
      "invalidReason should match",
    );

    t.end();
  });

  await t.test("settle response v2 -> v1 conversion", async (t) => {
    const v2Success = {
      success: true as const,
      transaction: "0xabc123",
      network: "eip155:84532",
      payer: "0xPayer",
    };
    const v1Success = adaptSettleResponseV2ToV1(v2Success);

    t.equal(v1Success.success, true, "success should be true");
    t.equal(
      v1Success.transaction,
      "0xabc123",
      "transaction should match (spec-compliant field name)",
    );
    t.equal(
      v1Success.network,
      "eip155:84532",
      "network should match (spec-compliant field name)",
    );

    const v2Failure = {
      success: false as const,
      errorReason: "insufficient_funds",
      transaction: "",
      network: "",
    };
    const v1Failure = adaptSettleResponseV2ToV1(v2Failure);

    t.equal(v1Failure.success, false, "success should be false");
    t.equal(
      v1Failure.errorReason,
      "insufficient_funds",
      "errorReason should match (spec-compliant field name)",
    );

    t.end();
  });

  await t.test("supported kind v2 -> v1 -> v2 roundtrip", async (t) => {
    const originalV2 = {
      x402Version: 2 as const,
      scheme: "exact-evm",
      network: "eip155:8453",
      extra: { supportedAssets: ["USDC", "ETH"] },
    };

    const v1 = adaptSupportedKindV2ToV1(originalV2);
    t.equal(v1.x402Version, 1, "v1 should have x402Version 1");
    t.equal(v1.scheme, originalV2.scheme, "scheme should match");
    t.equal(v1.network, originalV2.network, "network should match");
    t.same(v1.extra, originalV2.extra, "extra should match");

    const roundtripV2 = adaptSupportedKindV1ToV2(v1, identity);
    t.equal(roundtripV2.x402Version, 2, "roundtrip should have x402Version 2");
    t.equal(roundtripV2.scheme, originalV2.scheme, "scheme preserved");
    t.equal(roundtripV2.network, originalV2.network, "network preserved");
    t.same(roundtripV2.extra, originalV2.extra, "extra preserved");

    t.end();
  });

  await t.test("payload v1 -> v2 conversion", async (t) => {
    const v1Payload = {
      x402Version: 1 as const,
      scheme: "exact-evm",
      network: "eip155:84532",
      asset: "0xUSDC",
      payload: { signature: "0xabc123", nonce: 42 },
    };

    const v1Requirements: x402PaymentRequirementsV1 = {
      scheme: "exact-evm",
      network: "eip155:84532",
      maxAmountRequired: "1000000",
      resource: "https://example.com/api",
      description: "Test",
      mimeType: "application/json",
      payTo: "0x1234",
      maxTimeoutSeconds: 60,
      asset: "0xUSDC",
    };

    const v2Payload = adaptPayloadV1ToV2(v1Payload, v1Requirements, identity);

    t.equal(v2Payload.x402Version, 2, "v2 payload should have x402Version 2");
    t.same(v2Payload.payload, v1Payload.payload, "payload data should match");
    t.equal(
      v2Payload.accepted.scheme,
      v1Requirements.scheme,
      "accepted.scheme should match",
    );
    t.equal(
      v2Payload.accepted.network,
      v1Requirements.network,
      "accepted.network should match",
    );
    t.equal(
      v2Payload.accepted.amount,
      v1Requirements.maxAmountRequired,
      "accepted.amount should match",
    );

    t.ok(v2Payload.resource, "v2 payload should include resource");
    t.equal(
      v2Payload.resource?.url,
      v1Requirements.resource,
      "resource.url should match v1 resource",
    );
    t.equal(
      v2Payload.resource?.description,
      v1Requirements.description,
      "resource.description should match v1 description",
    );
    t.equal(
      v2Payload.resource?.mimeType,
      v1Requirements.mimeType,
      "resource.mimeType should match v1 mimeType",
    );

    t.end();
  });

  await t.test(
    "payload v1 -> v2 omits empty description and mimeType from resource",
    async (t) => {
      const v1Payload = {
        x402Version: 1 as const,
        scheme: "exact-evm",
        network: "eip155:84532",
        asset: "0xUSDC",
        payload: { signature: "0xdef456" },
      };

      const v1Requirements: x402PaymentRequirementsV1 = {
        scheme: "exact-evm",
        network: "eip155:84532",
        maxAmountRequired: "500000",
        resource: "https://example.com/data",
        description: "",
        mimeType: "",
        payTo: "0xabcd",
        maxTimeoutSeconds: 30,
        asset: "0xUSDC",
      };

      const v2Payload = adaptPayloadV1ToV2(v1Payload, v1Requirements, identity);

      t.ok(v2Payload.resource, "v2 payload should include resource");
      t.equal(
        v2Payload.resource?.url,
        "https://example.com/data",
        "resource.url should match",
      );
      t.notOk(
        v2Payload.resource && "description" in v2Payload.resource,
        "resource should not have empty description",
      );
      t.notOk(
        v2Payload.resource && "mimeType" in v2Payload.resource,
        "resource should not have empty mimeType",
      );

      t.end();
    },
  );

  await t.test("requirements without extra field", async (t) => {
    const v1Req: x402PaymentRequirementsV1 = {
      scheme: "exact-evm",
      network: "eip155:84532",
      maxAmountRequired: "1000000",
      resource: "https://example.com/api",
      description: "Test",
      mimeType: "application/json",
      payTo: "0x1234",
      maxTimeoutSeconds: 60,
      asset: "0xUSDC",
      // No extra field
    };

    const v2Req = adaptRequirementsV1ToV2(v1Req, identity);

    t.notOk(
      "extra" in v2Req && v2Req.extra !== undefined,
      "v2 should not have extra field if v1 didnt have one",
    );

    const resourceInfo = { url: v1Req.resource };
    const roundtripV1 = adaptRequirementsV2ToV1(v2Req, resourceInfo);

    t.notOk(
      "extra" in roundtripV1 && roundtripV1.extra !== undefined,
      "roundtrip should not add extra field",
    );

    t.end();
  });
});

await t.test("v2-to-v1 adapters with network translator", async (t) => {
  const translator: NetworkTranslator = (network: string) => {
    const mapping: Record<string, string> = {
      "eip155:8453": "base",
      "eip155:84532": "base-sepolia",
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "solana-mainnet-beta",
    };
    return mapping[network] ?? network;
  };

  await t.test(
    "adaptRequirementsV2ToV1 translates CAIP-2 network to legacy name",
    (t) => {
      const v2Req: x402PaymentRequirements = {
        scheme: "exact-evm",
        network: "eip155:8453",
        amount: "1000000",
        payTo: "0x1234567890abcdef",
        maxTimeoutSeconds: 60,
        asset: "0xUSDC",
      };

      const resourceInfo = { url: "https://example.com/api" };
      const v1Req = adaptRequirementsV2ToV1(v2Req, resourceInfo, translator);

      t.equal(
        v1Req.network,
        "base",
        "network should be translated to legacy name",
      );
      t.end();
    },
  );

  await t.test(
    "adaptSettleResponseV2ToV1 translates network in settle response",
    (t) => {
      const v2Settle = {
        success: true as const,
        transaction: "0xabc123",
        network: "eip155:84532",
      };

      const v1Settle = adaptSettleResponseV2ToV1(v2Settle, translator);

      t.equal(
        v1Settle.network,
        "base-sepolia",
        "network should be translated to legacy name",
      );
      t.end();
    },
  );

  await t.test(
    "adaptSupportedKindV2ToV1 translates network in supported kind",
    (t) => {
      const v2Kind = {
        x402Version: 2 as const,
        scheme: "exact-solana",
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      };

      const v1Kind = adaptSupportedKindV2ToV1(v2Kind, translator);

      t.equal(
        v1Kind.network,
        "solana-mainnet-beta",
        "network should be translated to legacy name",
      );
      t.end();
    },
  );

  await t.test("unknown CAIP-2 network passes through unchanged", (t) => {
    const v2Kind = {
      x402Version: 2 as const,
      scheme: "exact-evm",
      network: "eip155:99999",
    };

    const v1Kind = adaptSupportedKindV2ToV1(v2Kind, translator);

    t.equal(
      v1Kind.network,
      "eip155:99999",
      "unknown network should pass through unchanged",
    );
    t.end();
  });

  t.end();
});

await t.test("settle response v1 -> v2 conversion", async (t) => {
  await t.test(
    "success case preserves transaction and network (spec-compliant)",
    (t) => {
      const v1Success = {
        success: true as const,
        transaction: "0xabc123",
        network: "eip155:84532",
        payer: "0xPayer123",
      };

      const v2Success = adaptSettleResponseV1ToV2(v1Success);

      t.equal(v2Success.success, true, "success should be true");
      t.equal(v2Success.transaction, "0xabc123", "transaction should match");
      t.equal(v2Success.network, "eip155:84532", "network should match");
      t.equal(v2Success.payer, "0xPayer123", "payer should match");
      t.end();
    },
  );

  await t.test(
    "failure case preserves network and uses empty transaction",
    (t) => {
      const v1Failure = {
        success: false as const,
        transaction: "",
        network: "eip155:84532",
        payer: "0xPayer123",
        errorReason: "insufficient_funds",
      };

      const v2Failure = adaptSettleResponseV1ToV2(v1Failure);

      t.equal(v2Failure.success, false, "success should be false");
      t.equal(
        v2Failure.transaction,
        "",
        "transaction should be empty on failure",
      );
      t.equal(v2Failure.network, "eip155:84532", "network should match");
      t.equal(
        v2Failure.errorReason,
        "insufficient_funds",
        "errorReason should match",
      );
      t.end();
    },
  );

  await t.test("errorReason field is omitted when undefined", (t) => {
    const v1NoError = {
      success: false as const,
      transaction: "",
      network: "eip155:84532",
      payer: "0xPayer123",
    };

    const v2NoError = adaptSettleResponseV1ToV2(v1NoError);

    t.notOk(
      "errorReason" in v2NoError,
      "errorReason should not be present when v1 errorReason is undefined",
    );
    t.end();
  });

  await t.test("payer is passed through when present", (t) => {
    const v1WithPayer = {
      success: true as const,
      transaction: "0xHash",
      network: "eip155:84532",
      payer: "0xPayerAddress",
    };

    const v2WithPayer = adaptSettleResponseV1ToV2(v1WithPayer);

    t.equal(v2WithPayer.payer, "0xPayerAddress", "payer should be preserved");
    t.end();
  });

  await t.test("empty payer is omitted in v2 output", (t) => {
    const v1EmptyPayer = {
      success: true as const,
      transaction: "0xHash",
      network: "eip155:84532",
      payer: "",
    };

    const v2EmptyPayer = adaptSettleResponseV1ToV2(v1EmptyPayer);

    t.notOk("payer" in v2EmptyPayer, "payer should be omitted when empty");
    t.end();
  });

  t.end();
});
