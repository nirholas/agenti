#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  adaptRequirementsV1ToV2,
  adaptRequirementsV2ToV1,
  extractResourceInfoV1,
  adaptPayloadV1ToV2,
  adaptPaymentRequiredResponseV1ToV2,
  adaptPaymentRequiredResponseV2ToV1,
  adaptVerifyResponseV2ToV1,
  adaptVerifyResponseV1ToV2,
  adaptSettleResponseV2ToV1,
  adaptSettleResponseV2ToV1Legacy,
  adaptSettleResponseV1ToV2,
  adaptSettleResponseLegacyToV2,
  adaptSettleResponseLenientToV2,
  adaptSupportedKindV2ToV1,
  adaptSupportedKindV1ToV2,
  type NetworkTranslator,
} from "./x402-adapters";
import type {
  x402PaymentRequirements as x402PaymentRequirementsV1,
  x402SettleResponseLegacy,
  x402SettleResponseLenient,
} from "./x402";
import type { x402PaymentRequirements, x402ResourceInfo } from "./x402v2";

// Identity translator for tests that don't care about network translation
const identity: NetworkTranslator = (n) => n;

// Mock translator that maps test networks
const mockTranslator: NetworkTranslator = (n) => {
  if (n === "solana-devnet") return "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
  if (n === "base-sepolia") return "eip155:84532";
  return n;
};

const makeV1Requirements = (
  overrides?: Partial<x402PaymentRequirementsV1>,
): x402PaymentRequirementsV1 => ({
  scheme: "exact",
  network: "base-sepolia",
  maxAmountRequired: "1000",
  resource: "https://example.com/api",
  description: "Test resource",
  mimeType: "application/json",
  payTo: "0x1234567890abcdef",
  maxTimeoutSeconds: 60,
  asset: "0xUSDC",
  ...overrides,
});

const makeV2Requirements = (
  overrides?: Partial<x402PaymentRequirements>,
): x402PaymentRequirements => ({
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000",
  payTo: "0x1234567890abcdef",
  maxTimeoutSeconds: 60,
  asset: "0xUSDC",
  ...overrides,
});

const makeResourceInfo = (
  overrides?: Partial<x402ResourceInfo>,
): x402ResourceInfo => ({
  url: "https://example.com/api",
  ...overrides,
});

