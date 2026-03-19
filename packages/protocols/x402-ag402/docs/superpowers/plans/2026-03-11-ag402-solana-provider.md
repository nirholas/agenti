# @ag402/solana Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `@ag402/solana` npm package — a real Solana USDC on-chain `PaymentProvider` for `@ag402/fetch`, fully aligned with Python's `SolanaAdapter`.

**Architecture:** Single-file `sdk/solana/src/index.ts` exports `SolanaPaymentProvider` + `fromEnv()`. Uses `@solana/web3.js` + `@solana/spl-token` + `@solana/spl-memo` for ATA creation, SPL `transfer_checked`, and memo injection. `bs58` decodes private key from base58. Memo format `Ag402-v1|{requestId}` mirrors Python exactly.

**Tech Stack:** TypeScript 5.7, `@solana/web3.js ^1.98`, `@solana/spl-token ^0.4`, `@solana/spl-memo ^0.2.5`, `bs58 ^6.0`, Vitest 2, tsup (build), Node >=18

---

## Chunk 1: Package Scaffold

### Task 1: Create package.json

**Files:**
- Create: `sdk/solana/package.json`

- [ ] **Step 1: Create `sdk/solana/package.json`**

```json
{
  "name": "@ag402/solana",
  "version": "0.1.0",
  "description": "Solana USDC PaymentProvider for @ag402/fetch — real on-chain x402 payments",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --clean --external @solana/web3.js --external @solana/spl-token --external @solana/spl-memo --external bs58",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run lint && npm test && npm run build"
  },
  "keywords": [
    "x402",
    "solana",
    "usdc",
    "payment",
    "ag402",
    "web3",
    "spl-token"
  ],
  "author": {
    "name": "ag402",
    "url": "https://github.com/agentpayments/ag402"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/agentpayments/ag402.git",
    "directory": "sdk/solana"
  },
  "homepage": "https://github.com/agentpayments/ag402/tree/main/sdk/solana#readme",
  "bugs": {
    "url": "https://github.com/agentpayments/ag402/issues"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@solana/web3.js": "^1.98.0",
    "@solana/spl-token": "^0.4.0",
    "@solana/spl-memo": "^0.2.5",
    "bs58": "^6.0.0"
  },
  "peerDependencies": {
    "@ag402/fetch": "^0.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.3.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Why `bs58`?** Node.js `Buffer.from(str, encoding)` does NOT support `"base58"` — it silently falls back to UTF-8, producing wrong bytes. `bs58.decode()` is the correct approach, same as `solders.Keypair.from_base58_string()` on the Python side.

**Why `@solana/spl-memo`?** The Memo instruction for `Ag402-v1|{requestId}` comes from this dedicated package, not from `@solana/spl-token`.

- [ ] **Step 2: Commit**

```bash
cd sdk/solana && git add package.json && git commit -m "chore(solana): scaffold @ag402/solana package.json"
```

---

### Task 2: Create tsconfig.json and vitest.config.ts

**Files:**
- Create: `sdk/solana/tsconfig.json`
- Create: `sdk/solana/vitest.config.ts`

- [ ] **Step 1: Create `sdk/solana/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 2: Create `sdk/solana/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
});
```

- [ ] **Step 3: Install dependencies**

```bash
cd sdk/solana && npm install
```

Expected: `node_modules/` created with `@solana/web3.js`, `@solana/spl-token`, `@solana/spl-memo`, `bs58`, vitest, tsup, typescript.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json vitest.config.ts package-lock.json && git commit -m "chore(solana): add tsconfig and vitest config"
```

---

## Chunk 2: TDD — Constructor + getAddress()

### Task 3: Write failing tests for constructor and getAddress()

**Files:**
- Create: `sdk/solana/src/__tests__/solana-provider.test.ts`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p sdk/solana/src/__tests__
```

- [ ] **Step 2: Write the complete test file**

Create `sdk/solana/src/__tests__/solana-provider.test.ts` with the content below.

