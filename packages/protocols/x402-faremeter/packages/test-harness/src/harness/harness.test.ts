#!/usr/bin/env pnpm tsx

import t from "tap";
import { TestHarness } from "./harness";
import { createTestFacilitatorHandler } from "../scheme/facilitator";
import { createTestPaymentHandler } from "../scheme/client";
import { TEST_SCHEME, TEST_NETWORK } from "../scheme/constants";
import {
  matchFacilitatorSettle,
  matchFacilitatorVerify,
} from "../interceptors/matchers";
import { getURLFromRequestInfo } from "../interceptors/utils";

await t.test("interceptor composition", async (t) => {
  await t.test(
    "multiple middleware interceptors execute in order",
    async (t) => {
      const executionOrder: string[] = [];

      const harness = new TestHarness({
        settleMode: "verify-then-settle",
        accepts: [
          {
            scheme: TEST_SCHEME,
            network: TEST_NETWORK,
            maxAmountRequired: "100",
            resource: "http://example.com/test",
            description: "Test resource",
            mimeType: "application/json",
            payTo: "test-receiver",
            maxTimeoutSeconds: 30,
            asset: "",
          },
        ],
        facilitatorHandlers: [
          createTestFacilitatorHandler({ payTo: "test-receiver" }),
        ],
        clientHandlers: [createTestPaymentHandler()],
        middlewareInterceptors: [
          (fetch) => async (input, init) => {
            executionOrder.push("interceptor-1-before");
            const result = await fetch(input, init);
            executionOrder.push("interceptor-1-after");
            return result;
          },
          (fetch) => async (input, init) => {
            executionOrder.push("interceptor-2-before");
            const result = await fetch(input, init);
            executionOrder.push("interceptor-2-after");
            return result;
          },
          (fetch) => async (input, init) => {
            executionOrder.push("interceptor-3-before");
            const result = await fetch(input, init);
            executionOrder.push("interceptor-3-after");
            return result;
          },
        ],
      });

      const fetch = harness.createFetch();
      const response = await fetch("/test-resource");

      t.equal(response.status, 200, "should complete successfully");
      t.ok(executionOrder.length > 0, "interceptors should have executed");

      // Verify proper nesting: 1-before, 2-before, 3-before, 3-after, 2-after, 1-after
      const firstBefore = executionOrder.indexOf("interceptor-1-before");
      const secondBefore = executionOrder.indexOf("interceptor-2-before");
      const thirdBefore = executionOrder.indexOf("interceptor-3-before");
      const thirdAfter = executionOrder.lastIndexOf("interceptor-3-after");
      const secondAfter = executionOrder.lastIndexOf("interceptor-2-after");
      const firstAfter = executionOrder.lastIndexOf("interceptor-1-after");

      t.ok(
        firstBefore < secondBefore,
        "first interceptor before should execute first",
      );
      t.ok(
        secondBefore < thirdBefore,
        "second interceptor before should execute second",
      );
      t.ok(
        thirdAfter < secondAfter,
        "third interceptor after should execute before second after",
      );
      t.ok(
        secondAfter < firstAfter,
        "second interceptor after should execute before first after",
      );

      t.end();
    },
  );

  await t.test("client and middleware interceptors are separate", async (t) => {
    let clientInterceptorCalled = false;
    let middlewareInterceptorCalled = false;

    const harness = new TestHarness({
      accepts: [
        {
          scheme: TEST_SCHEME,
          network: TEST_NETWORK,
          maxAmountRequired: "100",
          resource: "http://example.com/test",
          description: "Test resource",
          mimeType: "application/json",
          payTo: "test-receiver",
          maxTimeoutSeconds: 30,
          asset: "",
        },
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      clientInterceptors: [
        (fetch) => async (input, init) => {
          clientInterceptorCalled = true;
          return fetch(input, init);
        },
      ],
      middlewareInterceptors: [
        (fetch) => async (input, init) => {
          middlewareInterceptorCalled = true;
          return fetch(input, init);
        },
      ],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.ok(clientInterceptorCalled, "client interceptor should be called");
    t.ok(
      middlewareInterceptorCalled,
      "middleware interceptor should be called",
    );

    t.end();
  });

  await t.test("interceptor can short-circuit request", async (t) => {
    let facilitatorWasCalled = false;

    const harness = new TestHarness({
      accepts: [
        {
          scheme: TEST_SCHEME,
          network: TEST_NETWORK,
          maxAmountRequired: "100",
          resource: "http://example.com/test",
          description: "Test resource",
          mimeType: "application/json",
          payTo: "test-receiver",
          maxTimeoutSeconds: 30,
          asset: "",
        },
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
      middlewareInterceptors: [
        (fetch) => async (input, init) => {
          const url = getURLFromRequestInfo(input);
          if (url.includes("/facilitator/")) {
            facilitatorWasCalled = true;
          }
          return fetch(input, init);
        },
        (fetch) => async (input, init) => {
          const url = getURLFromRequestInfo(input);
          // Short-circuit settle requests
          if (matchFacilitatorSettle(url, init)) {
            return new Response(
              JSON.stringify({
                success: true,
                transaction: "0xshortcircuit",
                network: TEST_NETWORK,
                payer: "test-payer",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          return fetch(input, init);
        },
      ],
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.ok(
      facilitatorWasCalled,
      "other facilitator endpoints should still be called",
    );

    t.end();
  });

  await t.test("dynamically added interceptors work correctly", async (t) => {
    let dynamicInterceptorCalled = false;

    const harness = new TestHarness({
      settleMode: "verify-then-settle",
      accepts: [
        {
          scheme: TEST_SCHEME,
          network: TEST_NETWORK,
          maxAmountRequired: "100",
          resource: "http://example.com/test",
          description: "Test resource",
          mimeType: "application/json",
          payTo: "test-receiver",
          maxTimeoutSeconds: 30,
          asset: "",
        },
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    // Add interceptor after construction to track verify endpoint calls
    harness.addMiddlewareInterceptor((fetch) => async (input, init) => {
      const url = getURLFromRequestInfo(input);
      if (matchFacilitatorVerify(url, init)) {
        dynamicInterceptorCalled = true;
      }
      return fetch(input, init);
    });

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.ok(
      dynamicInterceptorCalled,
      "dynamically added interceptor should be called",
    );

    t.end();
  });

  await t.test("clearInterceptors removes added interceptors", async (t) => {
    let dynamicInterceptorCalled = false;

    const harness = new TestHarness({
      accepts: [
        {
          scheme: TEST_SCHEME,
          network: TEST_NETWORK,
          maxAmountRequired: "100",
          resource: "http://example.com/test",
          description: "Test resource",
          mimeType: "application/json",
          payTo: "test-receiver",
          maxTimeoutSeconds: 30,
          asset: "",
        },
      ],
      facilitatorHandlers: [
        createTestFacilitatorHandler({ payTo: "test-receiver" }),
      ],
      clientHandlers: [createTestPaymentHandler()],
    });

    // Add then clear interceptor
    harness.addMiddlewareInterceptor((fetch) => async (input, init) => {
      dynamicInterceptorCalled = true;
      return fetch(input, init);
    });

    harness.clearInterceptors();

    const fetch = harness.createFetch();
    const response = await fetch("/test-resource");

    t.equal(response.status, 200, "should complete successfully");
    t.equal(
      dynamicInterceptorCalled,
      false,
      "cleared interceptor should not be called",
    );

    t.end();
  });
});
