# Phase 17: UI Cleanup & Subscriptions Section - Research

**Researched:** 2026-01-22
**Domain:** React/Next.js dashboard UI, subscription management
**Confidence:** HIGH

## Summary

This phase involves two main tasks: (1) removing the legacy embedded wallet UI from the header and replacing it with a user menu dropdown, and (2) creating a new Subscriptions page with subscription status, billing info, and payment history.

The codebase already has established patterns for all required components. The existing `WalletDropdown` component in the header shows wallet balance and navigation links - this needs to be transformed into a simpler user menu without the prominent wallet display. The dashboard already has Card components, Badge variants, table patterns, and all necessary UI primitives from Radix UI.

The backend already supports payment history via `getSubscriptionsByUserId()` in the subscriptions database layer, but no API endpoint currently exposes this data. A new endpoint will be needed.

**Primary recommendation:** Leverage existing UI components (Card, Badge, DropdownMenu) and established patterns from the codebase. The header changes are straightforward component modifications, while the Subscriptions page follows the same card-based layout pattern used throughout the dashboard.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^15.5.9 | React framework | Already in use, App Router |
| React | ^19.0.0 | UI library | Already in use |
| @tanstack/react-query | ^5.62.7 | Data fetching/caching | Already in use for all API calls |
| lucide-react | ^0.468.0 | Icons | Already in use throughout app |

### UI Components
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dropdown-menu | ^2.1.4 | Dropdown menus | User menu in header |
| @radix-ui/react-tabs | ^1.1.2 | Tab navigation | NOT NEEDED - single page |
| class-variance-authority | ^0.7.1 | Component variants | Status badge variants |
| tailwind-merge | ^2.5.5 | Class merging | All component styling |
| date-fns | ^4.1.0 | Date formatting | Payment history dates |

### Existing Components to Reuse
| Component | Location | Purpose |
|-----------|----------|---------|
| Card, CardHeader, CardTitle, CardContent | `@/components/ui/card` | Page layout cards |
| Badge | `@/components/ui/badge` | Status badges |
| Button | `@/components/ui/button` | CTAs |
| DropdownMenu* | `@/components/ui/dropdown-menu` | Header user menu |

**No new packages needed.** All required functionality exists in the current stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── subscriptions/
│       └── page.tsx              # New Subscriptions page
├── components/
│   ├── navbar.tsx                # Modified header (remove WalletDropdown, add UserMenu)
│   ├── user-menu.tsx             # NEW: Simple user dropdown
│   ├── wallet-dropdown.tsx       # ARCHIVE: Move to /archive folder
│   └── subscriptions/
│       ├── status-card.tsx       # Subscription status display
│       ├── billing-card.tsx      # Billing info (cost, next date)
│       └── payment-history.tsx   # Payment history table
└── lib/
    └── api.ts                    # Add getPaymentHistory() method
```

### Pattern 1: Page Layout with Multiple Cards
**What:** Dashboard pages use a grid of cards for different information sections
**When to use:** Subscriptions page layout
**Example:**
```typescript
// Source: /apps/dashboard/src/app/dashboard/page.tsx pattern
<main className="max-w-7xl mx-auto px-6 pt-24 pb-20">
  {/* Header */}
  <div className="mb-8">
    <h1 className="text-3xl font-bold">Subscriptions</h1>
    <p className="text-muted-foreground mt-1">
      Manage your subscription and view payment history.
    </p>
  </div>

  {/* Cards Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <StatusCard />
    <BillingCard />
  </div>

  {/* Full-width section */}
  <PaymentHistory />
</main>
```

### Pattern 2: Status Badge with Color Variants
**What:** Status indicators with semantic colors
**When to use:** Subscription status display
**Example:**
```typescript
// Source: /apps/dashboard/src/components/rewards/claim-history.tsx
function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    never: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${styles[status as keyof typeof styles]}`}>
      {status}
    </span>
  );
}
```

