# Changelog

## [0.1.0] — 2026-03-12

### Added
- `SolanaPaymentProvider` — implements `PaymentProvider` from `@ag402/fetch` for real Solana USDC on-chain payments
- `fromEnv()` — construct provider from `SOLANA_PRIVATE_KEY`; accepts `rpcUrl`, `usdcMint`, `confirmationLevel` options
- `confirmationLevel` option — `"confirmed"` (default) or `"finalized"` for high-value payments
- `MAINNET_USDC_MINT` — exported constant for the mainnet USDC mint address
- SPL Token `transfer_checked` instruction with `Ag402-v1|{requestId}` Memo for server-side idempotency
- Full TypeScript types exported: `SolanaPaymentProviderOptions`, `SolanaPaymentProvider`, `fromEnv`, `MAINNET_USDC_MINT`
- ESM + CJS dual build

### Security
- On-chain transaction failure detection: `confirmTransaction().value.err` checked; throws on failure to prevent wallet deduction without USDC transfer
- Mainnet + devnet USDC mint mismatch guard: constructor throws with a clear message when `rpcUrl` contains `"mainnet"` but `usdcMint` defaults to the devnet address
- Zero-lamport guard: amounts smaller than 0.000001 USDC round to 0 lamports and throw before any RPC call
- Self-payment guard: throws when recipient address equals payer address
- ATA creation order: recipient ATA created first to minimise wasted SOL on failure
- `getAddress()` strips CR/LF/quotes to prevent HTTP header injection
