#!/usr/bin/env pnpm tsx

import t from "tap";
import type { Test } from "tap";
import * as fmFetch from "./fetch";
import * as fmTypes from "@faremeter/types/client";
import * as x402 from "@faremeter/types/x402";
import * as x402v2 from "@faremeter/types/x402v2";
import { V2_PAYMENT_REQUIRED_HEADER, V2_PAYMENT_HEADER } from "./internal";

import { responseFeeder } from "./mock";

function createFakeHandler(t: Test) {
  const mockRequirements = {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "solana-devnet", // Use real legacy ID that maps to CAIP-2
        maxAmountRequired: "1.0",
        resource: "http://wherever",
        description: "what is a description",
        mimeType: "text/plain",
        payTo: "someaccount",
        maxTimeoutSeconds: 5,
        asset: "theasset",
      },
    ],
    error: "",
  };

  // Expected v2 requirements after conversion from v1
  // Network should be translated from legacy "solana-devnet" to CAIP-2
  const expectedV2Accepts = [
    {
      scheme: "exact",
      network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // CAIP-2 for devnet
      amount: "1.0",
      payTo: "someaccount",
      maxTimeoutSeconds: 5,
      asset: "theasset",
    },
  ];

  const fakeHandler: fmTypes.PaymentHandler = async (_ctx, required) => {
    t.equal(required.length, 1);
    t.matchOnly(required, expectedV2Accepts);

    const requirements = required[0];

    if (requirements === undefined) {
      throw new Error("expected to get at least 1 requirement");
    }

    const execers: fmTypes.PaymentExecer[] = [
      {
        requirements,
        exec: async () => ({
          payload: { key: "data" },
        }),
      },
    ];

    return execers;
  };

  const createMockResponse = async () =>
    new Response(JSON.stringify(mockRequirements), {
      status: 402,
    });

  return { fakeHandler, createMockResponse, mockRequirements };
}

await t.test("basicWrap", async (t) => {
  const { fakeHandler, createMockResponse } = createFakeHandler(t);

  const mockFetch = responseFeeder([
    createMockResponse,
    async (_input, init?: RequestInit) => {
      if (init?.headers === undefined) {
        throw new Error("didn't get back request headers");
      }

      const headers = new Headers(init.headers);
      const paymentPayload = x402.x402PaymentHeaderToPayload.assert(
        headers.get("X-PAYMENT"),
      );

      t.match(paymentPayload.payload, { key: "data" });

      return new Response("mypayload");
    },
  ]);

  const wrappedFetch = fmFetch.wrap(mockFetch, {
    handlers: [fakeHandler],
  });

  const res = await wrappedFetch("http://somewhere/something/protected");

  const body = await res.text();
  t.match(body, "mypayload");

  t.pass();
  t.end();
});

await t.test(
  "basicWrap with missing error field in 402 response",
  async (t) => {
    const mockRequirements = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "solana-devnet",
          maxAmountRequired: "1.0",
          resource: "http://wherever",
          description: "what is a description",
          mimeType: "text/plain",
          payTo: "someaccount",
          maxTimeoutSeconds: 5,
          asset: "theasset",
        },
      ],
    };

    const expectedV2Accepts = [
      {
        scheme: "exact",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
        amount: "1.0",
        payTo: "someaccount",
        maxTimeoutSeconds: 5,
        asset: "theasset",
      },
    ];

    const fakeHandler: fmTypes.PaymentHandler = async (_ctx, required) => {
      t.equal(required.length, 1);
      t.matchOnly(required, expectedV2Accepts);

      const requirements = required[0];

      if (requirements === undefined) {
        throw new Error("expected to get at least 1 requirement");
      }

      const execers: fmTypes.PaymentExecer[] = [
        {
          requirements,
          exec: async () => ({
            payload: { key: "data" },
          }),
        },
      ];

      return execers;
    };

    const createMockResponse = async () =>
      new Response(JSON.stringify(mockRequirements), {
        status: 402,
      });

    const mockFetch = responseFeeder([
      createMockResponse,
      async (_input, init?: RequestInit) => {
        if (init?.headers === undefined) {
          throw new Error("didn't get back request headers");
        }

        const headers = new Headers(init.headers);
        const paymentPayload = x402.x402PaymentHeaderToPayload.assert(
          headers.get("X-PAYMENT"),
        );

        t.match(paymentPayload.payload, { key: "data" });

        return new Response("mypayload");
      },
    ]);

    const wrappedFetch = fmFetch.wrap(mockFetch, {
      handlers: [fakeHandler],
    });

    const res = await wrappedFetch("http://somewhere/something/protected");

    const body = await res.text();
    t.match(body, "mypayload");

    t.pass();
    t.end();
  },
);

