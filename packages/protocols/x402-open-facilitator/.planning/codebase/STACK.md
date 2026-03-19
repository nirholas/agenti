# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**
- TypeScript 5.7.x - All application code (server, dashboard, SDK, core)

**Secondary:**
- MDX - Documentation pages in dashboard (`apps/dashboard/src/app/docs/**/*.mdx`)

## Runtime

**Environment:**
- Node.js >= 20 (required by `package.json` engines)
- Node.js 20-alpine in Docker images

**Package Manager:**
- pnpm 9.14.2
- Lockfile: `pnpm-lock.yaml` (present)
- Workspace: `pnpm-workspace.yaml` - monorepo with `packages/*`, `apps/*`, `examples`

## Frameworks

**Core:**
- Express 4.21.x - HTTP server (`packages/server`)
- Next.js 15.5.x - Dashboard application (`apps/dashboard`)
- React 19.0.x - UI framework for dashboard

**Testing:**
- Vitest 4.x - Server tests (`packages/server`)
- Vitest 3.x - Integration tests (`packages/integration-tests`)
- Supertest 7.2.x - HTTP endpoint testing

**Build/Dev:**
- Turbo 2.3.x - Monorepo build orchestration
- tsx 4.19.x - TypeScript execution for development
- tsup 8.x - SDK bundling (CJS + ESM + DTS)
- tsc - TypeScript compilation for server/core packages

## Key Dependencies

**Critical:**
- `viem` 2.21.x - EVM blockchain interactions (ERC-3009 settlements)
- `@solana/web3.js` 1.98.x - Solana blockchain interactions
- `@solana/spl-token` 0.4.x - SPL token operations (USDC transfers)
- `better-auth` 1.2.x - Authentication library (email/password)
- `better-sqlite3` 11.6.x - SQLite database driver

**Infrastructure:**
- `zod` 3.24.x - Runtime schema validation
- `dotenv` 16.4.x - Environment variable loading
- `nanoid` 5.x - ID generation
- `bs58` 6.x - Base58 encoding for Solana keys
- `cors` 2.8.x - CORS middleware
- `helmet` 8.x - Security headers

**Dashboard UI:**
- `@tanstack/react-query` 5.62.x - Data fetching
- `@radix-ui/*` - Headless UI components (dialog, dropdown, tabs, etc.)
- `tailwindcss` 3.4.x - CSS framework
- `recharts` 3.6.x - Charting library
- `lucide-react` 0.468.x - Icons
- `wagmi` 2.14.x - Ethereum wallet connections
- `class-variance-authority` - Component variants
- `clsx` + `tailwind-merge` - Classname utilities

**Documentation:**
- `@next/mdx` + `@mdx-js/*` - MDX support
- `rehype-pretty-code` + `shiki` - Syntax highlighting
- `remark-gfm` - GitHub-flavored markdown

## Configuration

**Environment:**
- `.env` files at package level (`packages/server/.env`, `apps/dashboard/.env.local`)
- Required variables documented in `.env.example` files
- Key configs: `BETTER_AUTH_SECRET`, `DATABASE_PATH`, RPC URLs

**Build:**
- `tsconfig.base.json` - Shared TypeScript config (ES2022, NodeNext modules)
- `turbo.json` - Build pipeline configuration
- `tailwind.config.ts` - Dashboard styling (shadcn/ui theme)
- `next.config.ts` - Next.js configuration with MDX support
- `postcss.config.mjs` - PostCSS for Tailwind

**TypeScript Settings:**
```json
{
  "target": "ES2022",
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "strict": true,
  "declaration": true
}
```

## Monorepo Structure

**Packages:**
| Package | Purpose | Build Output |
|---------|---------|--------------|
| `@openfacilitator/core` | Facilitator logic, blockchain interactions | `dist/` (ESM) |
| `@openfacilitator/sdk` | Client SDK for x402 integration | `dist/` (CJS + ESM + DTS) |
| `@openfacilitator/server` | HTTP API server | `dist/` (ESM) |
| `@openfacilitator/dashboard` | Next.js admin UI | `.next/` |
| `@openfacilitator/integration-tests` | E2E API tests | N/A |

**Workspace Dependencies:**
- Server depends on: `@openfacilitator/core`, `@openfacilitator/sdk`
- Dashboard depends on: `@openfacilitator/core`
- Integration tests depend on: `@openfacilitator/sdk`

## Platform Requirements

**Development:**
- Node.js >= 20
- pnpm 9.x (enforced via `packageManager` field)
- SQLite available (via better-sqlite3)

**Production:**
- Docker (Alpine-based images provided)
- Railway (primary deployment target, GraphQL API integration)
- Vercel-compatible for dashboard (`NEXT_TELEMETRY_DISABLED=1`)
- Persistent volume for SQLite database

## Build Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (via turbo)
pnpm dev              # Start all dev servers
pnpm clean            # Clean all build outputs
pnpm format           # Format with Prettier
```

**Package-specific:**
```bash
# Server
pnpm --filter=@openfacilitator/server dev    # Dev with tsx watch
pnpm --filter=@openfacilitator/server build  # Compile TypeScript

# SDK
pnpm --filter=@openfacilitator/sdk build     # Bundle with tsup

# Dashboard
pnpm --filter=@openfacilitator/dashboard dev # Next.js dev on port 5001
```

---

*Stack analysis: 2026-01-19*
