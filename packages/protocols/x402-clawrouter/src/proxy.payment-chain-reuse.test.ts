import { describe, expect, it } from "vitest";
import { generatePrivateKey } from "viem/accounts";

import { startProxy } from "./proxy.js";
import { deriveSolanaKeyBytes } from "./wallet.js";

describe("startProxy payment-chain reuse guard", () => {
  const TEST_MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

  it("rejects reusing an existing Base proxy when Solana is requested on the same port", async () => {
    const walletKey = generatePrivateKey();
    const solanaPrivateKeyBytes = deriveSolanaKeyBytes(TEST_MNEMONIC);
    const port = 21000 + Math.floor(Math.random() * 10000);

    const baseProxy = await startProxy({
      wallet: walletKey,
      paymentChain: "base",
      port,
      skipBalanceCheck: true,
    });

    try {
      await expect(
        startProxy({
          wallet: { key: walletKey, solanaPrivateKeyBytes },
          paymentChain: "solana",
          port,
          skipBalanceCheck: true,
        }),
      ).rejects.toThrow(`Existing proxy on port ${port} is using base but solana was requested`);
    } finally {
      await baseProxy.close();
    }
  });
});
