#!/usr/bin/env pnpm tsx

import t from "tap";
import * as solana from "./solana";

await t.test("basicClusterLookup", async (t) => {
  t.ok(solana.isKnownCluster("mainnet-beta"));
  t.ok(solana.isKnownCluster("devnet"));
  t.ok(solana.isKnownCluster("testnet"));
  t.ok(!solana.isKnownCluster("notacluster"));
  t.end();
});

await t.test("caip2Conversions", async (t) => {
  await t.test("clusterToCAIP2", (t) => {
    t.equal(
      solana.clusterToCAIP2("mainnet-beta").caip2,
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    );
    t.equal(
      solana.clusterToCAIP2("devnet").caip2,
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    );
    t.equal(
      solana.clusterToCAIP2("testnet").caip2,
      "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
    );
    t.end();
  });

  await t.test("caip2ToCluster", (t) => {
    t.equal(
      solana.caip2ToCluster("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"),
      "mainnet-beta",
    );
    t.equal(
      solana.caip2ToCluster("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"),
      "devnet",
    );
    t.equal(
      solana.caip2ToCluster("solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z"),
      "testnet",
    );
    t.equal(solana.caip2ToCluster("solana:unknown"), null);
    t.end();
  });

  await t.test("legacyNetworkIdToCAIP2", (t) => {
    t.equal(
      solana.legacyNetworkIdToCAIP2("solana-mainnet-beta")?.caip2,
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    );
    t.equal(
      solana.legacyNetworkIdToCAIP2("solana")?.caip2,
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    );
    t.equal(
      solana.legacyNetworkIdToCAIP2("solana-devnet")?.caip2,
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    );
    t.equal(
      solana.legacyNetworkIdToCAIP2("solana-testnet")?.caip2,
      "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
    );
    t.equal(solana.legacyNetworkIdToCAIP2("unknown"), null);
    t.end();
  });

  await t.test("normalizeNetworkId", (t) => {
    t.equal(
      solana.normalizeNetworkId("mainnet-beta"),
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    );
    t.equal(
      solana.normalizeNetworkId("devnet"),
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    );
    t.equal(
      solana.normalizeNetworkId("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"),
      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    );
    t.equal(
      solana.normalizeNetworkId("solana-devnet"),
      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    );
    t.end();
  });

  t.end();
});

await t.test("lookupX402Network", async (t) => {
  t.equal(
    solana.lookupX402Network("mainnet-beta").caip2,
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  );
  t.equal(
    solana.lookupX402Network("devnet").caip2,
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  );
  t.equal(
    solana.lookupX402Network("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1").caip2,
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  );
  t.throws(() => solana.lookupX402Network("unknown-network"));
  t.end();
});

await t.test("getV1NetworkIds", async (t) => {
  const mainnetIds = solana.getV1NetworkIds("mainnet-beta");
  t.equal(mainnetIds.length, 2);
  t.ok(mainnetIds.includes("solana-mainnet-beta"));
  t.ok(mainnetIds.includes("solana"));

  const devnetIds = solana.getV1NetworkIds("devnet");
  t.equal(devnetIds.length, 1);
  t.ok(devnetIds.includes("solana-devnet"));

  const testnetIds = solana.getV1NetworkIds("testnet");
  t.equal(testnetIds.length, 1);
  t.ok(testnetIds.includes("solana-testnet"));

  t.end();
});

await t.test("x402Exact returns v1-compatible requirements", async (t) => {
  await t.test(
    "mainnet-beta returns two requirements with legacy network IDs",
    (t) => {
      const reqs = solana.x402Exact({
        network: "mainnet-beta",
        asset: "USDC",
        amount: "1000000",
        payTo: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      });

      t.equal(reqs.length, 2);

      const networks = reqs.map((r) => r.network);
      t.ok(networks.includes("solana-mainnet-beta"));
      t.ok(networks.includes("solana"));

      for (const req of reqs) {
        t.equal(req.scheme, "exact");
        t.equal(req.asset, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        t.equal(req.maxAmountRequired, "1000000");
      }

      t.end();
    },
  );

  await t.test("devnet returns one requirement with legacy network ID", (t) => {
    const reqs = solana.x402Exact({
      network: "devnet",
      asset: "USDC",
      amount: "500000",
      payTo: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    });

    t.equal(reqs.length, 1);
    t.equal(reqs[0]?.network, "solana-devnet");
    t.equal(reqs[0]?.scheme, "exact");

    t.end();
  });

  t.end();
});

await t.test("basicSPLTokenLookup", async (t) => {
  await t.test((t) => {
    const info = solana.lookupKnownSPLToken("devnet", "USDC");

    if (!info) {
      throw new Error("failed to lookup known SPL token");
    }

    t.matchOnly(info.address, "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    t.matchOnly(info.cluster, "devnet");
    t.end();
  });

  await t.test((t) => {
    const info = solana.lookupKnownSPLToken(
      "alsdkjaklsdj" as solana.KnownCluster,
      "asldkjasd" as solana.KnownSPLToken,
    );

    t.matchOnly(info, undefined);
    t.end();
  });

  await t.test((t) => {
    t.ok(solana.isKnownSPLToken("USDC"));
    t.ok(!solana.isKnownSPLToken("notarealtoken" as solana.KnownSPLToken));
    t.end();
  });

  t.end();
});