### Pattern 3: User Menu Dropdown (Header)
**What:** Simple user icon with dropdown menu
**When to use:** Replace WalletDropdown in header
**Example:**
```typescript
// Based on existing WalletDropdown pattern, simplified
<DropdownMenu modal={false}>
  <DropdownMenuTrigger asChild>
    <button className="flex items-center gap-2 text-sm">
      <User className="w-5 h-5" />
      <ChevronDown className="w-3 h-3" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem asChild>
      <Link href="/dashboard">Dashboard</Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <Link href="/subscriptions">Subscriptions</Link>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={signOut}>
      Sign out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Pattern 4: Transaction/Payment History Table
**What:** Table with pagination showing payment records
**When to use:** Payment history display
**Example:**
```typescript
// Source: /apps/dashboard/src/components/transactions-table.tsx pattern
<div className="border rounded-lg overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-muted/50">
      <tr>
        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Transaction</th>
      </tr>
    </thead>
    <tbody>
      {/* Rows */}
    </tbody>
  </table>
</div>
```

### Anti-Patterns to Avoid
- **Creating new UI primitives:** Don't create new Button, Card, or Badge components - use existing ones from `@/components/ui`
- **Inline styling for status colors:** Use the established pattern with style objects for dark/light mode support
- **Fetching in useEffect:** Use `useQuery` from @tanstack/react-query for all data fetching
- **Deleting WalletDropdown:** Archive it instead (users may have funds in Solana wallet)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting | Custom date strings | `date-fns` formatDate | Already used, consistent format |
| Address truncation | Inline slice() | `formatAddress` from utils | Already exported, consistent |
| Status badges | Custom div with classes | Existing StatusBadge pattern | Dark mode support built in |
| Dropdown menus | Custom div visibility | @radix-ui/react-dropdown-menu | Accessibility, animations |
| Data fetching | useState + useEffect | @tanstack/react-query | Caching, loading states |
| Block explorer links | Hardcoded URLs | `getExplorerUrl()` pattern from transactions-table | Multi-chain support |

**Key insight:** The codebase already has solutions for every UI pattern needed. Copy and adapt existing patterns rather than creating new approaches.

## Common Pitfalls

### Pitfall 1: Breaking Mobile Responsiveness
**What goes wrong:** New header components break on mobile (hamburger menu has its own WalletDropdown rendering)
**Why it happens:** Header has separate desktop and mobile sections that both render auth-related components
**How to avoid:** Update BOTH desktop nav section AND mobile menu section in navbar.tsx
**Warning signs:** Test on mobile viewport - if user menu doesn't appear or wallet still shows, mobile section wasn't updated

### Pitfall 2: Forgetting Dark Mode Support
**What goes wrong:** Status badges and cards look wrong in dark mode
**Why it happens:** Using Tailwind colors directly without dark: variants
**How to avoid:** Follow existing StatusBadge pattern with explicit dark mode classes
**Warning signs:** Components look fine in light mode but text/background issues in dark mode

### Pitfall 3: Not Handling "Never Subscribed" State
**What goes wrong:** Page crashes or shows wrong UI for users who never subscribed
**Why it happens:** Assuming subscription data always exists
**How to avoid:** Handle four distinct states: active, pending, inactive/expired, never subscribed
**Warning signs:** `subscription?.tier` is null, no payment history exists

### Pitfall 4: Orphaned Wallet References
**What goes wrong:** Wallet balance or address still displayed somewhere after "removing" wallet UI
**Why it happens:** WalletDropdown is imported in multiple places, API calls for billingWallet still happen
**How to avoid:** Search codebase for all WalletDropdown imports and billingWallet query usage
**Warning signs:** Wallet balance still visible anywhere in header area

## Code Examples

Verified patterns from the codebase:

### User Menu Component (New)
```typescript
// Based on WalletDropdown but simplified
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, LogOut, LayoutDashboard, CreditCard, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/auth/auth-provider';