await t.test("adaptRequirementsV1ToV2", async (t) => {
  await t.test("converts maxAmountRequired to amount", (t) => {
    const v1 = makeV1Requirements({ maxAmountRequired: "5000" });
    const v2 = adaptRequirementsV1ToV2(v1, identity);

    t.equal(v2.amount, "5000");
    t.notOk("maxAmountRequired" in v2);
    t.notOk("resource" in v2);
    t.notOk("description" in v2);
    t.notOk("mimeType" in v2);
    t.end();
  });

  await t.test("preserves all other fields", (t) => {
    const v1 = makeV1Requirements();
    const v2 = adaptRequirementsV1ToV2(v1, identity);

    t.equal(v2.scheme, v1.scheme);
    t.equal(v2.network, v1.network);
    t.equal(v2.asset, v1.asset);
    t.equal(v2.payTo, v1.payTo);
    t.equal(v2.maxTimeoutSeconds, v1.maxTimeoutSeconds);
    t.end();
  });

  await t.test("preserves extra field when present", (t) => {
    const extra = { foo: "bar", nested: { value: 42 } };
    const v1 = makeV1Requirements({ extra });
    const v2 = adaptRequirementsV1ToV2(v1, identity);

    t.ok("extra" in v2);
    t.matchOnly(v2.extra, extra);
    t.end();
  });

  await t.test("omits extra field when undefined", (t) => {
    const v1 = makeV1Requirements();
    delete v1.extra;
    const v2 = adaptRequirementsV1ToV2(v1, identity);

    t.notOk("extra" in v2);
    t.end();
  });

  await t.test("applies network translator", (t) => {
    const v1 = makeV1Requirements({ network: "solana-devnet" });
    const v2 = adaptRequirementsV1ToV2(v1, mockTranslator);

    t.equal(v2.network, "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
    t.end();
  });
});

await t.test("adaptRequirementsV2ToV1", async (t) => {
  await t.test("converts amount to maxAmountRequired", (t) => {
    const v2 = makeV2Requirements({ amount: "2500" });
    const resource = makeResourceInfo({
      description: "A resource",
      mimeType: "text/plain",
    });
    const v1 = adaptRequirementsV2ToV1(v2, resource);

    t.equal(v1.maxAmountRequired, "2500");
    t.notOk("amount" in v1);
    t.end();
  });

  await t.test("populates resource fields from resource info", (t) => {
    const v2 = makeV2Requirements();
    const resource = makeResourceInfo({
      url: "https://api.example.com/data",
      description: "Data endpoint",
      mimeType: "application/json",
    });
    const v1 = adaptRequirementsV2ToV1(v2, resource);

    t.equal(v1.resource, "https://api.example.com/data");
    t.equal(v1.description, "Data endpoint");
    t.equal(v1.mimeType, "application/json");
    t.end();
  });

  await t.test("defaults description and mimeType to empty strings", (t) => {
    const v2 = makeV2Requirements();
    const resource = makeResourceInfo();
    const v1 = adaptRequirementsV2ToV1(v2, resource);

    t.equal(v1.description, "");
    t.equal(v1.mimeType, "");
    t.end();
  });

  await t.test("applies network translator when provided", (t) => {
    const v2 = makeV2Requirements({ network: "eip155:84532" });
    const resource = makeResourceInfo();
    const translator = (n: string) =>
      n === "eip155:84532" ? "base-sepolia" : n;
    const v1 = adaptRequirementsV2ToV1(v2, resource, translator);

    t.equal(v1.network, "base-sepolia");
    t.end();
  });

  await t.test("uses original network when no translator", (t) => {
    const v2 = makeV2Requirements({ network: "eip155:84532" });
    const resource = makeResourceInfo();
    const v1 = adaptRequirementsV2ToV1(v2, resource);

    t.equal(v1.network, "eip155:84532");
    t.end();
  });

  await t.test("preserves extra field when present", (t) => {
    const extra = { custom: "data" };
    const v2 = makeV2Requirements({ extra });
    const resource = makeResourceInfo();
    const v1 = adaptRequirementsV2ToV1(v2, resource);

    t.ok("extra" in v1);
    t.matchOnly(v1.extra, extra);
    t.end();
  });

  await t.test("omits extra field when undefined", (t) => {
    const v2 = makeV2Requirements();
    const resource = makeResourceInfo();
    const v1 = adaptRequirementsV2ToV1(v2, resource);

    t.notOk("extra" in v1);
    t.end();
  });
});

await t.test("extractResourceInfoV1", async (t) => {
  await t.test("extracts all fields when present", (t) => {
    const v1 = makeV1Requirements({
      resource: "https://example.com/resource",
      description: "Full description",
      mimeType: "application/octet-stream",
    });
    const info = extractResourceInfoV1(v1);

    t.equal(info.url, "https://example.com/resource");
    t.equal(info.description, "Full description");
    t.equal(info.mimeType, "application/octet-stream");
    t.end();
  });

  await t.test("omits description when empty string", (t) => {
    const v1 = makeV1Requirements({
      description: "",
      mimeType: "text/html",
    });
    const info = extractResourceInfoV1(v1);

    t.notOk("description" in info);
    t.equal(info.mimeType, "text/html");
    t.end();
  });

  await t.test("omits mimeType when empty string", (t) => {
    const v1 = makeV1Requirements({
      description: "Has description",
      mimeType: "",
    });
    const info = extractResourceInfoV1(v1);

    t.equal(info.description, "Has description");
    t.notOk("mimeType" in info);
    t.end();
  });

  await t.test("returns only url when both are empty", (t) => {
    const v1 = makeV1Requirements({
      description: "",
      mimeType: "",
    });
    const info = extractResourceInfoV1(v1);

    t.equal(info.url, v1.resource);
    t.notOk("description" in info);
    t.notOk("mimeType" in info);
    t.end();
  });
});

await t.test("adaptPayloadV1ToV2", async (t) => {
  await t.test("sets x402Version to 2", (t) => {
    const payload = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: { signature: "0xabc" },
    };
    const requirements = makeV1Requirements();
    const v2 = adaptPayloadV1ToV2(payload, requirements, identity);

    t.equal(v2.x402Version, 2);
    t.end();
  });

  await t.test("converts requirements to accepted field", (t) => {
    const payload = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: { signature: "0xabc" },
    };
    const requirements = makeV1Requirements({ maxAmountRequired: "7500" });
    const v2 = adaptPayloadV1ToV2(payload, requirements, identity);

    t.equal(v2.accepted.amount, "7500");
    t.equal(v2.accepted.scheme, requirements.scheme);
    t.end();
  });

  await t.test("extracts resource from requirements", (t) => {
    const payload = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: { data: "test" },
    };
    const requirements = makeV1Requirements({
      resource: "https://api.test.com/endpoint",
      description: "Test API",
      mimeType: "application/json",
    });
    const v2 = adaptPayloadV1ToV2(payload, requirements, identity);

    t.equal(v2.resource?.url, "https://api.test.com/endpoint");
    t.equal(v2.resource?.description, "Test API");
    t.equal(v2.resource?.mimeType, "application/json");
    t.end();
  });

  await t.test("preserves original payload object", (t) => {
    const innerPayload = { signature: "0xdef", nonce: 123 };
    const payload = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: innerPayload,
    };
    const requirements = makeV1Requirements();
    const v2 = adaptPayloadV1ToV2(payload, requirements, identity);

    t.matchOnly(v2.payload, innerPayload);
    t.end();
  });

  await t.test("applies network translator to accepted field", (t) => {
    const payload = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: { signature: "0xabc" },
    };
    const requirements = makeV1Requirements({ network: "solana-devnet" });
    const v2 = adaptPayloadV1ToV2(payload, requirements, mockTranslator);

    t.equal(v2.accepted.network, "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
    t.end();
  });
});

