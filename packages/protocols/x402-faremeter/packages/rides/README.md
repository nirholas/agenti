# @faremeter/rides

Low-boilerplate, no-friction API for getting on x402 quick.

## Installation

```bash
pnpm install @faremeter/rides
```

## Features

- Simplest Faremeter integration (3 lines of code)
- Automatic wallet detection (Solana keypair vs EVM private key)
- Multi-chain payment support (Solana, EVM)
- Multiple payment schemes (SPL tokens, EIP-3009 USDC)
- Automatic 402 handling and retry logic
- Batteries included - all payment handlers bundled

## API Reference

<!-- TSDOC_START -->

<!-- TSDOC_END -->

## Examples

See the [basic example](https://github.com/faremeter/faremeter/blob/main/scripts/rides-example.ts) in the faremeter repository.

## Related Packages

- [@faremeter/fetch](https://www.npmjs.com/package/@faremeter/fetch) - Lower-level fetch wrapper
- [@faremeter/middleware](https://www.npmjs.com/package/@faremeter/middleware) - Server-side middleware

## License

LGPL-3.0-only
