# Phase 2: Auth Integration - Research

**Researched:** 2026-01-19
**Domain:** Better Auth integration for rewards program
**Confidence:** HIGH

## Summary

This phase integrates the rewards system with the existing Better Auth authentication already in place. The codebase has a mature auth setup using Better Auth v1.2.0+ with SQLite, email/password authentication, session management, and database hooks. The rewards tables (from Phase 1) already reference the `"user"` table via `user_id` foreign keys.

The integration work focuses on three areas: (1) ensuring new users registering for rewards use the existing Better Auth flow with optional Solana address capture, (2) enabling existing Better Auth users to enroll in the rewards program, and (3) implementing admin identification via `ADMIN_USER_IDS` environment variable.

**Primary recommendation:** Leverage existing Better Auth patterns entirely - no auth library changes needed. Add rewards enrollment status tracking to user context and implement admin check as a simple middleware/helper.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | ^1.2.0 | Authentication framework | Already configured with email/password, sessions, SQLite |
| better-auth/react | ^1.2.0 | Client-side auth hooks | Used in dashboard for useSession, signIn, signOut |
| better-sqlite3 | ^11.6.0 | Database | Already used, rewards tables already reference user table |
| express | ^4.21.2 | Server framework | Existing API routes use requireAuth/optionalAuth middleware |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.24.1 | Validation | Request body validation in routes |
| nanoid | ^5.0.9 | ID generation | Already used for all ID generation |

### No New Dependencies Needed
This phase requires NO new npm packages. Everything needed is already in place.

## Architecture Patterns

### Existing Authentication Flow
```
Frontend (dashboard)                    Backend (server)
├── auth-client.ts                      ├── auth/
│   └── createAuthClient()             │   ├── config.ts (Better Auth setup)
│       ├── signIn.email()             │   └── index.ts (exports getAuth())
│       ├── signUp                     │
│       └── useSession()               ├── middleware/
│                                      │   └── auth.ts
├── components/auth/                   │       ├── requireAuth
│   └── auth-provider.tsx              │       └── optionalAuth
│       └── useAuth() hook             │
                                       └── routes/admin.ts
                                           └── Uses requireAuth middleware
```

### Existing User Data Model

**Better Auth "user" table** (managed by Better Auth):
```sql
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" TEXT,
  "updatedAt" TEXT
);
```

**Rewards tables reference user.id** (from Phase 1):
```sql
-- reward_addresses.user_id -> user.id
-- reward_claims.user_id -> user.id
```

### Recommended Pattern: Admin Identification

Create a simple admin check utility:

```typescript
// packages/server/src/utils/admin.ts
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

export function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}
```

Use in middleware:
```typescript
// packages/server/src/middleware/auth.ts
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  // First verify auth
  await requireAuth(req, res, () => {
    if (!isAdmin(req.user!.id)) {
      res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
      return;
    }
    next();
  });
}
```

### Recommended Pattern: Rewards Enrollment Check

Check if user has any reward addresses (enrolled in rewards):
```typescript
// packages/server/src/db/reward-addresses.ts (already exists)
export function isUserEnrolledInRewards(userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('SELECT 1 FROM reward_addresses WHERE user_id = ? LIMIT 1');
  return !!stmt.get(userId);
}
```

### Recommended Pattern: Facilitator Owner Detection

Check if user owns any facilitators (for 2x multiplier):
```typescript
// packages/server/src/db/facilitators.ts
export function isFacilitatorOwner(userId: string): boolean {
  const db = getDatabase();
  // Facilitators use owner_address which is set to user.id during creation
  const stmt = db.prepare('SELECT 1 FROM facilitators WHERE owner_address = ? LIMIT 1');
  return !!stmt.get(userId);
}
```

Note: The existing codebase stores `user.id` in `facilitators.owner_address` (see admin.ts line 287, 343).

### Anti-Patterns to Avoid
- **Creating separate auth system**: Better Auth already handles everything - don't add parallel auth
- **Modifying Better Auth tables**: The "user" table is managed by Better Auth - don't alter schema
- **Wallet-based authentication**: Phase 2 is email-first; wallet connection is Phase 9 (CLAIM-03, CLAIM-04)
- **Adding email verification requirement now**: CONTEXT.md says "verify-first" but existing setup has `requireEmailVerification: false` - follow existing pattern for now

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session validation | Custom JWT/token handling | `auth.api.getSession()` | Better Auth handles expiry, refresh, cookies |
| User lookup | Direct SQL queries | `req.user` from middleware | Already populated by requireAuth |
| Password hashing | Custom bcrypt implementation | Better Auth's signUp | Built-in secure handling |
| CORS for auth | Manual header handling | Better Auth's trustedOrigins | Already configured in config.ts |
| Cookie management | Manual cookie parsing | Better Auth | Automatic cookie handling with fromNodeHeaders |

**Key insight:** This phase is about LINKING to Better Auth, not building auth. Every auth primitive already exists.

## Common Pitfalls

### Pitfall 1: Confusing user.id with owner_address
**What goes wrong:** Assuming `facilitators.owner_address` is a wallet address
**Why it happens:** The column name suggests a blockchain address
**How to avoid:** Understand that `owner_address` is actually set to `user.id` (a nanoid) in admin.ts line 287
**Warning signs:** Code that tries to validate owner_address as a blockchain address

### Pitfall 2: Adding wallet requirement at registration
**What goes wrong:** Blocking users who don't have a Solana wallet yet
**Why it happens:** AUTH-01 mentions "email and Solana wallet address"
**How to avoid:** CONTEXT.md clarifies: "Solana address is optional at signup - can be added from dashboard"
**Warning signs:** Registration form that requires wallet address

