#!/usr/bin/env pnpm tsx

import t from "tap";
import {
  TestHarness,
  createTestFacilitatorHandler,
  createTestPaymentHandler,
  accepts,
  TEST_NETWORK,
  chooseFirst,
  chooseCheapest,
  chooseMostExpensive,
  chooseByNetwork,
  chooseByIndex,
  chooseNone,
  chooseWithInspection,
  chooseWithFilter,
} from "@faremeter/test-harness";

await t.test("x402 v1 multiple payment options", async (t) => {
  await t.test("chooseFirst selects first payment option", async (t) => {
    let selectedNetwork: string | undefined;

    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [
        accepts({ maxAmountRequired: "100", description: "Option A" }),
        accepts({ maxAmountRequired: "200", description: "Option B" }),
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: (req) => {
            selectedNetwork = req.network;
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch({ payerChooser: chooseFirst });
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.equal(selectedNetwork, TEST_NETWORK, "should use first option");

    t.end();
  });

  await t.test("chooseCheapest selects lowest maxAmountRequired", async (t) => {
    let selectedAmount: string | undefined;

    // Use different assets to disambiguate options with same scheme/network
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [
        accepts({
          maxAmountRequired: "500",
          description: "Expensive option",
          asset: "EXPENSIVE",
        }),
        accepts({
          maxAmountRequired: "50",
          description: "Cheap option",
          asset: "CHEAP",
        }),
        accepts({
          maxAmountRequired: "200",
          description: "Medium option",
          asset: "MEDIUM",
        }),
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: (req) => {
            selectedAmount = req.amount;
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch({ payerChooser: chooseCheapest });
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.equal(selectedAmount, "50", "should select cheapest option");

    t.end();
  });

  await t.test(
    "chooseMostExpensive selects highest maxAmountRequired",
    async (t) => {
      let selectedAmount: string | undefined;

      // Use different assets to disambiguate options with same scheme/network
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [
          accepts({
            maxAmountRequired: "100",
            description: "Medium option",
            asset: "MEDIUM",
          }),
          accepts({
            maxAmountRequired: "1000",
            description: "Expensive option",
            asset: "EXPENSIVE",
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: (req) => {
              selectedAmount = req.amount;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      const fetch = harness.createFetch({ payerChooser: chooseMostExpensive });
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.equal(selectedAmount, "1000", "should select most expensive option");

      t.end();
    },
  );

  await t.test("chooseByNetwork selects matching network", async (t) => {
    let selectedNetwork: string | undefined;

    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: (req) => {
            selectedNetwork = req.network;
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch({
      payerChooser: chooseByNetwork(TEST_NETWORK),
    });
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.equal(selectedNetwork, TEST_NETWORK, "should select matching network");

    t.end();
  });

  await t.test("chooseByNetwork throws when no matching network", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch({
      payerChooser: chooseByNetwork("non-existent-network"),
    });

    try {
      await fetch("/test-resource");
      t.fail("should throw when no matching network");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /No payment option for network/,
          "should indicate no matching network",
        );
      }
    }

    t.end();
  });

  await t.test("chooseByIndex selects by index", async (t) => {
    let selectedAmount: string | undefined;

    // Use different assets to disambiguate options with same scheme/network
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [
        accepts({
          maxAmountRequired: "100",
          description: "First option",
          asset: "FIRST",
        }),
        accepts({
          maxAmountRequired: "200",
          description: "Second option",
          asset: "SECOND",
        }),
        accepts({
          maxAmountRequired: "300",
          description: "Third option",
          asset: "THIRD",
        }),
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({
          payTo: "test-receiver",
          onSettle: (req) => {
            selectedAmount = req.amount;
          },
        }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch({ payerChooser: chooseByIndex(1) });
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.equal(selectedAmount, "200", "should select second option (index 1)");

    t.end();
  });

  await t.test("chooseByIndex throws when index out of bounds", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts({ description: "Only option" })],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch({ payerChooser: chooseByIndex(5) });

    try {
      await fetch("/test-resource");
      t.fail("should throw when index out of bounds");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /out of bounds/,
          "should indicate index out of bounds",
        );
      }
    }

    t.end();
  });

  await t.test("chooseNone always throws", async (t) => {
    const harness = new TestHarness({
      settleMode: "settle-only",
      accepts: [accepts()],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    const fetch = harness.createFetch({ payerChooser: chooseNone });

    try {
      await fetch("/test-resource");
      t.fail("should throw when using chooseNone");
    } catch (error) {
      t.ok(error instanceof Error, "should throw an error");
      if (error instanceof Error) {
        t.match(
          error.message,
          /No suitable payment option/,
          "should indicate no suitable option",
        );
      }
    }

    t.end();
  });

  await t.test(
    "chooseWithInspection allows inspection before choosing",
    async (t) => {
      let inspectedCount = 0;

      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [
          accepts({ description: "Option A" }),
          accepts({ description: "Option B" }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      const fetch = harness.createFetch({
        payerChooser: chooseWithInspection((execers) => {
          inspectedCount = execers.length;
        }, chooseFirst),
      });
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.equal(inspectedCount, 2, "should have inspected 2 options");

      t.end();
    },
  );

  await t.test(
    "chooseWithFilter filters options before choosing",
    async (t) => {
      let selectedAmount: string | undefined;

      // Use different assets to disambiguate options with same scheme/network
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [
          accepts({
            maxAmountRequired: "50",
            description: "Small amount",
            asset: "SMALL",
          }),
          accepts({
            maxAmountRequired: "500",
            description: "Large amount",
            asset: "LARGE",
          }),
          accepts({
            maxAmountRequired: "150",
            description: "Medium amount",
            asset: "MEDIUM",
          }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({
            payTo: "test-receiver",
            onSettle: (req) => {
              selectedAmount = req.amount;
            },
          }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      // Filter to only amounts >= 100, then choose cheapest
      const fetch = harness.createFetch({
        payerChooser: chooseWithFilter(
          (execer) =>
            BigInt(execer.requirements.maxAmountRequired) >= BigInt(100),
          chooseCheapest,
        ),
      });
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.equal(
        selectedAmount,
        "150",
        "should select cheapest option that passes filter (150)",
      );

      t.end();
    },
  );

  await t.test(
    "chooseWithFilter throws when all options are filtered",
    async (t) => {
      const harness = new TestHarness({
        settleMode: "settle-only",
        accepts: [
          accepts({ maxAmountRequired: "50", description: "Small amount" }),
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
      });

      // Filter to only amounts >= 1000 (none exist)
      const fetch = harness.createFetch({
        payerChooser: chooseWithFilter(
          (execer) =>
            BigInt(execer.requirements.maxAmountRequired) >= BigInt(1000),
          chooseFirst,
        ),
      });

      try {
        await fetch("/test-resource");
        t.fail("should throw when all options are filtered");
      } catch (error) {
        t.ok(error instanceof Error, "should throw an error");
        if (error instanceof Error) {
          t.match(
            error.message,
            /No payment options available/,
            "should indicate no options available",
          );
        }
      }

      t.end();
    },
  );
});
