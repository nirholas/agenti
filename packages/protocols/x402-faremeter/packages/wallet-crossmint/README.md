# @faremeter/wallet-crossmint

Crossmint custodial wallet integration for Faremeter payments on Solana.

## Installation

```bash
pnpm install @faremeter/wallet-crossmint
```

## Features

- Custodial wallet support
- No private key management required
- Crossmint API integration
- Solana network support

## API Reference

<!-- TSDOC_START -->

## Functions

- [createCrossmintWallet](#createcrossmintwallet)

### createCrossmintWallet

Creates a Crossmint custodial wallet for Solana.

Uses the Crossmint Wallets SDK to sign and send transactions via
API key authentication.

| Function                | Type                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createCrossmintWallet` | `(network: string, crossmintApiKey: string, crossmintWalletAddress: string) => Promise<{ network: string; publicKey: PublicKey; sendTransaction: (tx: VersionedTransaction) => Promise<...>; }>` |

Parameters:

- `network`: - Solana network identifier.
- `crossmintApiKey`: - Crossmint API key for authentication.
- `crossmintWalletAddress`: - Address of the Crossmint-managed wallet.

Returns:

A wallet object that can send Solana transactions.

<!-- TSDOC_END -->

## Related Packages

- [@faremeter/payment-solana](https://www.npmjs.com/package/@faremeter/payment-solana) - Solana payment handler
- [@faremeter/fetch](https://www.npmjs.com/package/@faremeter/fetch) - Client fetch wrapper

## License

LGPL-3.0-only