await t.test("adaptPaymentRequiredResponseV1ToV2", async (t) => {
  await t.test("sets x402Version to 2", (t) => {
    const v1Response = {
      x402Version: 1,
      accepts: [makeV1Requirements()],
    };
    const v2 = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      "https://example.com",
      identity,
    );

    t.equal(v2.x402Version, 2);
    t.end();
  });

  await t.test("converts single accept", (t) => {
    const v1Response = {
      x402Version: 1,
      accepts: [makeV1Requirements({ maxAmountRequired: "3000" })],
    };
    const v2 = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      "https://example.com",
      identity,
    );

    t.equal(v2.accepts.length, 1);
    t.equal(v2.accepts[0]?.amount, "3000");
    t.end();
  });

  await t.test("converts multiple accepts", (t) => {
    const v1Response = {
      x402Version: 1,
      accepts: [
        makeV1Requirements({ scheme: "exact", maxAmountRequired: "1000" }),
        makeV1Requirements({ scheme: "upto", maxAmountRequired: "2000" }),
      ],
    };
    const v2 = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      "https://example.com",
      identity,
    );

    t.equal(v2.accepts.length, 2);
    t.equal(v2.accepts[0]?.scheme, "exact");
    t.equal(v2.accepts[0]?.amount, "1000");
    t.equal(v2.accepts[1]?.scheme, "upto");
    t.equal(v2.accepts[1]?.amount, "2000");
    t.end();
  });

  await t.test("extracts resource info from first accept", (t) => {
    const v1Response = {
      x402Version: 1,
      accepts: [
        makeV1Requirements({
          description: "First description",
          mimeType: "text/plain",
        }),
        makeV1Requirements({
          description: "Second description",
          mimeType: "application/json",
        }),
      ],
    };
    const v2 = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      "https://resource.url",
      identity,
    );

    t.equal(v2.resource.url, "https://resource.url");
    t.equal(v2.resource.description, "First description");
    t.equal(v2.resource.mimeType, "text/plain");
    t.end();
  });

  await t.test("preserves error when present", (t) => {
    const v1Response = {
      x402Version: 1,
      accepts: [makeV1Requirements()],
      error: "Payment failed",
    };
    const v2 = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      "https://example.com",
      identity,
    );

    t.equal(v2.error, "Payment failed");
    t.end();
  });

  await t.test("omits error when not present", (t) => {
    const v1Response = {
      x402Version: 1,
      accepts: [makeV1Requirements()],
    };
    const v2 = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      "https://example.com",
      identity,
    );

    t.notOk("error" in v2);
    t.end();
  });

  await t.test("handles empty accepts array", (t) => {
    const v1Response = {
      x402Version: 1,
      accepts: [],
    };
    const v2 = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      "https://fallback.url",
      identity,
    );

    t.equal(v2.accepts.length, 0);
    t.equal(v2.resource.url, "https://fallback.url");
    t.notOk("description" in v2.resource);
    t.notOk("mimeType" in v2.resource);
    t.end();
  });

  await t.test("applies network translator to all accepts", (t) => {
    const v1Response = {
      x402Version: 1,
      accepts: [
        makeV1Requirements({ network: "solana-devnet" }),
        makeV1Requirements({ network: "base-sepolia" }),
      ],
    };
    const v2 = adaptPaymentRequiredResponseV1ToV2(
      v1Response,
      "https://example.com",
      mockTranslator,
    );

    t.equal(v2.accepts[0]?.network, "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
    t.equal(v2.accepts[1]?.network, "eip155:84532");
    t.end();
  });
});

