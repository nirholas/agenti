# @faremeter/middleware

Server middleware for adding payment walls to API endpoints using the x402 protocol.

## Installation

```bash
pnpm install @faremeter/middleware
```

## Features

- Paywall any endpoint - Add `middleware` to any route
- Framework agnostic - Express, Hono, or custom
- Multi-chain support - Solana, EVM, extensible
- Fast validation - Payment requirements caching
- Facilitator integration - Handles settlement verification

## API Reference

<!-- TSDOC_START -->

<!-- TSDOC_END -->

## Examples

See working examples in the [faremeter repository](https://github.com/faremeter/faremeter/tree/main/scripts):

- [Express + Solana](https://github.com/faremeter/faremeter/blob/main/scripts/solana-example/server-express.ts)
- [Express + EVM](https://github.com/faremeter/faremeter/blob/main/scripts/evm-example/server-express.ts)
- [Hono + Solana](https://github.com/faremeter/faremeter/blob/main/scripts/solana-example/server-hono.ts)

## Related Packages

- [@faremeter/fetch](https://www.npmjs.com/package/@faremeter/fetch) - Client-side fetch wrapper
- [@faremeter/info](https://www.npmjs.com/package/@faremeter/info) - Network/asset configuration helpers
- [@faremeter/facilitator](https://www.npmjs.com/package/@faremeter/facilitator) - Payment facilitator service

## License

LGPL-3.0-only