await t.test("failedPhase1", async (t) => {
  const phase1Fetch = responseFeeder([
    async () => {
      return new Response("the service is on fire", {
        status: 503,
      });
    },
    async () => {
      return new Response("it's all good", {
        status: 200,
      });
    },
  ]);

  const phase2fetch = responseFeeder([
    async () => {
      return new Response("you should never see this", {
        status: 500,
      });
    },
  ]);

  const wrappedFetch = fmFetch.wrap(phase2fetch, {
    phase1Fetch,
    handlers: [],
  });

  {
    const res = await wrappedFetch("http://somewhere/something/protected");

    t.equal(res.status, 503);
    const body = await res.text();
    t.matchOnly(body, "the service is on fire");
  }

  {
    const res = await wrappedFetch("http://somewhere/something/protected");

    const body = await res.text();
    t.equal(res.status, 200);
    t.matchOnly(body, "it's all good");
  }

  t.pass();
  t.end();
});

await t.test("basicRetry", async (t) => {
  const { fakeHandler, createMockResponse, mockRequirements } =
    createFakeHandler(t);

  {
    const mockFetch = responseFeeder([
      createMockResponse,
      createMockResponse,
      async () => {
        return new Response("retry worked", {
          status: 200,
        });
      },
    ]);

    const wrappedFetch = fmFetch.wrap(mockFetch, {
      handlers: [fakeHandler],
      retryCount: 1,
    });

    {
      const begin = Date.now();
      const res = await wrappedFetch("http://somewhere/something/protected");
      const delta = Date.now() - begin;
      // XXX - Hopefully this doesn't become flakey.
      t.ok(delta > 90 && delta < 110);
      t.equal(res.status, 200);
      const body = await res.text();
      t.matchOnly(body, "retry worked");
    }
  }

  {
    const retryCount = 42;
    const mockFetch = responseFeeder([
      ...Array<typeof createMockResponse>(retryCount + 1).fill(
        createMockResponse,
      ),
      async () => {
        return new Response("retry worked", {
          status: 200,
        });
      },
    ]);

    const wrappedFetch = fmFetch.wrap(mockFetch, {
      handlers: [fakeHandler],
      retryCount,
      initialRetryDelay: 0,
    });

    {
      const res = await wrappedFetch("http://somewhere/something/protected");

      t.equal(res.status, 200);
      const body = await res.text();
      t.matchOnly(body, "retry worked");
    }
  }

  {
    const mockFetch = responseFeeder([
      createMockResponse,
      createMockResponse,
      async () => {
        return new Response("retry worked", {
          status: 200,
        });
      },
    ]);

    const wrappedFetch = fmFetch.wrap(mockFetch, {
      handlers: [fakeHandler],
      retryCount: 0,
      returnPaymentFailure: true,
    });

    {
      const res = await wrappedFetch("http://somewhere/something/protected");

      t.equal(res.status, 402);
      const body = (await res.json()) as x402.x402PaymentRequiredResponse;
      t.matchOnly(body, mockRequirements);
    }
  }

  t.pass();
  t.end();
});

await t.test("handlingErrors", async (t) => {
  const { fakeHandler, createMockResponse } = createFakeHandler(t);

  const mockFetch = responseFeeder([
    createMockResponse,
    createMockResponse,
    async () => {
      return new Response("retry worked", {
        status: 200,
      });
    },
  ]);

  const wrappedFetch = fmFetch.wrap(mockFetch, {
    handlers: [fakeHandler],
    retryCount: 0,
  });

  await t.rejects(
    async () => {
      await wrappedFetch("http://somewhere/something/protected");
    },
    new fmFetch.WrappedFetchError(
      "failed to complete payment after retries",
      new Response(null, { status: 402 }),
    ),
  );
});

// V2 Protocol Tests

