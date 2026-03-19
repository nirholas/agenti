# Scheme: `direct-transfer`

## Summary

The `direct-transfer` scheme moves funds by having the payer execute a native token transfer on the target network (e.g., ERC‑20 `transfer` on EVM). The client submits an on-chain transaction reference (hash) and essential details. The resource server (or facilitator) verifies the transaction on-chain and, if valid, considers the payment complete.

This scheme avoids dependencies on token-specific signature flows (e.g., EIP‑3009, permit) and works with smart wallets (ERC‑1271), because the wallet executes the transfer itself.

## Use Cases

- Smart-wallet payers (contract accounts) where token signature-based flows are not compatible.
- Minimal trust: server only needs to verify a completed transfer on-chain.
- Works for any fungible token that exposes standard transfer semantics on the network.

## Appendix

- Scheme is network-agnostic by design. See per-network implementations (e.g., `direct-transfer` on `EVM`) for construction, verification, and settlement rules.