await t.test("adaptPaymentRequiredResponseV2ToV1", async (t) => {
  await t.test("sets x402Version to 1", (t) => {
    const v2Response = {
      x402Version: 2 as const,
      resource: makeResourceInfo(),
      accepts: [makeV2Requirements()],
    };
    const v1 = adaptPaymentRequiredResponseV2ToV1(v2Response);

    t.equal(v1.x402Version, 1);
    t.end();
  });

  await t.test("converts accepts with resource info", (t) => {
    const v2Response = {
      x402Version: 2 as const,
      resource: makeResourceInfo({
        url: "https://api.com/data",
        description: "Data API",
        mimeType: "application/json",
      }),
      accepts: [makeV2Requirements({ amount: "4000" })],
    };
    const v1 = adaptPaymentRequiredResponseV2ToV1(v2Response);

    t.equal(v1.accepts.length, 1);
    t.equal(v1.accepts[0]?.maxAmountRequired, "4000");
    t.equal(v1.accepts[0]?.resource, "https://api.com/data");
    t.equal(v1.accepts[0]?.description, "Data API");
    t.end();
  });

  await t.test("applies network translator to all accepts", (t) => {
    const v2Response = {
      x402Version: 2 as const,
      resource: makeResourceInfo(),
      accepts: [
        makeV2Requirements({ network: "eip155:84532" }),
        makeV2Requirements({ network: "eip155:8453" }),
      ],
    };
    const translator = (n: string) => {
      if (n === "eip155:84532") return "base-sepolia";
      if (n === "eip155:8453") return "base";
      return n;
    };
    const v1 = adaptPaymentRequiredResponseV2ToV1(v2Response, translator);

    t.equal(v1.accepts[0]?.network, "base-sepolia");
    t.equal(v1.accepts[1]?.network, "base");
    t.end();
  });

  await t.test("preserves error when present", (t) => {
    const v2Response = {
      x402Version: 2 as const,
      resource: makeResourceInfo(),
      accepts: [makeV2Requirements()],
      error: "Insufficient funds",
    };
    const v1 = adaptPaymentRequiredResponseV2ToV1(v2Response);

    t.equal(v1.error, "Insufficient funds");
    t.end();
  });

  await t.test("uses empty string for error when not present", (t) => {
    const v2Response = {
      x402Version: 2 as const,
      resource: makeResourceInfo(),
      accepts: [makeV2Requirements()],
    };
    const v1 = adaptPaymentRequiredResponseV2ToV1(v2Response);

    t.equal(v1.error, "");
    t.end();
  });
});

