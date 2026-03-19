# Codebase Structure

**Analysis Date:** 2026-01-19

## Directory Layout

```
openfacilitator/
├── apps/                           # Application packages
│   └── dashboard/                  # Next.js admin dashboard
│       ├── src/
│       │   ├── app/               # Next.js App Router pages
│       │   ├── components/        # React components
│       │   ├── hooks/             # Custom React hooks
│       │   └── lib/               # Utilities and API client
│       └── public/                # Static assets
├── packages/                       # Library packages
│   ├── core/                       # Core payment logic (no HTTP)
│   │   └── src/
│   ├── sdk/                        # Client SDK (published to npm)
│   │   └── src/
│   ├── server/                     # Express HTTP server
│   │   ├── src/
│   │   │   ├── auth/              # Better Auth config
│   │   │   ├── db/                # SQLite data access
│   │   │   ├── middleware/        # Express middleware
│   │   │   ├── routes/            # Route handlers
│   │   │   ├── services/          # Business logic
│   │   │   └── utils/             # Utilities (crypto)
│   │   ├── scripts/               # Dev scripts
│   │   └── data/                  # SQLite database (gitignored)
│   └── integration-tests/          # End-to-end tests
│       └── src/
├── examples/                       # Example integrations
├── docs/                           # Documentation
├── .github/                        # GitHub Actions workflows
├── .planning/                      # Planning documents
│   └── codebase/                  # Codebase analysis (this file)
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml            # Workspace definition
├── turbo.json                      # Turborepo config
└── tsconfig.base.json             # Shared TypeScript config
```

## Directory Purposes

**apps/dashboard:**
- Purpose: Admin web interface for managing facilitators
- Contains: Next.js 15 app with App Router, React components, TanStack Query
- Key files:
  - `src/app/layout.tsx` - Root layout with providers
  - `src/app/page.tsx` - Landing page
  - `src/app/dashboard/page.tsx` - Facilitator list
  - `src/app/dashboard/[id]/page.tsx` - Facilitator detail
  - `src/lib/api.ts` - API client class
  - `src/components/providers.tsx` - Global providers

**packages/core:**
- Purpose: Platform-agnostic payment verification and settlement
- Contains: Chain configs, token configs, ERC-3009, Solana settlement
- Key files:
  - `src/index.ts` - Package exports
  - `src/facilitator.ts` - Facilitator class (verify, settle)
  - `src/types.ts` - Core type definitions
  - `src/chains.ts` - Chain configurations
  - `src/tokens.ts` - Token configurations
  - `src/erc3009.ts` - ERC-3009 implementation
  - `src/solana.ts` - Solana transaction handling

**packages/sdk:**
- Purpose: Client library for API consumers
- Contains: HTTP client, middleware helpers, claims API
- Key files:
  - `src/index.ts` - Package exports
  - `src/client.ts` - OpenFacilitator client class
  - `src/middleware.ts` - Express/Hono middleware
  - `src/claims.ts` - Claims API client
  - `src/types.ts` - SDK-specific types
  - `src/errors.ts` - Error classes
  - `src/networks.ts` - Network utilities

**packages/server:**
- Purpose: Multi-tenant HTTP server
- Contains: Express routes, SQLite database, auth
- Key files:
  - `src/index.ts` - Server entry point
  - `src/server.ts` - Express app factory
  - `src/routes/facilitator.ts` - x402 protocol endpoints
  - `src/routes/admin.ts` - Dashboard API
  - `src/middleware/tenant.ts` - Tenant resolution
  - `src/db/index.ts` - Database init and schema
  - `src/auth/config.ts` - Better Auth setup

**packages/integration-tests:**
- Purpose: End-to-end API tests
- Contains: Test suites for server endpoints
- Key files:
  - `src/setup.ts` - Test setup
  - `src/endpoints.test.ts` - API endpoint tests
  - `src/solana-real.test.ts` - Solana integration tests
  - `src/base-real.test.ts` - Base integration tests

## Key File Locations

**Entry Points:**
- `packages/server/src/index.ts`: Server main
- `packages/sdk/src/index.ts`: SDK exports
- `packages/core/src/index.ts`: Core exports
- `apps/dashboard/src/app/layout.tsx`: Dashboard root

**Configuration:**
- `turbo.json`: Turborepo pipeline config
- `pnpm-workspace.yaml`: Workspace packages
- `tsconfig.base.json`: Shared TypeScript config
- `.prettierrc`: Code formatting
- `docker-compose.yml`: Local dev containers
- `Dockerfile.server`: Server container
- `Dockerfile.dashboard`: Dashboard container

**Core Logic:**
- `packages/core/src/facilitator.ts`: Payment flow
- `packages/core/src/erc3009.ts`: EVM transfers
- `packages/core/src/solana.ts`: Solana transfers
- `packages/server/src/routes/facilitator.ts`: x402 endpoints

