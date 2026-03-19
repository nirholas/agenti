#!/usr/bin/env pnpm tsx

import t from "tap";
import { sleep, allSettledWithTimeout } from "./promise";

async function checkDuration<T>(min: number, max: number, f: () => Promise<T>) {
  if (max <= min) {
    throw new Error("max duration must be greater than min");
  }

  const start = Date.now();

  const res = await f();

  const delta = Date.now() - start;

  t.ok(delta >= min, `duration took ${delta} ms, which isn't >= ${min} ms`);
  t.ok(delta <= max, `duration took ${delta} ms, which isn't <= ${max} ms`);

  return res;
}

await t.test("checkAllSettledNoTimeout", async (t) => {
  const results = await checkDuration(25, 50, () =>
    allSettledWithTimeout(
      [sleep(10, "good"), sleep(30, "to"), sleep(1, "go")],
      100,
    ),
  );

  t.equal(results.length, 3);

  results.forEach((x) => {
    if (x === undefined) {
      t.bailout();
    }
    t.matchOnly(x.status, "fulfilled");
  });

  t.matchOnly(
    results.map((x) => (x as PromiseFulfilledResult<string>).value),
    ["good", "to", "go"],
  );

  t.pass();
  t.end();
});

await t.test("checkAllSettledWithTimeout", async (t) => {
  const results = await checkDuration(20, 125, () =>
    allSettledWithTimeout([sleep(10), sleep(500)], 100),
  );

  t.equal(results.length, 2);

  const [result0, result1] = results;

  if (result0 == undefined) {
    return t.bailout();
  }

  if (result1 == undefined) {
    return t.bailout();
  }

  t.matchOnly(result0.status, "fulfilled");
  t.matchOnly(result1.status, "rejected");

  t.pass();
  t.end();
});

await t.test("checkAllSettleException", async (t) => {
  const results = await checkDuration(10, 45, async () =>
    allSettledWithTimeout(
      [
        sleep(10, 42),
        (async () => {
          throw new Error("an error happened");
        })(),
        sleep(15, 1337),
      ],
      50,
    ),
  );

  t.equal(results.length, 3);

  const [result0, result1, result2] = results;

  if (result0 === undefined) {
    return t.bailout();
  }

  if (result1 === undefined) {
    return t.bailout();
  }

  if (result2 === undefined) {
    return t.bailout();
  }

  if (result0.status !== "fulfilled") {
    return t.fail();
  }

  t.matchOnly(result0.value, 42);

  if (result1.status !== "rejected") {
    return t.fail();
  }

  t.matchOnly(result1.reason, new Error("an error happened"));

  if (result2.status !== "fulfilled") {
    return t.fail();
  }

  t.matchOnly(result2.value, 1337);
});
