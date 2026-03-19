# @faremeter/wallet-evm

EVM private key wallet adapter for Faremeter payments using viem.

## Installation

```bash
pnpm install @faremeter/wallet-evm
```

## Features

- Private key signing with viem
- Multi-chain support (Base, Skale, etc.)
- EIP-712 signature support
- Compatible with @faremeter/payment-evm

## API Reference

<!-- TSDOC_START -->

## Functions

- [createLocalWallet](#createlocalwallet)

### createLocalWallet

Creates a local EVM wallet from a private key.

| Function            | Type                                                           |
| ------------------- | -------------------------------------------------------------- |
| `createLocalWallet` | `(chain: ChainInfo, privateKey: string) => Promise<EvmWallet>` |

Parameters:

- `chain`: - Chain configuration for the wallet.
- `privateKey`: - Hex-encoded private key with "0x" prefix.

Returns:

An EVM wallet object for signing transactions.

## Interfaces

- [EvmWallet](#evmwallet)

### EvmWallet

An EVM wallet instance with chain info and signing capabilities.

| Property  | Type                                                                                                                                                                                                                                                  | Description                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `chain`   | `ChainInfo`                                                                                                                                                                                                                                           | Chain configuration for this wallet. |
| `address` | `0x${string}`                                                                                                                                                                                                                                         | Wallet address as a hex string.      |
| `account` | `{ address: `0x${string}`; nonceManager?: NonceManager or undefined; sign: (parameters: { hash: `0x${string}`; }) => Promise<`0x${string}`>; signAuthorization: (parameters: AuthorizationRequest) => Promise<...>; ... 5 more ...; type: "local"; }` | Viem account for signing operations. |

<!-- TSDOC_END -->

## Related Packages

- [@faremeter/payment-evm](https://www.npmjs.com/package/@faremeter/payment-evm) - EVM payment handler
- [@faremeter/fetch](https://www.npmjs.com/package/@faremeter/fetch) - Client fetch wrapper

## License

LGPL-3.0-only