await t.test("adaptVerifyResponseV2ToV1", async (t) => {
  await t.test("converts valid response", (t) => {
    const v2 = { isValid: true };
    const v1 = adaptVerifyResponseV2ToV1(v2);

    t.equal(v1.isValid, true);
    t.notOk("invalidReason" in v1);
    t.end();
  });

  await t.test("converts invalid response with reason", (t) => {
    const v2 = { isValid: false, invalidReason: "Signature mismatch" };
    const v1 = adaptVerifyResponseV2ToV1(v2);

    t.equal(v1.isValid, false);
    t.equal(v1.invalidReason, "Signature mismatch");
    t.end();
  });

  await t.test("preserves payer field when present", (t) => {
    const v2 = { isValid: true, payer: "0xPayerAddress" };
    const v1 = adaptVerifyResponseV2ToV1(v2);

    t.equal(v1.isValid, true);
    t.equal(v1.payer, "0xPayerAddress");
    t.end();
  });

  await t.test("uses empty string for payer when not present", (t) => {
    const v2 = { isValid: true };
    const v1 = adaptVerifyResponseV2ToV1(v2);

    t.equal(v1.isValid, true);
    t.equal(v1.payer, "");
    t.end();
  });
});

await t.test("adaptVerifyResponseV1ToV2", async (t) => {
  await t.test("converts valid response", (t) => {
    const v1 = { isValid: true };
    const v2 = adaptVerifyResponseV1ToV2(v1);

    t.equal(v2.isValid, true);
    t.notOk("invalidReason" in v2);
    t.end();
  });

  await t.test("converts invalid response with reason", (t) => {
    const v1 = { isValid: false, invalidReason: "Expired transaction" };
    const v2 = adaptVerifyResponseV1ToV2(v1);

    t.equal(v2.isValid, false);
    t.equal(v2.invalidReason, "Expired transaction");
    t.end();
  });

  await t.test("preserves null invalidReason", (t) => {
    const v1 = { isValid: false, invalidReason: null };
    const v2 = adaptVerifyResponseV1ToV2(v1);

    t.equal(v2.isValid, false);
    t.notOk("invalidReason" in v2);
    t.end();
  });

  await t.test("preserves payer field when present", (t) => {
    const v1 = { isValid: true, payer: "0xPayerAddress" };
    const v2 = adaptVerifyResponseV1ToV2(v1);

    t.equal(v2.isValid, true);
    t.equal(v2.payer, "0xPayerAddress");
    t.end();
  });

  await t.test("omits payer field when not present", (t) => {
    const v1 = { isValid: true };
    const v2 = adaptVerifyResponseV1ToV2(v1);

    t.notOk("payer" in v2);
    t.end();
  });
});

await t.test("adaptSettleResponseV2ToV1", async (t) => {
  await t.test(
    "converts success response with spec-compliant field names",
    (t) => {
      const v2 = {
        success: true,
        transaction: "0xTransactionHash",
        network: "eip155:84532",
      };
      const v1 = adaptSettleResponseV2ToV1(v2);

      t.equal(v1.success, true);
      t.equal(v1.transaction, "0xTransactionHash");
      t.equal(v1.network, "eip155:84532");
      t.end();
    },
  );

  await t.test("converts failure response with errorReason", (t) => {
    const v2 = {
      success: false,
      transaction: "",
      network: "eip155:84532",
      errorReason: "Transaction reverted",
    };
    const v1 = adaptSettleResponseV2ToV1(v2);

    t.equal(v1.success, false);
    t.equal(v1.errorReason, "Transaction reverted");
    t.end();
  });

  await t.test("applies network translator", (t) => {
    const v2 = {
      success: true,
      transaction: "0xHash",
      network: "eip155:84532",
    };
    const translator = (n: string) =>
      n === "eip155:84532" ? "base-sepolia" : n;
    const v1 = adaptSettleResponseV2ToV1(v2, translator);

    t.equal(v1.network, "base-sepolia");
    t.end();
  });

  await t.test("transfers payer field when present", (t) => {
    const v2 = {
      success: true,
      transaction: "0xHash",
      network: "eip155:84532",
      payer: "0xPayerAddress",
    };
    const v1 = adaptSettleResponseV2ToV1(v2);

    t.equal(v1.payer, "0xPayerAddress");
    t.end();
  });

  await t.test("uses empty string for payer when not present in v2", (t) => {
    const v2 = {
      success: true,
      transaction: "0xHash",
      network: "eip155:84532",
    };
    const v1 = adaptSettleResponseV2ToV1(v2);

    t.equal(v1.payer, "", "payer should be empty string when not in v2");
    t.end();
  });

  await t.test("omits errorReason when not present", (t) => {
    const v2 = {
      success: true,
      transaction: "0xHash",
      network: "eip155:84532",
    };
    const v1 = adaptSettleResponseV2ToV1(v2);

    t.notOk("errorReason" in v1);
    t.end();
  });
});

