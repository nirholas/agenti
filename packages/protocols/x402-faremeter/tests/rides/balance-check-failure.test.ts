#!/usr/bin/env pnpm tsx

import t from "tap";
import type { PaymentHandler } from "@faremeter/types/client";
import {
  TestHarness,
  createSimpleFacilitatorHandler,
  accepts,
  TEST_SCHEME,
  TEST_NETWORK,
  TEST_ASSET,
} from "@faremeter/test-harness";
import { createPayer, type WalletAdapter } from "@faremeter/rides";

await t.test("rides payerChooser balance check failures", async (t) => {
  await t.test("skips chains with failing balance checks", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [
        accepts({ network: "fail-net" }),
        accepts({ network: TEST_NETWORK }),
      ],
      facilitatorHandlers: [
        createSimpleFacilitatorHandler({ networkId: TEST_NETWORK }),
      ],
      clientHandlers: [],
    });

    const harnessRoutedFetch = harness.createClientFetch();

    const payer = createPayer({
      networks: [],
      assets: [],
      fetch: harnessRoutedFetch,
    });

    let failGetBalanceCalled = false;
    let workingGetBalanceCalled = false;

    const createMockHandler = (targetNetwork: string): PaymentHandler => {
      return async (_context, reqs) => {
        return reqs
          .filter((req) => req.network === targetNetwork)
          .map((req) => ({
            requirements: req,
            exec: async () => ({ payload: { test: true } }),
          }));
      };
    };

    const failingAdapter: WalletAdapter = {
      x402Id: [{ scheme: TEST_SCHEME, network: "fail-net", asset: TEST_ASSET }],
      paymentHandler: createMockHandler("fail-net"),
      getBalance: async () => {
        failGetBalanceCalled = true;
        throw new Error("RPC failure");
      },
    };

    const workingAdapter: WalletAdapter = {
      x402Id: [
        { scheme: TEST_SCHEME, network: TEST_NETWORK, asset: TEST_ASSET },
      ],
      paymentHandler: createMockHandler(TEST_NETWORK),
      getBalance: async () => {
        workingGetBalanceCalled = true;
        return { name: "TestToken", amount: 1000000n, decimals: 6 };
      },
    };

    payer.addWalletAdapter(failingAdapter);
    payer.addWalletAdapter(workingAdapter);

    const response = await payer.fetch("/test-resource");

    t.equal(
      response.status,
      200,
      "payment should succeed despite one failing balance check",
    );
    t.ok(
      failGetBalanceCalled,
      "failing adapter getBalance should have been called",
    );
    t.ok(
      workingGetBalanceCalled,
      "working adapter getBalance should have been called",
    );

    t.pass();
    t.end();
  });

  t.end();
});
