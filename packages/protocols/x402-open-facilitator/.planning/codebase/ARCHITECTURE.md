# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Multi-tenant monorepo with layered service architecture

**Key Characteristics:**
- Monorepo using pnpm workspaces with Turborepo orchestration
- Three-layer separation: core (business logic), server (HTTP layer), SDK (client)
- Multi-tenant facilitator model with subdomain/custom domain routing
- x402 payment protocol implementation for EVM (Base, Ethereum, Polygon, etc.) and Solana networks

## Package Architecture

**@openfacilitator/core:**
- Purpose: Platform-agnostic payment verification and settlement logic
- Location: `packages/core/src/`
- Contains: Chain configs, token definitions, ERC-3009 implementation, Solana settlement
- Used by: `@openfacilitator/server`
- No external HTTP dependencies - pure business logic

**@openfacilitator/server:**
- Purpose: Express HTTP server with multi-tenant routing and admin APIs
- Location: `packages/server/src/`
- Contains: Routes, middleware, database access, auth, services
- Depends on: `@openfacilitator/core`, `@openfacilitator/sdk`
- Entry point: `packages/server/src/index.ts`

**@openfacilitator/sdk:**
- Purpose: Client library for interacting with facilitator APIs
- Location: `packages/sdk/src/`
- Contains: OpenFacilitator client class, middleware helpers, claims API
- No server dependencies - published to npm
- Entry point: `packages/sdk/src/index.ts`

**@openfacilitator/dashboard:**
- Purpose: Next.js admin dashboard for managing facilitators
- Location: `apps/dashboard/src/`
- Contains: React components, pages, API client
- Depends on: `@openfacilitator/core` (for types)

## Server Layers

**Routes Layer** (`packages/server/src/routes/`):
- Purpose: HTTP endpoint handlers
- Files:
  - `facilitator.ts` - x402 protocol endpoints (verify, settle, supported, products)
  - `admin.ts` - Dashboard admin API (CRUD for facilitators, wallets, products)
  - `public.ts` - Public free facilitator endpoints
  - `subscriptions.ts` - Subscription management
  - `stats.ts` - x402-protected stats endpoints
  - `discovery.ts` - Service discovery for x402 resources (Bazaar integration)
  - `internal-webhooks.ts` - Internal webhook handlers (dogfooding)

**Middleware Layer** (`packages/server/src/middleware/`):
- Purpose: Request preprocessing and tenant resolution
- Files:
  - `tenant.ts` - Multi-tenant facilitator resolution by subdomain/domain
  - `auth.ts` - Authentication middleware (Better Auth)

**Services Layer** (`packages/server/src/services/`):
- Purpose: Business logic and external integrations
- Files:
  - `wallet.ts` - User billing wallet management (Solana)
  - `webhook.ts` - Webhook delivery and signing
  - `actions.ts` - Business action handlers (subscription activation)
  - `railway.ts` - Railway deployment integration for custom domains
  - `x402-client.ts` - Internal x402 client for dogfooding
  - `refund-wallet.ts` - Refund wallet management
  - `claims.ts` - Claim processing and payout

**Database Layer** (`packages/server/src/db/`):
- Purpose: SQLite data access via better-sqlite3
- Files:
  - `index.ts` - Database initialization and schema
  - `facilitators.ts` - Facilitator CRUD
  - `transactions.ts` - Transaction logging
  - `products.ts` - Products (payment links, proxies)
  - `webhooks.ts` - Webhook configuration
  - `subscriptions.ts` - User subscriptions
  - `user-wallets.ts` - Billing wallet storage
  - `storefronts.ts` - Product collections
  - `claims.ts` - Refund claims
  - `resource-owners.ts` - Third-party resource owner management
  - `refund-wallets.ts` - Refund wallet storage
  - `registered-servers.ts` - API key management for servers

**Auth Layer** (`packages/server/src/auth/`):
- Purpose: Authentication via Better Auth
- Files:
  - `config.ts` - Better Auth configuration
  - `index.ts` - Auth initialization and exports

## Data Flow

**x402 Payment Flow:**

