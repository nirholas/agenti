# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-07

### Added
- **Protocol v2 support** - Full x402 protocol v2 compliance with CAIP-2 network identifiers and updated headers
- **v2 `PAYMENT-REQUIRED` header** - 402 responses include base64-encoded PaymentRequired in header per v2 HTTP transport spec
- **v2 PaymentPayload format** - `scheme` and `network` nested inside `accepted` object per v2 spec
- **v2 PaymentRequired format** - `resource` info at top level, `amount` field (not `maxAmountRequired`), `extensions` object
- **Multi-chain accept** - `config.accept(chain:, currency:)` allows accepting payments on multiple chains simultaneously
- **Per-endpoint version override** - `x402_paywall(amount:, version:)` to use v1 or v2 per endpoint
- **Custom chain registration** - `config.register_chain(name:, chain_id:, standard:)` for custom EVM chains
- **Custom token registration** - `config.register_token(chain:, symbol:, address:, decimals:, name:)` for custom tokens
- **CAIP-2 support** - `to_caip2()` and `from_caip2()` for network identifier conversion
- **Per-chain fee payer** - Configure via `X402_SOLANA_DEVNET_FEE_PAYER`, `X402_SOLANA_FEE_PAYER` env vars
- **Dynamic HTML paywall** - Detects decimals and asset symbol from chain configuration

### Changed
- Default protocol version is now v2
- v2 responses use CAIP-2 network format (e.g., `eip155:84532` instead of `base-sepolia`)
- v2 402 responses include full PaymentRequired in both header and body for debugging
- v1 requirements include `resource`, `description`, `mimeType` in each accept; v2 places these at top level

## [0.2.1] - Previous Release

- Initial stable release with v1 protocol support
- Custom chain and token registration
- Optimistic and non-optimistic settlement modes
