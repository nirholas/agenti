#!/usr/bin/env pnpm tsx

import t from "tap";
import { AgedLRUCache } from "./cache";

await t.test("checkBasicCaching", async (t) => {
  let theTime = 0;
  const now = () => theTime;

  const cache = new AgedLRUCache<string, number>({
    capacity: 3,
    maxAge: 1000,
    now,
  });

  t.equal(cache.size, 0);
  t.matchOnly(cache.get("somekey"), undefined);
  cache.put("somekey", 42);

  theTime += 500;

  t.equal(cache.size, 1);
  t.matchOnly(cache.get("somekey"), 42);

  theTime += 1000;

  t.matchOnly(cache.get("somekey"), undefined);
  t.matchOnly(cache.size, 0);

  cache.put("0key", 0);
  cache.put("1key", 1);
  cache.put("2key", 2);

  t.equal(cache.size, 3);

  t.matchOnly(cache.get("0key"), 0);
  cache.put("3key", 3);
  t.equal(cache.size, 3);
  t.matchOnly(cache.get("1key"), undefined);
  t.matchOnly(cache.get("2key"), 2);
  cache.put("4key", 4);
  t.equal(cache.size, 3);
  t.matchOnly(cache.get("0key"), undefined);

  t.matchOnly(cache.get("2key"), 2);
  t.matchOnly(cache.get("3key"), 3);
  t.matchOnly(cache.get("4key"), 4);

  theTime += 1000;
  t.matchOnly(cache.get("2key"), undefined);
  t.matchOnly(cache.get("3key"), undefined);
  t.matchOnly(cache.get("4key"), undefined);

  t.equal(cache.size, 0);

  t.pass();
  t.end();
});
