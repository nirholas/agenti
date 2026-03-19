# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**Blockchain RPC:**
- Solana Mainnet - Payment settlement and verification
  - SDK/Client: `@solana/web3.js`, `@solana/spl-token`
  - Env: `SOLANA_RPC_URL` (default: `https://api.mainnet-beta.solana.com`)
- Solana Devnet - Testnet transactions
  - Env: `SOLANA_DEVNET_RPC_URL` (default: `https://api.devnet.solana.com`)
- EVM Chains (Base, Ethereum, Polygon, Avalanche, etc.) - ERC-3009 settlements
  - SDK/Client: `viem` with chain-specific configs
  - Env: `BASE_RPC_URL`, `ETHEREUM_RPC_URL`, `POLYGON_RPC_URL`, etc.

**Supported EVM Networks:**
| Network | Chain ID | Default RPC |
|---------|----------|-------------|
| Avalanche | 43114 | `https://api.avax.network/ext/bc/C/rpc` |
| Base | 8453 | `https://mainnet.base.org` |
| Ethereum | 1 | `https://eth.llamarpc.com` |
| IoTeX | 4689 | `https://babel-api.mainnet.iotex.io` |
| Peaq | 3338 | `https://peaq.api.onfinality.io/public` |
| Polygon | 137 | `https://polygon-rpc.com` |
| Sei | 1329 | `https://evm-rpc.sei-apis.com` |
| XLayer | 196 | `https://rpc.xlayer.tech` |

**x402jobs Discovery Service:**
- Service discovery for x402-enabled resources (Bazaar)
  - SDK/Client: `@x402jobs/sdk` 0.2.2
  - Env: `X402JOBS_API_KEY`
  - Implementation: `packages/server/src/routes/discovery.ts`
  - Caching: 5-minute in-memory cache

**Railway (Infrastructure):**
- Custom domain management via GraphQL API
  - Endpoint: `https://backboard.railway.com/graphql/v2`
  - Auth: Bearer token via `RAILWAY_TOKEN`
  - Env: `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID`
  - Implementation: `packages/server/src/services/railway.ts`
  - Functions: `addCustomDomain()`, `removeCustomDomain()`, `getDomainStatus()`

## Data Storage

**Databases:**
- SQLite (primary data store)
  - Connection: `DATABASE_PATH` env var (default: `./data/openfacilitator.db`)
  - Client: `better-sqlite3` (synchronous driver)
  - WAL mode enabled for concurrent performance
  - Implementation: `packages/server/src/db/index.ts`

**Tables:**
| Table | Purpose |
|-------|---------|
| `facilitators` | Multi-tenant facilitator configs |
| `transactions` | Payment transaction history |
| `user` / `session` / `account` | Better Auth user data |
| `subscriptions` | User subscription tiers |
| `products` | x402 products/payment links |
| `product_payments` | Payment tracking |
| `storefronts` | Product collections |
| `webhooks` | Webhook configurations |
| `claims` | Refund claims |
| `refund_wallets` | Custodial refund wallets |
| `resource_owners` | Third-party resource owners |

**File Storage:**
- Local filesystem only (SQLite database files)
- No cloud storage integration

**Caching:**
- In-memory caching for x402jobs discovery (5-minute TTL)
- No Redis or external cache

## Authentication & Identity

**Auth Provider:**
- Better Auth (self-hosted library)
  - Implementation: `packages/server/src/auth/config.ts`
  - Strategy: Email/password (no email verification required)
  - Session: 7-day expiration, daily refresh, 5-minute cookie cache
  - Secret: `BETTER_AUTH_SECRET` env var

**Client Integration:**
- Dashboard uses `better-auth/react` client
  - File: `apps/dashboard/src/lib/auth-client.ts`

**Trusted Origins:**
- Configured in auth config with defaults:
  - `localhost:3000`, `localhost:3002`, `localhost:5001`
  - `openfacilitator.io` and subdomains
  - Custom via `DASHBOARD_URL`, `ADDITIONAL_TRUSTED_ORIGINS`

## Wallet & Key Management

