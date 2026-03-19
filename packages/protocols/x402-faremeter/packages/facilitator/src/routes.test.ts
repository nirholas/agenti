#!/usr/bin/env pnpm tsx

import t from "tap";
import type { Context } from "hono";
import { getClientIP } from "./routes";

function mockContext(headers: Record<string, string>): Context {
  return {
    req: {
      header: (key: string) => headers[key],
    },
  } as unknown as Context;
}

await t.test("getClientIP returns first IP from X-Forwarded-For", async (t) => {
  const c = mockContext({
    "X-Forwarded-For": "192.168.1.1, 10.0.0.1, 172.16.0.1",
  });

  t.equal(getClientIP(c), "192.168.1.1");
  t.end();
});

await t.test("getClientIP trims whitespace from X-Forwarded-For", async (t) => {
  const c = mockContext({
    "X-Forwarded-For": "  192.168.1.1  , 10.0.0.1",
  });

  t.equal(getClientIP(c), "192.168.1.1");
  t.end();
});

await t.test(
  "getClientIP returns single IP from X-Forwarded-For",
  async (t) => {
    const c = mockContext({
      "X-Forwarded-For": "192.168.1.1",
    });

    t.equal(getClientIP(c), "192.168.1.1");
    t.end();
  },
);

await t.test(
  "getClientIP falls back to X-Real-IP when X-Forwarded-For is missing",
  async (t) => {
    const c = mockContext({
      "X-Real-IP": "10.0.0.1",
    });

    t.equal(getClientIP(c), "10.0.0.1");
    t.end();
  },
);

await t.test(
  "getClientIP prefers X-Forwarded-For over X-Real-IP",
  async (t) => {
    const c = mockContext({
      "X-Forwarded-For": "192.168.1.1",
      "X-Real-IP": "10.0.0.1",
    });

    t.equal(getClientIP(c), "192.168.1.1");
    t.end();
  },
);

await t.test(
  "getClientIP returns undefined when no proxy headers present",
  async (t) => {
    const c = mockContext({});

    t.equal(getClientIP(c), undefined);
    t.end();
  },
);

await t.test(
  "getClientIP returns undefined for empty X-Forwarded-For",
  async (t) => {
    const c = mockContext({
      "X-Forwarded-For": "",
    });

    t.equal(getClientIP(c), undefined);
    t.end();
  },
);

await t.test(
  "getClientIP returns undefined for whitespace-only X-Forwarded-For",
  async (t) => {
    const c = mockContext({
      "X-Forwarded-For": "   ",
    });

    t.equal(getClientIP(c), undefined);
    t.end();
  },
);