**Database:**
- `packages/server/src/db/index.ts`: Schema and init
- `packages/server/src/db/facilitators.ts`: Facilitator queries
- `packages/server/src/db/products.ts`: Product queries
- `packages/server/data/openfacilitator.db`: SQLite file (runtime)

**Authentication:**
- `packages/server/src/auth/config.ts`: Better Auth config
- `apps/dashboard/src/components/auth/auth-provider.tsx`: Client auth context

**Testing:**
- `packages/server/src/server.test.ts`: Server unit tests
- `packages/integration-tests/src/endpoints.test.ts`: API tests

## Naming Conventions

**Files:**
- TypeScript: `kebab-case.ts` (e.g., `user-wallets.ts`, `auth-provider.tsx`)
- React components: `PascalCase.tsx` for component files in some cases, but mostly `kebab-case.tsx`
- Test files: `*.test.ts` suffix

**Directories:**
- Lowercase with hyphens: `integration-tests`, `user-wallets`
- Singular names for grouped resources: `routes/`, `services/`, `db/`

**Exports:**
- Functions: `camelCase` (e.g., `createFacilitator`, `getProductById`)
- Classes: `PascalCase` (e.g., `OpenFacilitator`, `Facilitator`)
- Types/Interfaces: `PascalCase` (e.g., `PaymentRequirements`, `FacilitatorRecord`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_URL`, `ACCESS_TOKEN_SECRET`)

**Database:**
- Tables: `snake_case` plural (e.g., `facilitators`, `user_wallets`, `product_payments`)
- Columns: `snake_case` (e.g., `created_at`, `webhook_url`, `encrypted_private_key`)

## Where to Add New Code

**New API Endpoint:**
- Route handler: `packages/server/src/routes/{resource}.ts`
- If new resource type, add router to `packages/server/src/server.ts`
- Add types to `packages/server/src/db/types.ts`
- Add DB queries to `packages/server/src/db/{resource}.ts`

**New Dashboard Page:**
- Page: `apps/dashboard/src/app/{route}/page.tsx`
- Dynamic route: `apps/dashboard/src/app/{route}/[param]/page.tsx`
- API types: `apps/dashboard/src/lib/api.ts`
- Components: `apps/dashboard/src/components/{feature}.tsx`

**New SDK Feature:**
- Implementation: `packages/sdk/src/{feature}.ts`
- Export from: `packages/sdk/src/index.ts`
- Types: `packages/sdk/src/types.ts`

**New Blockchain Network:**
- Chain config: `packages/core/src/chains.ts`
- Token config: `packages/core/src/tokens.ts`
- Viem chain: `packages/core/src/facilitator.ts` (viemChains map)
- Settlement logic: `packages/core/src/{chain}.ts` if unique

**New Business Logic Service:**
- Service: `packages/server/src/services/{service}.ts`
- Import in routes that need it

**New Database Table:**
- Schema in: `packages/server/src/db/index.ts` (CREATE TABLE)
- Queries in: `packages/server/src/db/{table}.ts`
- Types in: `packages/server/src/db/types.ts`
- Migrations in: `packages/server/src/db/migrations/`

**New React Component:**
- UI primitives: `apps/dashboard/src/components/ui/{component}.tsx`
- Feature components: `apps/dashboard/src/components/{feature}.tsx`
- Hooks: `apps/dashboard/src/hooks/use-{hook}.ts`

**New Test:**
- Unit tests: Co-located `{file}.test.ts`
- Integration tests: `packages/integration-tests/src/{feature}.test.ts`

## Special Directories

**packages/server/data:**
- Purpose: SQLite database storage
- Generated: Yes (at runtime)
- Committed: No (gitignored)

**packages/*/dist:**
- Purpose: TypeScript build output
- Generated: Yes (by tsc/tsup)
- Committed: No (gitignored)

**apps/dashboard/.next:**
- Purpose: Next.js build cache
- Generated: Yes (by next build)
- Committed: No (gitignored)

**.turbo:**
- Purpose: Turborepo cache
- Generated: Yes (by turbo)
- Committed: No (gitignored)

**.pnpm-store:**
- Purpose: pnpm package cache
- Generated: Yes (by pnpm)
- Committed: No (gitignored)

**packages/server/better-auth_migrations:**
- Purpose: Better Auth migration tracking
- Generated: Yes (by better-auth)
- Committed: No (gitignored)

## Import Patterns

**Workspace Package Imports:**
```typescript
import { createFacilitator } from '@openfacilitator/core';
import { OpenFacilitator } from '@openfacilitator/sdk';
```

**Internal Imports (with .js extension for ESM):**
```typescript
import { getDatabase } from './db/index.js';
import { resolveFacilitator } from '../middleware/tenant.js';
```

**Dashboard Path Aliases:**
```typescript
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
```

---

*Structure analysis: 2026-01-19*
