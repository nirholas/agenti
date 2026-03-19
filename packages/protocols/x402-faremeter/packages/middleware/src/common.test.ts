#!/usr/bin/env pnpm tsx

import t from "tap";
import { getPaymentRequiredResponse } from "./common";

const validAccepts = [
  {
    scheme: "exact",
    network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    maxAmountRequired: "1000",
    resource: "https://example.com/resource",
    description: "Test resource",
    payTo: "test-receiver",
    maxTimeoutSeconds: 60,
    asset: "test-token",
  },
];

await t.test(
  "getPaymentRequiredResponse accepts response without error field",
  async (t) => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          x402Version: 1,
          accepts: validAccepts,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const response = await getPaymentRequiredResponse({
      facilitatorURL: "https://facilitator.example.com",
      accepts: [
        { scheme: "exact", network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" },
      ],
      resource: "https://example.com/resource",
      fetch: mockFetch as typeof fetch,
    });

    t.equal(response.x402Version, 1);
    t.equal(response.accepts.length, 1);
    t.equal(response.error, "");
    t.end();
  },
);

await t.test(
  "getPaymentRequiredResponse preserves error field when present",
  async (t) => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          x402Version: 1,
          accepts: validAccepts,
          error: "some error",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const response = await getPaymentRequiredResponse({
      facilitatorURL: "https://facilitator.example.com",
      accepts: [
        { scheme: "exact", network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" },
      ],
      resource: "https://example.com/resource",
      fetch: mockFetch as typeof fetch,
    });

    t.equal(response.error, "some error");
    t.end();
  },
);
