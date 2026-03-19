# @faremeter/fetch

HTTP fetch wrapper that automatically handles 402 Payment Required responses with the x402 protocol.

## Installation

```bash
pnpm install @faremeter/fetch
```

## Features

- Automatic 402 handling - Transparently pays and retries
- Pluggable payment handlers - Support any blockchain
- Multi-chain support - Use multiple handlers simultaneously
- Smart payer selection - Choose based on balance, cost, etc.
- Retry logic - Configurable exponential backoff
- Type-safe - Full TypeScript support

## API Reference

<!-- TSDOC_START -->

<!-- TSDOC_END -->

## Examples

See working examples in the [faremeter repository](https://github.com/faremeter/faremeter/tree/main/scripts):

- [Solana payment example](https://github.com/faremeter/faremeter/blob/main/scripts/solana-example/sol-payment.ts)
- [EVM payment example](https://github.com/faremeter/faremeter/blob/main/scripts/evm-example/base-sepolia-payment.ts)

## Related Packages

- [@faremeter/rides](https://www.npmjs.com/package/@faremeter/rides) - High-level SDK
- [@faremeter/payment-solana](https://www.npmjs.com/package/@faremeter/payment-solana) - Solana payment handler
- [@faremeter/payment-evm](https://www.npmjs.com/package/@faremeter/payment-evm) - EVM payment handler
- [@faremeter/middleware](https://www.npmjs.com/package/@faremeter/middleware) - Server-side middleware

## License

LGPL-3.0-only
