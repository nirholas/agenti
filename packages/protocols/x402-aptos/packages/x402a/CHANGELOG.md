# Changelog

All notable changes to the x402a package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-11-14

### Added

#### Client
- `signTransactionForFeePayer()` - Sign transactions without submitting (fee payer flow)
- `calculateExpiration()` - Calculate transaction expiration timestamps
- `generateSecureNonce()` - Generate cryptographically secure nonces for replay protection
- `getChainIdFromNetwork()` - Get Aptos chain ID from network name
- Encoding utilities: `hexToBytes()`, `bytesToHex()`, `formatExpirationTime()`

#### Server
- `X402Facilitator` class - Complete facilitator implementation
  - `buildTransactionForClient()` - Build fee payer transactions for client signing
  - `submitPayment()` - Submit user-signed transactions as fee payer
  - `submitSponsoredPayment()` - Low-level sponsored transaction submission
  - `isNonceUsed()` - Check nonce status on-chain
  - `isRegistryInitialized()` - Check if user has initialized payment registry
- Payment validation utilities
  - `parsePaymentHeader()` - Parse base64-encoded payment headers
  - `validatePaymentPayload()` - Validate payment payload structure
  - `getSupportedPayments()` - Return supported payment schemes and networks
- Response utilities
  - `createPaymentResponseHeader()` - Create payment response headers
  - `parsePaymentResponseHeader()` - Parse payment response headers
- Health check system
  - `performHealthCheck()` - Check facilitator health (balance, connectivity)
  - `createHealthHandler()` - Create health check API handler
- Rate limiting
  - `checkRateLimit()` - IP-based rate limiting
  - `createRateLimitMiddleware()` - Rate limiting middleware
  - `addRateLimitHeaders()` - Add rate limit headers to responses
- Structured logging with pino

#### Types
- `PaymentRequirements` - Payment requirement specification
- `PaymentPayload` - Payment payload structure
- `AptosPaymentPayloadData` - Aptos-specific payment data
- `TransactionPayloadForSigning` - Fee payer transaction payload
- `BuildSponsoredTransactionOptions` - Options for building sponsored transactions
- `SubmitPaymentOptions` - Options for submitting payments
- `SubmitPaymentResult` - Payment submission result
- `SupportedPaymentsResponse` - Supported payment schemes response
- Full TypeScript type definitions for all APIs

### Features

- **Fee Payer Transactions** - Users sign, facilitator pays gas
- **Multi-Recipient Splits** - Support for up to 10 recipients per transaction
- **Replay Protection** - Nonce-based protection against replay attacks
- **Expiration Protection** - Time-based transaction expiration
- **Chain ID Validation** - Prevent cross-chain replay attacks
- **Balance Pre-checks** - Verify sufficient balance before submission
- **Zero Address Prevention** - Prevent transfers to zero address
- **Overflow Protection** - Safe arithmetic for split transfers
- **Event Emission** - On-chain events for transaction tracking
- **React Integration** - Works with @aptos-labs/wallet-adapter-react

### Security

- Nonce registry prevents replay attacks
- Transaction expiration timestamps
- Chain ID validation (mainnet/testnet/devnet)
- Duplicate recipient detection in splits
- Integer overflow protection using u128 arithmetic
- Balance pre-checks before transfer
- Zero address validation

### Testing

- 37 facilitator tests passing
- Comprehensive test coverage for transaction building, payment submission, nonce management, error handling, and split payments

### Documentation

- Complete API documentation
- Usage examples for client and server
- Security model documentation
- Fee payer architecture explanation

## [Unreleased]

### Planned
- Fungible Assets (FA) support
- React hooks (useX402Payment)
- Subscription support (recurring payments)
- Batch payments
- Price oracle integration

[0.1.0]: https://github.com/raintree-technology/x402a/releases/tag/v0.1.0