await t.test("adaptSettleResponseV2ToV1Legacy", async (t) => {
  await t.test("converts success response with legacy field names", (t) => {
    const v2 = {
      success: true,
      transaction: "0xTransactionHash",
      network: "eip155:84532",
    };
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const v1Legacy = adaptSettleResponseV2ToV1Legacy(v2);

    t.equal(v1Legacy.success, true);
    t.equal(v1Legacy.txHash, "0xTransactionHash");
    t.equal(v1Legacy.networkId, "eip155:84532");
    t.end();
  });

  await t.test("converts failure response with error field", (t) => {
    const v2 = {
      success: false,
      transaction: "",
      network: "eip155:84532",
      errorReason: "Transaction reverted",
    };
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const v1Legacy = adaptSettleResponseV2ToV1Legacy(v2);

    t.equal(v1Legacy.success, false);
    t.equal(v1Legacy.error, "Transaction reverted");
    t.end();
  });

  await t.test("applies network translator", (t) => {
    const v2 = {
      success: true,
      transaction: "0xHash",
      network: "eip155:84532",
    };
    const translator = (n: string) =>
      n === "eip155:84532" ? "base-sepolia" : n;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const v1Legacy = adaptSettleResponseV2ToV1Legacy(v2, translator);

    t.equal(v1Legacy.networkId, "base-sepolia");
    t.end();
  });
});

await t.test("adaptSettleResponseV1ToV2", async (t) => {
  await t.test(
    "converts success response with spec-compliant field names",
    (t) => {
      const v1 = {
        success: true,
        transaction: "0xSuccessHash",
        network: "base-sepolia",
      };
      const v2 = adaptSettleResponseV1ToV2(v1);

      t.equal(v2.success, true);
      t.equal(v2.transaction, "0xSuccessHash");
      t.equal(v2.network, "base-sepolia");
      t.end();
    },
  );

  await t.test("throws on missing network", (t) => {
    const v1 = {
      success: true,
      transaction: "0xHash",
      network: null,
    };

    t.throws(() => adaptSettleResponseV1ToV2(v1), /missing network/);
    t.end();
  });

  await t.test("throws on success with missing transaction", (t) => {
    const v1 = {
      success: true,
      transaction: null,
      network: "base-sepolia",
    };

    t.throws(() => adaptSettleResponseV1ToV2(v1), /missing transaction/);
    t.end();
  });

  await t.test("uses empty string for null transaction on failure", (t) => {
    const v1 = {
      success: false,
      transaction: null,
      network: "base-sepolia",
      errorReason: "Failed",
    };
    const v2 = adaptSettleResponseV1ToV2(v1);

    t.equal(v2.success, false);
    t.equal(v2.transaction, "");
    t.end();
  });

  await t.test("passes through errorReason", (t) => {
    const v1 = {
      success: false,
      transaction: null,
      network: "base-sepolia",
      errorReason: "Settlement failed",
    };
    const v2 = adaptSettleResponseV1ToV2(v1);

    t.equal(v2.errorReason, "Settlement failed");
    t.end();
  });

  await t.test("omits errorReason when null", (t) => {
    const v1 = {
      success: false,
      transaction: "",
      network: "base-sepolia",
      errorReason: null,
    };
    const v2 = adaptSettleResponseV1ToV2(v1);

    t.notOk("errorReason" in v2);
    t.end();
  });

  await t.test("omits errorReason when undefined", (t) => {
    const v1 = {
      success: false,
      transaction: "",
      network: "base-sepolia",
    };
    const v2 = adaptSettleResponseV1ToV2(v1);

    t.notOk("errorReason" in v2);
    t.end();
  });

  await t.test("preserves payer field when present", (t) => {
    const v1 = {
      success: true,
      transaction: "0xHash",
      network: "base-sepolia",
      payer: "0xPayerAddress",
    };
    const v2 = adaptSettleResponseV1ToV2(v1);

    t.equal(v2.payer, "0xPayerAddress");
    t.end();
  });
});

