# Changelog

All notable changes to the x402a-next package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-11-14

### Added

#### Middleware
- `createPaymentMiddleware()` - Next.js middleware for x402 payment protection
  - Route pattern matching (exact paths and wildcards)
  - Automatic 402 Payment Required responses
  - Payment verification with facilitator
  - Client-side payment verification fallback
  - Custom error pages
  - Debug logging
- Payment header parsing and validation
- Payment verification utilities
- 402 response creation with payment requirements

#### Configuration
- Route-based payment configuration
  - Price per route
  - Network selection (testnet/mainnet)
  - Custom descriptions
  - Resource identifiers
  - Override with custom PaymentRequirements
- Facilitator configuration
  - URL and authentication headers
  - Request timeout settings
  - Automatic payment submission

#### Utilities
- `buildPaymentRequirements()` - Build payment requirements from route config
- `matchRoute()` - Pattern matching for route protection
- `verifyPayment()` - Verify payments via facilitator or client-side
- `parsePaymentFromHeader()` - Parse and validate payment headers
- `create402Response()` - Create 402 responses with requirements
- `createSuccessResponse()` - Create success response headers

#### Lifecycle Hooks
- `onPaymentRequired` - Called when 402 response is sent
- `onPaymentVerified` - Called when payment is verified
- `onPaymentSettled` - Called when payment settles on-chain
- `onPaymentError` - Called on payment errors

### Features

- **Next.js App Router Support** - Works with Next.js 13+ middleware
- **Route Protection** - Protect API routes and pages with payments
- **Pattern Matching** - Support for wildcards and path parameters
- **Facilitator Integration** - Automatic payment verification via facilitator
- **Client Verification** - Fallback client-side verification
- **Flexible Configuration** - Per-route pricing and settings
- **Type Safety** - Full TypeScript support
- **Debug Mode** - Detailed logging for development

### Testing

- 26 middleware tests passing
- Comprehensive test coverage for:
  - Route matching
  - Payment verification
  - 402 response creation
  - Header parsing
  - Error handling

### Documentation

- Middleware setup guide
- Configuration examples
- Integration with x402a facilitator
- API reference

### Dependencies

- `x402a` ^0.1.0 - Core x402a functionality
- `pino` ^10.1.0 - Structured logging
- `pino-pretty` ^13.1.2 - Pretty log formatting

### Peer Dependencies

- `next` >=13.0.0 - Next.js framework

## [Unreleased]

### Planned
- Pages Router support
- Custom payment validators
- Multi-network support
- Payment caching
- Rate limiting integration

[0.1.0]: https://github.com/raintree-technology/x402a/releases/tag/v0.1.0
