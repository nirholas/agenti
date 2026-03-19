# Coding Conventions

**Analysis Date:** 2026-01-19

## Naming Patterns

**Files:**
- TypeScript files: `kebab-case.ts` (e.g., `auth-client.ts`, `use-toast.ts`)
- React components: `kebab-case.tsx` (e.g., `facilitator-card.tsx`, `billing-wallet.tsx`)
- Test files: `*.test.ts` suffix (e.g., `server.test.ts`, `endpoints.test.ts`)
- Type files: `types.ts` for shared types within a package

**Functions:**
- camelCase for all functions (e.g., `createFacilitator`, `getFacilitatorById`)
- Use verb prefixes: `get*`, `create*`, `update*`, `delete*`, `is*`, `has*`
- Async functions use descriptive names (e.g., `executeSolanaSettlement`, `sendSettlementWebhook`)

**Variables:**
- camelCase for local variables and parameters
- UPPER_SNAKE_CASE for constants (e.g., `DEFAULT_TIMEOUT`, `USDC_MINT`, `SOLANA_RPC`)
- Prefix boolean variables with `is`, `has`, `can` (e.g., `isValid`, `hasWallet`, `isAvailable`)

**Types:**
- PascalCase for interfaces and type aliases
- Suffix with `Record` for database models (e.g., `FacilitatorRecord`, `TransactionRecord`)
- Suffix with `Request`/`Response` for API types (e.g., `VerifyRequest`, `SettleResponse`)
- Suffix with `Config` for configuration (e.g., `FacilitatorConfig`, `TokenConfig`)
- Suffix with `Props` for React component props (e.g., `FacilitatorCardProps`, `ButtonProps`)

## Code Style

**Formatting:**
- Prettier configured via `.prettierrc`
- Semi: `true` (always use semicolons)
- Single quotes: `true`
- Tab width: 2 spaces
- Trailing comma: `es5`
- Print width: 100 characters

**Linting:**
- ESLint in SDK package only (`packages/sdk/package.json`)
- TypeScript strict mode enabled via `tsconfig.base.json`
- `noEmit` used for type checking without build

## Import Organization

**Order:**
1. External libraries (e.g., `express`, `viem`, `react`)
2. Internal packages (e.g., `@openfacilitator/core`, `@openfacilitator/sdk`)
3. Relative imports (e.g., `./types.js`, `../db/index.js`)

**Path Aliases:**
- Dashboard uses `@/` alias for `src/` directory (e.g., `@/lib/utils`, `@/components/ui/button`)
- Server uses `.js` extension in imports for ESM compatibility

**Extension Usage:**
- Server package: Always include `.js` extension in imports (ESM requirement)
- Dashboard: No extensions needed (Next.js handles resolution)
- SDK: Uses `.js` extension

## Error Handling

**Patterns:**
- Custom error classes with inheritance (`packages/sdk/src/errors.ts`)
  ```typescript
  export class FacilitatorError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode?: number,
      public details?: unknown
    ) {
      super(message);
      this.name = 'FacilitatorError';
    }
  }
  ```
- Specific error types: `NetworkError`, `VerificationError`, `SettlementError`, `ConfigurationError`
- Database errors: Check for specific error messages (e.g., `UNIQUE constraint failed`)
- Try-catch with typed error handling: `catch (error: unknown)`

**API Error Responses:**
```typescript
res.status(500).json({
  error: 'Internal server error',
  message: process.env.NODE_ENV === 'development' ? err.message : undefined,
});
```

**Return Types:**
- Use `| null` for functions that may not find data (e.g., `getFacilitatorById(): FacilitatorRecord | null`)
- Use success/error objects for operations: `{ success: boolean; error?: string }`

## Logging

**Framework:** `console` (no external logging library)

**Patterns:**
- Debug logs with context: `console.log('[Facilitator] EVM authorization received:', ...)`
- Error logs: `console.error('Server error:', err)`
- Test logs with emojis for visibility (integration tests only)

## Comments

**When to Comment:**
- JSDoc for public API functions with `@param`, `@returns`, `@deprecated`
- Block comments for complex logic explanations
- Inline comments for non-obvious operations

**JSDoc/TSDoc:**
```typescript
/**
 * Create a signed access token for a product
 */
function createAccessToken(productId: string, expiresAt: number): string { ... }

/**
 * Create a facilitator client with default OpenFacilitator URL
 * @deprecated Just use `new OpenFacilitator()` - it defaults to the public endpoint
 */
export function createDefaultFacilitator(): OpenFacilitator { ... }
```

**Deprecation Pattern:**
- Use `@deprecated` JSDoc tag with migration instructions
- Export deprecated aliases for backwards compatibility (e.g., `export type PaymentLink = Product`)

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Extract helper functions for reusable logic
- Long functions acceptable for route handlers with clear sections

**Parameters:**
- Use object parameters for functions with multiple optional fields
- Destructure in function signature when appropriate
- Type all parameters explicitly

**Return Values:**
- Return typed objects, avoid `any`
- Use union types for functions with multiple return shapes
- Prefer `null` over `undefined` for optional database values

## Module Design

**Exports:**
- Named exports preferred over default exports
- Re-export from index files for public API
- Group related functions in single files by domain (e.g., all facilitator DB operations in `facilitators.ts`)

**Barrel Files:**
- `packages/core/src/index.ts` - exports all public types and functions
- `packages/sdk/src/index.ts` - exports client and types
- Dashboard components use index files for component groups

## React Patterns

**Component Structure:**
```typescript
'use client';  // For client components in Next.js App Router

import { useState } from 'react';
// ... other imports

interface ComponentProps {
  prop1: Type;
  onEvent?: () => void;
}

export function ComponentName({ prop1, onEvent }: ComponentProps) {
  // hooks first
  const [state, setState] = useState(false);

  // handlers
  const handleClick = () => { ... };

  // render
  return ( ... );
}
```

**UI Components:**
- Use `class-variance-authority` (cva) for variant styling
- Use `cn()` utility for conditional class merging
- Forward refs with `React.forwardRef`
- Set `displayName` for debugging

**Hooks:**
- Custom hooks in `hooks/` directory
- Prefix with `use` (e.g., `useToast`, `useDomainStatus`)

## Validation

**Schema Library:** Zod

**Patterns:**
```typescript
const verifyRequestSchema = z.object({
  x402Version: z.number().optional(),
  paymentPayload: z.union([z.string(), z.object({}).passthrough()]),
  paymentRequirements: paymentRequirementsSchema,
});
```

**Usage:**
- Define schemas near route handlers
- Use `.parse()` or `.safeParse()` for validation
- Compose schemas with nested objects

## Database Patterns

**ORM:** Raw SQL with better-sqlite3 (synchronous)

**Patterns:**
- Prepare statements: `db.prepare('SELECT * FROM table WHERE id = ?')`
- Use `stmt.get()` for single row, `stmt.all()` for multiple
- Cast results: `stmt.get(id) as RecordType | undefined`
- Return `null` for not found, not `undefined`

**Naming:**
- Database columns: `snake_case` (e.g., `custom_domain`, `created_at`)
- TypeScript interfaces: `camelCase` (transform in application layer when needed)

---

*Convention analysis: 2026-01-19*
