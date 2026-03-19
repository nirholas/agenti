# @faremeter/wallet-solana

Solana keypair wallet adapter for Faremeter payments.

## Installation

```bash
pnpm install @faremeter/wallet-solana
```

## Features

- Local keypair signing
- Network configuration (devnet, mainnet-beta)
- Compatible with @faremeter/payment-solana

## API Reference

<!-- TSDOC_START -->

## Functions

- [createLocalWallet](#createlocalwallet)

### createLocalWallet

Creates a local Solana wallet from a keypair for signing transactions.

| Function            | Type                                                                                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createLocalWallet` | `(network: string, keypair: Keypair) => Promise<{ network: string; publicKey: PublicKey; partiallySignTransaction: (tx: VersionedTransaction) => Promise<...>; updateTransaction: (tx: VersionedTransaction) => Promise<...>; }>` |

Parameters:

- `network`: - Network identifier (e.g., "mainnet-beta", "devnet").
- `keypair`: - Solana keypair containing the private key.

Returns:

A wallet object that can sign versioned transactions.

## Types

- [LocalWallet](#localwallet)

### LocalWallet

Type representing a local Solana wallet created by {@link createLocalWallet}.

| Type          | Type                                            |
| ------------- | ----------------------------------------------- |
| `LocalWallet` | `Awaited<ReturnType<typeof createLocalWallet>>` |

<!-- TSDOC_END -->

## Related Packages

- [@faremeter/payment-solana](https://www.npmjs.com/package/@faremeter/payment-solana) - Solana payment handler
- [@faremeter/fetch](https://www.npmjs.com/package/@faremeter/fetch) - Client fetch wrapper

## License

LGPL-3.0-only