1. Client sends request to resource with no X-PAYMENT header
2. Server returns 402 with payment requirements (scheme, network, amount, asset, payTo)
3. Client wallet signs payment authorization (ERC-3009 or Solana transaction)
4. Client sends request with base64-encoded X-PAYMENT header
5. Facilitator verifies signature via `/verify` endpoint
6. Facilitator settles transaction via `/settle` endpoint (on-chain transfer)
7. Resource server returns content

**Multi-Tenant Routing:**

1. Request arrives at server
2. `resolveFacilitator` middleware extracts hostname
3. For `*.openfacilitator.io`: Extract subdomain, lookup facilitator
4. For custom domains: Lookup by custom_domain or additional_domains
5. Attach `req.facilitator` with configuration and keys
6. Route handlers use `req.facilitator` for tenant-specific behavior

**Dashboard Authentication Flow:**

1. User signs up/in via Better Auth (email/password)
2. Session cookie set, managed by Better Auth
3. On signup, billing wallet auto-generated (Solana)
4. Dashboard API calls include credentials for session auth
5. Admin routes verify session and check facilitator ownership

## Key Abstractions

**Facilitator:**
- Purpose: A tenant instance with its own domain, keys, and configuration
- Examples: `packages/server/src/db/facilitators.ts`, `packages/core/src/facilitator.ts`
- Pattern: Each facilitator has EVM and Solana private keys (encrypted at rest)

**Product (x402 Resource):**
- Purpose: A payable resource with price, asset, and optional webhook
- Examples: `packages/server/src/db/products.ts`
- Pattern: Supports payment, redirect, and proxy types

**PaymentPayload:**
- Purpose: Base64-encoded payment authorization from user wallet
- Examples: `packages/core/src/types.ts`
- Pattern: Contains signature and authorization details (from, to, value, nonce)

**PaymentRequirements:**
- Purpose: Server-specified payment terms
- Examples: `packages/core/src/types.ts`
- Pattern: Includes scheme, network, maxAmountRequired, asset, payTo

**Claim:**
- Purpose: Refund request when API fails after payment
- Examples: `packages/server/src/db/claims.ts`
- Pattern: Created by servers via API key, approved/rejected by resource owners

## Entry Points

**Server:**
- Location: `packages/server/src/index.ts`
- Triggers: `pnpm dev` or `node dist/index.js`
- Responsibilities: Initialize database, auth, create Express app, listen on port

**Dashboard:**
- Location: `apps/dashboard/src/app/layout.tsx`
- Triggers: Next.js routing via `next dev` or `next start`
- Responsibilities: App shell, providers (QueryClient, Theme, Auth)

**SDK:**
- Location: `packages/sdk/src/index.ts`
- Triggers: Import in user code
- Responsibilities: Export client, middleware, claims helpers, types

## Error Handling

**Strategy:** Structured error responses with optional detailed messages in development

**Patterns:**
- Routes catch errors and return JSON with `error` field
- Settlement failures include `errorReason` in response
- SDK wraps errors in typed error classes (FacilitatorError, VerificationError, etc.)
- Global error handler in `packages/server/src/server.ts` logs and returns 500

**Error Types:**
- `VerificationError` - Payment signature invalid
- `SettlementError` - On-chain transaction failed
- `NetworkError` - RPC/HTTP errors
- `ConfigurationError` - Invalid config

## Cross-Cutting Concerns

**Logging:**
- Console-based logging with prefixes (e.g., `[Actions]`, `[Facilitator]`)
- Error stack traces logged server-side

**Validation:**
- Zod schemas for request validation in routes
- Type guards for payment payload structure

**Authentication:**
- Better Auth for dashboard users
- API keys for registered servers (claims reporting)
- No auth for public x402 endpoints (verify, settle, supported)

**Encryption:**
- Private keys encrypted at rest using `packages/server/src/utils/crypto.ts`
- Environment variable `ENCRYPTION_KEY` for key derivation

**Multi-Network Support:**
- Chain configuration in `packages/core/src/chains.ts`
- Token configuration in `packages/core/src/tokens.ts`
- EVM settlement via `packages/core/src/erc3009.ts`
- Solana settlement via `packages/core/src/solana.ts`

---

*Architecture analysis: 2026-01-19*
