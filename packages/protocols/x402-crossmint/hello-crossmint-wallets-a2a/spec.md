## Crossmint Wallets with x402 (Direct-Transfer Scheme)

### 1. Abstract
This document specifies how a client using Crossmint smart wallets can pay an EOA merchant server via the A2A x402 protocol, with funds debited directly from the Crossmint wallet. The design uses a new x402 scheme (“direct-transfer”) where the payer executes an ERC‑20 transfer and returns the transaction hash as the payment payload. This avoids EIP‑3009/permit limitations with ERC‑1271 and remains compliant with the A2A x402 protocol by preserving message structure, states, and receipts.

Adheres to: A2A x402 protocol and the x402 payments protocol specifications.

### 2. Goals and Non-Goals
- Goals:
  - Debit the amount from the Crossmint smart wallet (payer) to the server’s EOA.
  - Maintain compatibility with the A2A x402 protocol (activation header, states, receipts).
  - Be chain- and token-agnostic for ERC‑20 tokens on EVM.
- Non-goals:
  - EIP‑3009/permit-based settlement from a smart wallet (tokens typically do not validate ERC‑1271 here).
  - Custodial-private-key exposure. Signing is performed by Crossmint’s wallet platform.

### 3. Scheme: direct-transfer (EVM)
The merchant advertises a payment option using scheme "direct-transfer". The client will perform an on-chain ERC‑20 `transfer` from the Crossmint wallet to the merchant’s `payTo` address and submit the resulting transaction hash back to the merchant via x402.

Example PaymentRequirements (embedded in Task message metadata when server requires payment):
```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "direct-transfer",
      "network": "base-sepolia",
      "asset": "0xUSDC_CONTRACT_ADDRESS",
      "payTo": "0xMerchantEOA",
      "maxAmountRequired": "1000000",
      "maxTimeoutSeconds": 600,
      "resource": "https://api.example.com/paid-endpoint",
      "description": "Pay exact amount for service",
      "extra": null
    }
  ]
}
```

### 4. Protocol Compliance (A2A x402)
- Extension activation: client sets `X-A2A-Extensions: https://github.com/google-a2a/a2a-x402/v0.1`. Server echoes it.
- States: `payment-required` → `payment-submitted` → (`payment-pending`) → `payment-completed`/`payment-failed`.
- Correlation: Keep `taskId` consistent across the flow.
- Receipts: Append to `x402.payment.receipts` (never replace prior receipts).

### 5. Client Flow (Crossmint is payer)
High-level:
1) Discover payment requirements (Task with `payment-required`).
2) Create/load Crossmint smart wallet for `email:{userEmail}` on `network`.
3) Execute ERC‑20 transfer from that wallet to `payTo` for `maxAmountRequired`.
4) Submit `payment-submitted` with a payload containing the `transaction` hash, `payer`, and details.

TypeScript example (using Crossmint SDK):
```ts
import { createCrossmint, CrossmintWallets, EVMWallet } from "@crossmint/wallets-sdk";

// selected comes from x402.payment.required.accepts[0]
const crossmint = createCrossmint({ apiKey });
const wallets = CrossmintWallets.from(crossmint);
const cmWallet = await wallets.createWallet({
  chain: String(selected.network) as any,
  signer: { type: "api-key" },      // API-key admin signer auto-approves actions
  owner: `email:${userEmail}`,
});
const evmWallet = EVMWallet.from(cmWallet);

// Call USDC.transfer(payTo, amount)
const transferTx = await evmWallet.sendTransaction({
  abi: [
    {
      type: "function",
      name: "transfer",
      stateMutability: "nonpayable",
      inputs: [ { name: "to", type: "address" }, { name: "value", type: "uint256" } ],
      outputs: [ { type: "bool" } ],
    },
  ],
  to: String(selected.asset), // USDC token address
  functionName: "transfer",
  args: [ String(selected.payTo), String(selected.maxAmountRequired) ],
});
const txHash = transferTx.hash!;

// Submit with x402 payment-submitted
await client.sendMessage({
  message: {
    messageId: uuidv4(),
    taskId: createdTask.id,
    role: "user",
    kind: "message",
    parts: [{ kind: "text", text: "Here is the transfer receipt." }],
    metadata: {
      "x402.payment.status": "payment-submitted",
      "x402.payment.payload": {
        x402Version: 1,
        scheme: "direct-transfer",
        network: selected.network,
        payload: {
          transaction: txHash,
          payer: cmWallet.address,
          asset: String(selected.asset),
          payTo: String(selected.payTo),
          value: String(selected.maxAmountRequired),
        },
      },
    },
  },
  configuration: { blocking: true, acceptedOutputModes: ["text/plain"] },
});
```

Relevant SDK code references:
```41:56:crossmint-sdk/packages/wallets/src/wallets/evm.ts
public async sendTransaction<T extends EVMTransactionInput>(
    params: T
): Promise<Transaction<T["options"] extends PrepareOnly<true> ? true : false>> {
    const builtTransaction = this.buildTransaction(params);
    const createdTransaction = await this.createTransaction(builtTransaction, params.options);
    if (params.options?.experimental_prepareOnly) { ... }
    return await this.approveTransactionAndWait(createdTransaction.id);
}
```