### Pitfall 3: Over-engineering admin middleware
**What goes wrong:** Creating complex role-based access control system
**Why it happens:** Anticipating future needs
**How to avoid:** AUTH-05 is simple: "Admin users identified via config-based check (ADMIN_USER_IDS env var)"
**Warning signs:** Database tables for roles, permissions, etc.

### Pitfall 4: Modifying Better Auth config for rewards
**What goes wrong:** Adding custom hooks or plugins to Better Auth for rewards
**Why it happens:** Seems natural to extend auth for rewards
**How to avoid:** Rewards enrollment is separate from auth - use reward_addresses table
**Warning signs:** Changes to packages/server/src/auth/config.ts beyond trustedOrigins

### Pitfall 5: Frontend auth state for rewards
**What goes wrong:** Creating separate rewards auth context
**Why it happens:** Want to track rewards enrollment in context
**How to avoid:** Use existing useAuth() + API call to check enrollment status
**Warning signs:** New AuthProvider or context for rewards

## Code Examples

Verified patterns from existing codebase:

### Getting Session in Express Route (Existing Pattern)
```typescript
// Source: packages/server/src/middleware/auth.ts
import { fromNodeHeaders } from 'better-auth/node'; // NOT used in current code
// Current implementation uses:
const session = await auth.api.getSession({
  headers: req.headers as Record<string, string>,
});
```

### User Type from Session (Existing Pattern)
```typescript
// Source: packages/server/src/middleware/auth.ts
interface Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}
```

### Creating Facilitator with User ID (Existing Pattern)
```typescript
// Source: packages/server/src/routes/admin.ts lines 283-290
const ownerAddress = req.user!.id; // Use authenticated user's ID

const facilitator = createFacilitator({
  name,
  subdomain,
  custom_domain: customDomain,
  owner_address: ownerAddress, // Stores user.id, NOT a wallet address
  // ...
});
```

### Client-Side Auth Check (Existing Pattern)
```typescript
// Source: apps/dashboard/src/components/auth/auth-provider.tsx
const { data: session, isPending } = useSession();

// Usage in components:
const { isAuthenticated, isLoading, user } = useAuth();

useEffect(() => {
  if (!authLoading && !isAuthenticated) {
    router.push('/auth/signin');
  }
}, [authLoading, isAuthenticated, router]);
```

### Registering Reward Address (From Phase 1)
```typescript
// Source: packages/server/src/db/reward-addresses.ts
import { createRewardAddress } from '../db/reward-addresses.js';

// To enroll user in rewards:
const address = createRewardAddress({
  user_id: req.user!.id,
  chain_type: 'solana', // or 'evm'
  address: solanaAddress, // User's pay-to address
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Better Auth v0.x | Better Auth v1.2.0 | Late 2024 | Stable API, use current patterns |
| Cookie-based only | Cookie cache + DB sessions | Better Auth 1.x | Session caching enabled in config |

**No deprecated patterns found in codebase** - auth setup is current.

## Open Questions

Things that couldn't be fully resolved:

1. **Email Verification Timing**
   - What we know: CONTEXT.md says "verify-first", but `requireEmailVerification: false` in config
   - What's unclear: Should we enable email verification for rewards users?
   - Recommendation: Keep current behavior, defer email verification to separate decision

2. **Facilitator Owner Auto-Enrollment**
   - What we know: CONTEXT.md gives Claude discretion on auto-enroll vs one-click
   - What's unclear: How to trigger enrollment for existing facilitator owners
   - Recommendation: Implement one-click with dashboard banner - simpler, more explicit

3. **Admin Badge Styling**
   - What we know: CONTEXT.md says "subtle badge visible in header or profile area"
   - What's unclear: Exact design/placement
   - Recommendation: Follow existing dashboard styling patterns, simple "Admin" text badge

## Integration Points Summary

| Component | Location | What Phase 2 Does |
|-----------|----------|-------------------|
| Better Auth Config | `packages/server/src/auth/config.ts` | No changes needed |
| Auth Middleware | `packages/server/src/middleware/auth.ts` | Add `requireAdmin` middleware |
| User Context | `apps/dashboard/src/components/auth/auth-provider.tsx` | May extend to include isAdmin flag |
| Reward Addresses | `packages/server/src/db/reward-addresses.ts` | Add enrollment check helper |
| Facilitators | `packages/server/src/db/facilitators.ts` | Add owner check helper |
| Server .env | `packages/server/.env.example` | Add ADMIN_USER_IDS |

## Sources

### Primary (HIGH confidence)
- Better Auth Official Docs - [Express Integration](https://www.better-auth.com/docs/integrations/express)
- Better Auth Official Docs - [Client](https://www.better-auth.com/docs/concepts/client)
- Codebase: `packages/server/src/auth/config.ts` - Current Better Auth setup
- Codebase: `packages/server/src/middleware/auth.ts` - Existing auth middleware
- Codebase: `packages/server/src/routes/admin.ts` - API patterns
- Codebase: `packages/server/src/db/reward-addresses.ts` - Phase 1 CRUD

### Secondary (MEDIUM confidence)
- [Better Auth GitHub](https://github.com/better-auth/better-auth) - API reference

### Tertiary (LOW confidence)
- None - all findings verified with codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against package.json and existing code
- Architecture: HIGH - traced through existing codebase patterns
- Pitfalls: HIGH - identified from CONTEXT.md decisions and codebase analysis

**Research date:** 2026-01-19
**Valid until:** 60 days (Better Auth is stable, codebase patterns won't change)
