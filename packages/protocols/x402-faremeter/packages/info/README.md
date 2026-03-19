# @faremeter/info

Network and asset information lookup utilities for Solana and EVM chains.

## Installation

```bash
pnpm install @faremeter/info
```

## Features

- Network alias resolution
- Asset/token lookups
- x402 requirement helpers
- Centralized configuration

## Subpath Exports

- `@faremeter/info/solana` - Solana network and SPL token info
- `@faremeter/info/evm` - EVM network and asset info

## API Reference

<!-- TSDOC_START -->

## Functions

- [normalizeNetworkId](#normalizenetworkid)
- [translateNetworkToLegacy](#translatenetworktolegacy)

### normalizeNetworkId

Normalize a legacy network identifier to CAIP-2 format.
Handles both EVM and Solana networks.
Returns the input unchanged if no mapping exists (may already be CAIP-2
or an unknown network).

| Function             | Type                          |
| -------------------- | ----------------------------- |
| `normalizeNetworkId` | `(network: string) => string` |

### translateNetworkToLegacy

Translate a CAIP-2 network identifier to legacy format.
Handles both EVM and Solana networks.
Returns the input unchanged if no mapping exists (may not be a known
CAIP-2 network, or may already be legacy).

| Function                   | Type                          |
| -------------------------- | ----------------------------- |
| `translateNetworkToLegacy` | `(network: string) => string` |

<!-- TSDOC_END -->

## Related Packages

- [@faremeter/middleware](https://www.npmjs.com/package/@faremeter/middleware) - Uses info for payment requirements
- [@faremeter/types](https://www.npmjs.com/package/@faremeter/types) - Type definitions

## License

LGPL-3.0-only