function createFakeHandlerV2(t: Test) {
  const mockRequirementsV2: x402v2.x402PaymentRequiredResponse = {
    x402Version: 2,
    resource: {
      url: "http://wherever",
      description: "what is a description",
      mimeType: "text/plain",
    },
    accepts: [
      {
        scheme: "exact",
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        amount: "1.0",
        payTo: "someaccount",
        maxTimeoutSeconds: 5,
        asset: "theasset",
      },
    ],
  };

  // Handler receives v2 requirements directly
  const fakeHandler: fmTypes.PaymentHandler = async (_ctx, required) => {
    t.equal(required.length, 1);
    t.matchOnly(required, mockRequirementsV2.accepts);

    const requirements = required[0];

    if (requirements === undefined) {
      throw new Error("expected to get at least 1 requirement");
    }

    const execers: fmTypes.PaymentExecer[] = [
      {
        requirements,
        exec: async () => ({
          payload: { key: "data" },
        }),
      },
    ];

    return execers;
  };

  const createMockResponse = async () => {
    const encoded = btoa(JSON.stringify(mockRequirementsV2));
    return new Response(null, {
      status: 402,
      headers: {
        [V2_PAYMENT_REQUIRED_HEADER]: encoded,
      },
    });
  };

  return { fakeHandler, createMockResponse, mockRequirementsV2 };
}

await t.test("basicWrapV2", async (t) => {
  const { fakeHandler, createMockResponse, mockRequirementsV2 } =
    createFakeHandlerV2(t);

  const mockFetch = responseFeeder([
    createMockResponse,
    async (_input, init?: RequestInit) => {
      if (init?.headers === undefined) {
        throw new Error("didn't get back request headers");
      }

      const headers = new Headers(init.headers);

      // V2 should use PAYMENT-SIGNATURE header
      const paymentSignature = headers.get(V2_PAYMENT_HEADER);
      t.ok(paymentSignature, "should have PAYMENT-SIGNATURE header");
      t.notOk(headers.get("X-PAYMENT"), "should not have X-PAYMENT header");

      const paymentPayload =
        x402v2.x402PaymentHeaderToPayload.assert(paymentSignature);

      t.equal(paymentPayload.x402Version, 2);
      t.match(paymentPayload.payload, { key: "data" });
      t.equal(
        paymentPayload.accepted.scheme,
        mockRequirementsV2.accepts[0]?.scheme,
      );
      t.equal(
        paymentPayload.accepted.network,
        mockRequirementsV2.accepts[0]?.network,
      );
      t.equal(
        paymentPayload.accepted.amount,
        mockRequirementsV2.accepts[0]?.amount,
      );

      return new Response("mypayload");
    },
  ]);

  const wrappedFetch = fmFetch.wrap(mockFetch, {
    handlers: [fakeHandler],
  });

  const res = await wrappedFetch("http://somewhere/something/protected");

  const body = await res.text();
  t.match(body, "mypayload");

  t.pass();
  t.end();
});

await t.test("v2RetryWithV2Header", async (t) => {
  const { fakeHandler, createMockResponse } = createFakeHandlerV2(t);

  // Flow:
  // 1. makeRequest() called
  // 2. phase1Fetch returns 402 (createMockResponse #1)
  // 3. Client processes payment, sends with PAYMENT-SIGNATURE header
  // 4. phase2Fetch returns 402 (createMockResponse #2) - payment not accepted
  // 5. Retry loop waits, calls makeRequest() again
  // 6. phase1Fetch returns 402 (createMockResponse #3)
  // 7. Client processes payment, sends with PAYMENT-SIGNATURE header
  // 8. phase2Fetch returns 200 (success handler) - should have v2 header
  const mockFetch = responseFeeder([
    createMockResponse, // #1: Initial 402 response
    createMockResponse, // #2: Payment attempt rejected with 402
    createMockResponse, // #3: Retry cycle - initial 402 response
    async (_input, init?: RequestInit) => {
      // #4: Retry payment attempt - should have v2 header
      const headers = new Headers(init?.headers);
      t.ok(headers.get(V2_PAYMENT_HEADER), "should use v2 header on retry");
      t.notOk(headers.get("X-PAYMENT"), "should not have v1 header on retry");
      return new Response("retry worked", { status: 200 });
    },
  ]);

  const wrappedFetch = fmFetch.wrap(mockFetch, {
    handlers: [fakeHandler],
    retryCount: 1,
    initialRetryDelay: 0,
  });

  const res = await wrappedFetch("http://somewhere/something/protected");

  t.equal(res.status, 200);
  const body = await res.text();
  t.match(body, "retry worked");

  t.pass();
  t.end();
});