await t.test("adaptSettleResponseLegacyToV2", async (t) => {
  await t.test("converts legacy success response", (t) => {
    const v1Legacy: x402SettleResponseLegacy = {
      success: true,
      txHash: "0xSuccessHash",
      networkId: "base-sepolia",
    };
    const v2 = adaptSettleResponseLegacyToV2(v1Legacy);

    t.equal(v2.success, true);
    t.equal(v2.transaction, "0xSuccessHash");
    t.equal(v2.network, "base-sepolia");
    t.end();
  });

  await t.test("throws on missing networkId", (t) => {
    const v1Legacy: x402SettleResponseLegacy = {
      success: true,
      txHash: "0xHash",
      networkId: null,
    };

    t.throws(
      () => adaptSettleResponseLegacyToV2(v1Legacy),
      /missing networkId/,
    );
    t.end();
  });

  await t.test("throws on success with missing txHash", (t) => {
    const v1Legacy: x402SettleResponseLegacy = {
      success: true,
      txHash: null,
      networkId: "base-sepolia",
    };

    t.throws(() => adaptSettleResponseLegacyToV2(v1Legacy), /missing txHash/);
    t.end();
  });

  await t.test("maps error to errorReason", (t) => {
    const v1Legacy: x402SettleResponseLegacy = {
      success: false,
      txHash: null,
      networkId: "base-sepolia",
      error: "Settlement failed",
    };
    const v2 = adaptSettleResponseLegacyToV2(v1Legacy);

    t.equal(v2.errorReason, "Settlement failed");
    t.end();
  });
});

await t.test("adaptSettleResponseLenientToV2", async (t) => {
  await t.test("converts spec-compliant input", (t) => {
    const lenient: x402SettleResponseLenient = {
      success: true,
      transaction: "0xSpecHash",
      network: "base-sepolia",
    };
    const v2 = adaptSettleResponseLenientToV2(lenient);

    t.equal(v2.success, true);
    t.equal(v2.transaction, "0xSpecHash");
    t.equal(v2.network, "base-sepolia");
    t.end();
  });

  await t.test("converts legacy input", (t) => {
    const lenient: x402SettleResponseLenient = {
      success: true,
      txHash: "0xLegacyHash",
      networkId: "base-sepolia",
    };
    const v2 = adaptSettleResponseLenientToV2(lenient);

    t.equal(v2.success, true);
    t.equal(v2.transaction, "0xLegacyHash");
    t.equal(v2.network, "base-sepolia");
    t.end();
  });

  await t.test("prefers spec-compliant fields when both present", (t) => {
    const lenient: x402SettleResponseLenient = {
      success: true,
      transaction: "0xSpecHash",
      txHash: "0xLegacyHash",
      network: "spec-network",
      networkId: "legacy-network",
    };
    const v2 = adaptSettleResponseLenientToV2(lenient);

    t.equal(v2.transaction, "0xSpecHash");
    t.equal(v2.network, "spec-network");
    t.end();
  });

  await t.test("maps legacy error to errorReason", (t) => {
    const lenient: x402SettleResponseLenient = {
      success: false,
      txHash: null,
      networkId: "base-sepolia",
      error: "Legacy error",
    };
    const v2 = adaptSettleResponseLenientToV2(lenient);

    t.equal(v2.errorReason, "Legacy error");
    t.end();
  });

  await t.test("prefers errorReason over error when both present", (t) => {
    const lenient: x402SettleResponseLenient = {
      success: false,
      transaction: "",
      network: "base-sepolia",
      errorReason: "Spec error",
      error: "Legacy error",
    };
    const v2 = adaptSettleResponseLenientToV2(lenient);

    t.equal(v2.errorReason, "Spec error");
    t.end();
  });
});