```83:101:crossmint-sdk/packages/wallets/src/wallets/evm.ts
public async signTypedData<T extends SignTypedDataInput>(
    params: T
): Promise<Signature<T["options"] extends PrepareOnly<true> ? true : false>> {
    const { domain, message, primaryType, types, chain } = params;
    ...
    const signatureCreationResponse = await this.apiClient.createSignature(this.walletLocator, {
        type: "typed-data",
        params: { typedData: { ... }, signer: this.signer.locator(), chain, isSmartWalletSignature: false },
    });
    ...
}
```

### 6. Server Flow (Merchant Agent)
When receiving `payment-submitted` with scheme `direct-transfer`, the server must verify the transaction and finalize state.

Verification rules:
- Network matches the advertised `network`.
- `to` equals the advertised `asset` (token contract address).
- Event logs include `Transfer(payer → payTo, value)` and the `value` equals `maxAmountRequired`.
- Timestamp within `maxTimeoutSeconds` of requirements issuance.

Server-side pseudo-code (Node/ethers):
```ts
const receipt = await provider.getTransactionReceipt(txHash);
if (!receipt || receipt.status !== 1) fail("SETTLEMENT_FAILED");

// Confirm token contract call
if (receipt.to?.toLowerCase() !== asset.toLowerCase()) fail("NETWORK_MISMATCH");

// Parse Transfer logs
const iface = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);
const transferLog = receipt.logs
  .filter((l) => l.address.toLowerCase() === asset.toLowerCase())
  .map((l) => { try { return iface.parseLog(l); } catch { return null; }})
  .find((e) => e && e.name === "Transfer");

if (!transferLog) fail("SETTLEMENT_FAILED");
const { from, to, value } = transferLog.args;
if (from.toLowerCase() !== payer.toLowerCase()) fail("INVALID_SIGNATURE");
if (to.toLowerCase() !== payTo.toLowerCase()) fail("INVALID_AMOUNT");
if (value.toString() !== maxAmountRequired) fail("INVALID_AMOUNT");

// Success → publish payment-completed and append receipt
const receiptObj = { success: true, transaction: txHash, network, payer };
```

State updates (A2A x402):
- On receipt and before verification: optionally set `payment-pending`.
- On success: `x402.payment.status = "payment-completed"`; append receipt to `x402.payment.receipts`.
- On failure: `x402.payment.status = "payment-failed"` with `x402.payment.error` code.

### 7. Error Handling
Map failures to standard x402 error codes (see spec). Examples:
- `INSUFFICIENT_FUNDS`: transfer missing or reverted.
- `NETWORK_MISMATCH`: different chain/asset.
- `INVALID_AMOUNT`: value != required.
- `EXPIRED_PAYMENT`: beyond `maxTimeoutSeconds`.
- `SETTLEMENT_FAILED`: on-chain failure.

### 8. Security Considerations
- Private keys never leave Crossmint; approvals/signing are performed by Crossmint Wallets platform.
- Replay protection: server should track seen `transaction` hashes per `taskId` and/or enforce timeouts.
- Input validation: validate all fields from `payment-submitted` against prior advertised requirements.

### 9. Custom-Built Components and Infrastructure
This integration depends on:

Custom scheme definition (this doc):
- Logical scheme name: `direct-transfer` (EVM).
- Merchant must advertise this in `accepts`.

Crossmint-maintained infrastructure:
- Crossmint Wallets API and signing/approval service (API-key admin signer auto-approvals).
- Optional relayer/gas-sponsorship if the smart wallet needs gas coverage.

Merchant infrastructure:
- Merchant Agent (server) implementing x402 messaging/states.
- EVM RPC provider for verification (e.g., Alchemy, Infura, own node).
- Optional facilitator service if the merchant prefers outsourced verify/settle interfaces (per x402 protocol).

Client application components:
- Client Agent integrating A2A x402 and Crossmint Wallets SDK (`createCrossmint`, `CrossmintWallets.from`, `EVMWallet`).

### 10. Rationale: Why direct-transfer (not EIP‑3009)
- EIP‑3009 requires an ECDSA signature that recovers to `from`. Smart wallets verify via ERC‑1271; most ERC‑20 EIP‑3009 implementations (e.g., USDC) do not support ERC‑1271 verification for authorizations. Direct-transfer avoids this constraint by having the wallet execute the transfer natively.

### 11. Testing and Validation
- Unit test server verification logic with mocked receipts/logs.
- Integration test on Base Sepolia USDC (configure `asset`, fund the Crossmint wallet, run the client + server, observe balances and receipts).
- Negative tests: wrong amount, wrong asset, wrong network, expired requirements.

### 12. Appendices (Code References)

Crossmint SDK internals used:
```41:56:crossmint-sdk/packages/wallets/src/wallets/evm.ts
public async sendTransaction<...>(...) { /* builds, creates, approves and waits for tx */ }
```

```83:136:crossmint-sdk/packages/wallets/src/wallets/evm.ts
public async signTypedData<...>(...) { /* typed data signature flow via API */ }
```

Delegated signers (not required for this scheme, but available if server-initiated flows are needed in future):
```317:347:crossmint-sdk/packages/wallets/src/wallets/wallet.ts
public async addDelegatedSigner(params: { signer: string | RegisterSignerPasskeyParams }) { ... }
```

```349:376:crossmint-sdk/packages/wallets/src/wallets/wallet.ts
public async delegatedSigners(): Promise<DelegatedSigner[]> { ... }
```