**Custodial Wallets:**
- EVM wallets generated for users (billing/subscriptions)
- Solana wallets for free facilitator
- Private keys stored encrypted in SQLite
  - EVM: `encrypted_private_key` column
  - Solana: `encrypted_solana_private_key` column
- Implementation: `packages/server/src/services/wallet.ts`

**Free Facilitator:**
- Pre-configured wallets for demo/public use
  - EVM: `FREE_FACILITATOR_EVM_KEY`, `FREE_FACILITATOR_EVM_ADDRESS`
  - Solana: `FREE_FACILITATOR_SOLANA_KEY`, `FREE_FACILITATOR_SOLANA_ADDRESS`

## Monitoring & Observability

**Error Tracking:**
- None (console.error logging only)

**Logs:**
- Console logging with prefix tags (e.g., `[Webhook]`, `[Discovery]`, `[x402Client]`)
- No structured logging framework

**Health Check:**
- HTTP endpoint at `/health`
- Docker healthcheck via wget

## CI/CD & Deployment

**Hosting:**
- Railway (primary target for server)
- Vercel-compatible (dashboard can deploy as Next.js app)
- Docker support via `docker-compose.yml`

**CI Pipeline:**
- GitHub Actions (`integration-tests.yml`)
  - Trigger: Push/PR to `main`
  - Steps: pnpm install, build SDK, run integration tests
  - Node 20, pnpm 9
  - Env secret: `TEST_CUSTOM_DOMAIN`

**Docker Images:**
- `Dockerfile.server` - Node.js Alpine, exposes port 3001
- `Dockerfile.dashboard` - Next.js standalone output, exposes port 3000

## Environment Configuration

**Required env vars:**
| Variable | Package | Purpose |
|----------|---------|---------|
| `BETTER_AUTH_SECRET` | server | Auth session encryption |
| `DATABASE_PATH` | server | SQLite database location |
| `NEXT_PUBLIC_API_URL` | dashboard | Backend API endpoint |

**Optional env vars:**
| Variable | Package | Purpose |
|----------|---------|---------|
| `SOLANA_RPC_URL` | server/core | Solana mainnet RPC |
| `SOLANA_DEVNET_RPC_URL` | server/core | Solana devnet RPC |
| `BASE_RPC_URL`, etc. | core | EVM chain RPC endpoints |
| `RAILWAY_TOKEN` | server | Railway API access |
| `X402JOBS_API_KEY` | server | Discovery service access |
| `FREE_FACILITATOR_*` | server | Demo facilitator wallets |

**Secrets location:**
- Environment variables (not committed)
- `.env.example` files document required vars
- Railway environment variables in production

## Webhooks & Callbacks

**Outgoing Webhooks:**
- Settlement notifications to facilitator webhook URLs
  - Events: `payment.settled`, `product.payment`, `webhook.test`
  - Delivery: HTTP POST with HMAC-SHA256 signature
  - Headers: `X-Webhook-Signature`, `X-Webhook-Timestamp`, `X-Webhook-Event`
  - Retries: 3 attempts with exponential backoff (1s, 2s, 4s)
  - Timeout: 10 seconds
  - Implementation: `packages/server/src/services/webhook.ts`

**Incoming Webhooks:**
- Internal subscription activation webhook
  - Secret: `SUBSCRIPTION_WEBHOOK_SECRET`
  - Purpose: Activate subscriptions after x402 payment
  - Implementation: `packages/server/src/routes/internal-webhooks.ts`

## x402 Protocol Integration

**Payment Flow:**
1. Client receives 402 response with `PaymentRequirements`
2. Client signs transaction (EVM ERC-3009 or Solana SPL transfer)
3. Client sends `X-PAYMENT` header with base64-encoded payload
4. Facilitator verifies and settles payment
5. Webhook notification sent to resource owner

**SDK Functions:**
- `verify()` - Validate payment payload
- `settle()` - Execute on-chain transfer
- `getSupported()` - Return supported payment kinds (v1 + v2/CAIP-2)

**Payment Schemes:**
- `exact` - Exact amount payment
- Networks: Human-readable (v1) or CAIP-2 format (v2)

---

*Integration audit: 2026-01-19*