await t.test("adaptSupportedKindV2ToV1", async (t) => {
  await t.test("sets x402Version to 1", (t) => {
    const v2 = {
      x402Version: 2 as const,
      scheme: "exact",
      network: "eip155:84532",
    };
    const v1 = adaptSupportedKindV2ToV1(v2);

    t.equal(v1.x402Version, 1);
    t.end();
  });

  await t.test("preserves scheme and network", (t) => {
    const v2 = {
      x402Version: 2 as const,
      scheme: "upto",
      network: "solana:devnet",
    };
    const v1 = adaptSupportedKindV2ToV1(v2);

    t.equal(v1.scheme, "upto");
    t.equal(v1.network, "solana:devnet");
    t.end();
  });

  await t.test("applies network translator", (t) => {
    const v2 = {
      x402Version: 2 as const,
      scheme: "exact",
      network: "eip155:84532",
    };
    const translator = (n: string) =>
      n === "eip155:84532" ? "base-sepolia" : n;
    const v1 = adaptSupportedKindV2ToV1(v2, translator);

    t.equal(v1.network, "base-sepolia");
    t.end();
  });

  await t.test("preserves extra field when present", (t) => {
    const extra = { capability: "streaming" };
    const v2 = {
      x402Version: 2 as const,
      scheme: "exact",
      network: "eip155:84532",
      extra,
    };
    const v1 = adaptSupportedKindV2ToV1(v2);

    t.ok("extra" in v1);
    t.matchOnly(v1.extra, extra);
    t.end();
  });

  await t.test("omits extra field when undefined", (t) => {
    const v2 = {
      x402Version: 2 as const,
      scheme: "exact",
      network: "eip155:84532",
    };
    const v1 = adaptSupportedKindV2ToV1(v2);

    t.notOk("extra" in v1);
    t.end();
  });
});

await t.test("adaptSupportedKindV1ToV2", async (t) => {
  await t.test("sets x402Version to 2", (t) => {
    const v1 = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
    };
    const v2 = adaptSupportedKindV1ToV2(v1, identity);

    t.equal(v2.x402Version, 2);
    t.end();
  });

  await t.test("preserves scheme and network with identity translator", (t) => {
    const v1 = {
      x402Version: 1,
      scheme: "upto",
      network: "solana:mainnet",
    };
    const v2 = adaptSupportedKindV1ToV2(v1, identity);

    t.equal(v2.scheme, "upto");
    t.equal(v2.network, "solana:mainnet");
    t.end();
  });

  await t.test("preserves extra field when present", (t) => {
    const extra = { feature: "batch" };
    const v1 = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      extra,
    };
    const v2 = adaptSupportedKindV1ToV2(v1, identity);

    t.ok("extra" in v2);
    t.matchOnly(v2.extra, extra);
    t.end();
  });

  await t.test("omits extra field when undefined", (t) => {
    const v1 = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
    };
    const v2 = adaptSupportedKindV1ToV2(v1, identity);

    t.notOk("extra" in v2);
    t.end();
  });

  await t.test("applies network translator", (t) => {
    const v1 = {
      x402Version: 1,
      scheme: "exact",
      network: "solana-devnet",
    };
    const v2 = adaptSupportedKindV1ToV2(v1, mockTranslator);

    t.equal(v2.network, "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
    t.end();
  });
});