export function UserMenu() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const isOnDashboard = pathname === '/dashboard';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 focus:outline-none transition-colors">
          <User className="w-5 h-5" />
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isOnDashboard && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="flex items-center">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/subscriptions" className="flex items-center">
            <CreditCard className="w-4 h-4 mr-2" />
            Subscriptions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="flex items-center">
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Subscription Status Display
```typescript
// Four status states per CONTEXT.md decisions
type SubscriptionState = 'active' | 'pending' | 'inactive' | 'never';

function getSubscriptionState(subscription: SubscriptionStatus | null | undefined): SubscriptionState {
  if (!subscription) return 'never';
  if (subscription.active) return 'active';
  // Check if in grace period (pending)
  if (subscription.expires) {
    const expiresDate = new Date(subscription.expires);
    const gracePeriodEnd = new Date(expiresDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    if (new Date() < gracePeriodEnd) return 'pending';
  }
  return 'inactive';
}
```

### Payment History Row with Explorer Link
```typescript
// Source: transactions-table.tsx pattern adapted for subscriptions
function getExplorerUrl(txHash: string, network: string = 'solana'): string {
  // Subscriptions currently use Solana
  return `https://solscan.io/tx/${txHash}`;
}

function truncateTxHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

// In component:
{payment.tx_hash && (
  <a
    href={getExplorerUrl(payment.tx_hash)}
    target="_blank"
    rel="noopener noreferrer"
    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
  >
    <code className="font-mono text-xs">{truncateTxHash(payment.tx_hash)}</code>
    <ExternalLink className="w-3 h-3" />
  </a>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wallet balance in header | User icon + dropdown | This phase | Cleaner header, wallet moved to subscriptions page |
| Single BillingSection component | Dedicated Subscriptions page | This phase | More room for subscription details |

**Deprecated/outdated:**
- WalletDropdown in header: Being archived (not deleted) for Phase 18 multi-chain wallet work

## Open Questions

Things that couldn't be fully resolved:

1. **Payment History API Endpoint**
   - What we know: `getSubscriptionsByUserId()` exists in DB layer
   - What's unclear: No REST endpoint exposes this data yet
   - Recommendation: Create `/api/subscriptions/history` endpoint that returns subscription payments

2. **Failed Payment Tracking**
   - What we know: CONTEXT.md says show failed payments
   - What's unclear: Current schema only tracks successful subscriptions with tx_hash
   - Recommendation: Display subscriptions table as-is (all have tx_hash); failed attempts may need new table in future

3. **Daily Subscription Cost Source**
   - What we know: $5/month is hardcoded as SUBSCRIPTION_PRICING.starter
   - What's unclear: Whether to calculate daily rate or show monthly
   - Recommendation: Show monthly ($5/month) since that's the billing cycle

## Sources

### Primary (HIGH confidence)
- `/apps/dashboard/src/components/navbar.tsx` - Current header implementation
- `/apps/dashboard/src/components/wallet-dropdown.tsx` - Current wallet dropdown to replace
- `/apps/dashboard/src/components/ui/card.tsx` - Card components
- `/apps/dashboard/src/components/ui/dropdown-menu.tsx` - Dropdown components
- `/apps/dashboard/src/components/ui/badge.tsx` - Badge component
- `/apps/dashboard/src/components/transactions-table.tsx` - Table pattern with pagination
- `/apps/dashboard/src/components/rewards/claim-history.tsx` - StatusBadge pattern
- `/apps/dashboard/src/lib/api.ts` - API client with subscription methods
- `/packages/server/src/db/subscriptions.ts` - Subscription database layer
- `/packages/server/src/routes/subscriptions.ts` - Subscription API routes

### Secondary (MEDIUM confidence)
- `/apps/dashboard/src/components/billing-section.tsx` - Existing billing display (simpler version)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified in package.json
- Architecture: HIGH - Patterns directly copied from existing codebase
- Pitfalls: HIGH - Based on actual code structure analysis

**Research date:** 2026-01-22
**Valid until:** 60 days (stable internal codebase)