**Mock strategy:** `vi.mock()` calls are hoisted to the top by Vitest. Factory return values (set via `mockReturnValue`/`mockImplementation` inside `vi.mock()`) persist for the lifetime of the test file. We use `beforeEach` with `vi.clearAllMocks()` to reset call counts and history between tests while preserving factory implementations. Tests that need one-shot custom behavior use `mockImplementationOnce()` inside the test body — it self-clears after use.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock @solana/web3.js ────────────────────────────────────────────────────
// Hoisted by Vitest. Factory runs once; vi.resetAllMocks() in beforeEach
// restores mock return values from the factory.
vi.mock("@solana/web3.js", () => {
  const mockPublicKey = {
    toBase58: vi.fn().mockReturnValue("PayerPubkey1111111111111111111111111111111"),
    toString: vi.fn().mockReturnValue("PayerPubkey1111111111111111111111111111111"),
  };
  const mockKeypair = {
    publicKey: mockPublicKey,
    secretKey: new Uint8Array(64),
  };
  return {
    Connection: vi.fn().mockImplementation(() => ({
      sendTransaction: vi.fn().mockResolvedValue("5xFakeTxSignature111111111111111111111111111111"),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    })),
    Keypair: {
      fromSecretKey: vi.fn().mockReturnValue(mockKeypair),
    },
    PublicKey: vi.fn().mockImplementation((addr: string) => ({
      toBase58: () => addr,
      toString: () => addr,
    })),
    Transaction: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockReturnThis(),
    })),
    LAMPORTS_PER_SOL: 1_000_000_000,
  };
});

// ─── Mock bs58 ───────────────────────────────────────────────────────────────
vi.mock("bs58", () => ({
  default: {
    decode: vi.fn().mockReturnValue(new Uint8Array(64)),
  },
}));

