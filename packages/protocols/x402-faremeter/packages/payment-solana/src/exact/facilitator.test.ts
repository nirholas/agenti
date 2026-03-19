#!/usr/bin/env pnpm tsx

import t from "tap";
import type { TransactionError } from "@solana/rpc-types";
import { transactionErrorToString } from "./facilitator";
import { getV1NetworkIds, clusterToCAIP2 } from "@faremeter/info/solana";

class MyBigCrazyError {
  someBigInt = 32n;
  someString = "a string";
  DuplicateInstruction = 42;
}

await t.test("transactionErrorToString", async (t) => {
  {
    const err = "AccountBorrowOutstanding" satisfies TransactionError;
    t.matchOnly(transactionErrorToString(err), "AccountBorrowOutstanding");
  }

  {
    const err = { DuplicateInstruction: 42 } satisfies TransactionError;
    t.matchOnly(transactionErrorToString(err), '{"DuplicateInstruction":42}');
  }

  {
    const err = {
      InstructionError: [32, "AccountBorrowFailed"],
    } satisfies TransactionError;
    t.matchOnly(
      transactionErrorToString(err),
      '{"InstructionError":[32,"AccountBorrowFailed"]}',
    );
  }

  {
    const err = {
      SomeResultThatShouldNeverHappen: 1337n,
    } as unknown as TransactionError;

    t.matchOnly(
      transactionErrorToString(err),
      '{"SomeResultThatShouldNeverHappen":"1337"}',
    );
  }

  {
    const err = 42 as unknown as TransactionError;
    t.matchOnly(transactionErrorToString(err), "42");
  }

  {
    const err = new MyBigCrazyError();
    t.matchOnly(
      transactionErrorToString(err),
      '{"someBigInt":"32","someString":"a string","DuplicateInstruction":42}',
    );
  }

  t.end();
});

await t.test(
  "getV1NetworkIds returns legacy network identifiers",
  async (t) => {
    await t.test("mainnet-beta returns two legacy network IDs", (t) => {
      const networkIds = getV1NetworkIds("mainnet-beta");

      t.equal(networkIds.length, 2);
      t.ok(networkIds.includes("solana-mainnet-beta"));
      t.ok(networkIds.includes("solana"));

      t.end();
    });

    await t.test("devnet returns one legacy network ID", (t) => {
      const networkIds = getV1NetworkIds("devnet");

      t.equal(networkIds.length, 1);
      t.ok(networkIds.includes("solana-devnet"));

      t.end();
    });

    t.end();
  },
);

await t.test("clusterToCAIP2 returns CAIP-2 network identifiers", async (t) => {
  await t.test("mainnet-beta maps to solana genesis hash", (t) => {
    const network = clusterToCAIP2("mainnet-beta");
    t.equal(network.caip2, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
    t.end();
  });

  await t.test("devnet maps to solana devnet genesis hash", (t) => {
    const network = clusterToCAIP2("devnet");
    t.equal(network.caip2, "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
    t.end();
  });

  await t.test("testnet maps to solana testnet genesis hash", (t) => {
    const network = clusterToCAIP2("testnet");
    t.equal(network.caip2, "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z");
    t.end();
  });

  t.end();
});
