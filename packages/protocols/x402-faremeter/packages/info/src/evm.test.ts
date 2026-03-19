#!/usr/bin/env pnpm tsx

import t from "tap";
import * as evm from "./evm";

await t.test("basicNetworkLookup", async (t) => {
  t.ok(evm.isKnownCAIP2Network("eip155:8453"));
  t.ok(!evm.isKnownCAIP2Network("eip155:999999"));
  t.ok(!evm.isKnownCAIP2Network("base"));
  t.end();
});

await t.test("networkConversions", async (t) => {
  await t.test("chainIdToCAIP2", (t) => {
    t.equal(evm.chainIdToCAIP2(8453), "eip155:8453");
    t.equal(evm.chainIdToCAIP2(84532), "eip155:84532");
    t.equal(evm.chainIdToCAIP2(999999), "eip155:999999");
    t.end();
  });

  await t.test("caip2ToChainId", (t) => {
    t.equal(evm.caip2ToChainId("eip155:8453"), 8453);
    t.equal(evm.caip2ToChainId("eip155:84532"), 84532);
    t.equal(evm.caip2ToChainId("invalid"), null);
    t.equal(evm.caip2ToChainId("eip155:"), null);
    t.end();
  });

  await t.test("legacyNameToCAIP2", (t) => {
    t.equal(evm.legacyNameToCAIP2("base"), "eip155:8453");
    t.equal(evm.legacyNameToCAIP2("base-sepolia"), "eip155:84532");
    t.equal(evm.legacyNameToCAIP2("skale-europa-testnet"), "eip155:1444673419");
    t.equal(evm.legacyNameToCAIP2("unknown-network"), null);
    t.end();
  });

  await t.test("caip2ToLegacyName", (t) => {
    t.equal(evm.caip2ToLegacyName("eip155:8453"), "base");
    t.equal(evm.caip2ToLegacyName("eip155:84532"), "base-sepolia");
    t.equal(evm.caip2ToLegacyName("eip155:999999"), null);
    t.end();
  });

  await t.test("normalizeNetworkId", (t) => {
    t.equal(evm.normalizeNetworkId(8453), "eip155:8453");
    t.equal(evm.normalizeNetworkId("base"), "eip155:8453");
    t.equal(evm.normalizeNetworkId("base-sepolia"), "eip155:84532");
    t.equal(evm.normalizeNetworkId("eip155:8453"), "eip155:8453");
    t.equal(evm.normalizeNetworkId("84532"), "eip155:84532");
    t.end();
  });

  t.end();
});

await t.test("basicAssetLookup", async (t) => {
  await t.test((t) => {
    const info = evm.lookupKnownAsset("eip155:84532", "USDC");

    if (!info) {
      throw new Error("failed to lookup known EVM asset");
    }

    t.matchOnly(info.address, "0x036cbd53842c5426634e7929541ec2318f3dcf7e");
    t.matchOnly(info.name, "USDC");
    t.matchOnly(info.network, "eip155:84532");
    t.equal(info.forwarder, undefined);
    t.equal(info.forwarderName, undefined);
    t.equal(info.forwarderVersion, undefined);
    t.end();
  });

  await t.test("lookup by legacy name", (t) => {
    const info = evm.lookupKnownAsset("base-sepolia", "USDC");

    if (!info) {
      throw new Error("failed to lookup known EVM asset by legacy name");
    }

    t.matchOnly(info.address, "0x036cbd53842c5426634e7929541ec2318f3dcf7e");
    t.matchOnly(info.name, "USDC");
    t.matchOnly(info.network, "eip155:84532");
    t.end();
  });

  await t.test((t) => {
    const info = evm.lookupKnownAsset("eip155:1444673419", "USDC");

    if (!info) {
      throw new Error("failed to lookup known EVM asset");
    }

    t.matchOnly(info.address, "0x9eAb55199f4481eCD7659540A17Af618766b07C4");
    t.matchOnly(info.name, "USDC");
    t.matchOnly(info.network, "eip155:1444673419");
    t.matchOnly(info.forwarder, "0x7779B0d1766e6305E5f8081E3C0CDF58FcA24330");
    t.matchOnly(info.forwarderName, "USDC Forwarder");
    t.matchOnly(info.forwarderVersion, "1");
    t.end();
  });

  await t.test((t) => {
    const info = evm.lookupKnownAsset(
      "eip155:999999",
      "asldkjasd" as evm.KnownAsset,
    );

    t.matchOnly(info, undefined);
    t.end();
  });

  await t.test((t) => {
    t.ok(evm.isKnownAsset("USDC"));
    t.ok(!evm.isKnownAsset("notarealtoken" as evm.KnownAsset));
    t.end();
  });

  await t.test("lookup by chain ID number", (t) => {
    const info = evm.lookupKnownAsset(84532, "USDC");

    if (!info) {
      throw new Error("failed to lookup known EVM asset");
    }

    t.matchOnly(info.address, "0x036cbd53842c5426634e7929541ec2318f3dcf7e");
    t.matchOnly(info.name, "USDC");
    t.matchOnly(info.network, "eip155:84532");
    t.end();
  });

  t.end();
});

await t.test("basicChainLookup", async (t) => {
  t.matchOnly(evm.lookupX402Network(8453), "eip155:8453");
  t.matchOnly(evm.lookupX402Network(84532), "eip155:84532");
  t.matchOnly(evm.lookupX402Network(8675309), "eip155:8675309");
  t.end();
});