// ─── Mock @solana/spl-token ──────────────────────────────────────────────────
vi.mock("@solana/spl-token", () => ({
  getOrCreateAssociatedTokenAccount: vi.fn().mockResolvedValue({
    address: {
      toBase58: () => "PayerATA1111111111111111111111111111111111",
      toString: () => "PayerATA1111111111111111111111111111111111",
    },
  }),
  createTransferCheckedInstruction: vi.fn().mockReturnValue({ programId: "tokenProg", data: new Uint8Array() }),
  TOKEN_PROGRAM_ID: { toBase58: () => "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
}));

// ─── Mock @solana/spl-memo ───────────────────────────────────────────────────
vi.mock("@solana/spl-memo", () => ({
  createMemoInstruction: vi.fn().mockReturnValue({ programId: "memoProg", data: new Uint8Array() }),
}));

// ─── Import SUT (after mocks) ────────────────────────────────────────────────
import { SolanaPaymentProvider, fromEnv } from "../index.ts";

// ─── Shared reset ────────────────────────────────────────────────────────────
// vi.clearAllMocks() resets call history between tests while preserving
// factory mock return values (unlike vi.resetAllMocks() which removes them).
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Test: Constructor ───────────────────────────────────────────────────────
describe("SolanaPaymentProvider — constructor", () => {
  // A syntactically valid base58 string of appropriate length
  const VALID_KEY = "4NMwxzmYj2uvHuq8xoqhY8RXg63KSVJM1DXkpbmkUY7YQWoVrk7DqEDsomePvYKqU1h7H4P1DpxJnrZMHNF6Abt";

  it("constructs successfully with a valid base58 private key", () => {
    expect(() => new SolanaPaymentProvider({ privateKey: VALID_KEY })).not.toThrow();
  });

  it("uses devnet as default rpcUrl", async () => {
    const { Connection } = await import("@solana/web3.js");
    new SolanaPaymentProvider({ privateKey: VALID_KEY });
    expect(Connection).toHaveBeenCalledWith(
      "https://api.devnet.solana.com",
      expect.anything()
    );
  });

  it("uses custom rpcUrl when provided", async () => {
    const { Connection } = await import("@solana/web3.js");
    new SolanaPaymentProvider({
      privateKey: VALID_KEY,
      rpcUrl: "https://api.mainnet-beta.solana.com",
    });
    expect(Connection).toHaveBeenCalledWith(
      "https://api.mainnet-beta.solana.com",
      expect.anything()
    );
  });

  it("throws when given an invalid base58 private key", async () => {
    const bs58 = await import("bs58");
    // Simulate bs58.decode throwing on invalid input
    vi.mocked(bs58.default.decode).mockImplementationOnce(() => {
      throw new Error("Non-base58 character");
    });
    expect(() => new SolanaPaymentProvider({ privateKey: "not-valid-base58!!!" })).toThrow();
  });
});

// ─── Test: getAddress() ──────────────────────────────────────────────────────
describe("SolanaPaymentProvider — getAddress()", () => {
  const VALID_KEY = "4NMwxzmYj2uvHuq8xoqhY8RXg63KSVJM1DXkpbmkUY7YQWoVrk7DqEDsomePvYKqU1h7H4P1DpxJnrZMHNF6Abt";

  it("returns a base58 public key string", () => {
    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    const addr = provider.getAddress();
    expect(typeof addr).toBe("string");
    expect(addr.length).toBeGreaterThan(0);
  });

  it("does not contain CR, LF, or quotes (header injection safety)", () => {
    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    const addr = provider.getAddress();
    expect(addr).not.toMatch(/[\r\n"]/);
  });
});
```

- [ ] **Step 3: Run tests to verify they FAIL (no source file yet)**

```bash
cd sdk/solana && npm test
```

Expected: FAIL — `Cannot find module '../index.ts'`

- [ ] **Step 4: Commit failing tests**

```bash
git add src/__tests__/solana-provider.test.ts && git commit -m "test(solana): add failing constructor + getAddress tests"
```

---

### Task 4: Implement constructor + getAddress() only

**Files:**
- Create: `sdk/solana/src/index.ts`

This step implements ONLY the constructor and `getAddress()`. `pay()` and `fromEnv()` are stubs that will be fleshed out in Tasks 5–6.

- [ ] **Step 1: Create `sdk/solana/src/index.ts`**

```typescript
/**
 * @ag402/solana — Solana USDC PaymentProvider for @ag402/fetch
 *
 * Implements real on-chain USDC transfers via SPL Token Program.
 * Fully aligned with Python ag402_core.payment.solana_adapter.SolanaAdapter.
 *
 * Usage:
 *   import { SolanaPaymentProvider, fromEnv } from "@ag402/solana";
 *   const provider = new SolanaPaymentProvider({ privateKey: process.env.SOLANA_PRIVATE_KEY! });
 *   const apiFetch = createX402Fetch({ wallet, provider });
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createMemoInstruction } from "@solana/spl-memo";
import bs58 from "bs58";
import type { PaymentProvider, X402PaymentChallenge } from "@ag402/fetch";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEVNET_RPC = "https://api.devnet.solana.com";
const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
/** USDC has 6 decimal places */
const USDC_DECIMALS = 6;

// ─── Options ─────────────────────────────────────────────────────────────────

export interface SolanaPaymentProviderOptions {
  /** Base58-encoded Solana private key — mirrors Python SOLANA_PRIVATE_KEY env var */
  privateKey: string;
  /** Solana RPC endpoint. Defaults to devnet. */
  rpcUrl?: string;
  /** USDC mint address. Defaults to devnet USDC mint. */
  usdcMint?: string;
}

// ─── SolanaPaymentProvider ───────────────────────────────────────────────────

export class SolanaPaymentProvider implements PaymentProvider {
  private readonly connection: Connection;
  private readonly keypair: Keypair;
  private readonly usdcMint: PublicKey;

  constructor(options: SolanaPaymentProviderOptions) {
    const rpcUrl = options.rpcUrl ?? DEVNET_RPC;
    const mintAddress = options.usdcMint ?? DEVNET_USDC_MINT;

    // bs58.decode() throws for invalid input — do NOT use Buffer.from(..., "base58")
    // which silently falls back to UTF-8 and produces garbage bytes.
    this.keypair = Keypair.fromSecretKey(bs58.decode(options.privateKey));
    this.connection = new Connection(rpcUrl, "confirmed");
    this.usdcMint = new PublicKey(mintAddress);
  }

  /**
   * Returns the payer's base58 public key.
   * Guaranteed to not contain CR, LF, or quotes (header injection safety —
   * mirrors @ag402/fetch buildAuthorization protection).
   */
  getAddress(): string {
    const addr = this.keypair.publicKey.toBase58();
    return addr.replace(/[\r\n"]/g, "");
  }

  // pay() and fromEnv() are stubbed here — implemented in Task 5.
  // This keeps the TDD red-green cycle: tests written first (Task 3), then stubs
  // make constructor/getAddress tests green, then full pay() implemented in Task 5.
  async pay(_challenge: X402PaymentChallenge, _requestId: string): Promise<string> {
    throw new Error("pay() not implemented yet");
  }
}

// ─── fromEnv (stub — implemented in Task 5) ──────────────────────────────────
export function fromEnv(_options?: { rpcUrl?: string }): SolanaPaymentProvider {
  throw new Error("fromEnv() not implemented yet");
}
```

- [ ] **Step 2: Run constructor + getAddress tests to confirm GREEN**

```bash
cd sdk/solana && npm test -- --reporter=verbose
```

Expected: constructor describe (4 tests) + getAddress describe (2 tests) = **6 tests PASS**.
`pay()` stub will throw "not implemented yet" — but no pay() tests are written yet, so overall: 6 PASS, 0 FAIL.

- [ ] **Step 3: Commit stub implementation**

```bash
git add src/index.ts && git commit -m "feat(solana): implement constructor + getAddress (pay/fromEnv stubbed)"
```

---

## Chunk 3: TDD — pay() happy path

### Task 5: Write failing pay() tests → implement pay() + fromEnv() → green

**Files:**
- Modify: `sdk/solana/src/__tests__/solana-provider.test.ts`
- Modify: `sdk/solana/src/index.ts`

Also update the mock for `Connection` in `solana-provider.test.ts` — the `Connection` factory now needs to include `getLatestBlockhash` (required by the real `pay()` implementation):

Find the `Connection: vi.fn().mockImplementation(...)` block in `solana-provider.test.ts` and update it:

```typescript
Connection: vi.fn().mockImplementation(() => ({
  getLatestBlockhash: vi.fn().mockResolvedValue({
    blockhash: "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N",
    lastValidBlockHeight: 999999,
  }),
  sendTransaction: vi.fn().mockResolvedValue("5xFakeTxSignature111111111111111111111111111111"),
  confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
})),
```

- [ ] **Step 1: Update Connection mock to include getLatestBlockhash**

In `sdk/solana/src/__tests__/solana-provider.test.ts`, find and replace the `Connection` mock implementation to add `getLatestBlockhash` as shown above.

- [ ] **Step 2: Append pay() happy path tests to test file**

Add after the `getAddress()` describe block in `solana-provider.test.ts`:

```typescript
// ─── Test: pay() happy path ──────────────────────────────────────────────────
describe("SolanaPaymentProvider — pay() happy path", () => {
  const VALID_KEY = "4NMwxzmYj2uvHuq8xoqhY8RXg63KSVJM1DXkpbmkUY7YQWoVrk7DqEDsomePvYKqU1h7H4P1DpxJnrZMHNF6Abt";
  const VALID_CHALLENGE: { chain: string; token: string; amount: string; address: string } = {
    chain: "solana",
    token: "USDC",
    amount: "0.05",
    address: "SellerAddr111111111111111111111111111111111",
  };
  const REQUEST_ID = "abcdef1234567890abcdef1234567890";

  it("returns a non-empty tx signature string", async () => {
    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    const txHash = await provider.pay(VALID_CHALLENGE, REQUEST_ID);
    expect(typeof txHash).toBe("string");
    expect(txHash.length).toBeGreaterThan(0);
  });

  it("memo instruction is called with exactly 'Ag402-v1|{requestId}'", async () => {
    const { createMemoInstruction } = await import("@solana/spl-memo");
    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    await provider.pay(VALID_CHALLENGE, REQUEST_ID);
    expect(createMemoInstruction).toHaveBeenCalledWith(
      `Ag402-v1|${REQUEST_ID}`,
      expect.any(Array)
    );
  });

  it("transfer_checked is called with correct lamport count (0.05 USDC = 50_000 lamports)", async () => {
    const { createTransferCheckedInstruction } = await import("@solana/spl-token");
    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    await provider.pay(VALID_CHALLENGE, REQUEST_ID);
    expect(createTransferCheckedInstruction).toHaveBeenCalledWith(
      expect.anything(),  // payerAta.address
      expect.anything(),  // usdcMint
      expect.anything(),  // recipientAta.address
      expect.anything(),  // payerPubkey
      BigInt(50_000),     // lamports: 0.05 × 10^6
      6,                  // USDC_DECIMALS
      [],
      expect.anything()   // TOKEN_PROGRAM_ID
    );
  });

  it("getOrCreateAssociatedTokenAccount is called twice (payer ATA + recipient ATA)", async () => {
    const { getOrCreateAssociatedTokenAccount } = await import("@solana/spl-token");
    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    await provider.pay(VALID_CHALLENGE, REQUEST_ID);
    expect(getOrCreateAssociatedTokenAccount).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run tests — confirm pay() tests are RED (stub throws "not implemented")**

```bash
cd sdk/solana && npm test -- --reporter=verbose
```

Expected: 6 PASS (constructor + getAddress) + 4 FAIL (pay() still stubbed). Failure message should include "not implemented yet".

- [ ] **Step 4: Implement full pay() and fromEnv() in src/index.ts**

Replace the stub bodies in `sdk/solana/src/index.ts` with the full implementation:

```typescript
  async pay(challenge: X402PaymentChallenge, requestId: string): Promise<string> {
    // Step 1: Validate — throw immediately, no RPC calls
    if (challenge.chain !== "solana") {
      throw new Error(
        `Unsupported chain: "${challenge.chain}". @ag402/solana only supports "solana".`
      );
    }
    if (challenge.token !== "USDC") {
      throw new Error(
        `Unsupported token: "${challenge.token}". @ag402/solana only supports "USDC".`
      );
    }

    // Step 2: Parse amount → integer lamports (BigInt required by SPL Token)
    const amountFloat = parseFloat(challenge.amount);
    if (!isFinite(amountFloat) || amountFloat <= 0) {
      throw new Error(`Invalid payment amount: "${challenge.amount}"`);
    }
    const lamports = BigInt(Math.round(amountFloat * Math.pow(10, USDC_DECIMALS)));

    const recipientPubkey = new PublicKey(challenge.address);
    const payerPubkey = this.keypair.publicKey;

    // Step 3: Get/create payer ATA
    const payerAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      this.usdcMint,
      payerPubkey
    );

    // Step 4: Get/create recipient ATA
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.keypair,
      this.usdcMint,
      recipientPubkey
    );

    // Step 5: Build transfer_checked instruction
    const transferIx = createTransferCheckedInstruction(
      payerAta.address,
      this.usdcMint,
      recipientAta.address,
      payerPubkey,
      lamports,
      USDC_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    );

    // Step 6: Attach Memo — mirrors Python: f"Ag402-v1|{request_id}"
    const memoIx = createMemoInstruction(`Ag402-v1|${requestId}`, [payerPubkey]);

    // Step 7: Fetch blockhash, build tx, sign, send, confirm.
    // recentBlockhash + feePayer MUST be set before sendTransaction.
    // confirmTransaction uses BlockheightBasedTransactionConfirmationStrategy
    // (string-only overload is deprecated in @solana/web3.js v1.98).
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash("confirmed");
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payerPubkey;
    tx.add(transferIx, memoIx);

    const signature = await this.connection.sendTransaction(tx, [this.keypair]);
    await this.connection.confirmTransaction(
      { blockhash, lastValidBlockHeight, signature },
      "confirmed"
    );

    // Step 8: Return tx hash
    return signature;
  }
}

// ─── fromEnv ─────────────────────────────────────────────────────────────────

/**
 * Construct SolanaPaymentProvider from environment variables.
 * Mirrors Python config.py: reads SOLANA_PRIVATE_KEY.
 *
 * @throws {Error} if SOLANA_PRIVATE_KEY is not set
 */
export function fromEnv(options?: { rpcUrl?: string }): SolanaPaymentProvider {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "SOLANA_PRIVATE_KEY environment variable is not set. " +
        "Set it to your base58-encoded Solana private key."
    );
  }
  return new SolanaPaymentProvider({ privateKey, ...options });
}
```

- [ ] **Step 5: Run tests — all 10 should pass**

```bash
cd sdk/solana && npm test
```

Expected: 6 (previous) + 4 (new) = **10 tests PASS**.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/solana-provider.test.ts src/index.ts && git commit -m "feat(solana): implement pay() and fromEnv() — TDD green"
```

---

## Chunk 4: TDD — pay() error handling + fromEnv()

### Task 6: Write failing error handling + fromEnv tests, then verify they pass

**Files:**
- Modify: `sdk/solana/src/__tests__/solana-provider.test.ts`

- [ ] **Step 1: Append error handling + fromEnv tests to test file**

Add after the `pay() happy path` describe block:

```typescript
// ─── Test: pay() error handling ──────────────────────────────────────────────
describe("SolanaPaymentProvider — pay() error handling", () => {
  const VALID_KEY = "4NMwxzmYj2uvHuq8xoqhY8RXg63KSVJM1DXkpbmkUY7YQWoVrk7DqEDsomePvYKqU1h7H4P1DpxJnrZMHNF6Abt";
  const REQUEST_ID = "abcdef1234567890abcdef1234567890";

  it("throws immediately for chain !== 'solana', without calling RPC", async () => {
    const { Connection } = await import("@solana/web3.js");
    // Track the connection instance created for this provider
    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    // Get the mock connection instance (Connection is called as constructor → result is last mock call's return)
    const mockConn = vi.mocked(Connection).mock.results.at(-1)?.value as {
      sendTransaction: ReturnType<typeof vi.fn>;
    };

    await expect(
      provider.pay({ chain: "base", token: "USDC", amount: "0.05", address: "Addr" }, REQUEST_ID)
    ).rejects.toThrow(/Unsupported chain/);

    expect(mockConn.sendTransaction).not.toHaveBeenCalled();
  });

  it("throws immediately for token !== 'USDC', without calling RPC", async () => {
    const { Connection } = await import("@solana/web3.js");
    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    const mockConn = vi.mocked(Connection).mock.results.at(-1)?.value as {
      sendTransaction: ReturnType<typeof vi.fn>;
    };

    await expect(
      provider.pay({ chain: "solana", token: "BONK", amount: "0.05", address: "Addr" }, REQUEST_ID)
    ).rejects.toThrow(/Unsupported token/);

    expect(mockConn.sendTransaction).not.toHaveBeenCalled();
  });

  it("throws when sendTransaction fails", async () => {
    const { Connection } = await import("@solana/web3.js");
    // Override Connection mock for this test — must include getLatestBlockhash
    vi.mocked(Connection).mockImplementationOnce(() => ({
      getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: "FakeHash", lastValidBlockHeight: 1 }),
      sendTransaction: vi.fn().mockRejectedValue(new Error("RPC connection refused")),
      confirmTransaction: vi.fn(),
    }));

    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    await expect(
      provider.pay({ chain: "solana", token: "USDC", amount: "0.05", address: "Addr" }, REQUEST_ID)
    ).rejects.toThrow("RPC connection refused");
  });

  it("throws when confirmTransaction fails", async () => {
    const { Connection } = await import("@solana/web3.js");
    vi.mocked(Connection).mockImplementationOnce(() => ({
      getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: "FakeHash", lastValidBlockHeight: 1 }),
      sendTransaction: vi.fn().mockResolvedValue("5xFakeSig"),
      confirmTransaction: vi.fn().mockRejectedValue(new Error("Confirmation timeout")),
    }));

    const provider = new SolanaPaymentProvider({ privateKey: VALID_KEY });
    await expect(
      provider.pay({ chain: "solana", token: "USDC", amount: "0.05", address: "Addr" }, REQUEST_ID)
    ).rejects.toThrow("Confirmation timeout");
  });
});

// ─── Test: fromEnv() ─────────────────────────────────────────────────────────
describe("fromEnv()", () => {
  const VALID_KEY = "4NMwxzmYj2uvHuq8xoqhY8RXg63KSVJM1DXkpbmkUY7YQWoVrk7DqEDsomePvYKqU1h7H4P1DpxJnrZMHNF6Abt";

  afterEach(() => {
    delete process.env.SOLANA_PRIVATE_KEY;
  });

  it("constructs provider from SOLANA_PRIVATE_KEY env var", () => {
    process.env.SOLANA_PRIVATE_KEY = VALID_KEY;
    expect(() => fromEnv()).not.toThrow();
  });

  it("throws a clear error when SOLANA_PRIVATE_KEY is not set", () => {
    delete process.env.SOLANA_PRIVATE_KEY;
    expect(() => fromEnv()).toThrow(/SOLANA_PRIVATE_KEY/);
  });

  it("passes custom rpcUrl to the underlying provider", async () => {
    const { Connection } = await import("@solana/web3.js");
    process.env.SOLANA_PRIVATE_KEY = VALID_KEY;
    fromEnv({ rpcUrl: "https://api.mainnet-beta.solana.com" });
    expect(Connection).toHaveBeenCalledWith(
      "https://api.mainnet-beta.solana.com",
      expect.anything()
    );
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
cd sdk/solana && npm test -- --reporter=verbose
```

Expected: 10 (previous) + 4 (error handling) + 3 (fromEnv) = **17 tests PASS**.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/solana-provider.test.ts && git commit -m "test(solana): add + pass pay() error handling + fromEnv tests"
```

---

## Chunk 5: Build, Lint, and Integration Verification

### Task 7: TypeScript lint check

**Files:**
- Possibly modify: `sdk/solana/src/index.ts` or `sdk/solana/tsconfig.json` (only if lint errors appear)

- [ ] **Step 1: Run lint**

```bash
cd sdk/solana && npm run lint
```

Expected: zero errors.

**If errors appear**, common fixes:

| Error | Fix |
|-------|-----|
| `bs58` has no type declarations | Add `"skipLibCheck": true` (already in tsconfig) or `npm install --save-dev @types/bs58` |
| `@solana/spl-memo` has no type declarations | Already handled by `skipLibCheck: true` |
| `Buffer` not available | `@types/node` is in devDependencies — should be available |
| Implicit `any` on `bs58.decode()` result | Cast: `bs58.decode(options.privateKey) as Uint8Array` |

- [ ] **Step 2: Commit if any fixes were needed**

```bash
git add src/index.ts tsconfig.json && git commit -m "fix(solana): fix TypeScript lint errors"
```

---

### Task 8: Build and verify dist output

**Files:**
- No new files

- [ ] **Step 1: Build**

```bash
cd sdk/solana && npm run build
```

Expected: `dist/` created with `index.js`, `index.cjs`, `index.d.ts`, source maps, declaration maps.

- [ ] **Step 2: Verify CJS exports**

```bash
node -e "const m = require('./sdk/solana/dist/index.cjs'); console.log(Object.keys(m))"
```

Expected: `[ 'SolanaPaymentProvider', 'fromEnv' ]`

- [ ] **Step 3: Commit build config confirmation (do NOT commit dist/)**

```bash
# dist/ should remain gitignored (published via npm publish)
# If no source changes needed, no commit required here.
echo "Build verified — dist/ not committed (published via npm publish)"
```

---

### Task 9: Full regression suite

**Files:**
- No new files

- [ ] **Step 1: Python baseline**

```bash
cd D:/ag402 && python -m pytest adapters/mcp/tests/test_gateway_adapter.py core/tests/test_prepaid_verifier.py core/tests/test_prepaid_integration.py -q --import-mode=importlib
```

Expected: **96 passed** (Windows pre-existing skip excluded).

- [ ] **Step 2: @ag402/solana tests**

```bash
cd D:/ag402/sdk/solana && npm test
```

Expected: **17 tests PASS**.

- [ ] **Step 3: @ag402/fetch regression**

```bash
cd D:/ag402/sdk/typescript && npm test
```

Expected: all 100+ tests PASS (no regression from this new package).

- [ ] **Step 4: Final commit**

```bash
cd D:/ag402 && git add sdk/solana/ && git commit -m "feat(solana): complete @ag402/solana v0.1.0 — SolanaPaymentProvider + fromEnv"
```

---

## Chunk 6: README

### Task 10: Write README.md

**Files:**
- Create: `sdk/solana/README.md`

- [ ] **Step 1: Create `sdk/solana/README.md`**

```markdown
# @ag402/solana

Real Solana USDC on-chain payment provider for [`@ag402/fetch`](https://www.npmjs.com/package/@ag402/fetch).

Broadcasts genuine SPL USDC `transfer_checked` transactions. Each payment includes a `Ag402-v1|{requestId}` Memo for server-side idempotency — matching the Python `ag402-core` SDK behavior exactly.

## Installation

```bash
npm install @ag402/solana @ag402/fetch
```

## Usage

```typescript
import { createX402Fetch, InMemoryWallet } from "@ag402/fetch";
import { SolanaPaymentProvider, fromEnv } from "@ag402/solana";

// From environment variable (recommended for agents)
const provider = fromEnv();  // reads SOLANA_PRIVATE_KEY

// Or explicit constructor
const provider = new SolanaPaymentProvider({
  privateKey: "your-base58-private-key",
  rpcUrl: "https://api.mainnet-beta.solana.com",          // default: devnet
  usdcMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  // mainnet USDC
});

const wallet = new InMemoryWallet(10);  // $10 spend budget
const apiFetch = createX402Fetch({ wallet, provider });

const res = await apiFetch("https://api.example.com/paid-endpoint");
console.log("tx:", res.x402.txHash);
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `privateKey` | **required** | Base58-encoded Solana private key |
| `rpcUrl` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `usdcMint` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | USDC mint (devnet default) |

**Mainnet USDC mint:** `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SOLANA_PRIVATE_KEY` | Base58-encoded private key, used by `fromEnv()` |

## How It Works

Each `pay()` call:

1. Validates `chain === "solana"` and `token === "USDC"` — throws immediately otherwise
2. Converts amount string → lamports (`BigInt(Math.round(amount × 10^6))`)
3. Gets/creates payer Associated Token Account (ATA) via SPL Token Program
4. Gets/creates recipient ATA
5. Builds `transfer_checked` SPL instruction
6. Attaches Memo instruction: `Ag402-v1|{requestId}`
7. Signs, broadcasts, and awaits `"confirmed"` commitment
8. Returns the base58 transaction signature as `tx_hash`

Any failure in steps 3–7 throws an error, triggering `@ag402/fetch`'s automatic rollback.

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
cd sdk/solana && git add README.md && git commit -m "docs(solana): add @ag402/solana README"
```

---

## Summary

| Chunk | Tasks | Files | Key output |
|-------|-------|-------|------------|
| 1 — Scaffold | 1–2 | `package.json`, `tsconfig.json`, `vitest.config.ts` | Package configured with all deps |
| 2 — Constructor + getAddress TDD | 3–4 | `src/__tests__/...`, `src/index.ts` (stub) | 6 tests green, pay()/fromEnv() stubbed |
| 3 — pay() TDD (red→implement→green) | 5 | `src/__tests__/...`, `src/index.ts` | 10 tests green |
| 4 — Error + fromEnv TDD | 6 | `src/__tests__/...` | 17 tests green |
| 5 — Build + regression | 7–9 | — | lint clean, dist valid, 96 Python + 17 TS pass |
| 6 — README | 10 | `README.md` | Published docs |

**Critical invariants:**
- Use `bs58.decode()` for private key — NEVER `Buffer.from(..., "base58")`
- Memo format: exactly `Ag402-v1|{requestId}` (capital A, pipe separator)
- USDC lamports: `BigInt(Math.round(amount × 10^6))` — BigInt required by SPL Token
- `recentBlockhash` + `feePayer` MUST be set on Transaction before `sendTransaction`
- Use `BlockheightBasedTransactionConfirmationStrategy` for `confirmTransaction` (not string-only overload)
- Default RPC: devnet — mainnet requires explicit `rpcUrl`
- All `pay()` failures → `throw` → triggers `@ag402/fetch` rollback path
- `getAddress()` strips `\r`, `\n`, `"` (header injection safety)
- `vi.clearAllMocks()` in `beforeEach` — NOT `vi.resetAllMocks()` (which strips factory return values and breaks all tests after the first)
- `mockImplementationOnce` overrides for Connection must include `getLatestBlockhash`
