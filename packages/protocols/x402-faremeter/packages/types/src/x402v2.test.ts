#!/usr/bin/env pnpm tsx

import t from "tap";
import { isValidationError } from "./validation";
import {
  x402PaymentHeaderToPayload,
  type x402PaymentPayload,
  type x402PaymentRequirements,
  type x402ResourceInfo,
} from "./x402v2";

const makeValidRequirements = (): x402PaymentRequirements => ({
  scheme: "exact",
  network: "eip155:84532",
  amount: "1000",
  asset: "0xUSDC",
  payTo: "0x1234567890abcdef",
  maxTimeoutSeconds: 60,
});

const makeValidResource = (): x402ResourceInfo => ({
  url: "https://example.com/api",
});

const makeValidPayload = (): x402PaymentPayload => ({
  x402Version: 2,
  resource: makeValidResource(),
  accepted: makeValidRequirements(),
  payload: { signature: "0xabc123" },
});

await t.test("x402PaymentHeaderToPayload", async (t) => {
  await t.test("parses valid base64-encoded JSON payload", (t) => {
    const payload = makeValidPayload();
    const encoded = btoa(JSON.stringify(payload));
    const result = x402PaymentHeaderToPayload(encoded);

    if (isValidationError(result)) {
      t.fail("expected valid payload");
      t.end();
      return;
    }

    t.equal(result.x402Version, 2);
    t.equal(result.accepted.scheme, "exact");
    t.equal(result.accepted.amount, "1000");
    t.matchOnly(result.resource, payload.resource);
    t.end();
  });

  await t.test("rejects invalid base64 string", (t) => {
    const result = x402PaymentHeaderToPayload("!!!not-valid-base64!!!");

    t.ok(isValidationError(result));
    t.end();
  });

  await t.test("rejects valid base64 with invalid JSON", (t) => {
    const encoded = btoa("this is not valid json {{{");
    const result = x402PaymentHeaderToPayload(encoded);

    t.ok(isValidationError(result));
    t.end();
  });

  await t.test("rejects valid JSON with missing required fields", (t) => {
    const incompletePayload = { foo: "bar" };
    const encoded = btoa(JSON.stringify(incompletePayload));
    const result = x402PaymentHeaderToPayload(encoded);

    t.ok(isValidationError(result));
    t.end();
  });

  await t.test("rejects payload with wrong x402Version", (t) => {
    const payload = { ...makeValidPayload(), x402Version: 1 };
    const encoded = btoa(JSON.stringify(payload));
    const result = x402PaymentHeaderToPayload(encoded);

    t.ok(isValidationError(result));
    t.end();
  });
});
