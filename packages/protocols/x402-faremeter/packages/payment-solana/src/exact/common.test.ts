#!/usr/bin/env pnpm tsx

import t from "tap";

import { isValidationError as iVE } from "@faremeter/types";
import { lookupKnownSPLToken, clusterToCAIP2 } from "@faremeter/info/solana";
import { generateMatcher } from "./common";

await t.test("testBasicMatching", async (t) => {
  {
    const tokenInfo = lookupKnownSPLToken("mainnet-beta", "USDC");
    if (tokenInfo === undefined) {
      t.bailout("couldn't find SPL token");
      return;
    }

    const { matchTuple } = generateMatcher("mainnet-beta", tokenInfo.address);
    const network = clusterToCAIP2("mainnet-beta");

    const req = {
      network: network.caip2,
      scheme: "exact",
      asset: tokenInfo.address,
    };

    // CAIP-2 network identifier should match
    t.ok(!iVE(matchTuple(req)));

    // Legacy network names should not match (normalization happens in
    // the routes layer before dispatch, not in the handler matcher)
    t.ok(
      iVE(
        matchTuple({
          ...req,
          network: "solana-mainnet-beta",
        }),
      ),
    );
    t.ok(
      iVE(
        matchTuple({
          ...req,
          network: "solana",
        }),
      ),
    );

    t.ok(
      iVE(
        matchTuple({
          ...req,
          network: "foobar",
        }),
      ),
    );

    t.ok(
      iVE(
        matchTuple({
          ...req,
          scheme: "fner",
        }),
      ),
    );
  }

  t.end();
});
