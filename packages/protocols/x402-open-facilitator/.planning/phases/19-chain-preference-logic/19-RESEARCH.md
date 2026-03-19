# Phase 19: Chain Preference Logic - Research

**Researched:** 2026-01-22
**Domain:** User preference UI (toggle component), preference persistence (database + optimistic updates), payment fallback logic
**Confidence:** HIGH

## Summary

Chain preference logic requires three distinct technical domains: (1) a toggle UI component for user selection, (2) a persistence strategy for storing and retrieving the preference across sessions, and (3) fallback logic that attempts the alternate chain when the preferred chain has insufficient funds. The standard approach uses Radix UI Switch (already installed) styled as an iOS-style toggle, persists preferences to the database via API with optimistic UI updates for instant feedback, and implements fallback as a sequential attempt pattern (try preferred → if insufficient, try alternate → if both fail, enter grace period).

**Key technical decisions:**
- Radix UI Switch component (already in dependencies) styled with Tailwind for iOS appearance
- Database persistence via API endpoint (preference stored with user subscription record)
- Optimistic UI with React's useOptimistic or TanStack Query's optimistic update pattern
- Fallback logic in recurring payment engine (Phase 20) uses balance check → attempt → fallback sequence
- Preference defaults determined by payment history query on initial load

**Primary recommendation:** Store preference server-side (database) with optimistic client updates for instant UI feedback. Use Radix Switch component with custom Tailwind styling between wallet cards. Implement fallback as sequential chain attempts in payment processing logic.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-switch | ^1.2.6 | Toggle component | Already installed, accessible, unstyled primitive perfect for custom iOS styling |
| @tanstack/react-query | ^5.62.7 | State management + optimistic updates | Already in use, built-in optimistic update support via `useMutation` |
| Tailwind CSS | ^3.4.16 | Toggle styling | Already in use, can create iOS-style appearance with utility classes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React useOptimistic | React 19 built-in | Optimistic state updates | Alternative to TanStack Query for simpler optimistic UI (React 19+ only) |
| clsx / cn utility | ^2.1.1 | Conditional styling | Already in use via lib/utils, for toggle state styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Database persistence | localStorage only | localStorage loses cross-device sync, doesn't work in SSR, less reliable for payment logic |
| Radix Switch | Custom checkbox + styling | Radix provides accessibility, keyboard nav, form integration for free |
| Optimistic updates | Loading state only | Optimistic feels instant, loading states feel slow for simple preferences |
| Sequential fallback | Parallel attempts | Sequential is safer (avoids double-charge risk), clearer to debug, respects preference order |

**Installation:**
```bash
# All dependencies already installed
# No additional packages needed
```

## Architecture Patterns

### Recommended Component Structure
```
apps/dashboard/src/components/subscriptions/
├── wallet-cards.tsx           # Existing container
├── wallet-card.tsx            # Existing individual card
├── chain-preference-toggle.tsx  # NEW: Toggle component
└── hooks/
    └── use-chain-preference.ts  # NEW: Preference logic hook
```

### Pattern 1: iOS-Style Radix Switch with Tailwind
**What:** Use Radix Switch primitive with custom Tailwind classes to create iOS-style toggle appearance
**When to use:** User-facing preference toggles that need accessibility and custom styling
**Example:**
```typescript
// Source: Radix UI Switch docs + Tailwind styling patterns
// apps/dashboard/src/components/subscriptions/chain-preference-toggle.tsx

import * as Switch from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

interface ChainPreferenceToggleProps {
  preference: 'base' | 'solana';
  onChange: (chain: 'base' | 'solana') => void;
  disabled?: boolean;
}

export function ChainPreferenceToggle({
  preference,
  onChange,
  disabled
}: ChainPreferenceToggleProps) {
  const isBase = preference === 'base';

  return (
    <div className="flex flex-col items-center gap-2">
      <label className="text-sm font-medium text-muted-foreground">
        Preferred Chain
      </label>

      <div className="flex items-center gap-3">
        <span className={cn(
          'text-sm font-medium transition-colors',
          isBase ? 'text-foreground' : 'text-muted-foreground'
        )}>
          Base
        </span>

        <Switch.Root
          checked={!isBase} // Solana = checked
          onCheckedChange={(checked) => onChange(checked ? 'solana' : 'base')}
          disabled={disabled}
          className={cn(
            'relative h-7 w-14 rounded-full transition-colors',
            'bg-blue-500 data-[state=checked]:bg-purple-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Switch.Thumb
            className={cn(
              'block h-5 w-5 rounded-full bg-white shadow-lg',
              'transition-transform duration-200',
              'translate-x-1 data-[state=checked]:translate-x-8'
            )}
          />
        </Switch.Root>

        <span className={cn(
          'text-sm font-medium transition-colors',
          !isBase ? 'text-foreground' : 'text-muted-foreground'
        )}>
          Solana
        </span>
      </div>
    </div>
  );
}
```

### Pattern 2: Optimistic Updates with TanStack Query
**What:** Update UI immediately, persist to server in background, rollback on error
**When to use:** User preferences that should feel instant but need server persistence
**Example:**
```typescript
// Source: TanStack Query optimistic updates pattern
// apps/dashboard/src/components/subscriptions/hooks/use-chain-preference.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function useChainPreference() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (chain: 'base' | 'solana') =>
      api.updateChainPreference(chain),

    // Optimistic update - runs immediately
    onMutate: async (newChain) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['subscription'] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['subscription']);

      // Optimistically update
      queryClient.setQueryData(['subscription'], (old: any) => ({
        ...old,
        preferredChain: newChain,
      }));

      return { previousData };
    },

    // Rollback on error
    onError: (err, newChain, context) => {
      queryClient.setQueryData(['subscription'], context?.previousData);
      toast({
        title: 'Failed to update preference',
        description: 'Your preference could not be saved. Please try again.',
        variant: 'destructive',
      });
    },

    // Refetch on success to ensure consistency
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  return {
    updatePreference: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
```

### Pattern 3: Default Chain Logic from Payment History
**What:** Determine initial preference based on user's payment history
**When to use:** First-time preference initialization before user makes explicit choice
**Example:**
```typescript
// Source: Business logic from CONTEXT.md requirements
// apps/dashboard/src/lib/chain-preference-defaults.ts

import type { SubscriptionPayment, SubscriptionWallet } from '@/lib/api';

export function getDefaultChainPreference(
  payments: SubscriptionPayment[],
  wallets: SubscriptionWallet[]
): 'base' | 'solana' {
  // Rule 1: Most recent payment chain
  if (payments.length > 0) {
    const mostRecent = payments.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    return mostRecent.chain === 'base' ? 'base' : 'solana';
  }

  // Rule 2: Highest balance wallet
  const baseWallet = wallets.find(w => w.network === 'base');
  const solanaWallet = wallets.find(w => w.network === 'solana');

  const baseBalance = baseWallet ? parseFloat(baseWallet.balance) : 0;
  const solanaBalance = solanaWallet ? parseFloat(solanaWallet.balance) : 0;

  if (baseBalance > solanaBalance) return 'base';
  if (solanaBalance > baseBalance) return 'solana';

  // Rule 3: Both empty, default to Solana
  return 'solana';
}
```

### Pattern 4: Fallback Logic Structure (for Phase 20)
**What:** Sequential attempt pattern with balance pre-check and fallback
**When to use:** Recurring payment processing with multi-chain support
**Example:**
```typescript
// Source: Fallback pattern from crypto payment systems research
// Reference for Phase 20 implementation
// This pattern goes in the recurring payment engine

async function processSubscriptionPayment(
  userId: string,
  amount: string,
  preferredChain: 'base' | 'solana'
): Promise<{
  success: boolean;
  chainUsed: 'base' | 'solana' | null;
  txHash?: string;
  error?: string;
}> {
  const alternateChain = preferredChain === 'base' ? 'solana' : 'base';

  // Try preferred chain first
  const preferredResult = await attemptPayment(userId, amount, preferredChain);

  if (preferredResult.success) {
    return {
      success: true,
      chainUsed: preferredChain,
      txHash: preferredResult.txHash,
    };
  }

  // If preferred failed due to insufficient balance, try alternate
  if (preferredResult.insufficientBalance) {
    const alternateResult = await attemptPayment(userId, amount, alternateChain);

    if (alternateResult.success) {
      // Note: preference is NOT changed, this is just a fallback
      return {
        success: true,
        chainUsed: alternateChain,
        txHash: alternateResult.txHash,
      };
    }
  }

  // Both failed - enter grace period
  return {
    success: false,
    chainUsed: null,
    error: 'Insufficient balance on both chains',
  };
}

async function attemptPayment(
  userId: string,
  amount: string,
  chain: 'base' | 'solana'
): Promise<{
  success: boolean;
  insufficientBalance?: boolean;
  txHash?: string;
  error?: string;
}> {
  // 1. Check balance first (avoid unnecessary transaction attempts)
  const balance = await getWalletBalance(userId, chain);
  const required = parseFloat(amount);

  if (balance < required) {
    return { success: false, insufficientBalance: true };
  }

  // 2. Attempt transaction
  try {
    const txHash = await executePayment(userId, amount, chain);
    return { success: true, txHash };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### Anti-Patterns to Avoid
- **Parallel chain attempts:** Risk of double-charging, harder to debug, violates preference priority
- **Client-side only storage:** Preference gets lost across devices, can't inform server-side payment logic
- **Loading spinners for preference toggle:** Breaks instant feedback, feels slow for simple UI action
- **Changing preference on fallback:** User explicitly chose preferred chain, fallback is temporary exception
- **No balance pre-check:** Wastes gas fees attempting doomed transactions

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toggle component | Custom checkbox + state | Radix UI Switch | Accessibility (ARIA, keyboard nav), form integration, reduced state, battle-tested |
| Optimistic updates | Manual state + rollback logic | TanStack Query useMutation | Built-in optimistic update support, automatic rollback, request deduplication |
| Default preference logic | Inline conditionals | Separate pure function | Testable, reusable, clearer business logic, easier to modify rules |
| iOS-style toggle animation | Custom CSS keyframes | Tailwind transition utilities + Radix data attributes | Simpler, consistent with existing codebase, less CSS to maintain |
| Preference caching | Manual cache management | TanStack Query cache | Automatic cache invalidation, stale-while-revalidate, background refetching |

**Key insight:** User preferences are a solved problem in React - use TanStack Query's optimistic updates and Radix's accessible primitives rather than custom state management and components.

## Common Pitfalls

### Pitfall 1: Radix Switch Client-Side Only (Next.js SSR)
**What goes wrong:** "document is not defined" error or hydration mismatch when using Switch during SSR
**Why it happens:** Radix Switch uses browser APIs, Next.js renders on server where these don't exist
**How to avoid:** Mark component as 'use client' directive at top of file
**Warning signs:** Errors mentioning "document," "window," or hydration mismatches
**Code example:**
```typescript
// WRONG - Missing 'use client'
import * as Switch from '@radix-ui/react-switch';

export function ChainPreferenceToggle() {
  // This will error during SSR
  return <Switch.Root>...</Switch.Root>;
}

// CORRECT - Client component directive
'use client';

import * as Switch from '@radix-ui/react-switch';

export function ChainPreferenceToggle() {
  return <Switch.Root>...</Switch.Root>;
}
```

### Pitfall 2: Optimistic Update Race Conditions
**What goes wrong:** Multiple rapid toggles cause inconsistent state or wrong final value
**Why it happens:** User clicks toggle multiple times before first request completes
**How to avoid:** Disable toggle during mutation, or use TanStack Query's automatic request cancellation
**Warning signs:** Preference "flips back" to wrong value, inconsistent state after rapid clicks
**Code example:**
```typescript
// WRONG - No protection against rapid clicks
function MyComponent() {
  const { updatePreference } = useChainPreference();

  return (
    <ChainPreferenceToggle
      onChange={updatePreference}
      // No disabled state
    />
  );
}

// CORRECT - Disable during update
function MyComponent() {
  const { updatePreference, isUpdating } = useChainPreference();

  return (
    <ChainPreferenceToggle
      onChange={updatePreference}
      disabled={isUpdating} // Prevents race conditions
    />
  );
}
```

### Pitfall 3: Missing Fallback Error Handling
**What goes wrong:** Payment fails silently, user unaware that fallback was used or both chains failed
**Why it happens:** No UI feedback after fallback payment attempt
**How to avoid:** Log which chain was used in payment history, show notification only on total failure
**Warning signs:** Users confused about why payment came from unexpected chain
**Code example:**
```typescript
// WRONG - No feedback about fallback
async function processPayment(userId: string, preferred: string) {
  const result = await attemptPayment(userId, preferred);
  if (!result.success) {
    await attemptPayment(userId, alternate); // Silent fallback
  }
}

// CORRECT - Record chain used, notify on failure
async function processPayment(userId: string, preferred: string) {
  const result = await attemptPayment(userId, preferred);

  if (!result.success) {
    const fallbackResult = await attemptPayment(userId, alternate);

    if (fallbackResult.success) {
      // Record that fallback was used
      await recordPayment({
        chainUsed: alternate,
        chainPreferred: preferred,
        wasFallback: true,
      });
      return { success: true };
    }

    // Both failed - notify user
    await notifyPaymentFailure(userId);
    await enterGracePeriod(userId);
    return { success: false };
  }

  return { success: true };
}
```

### Pitfall 4: Persisting Preference Before Wallets Exist
**What goes wrong:** User sets preference before creating wallet for that chain, preference becomes invalid
**Why it happens:** Toggle is active before wallet creation, or wallet deletion doesn't reset preference
**How to avoid:** Only enable toggle when both wallets exist, reset to default if preferred wallet deleted
**Warning signs:** Payment fails because preferred chain has no wallet despite valid preference
**Code example:**
```typescript
// WRONG - Allow preference for non-existent wallets
function WalletCards() {
  const wallets = useSubscriptionWallets();
  const preference = useChainPreference();

  return (
    <>
      <ChainPreferenceToggle {...preference} /> {/* Always enabled */}
      <WalletCard network="base" wallet={wallets.base} />
      <WalletCard network="solana" wallet={wallets.solana} />
    </>
  );
}

// CORRECT - Only enable when both wallets exist
function WalletCards() {
  const wallets = useSubscriptionWallets();
  const preference = useChainPreference();

  const bothWalletsExist = wallets.base && wallets.solana;

  return (
    <>
      {bothWalletsExist ? (
        <ChainPreferenceToggle {...preference} />
      ) : (
        <div className="text-sm text-muted-foreground text-center">
          Create both wallets to set preference
        </div>
      )}
      <WalletCard network="base" wallet={wallets.base} />
      <WalletCard network="solana" wallet={wallets.solana} />
    </>
  );
}
```

### Pitfall 5: Not Showing Current Preference Indicator
**What goes wrong:** User forgets their preference, can't tell which chain will be used for next payment
**Why it happens:** Toggle exists but preference is only visible in toggle state (not clear)
**How to avoid:** Add subtle indicator in payment history or next payment preview
**Warning signs:** Users ask "which chain will be charged?" despite toggle being visible
**Code example:**
```typescript
// Consider adding preference indicator in relevant places
function NextPaymentPreview() {
  const { preference } = useChainPreference();

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-medium">Next Payment</h3>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Will attempt</span>
        <span className="font-medium text-foreground">
          {preference === 'base' ? 'Base' : 'Solana'}
        </span>
        <span>first</span>
      </div>
    </div>
  );
}
```

## Code Examples

Verified patterns from official sources:

### Radix Switch Basic Usage
```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/switch
import * as Switch from '@radix-ui/react-switch';

function SwitchDemo() {
  return (
    <form>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <label htmlFor="airplane-mode" style={{ paddingRight: 15 }}>
          Airplane mode
        </label>
        <Switch.Root id="airplane-mode">
          <Switch.Thumb />
        </Switch.Root>
      </div>
    </form>
  );
}
```

### TanStack Query Optimistic Updates
```typescript
// Source: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
import { useMutation, useQueryClient } from '@tanstack/react-query';

function App() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateTodo,
    onMutate: async (newTodo) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // Snapshot the previous value
      const previousTodos = queryClient.getQueryData(['todos']);

      // Optimistically update to the new value
      queryClient.setQueryData(['todos'], (old) => [...old, newTodo]);

      // Return a context object with the snapshotted value
      return { previousTodos };
    },
    onError: (err, newTodo, context) => {
      // Rollback to previous value on error
      queryClient.setQueryData(['todos'], context.previousTodos);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  return <div>...</div>;
}
```

### Tailwind iOS-Style Toggle Styling
```typescript
// Source: Tailwind utility patterns + iOS design system
// Complete working example with iOS appearance

'use client';

import * as Switch from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export function IOSStyleSwitch({
  checked,
  onCheckedChange,
  disabled,
  leftLabel,
  rightLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'text-sm font-medium transition-colors duration-200',
          !checked ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {leftLabel}
      </span>

      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-8 w-14 items-center rounded-full',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Colors match chain branding
          checked ? 'bg-purple-500' : 'bg-blue-500'
        )}
      >
        <Switch.Thumb
          className={cn(
            'pointer-events-none block h-6 w-6 rounded-full',
            'bg-white shadow-lg ring-0',
            'transition-transform duration-200 ease-in-out',
            // iOS-style offset from edges
            checked ? 'translate-x-7' : 'translate-x-1'
          )}
        />
      </Switch.Root>

      <span
        className={cn(
          'text-sm font-medium transition-colors duration-200',
          checked ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {rightLabel}
      </span>
    </div>
  );
}
```

### Pure Function for Default Preference Logic
```typescript
// Source: Business requirements from CONTEXT.md
// Testable, reusable preference determination

export function determineDefaultPreference(params: {
  payments: Array<{ chain: string; date: string }>;
  baseBalance: number;
  solanaBalance: number;
}): 'base' | 'solana' {
  const { payments, baseBalance, solanaBalance } = params;

  // Priority 1: Most recent payment chain
  if (payments.length > 0) {
    const sorted = [...payments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const mostRecentChain = sorted[0].chain.toLowerCase();
    if (mostRecentChain === 'base' || mostRecentChain === 'solana') {
      return mostRecentChain as 'base' | 'solana';
    }
  }

  // Priority 2: Highest balance
  if (baseBalance > solanaBalance) return 'base';
  if (solanaBalance > baseBalance) return 'solana';

  // Priority 3: Default to Solana
  return 'solana';
}

// Example usage with tests
describe('determineDefaultPreference', () => {
  it('prefers most recent payment chain', () => {
    const result = determineDefaultPreference({
      payments: [
        { chain: 'base', date: '2026-01-20' },
        { chain: 'solana', date: '2026-01-15' },
      ],
      baseBalance: 100,
      solanaBalance: 200,
    });
    expect(result).toBe('base'); // Most recent wins despite lower balance
  });

  it('prefers highest balance when no payment history', () => {
    const result = determineDefaultPreference({
      payments: [],
      baseBalance: 50,
      solanaBalance: 100,
    });
    expect(result).toBe('solana');
  });

  it('defaults to Solana when both balances are zero', () => {
    const result = determineDefaultPreference({
      payments: [],
      baseBalance: 0,
      solanaBalance: 0,
    });
    expect(result).toBe('solana');
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for preferences | Database + optimistic UI | 2023-2024 | Cross-device sync, SSR compatibility, server-side payment logic access |
| Loading spinners for updates | Optimistic updates | 2023-2024 | Instant perceived performance, better UX, React 19 useOptimistic hook |
| Custom toggle components | Radix UI primitives | 2022-2023 | Accessibility by default, less maintenance, consistent behavior |
| Redux for simple preferences | TanStack Query or lightweight state | 2023-2024 | Less boilerplate, built-in async handling, simpler code |
| Parallel payment attempts | Sequential with fallback | 2024-2025 | Safer (no double-charge), respects preference order, clearer logging |

**Deprecated/outdated:**
- **localStorage-only preferences:** Can't inform server-side logic, lost across devices, SSR incompatible
- **Custom checkbox for toggles:** Accessibility is hard to get right, Radix is standard now
- **Redux for simple UI state:** TanStack Query or Zustand are lighter, more appropriate for preferences
- **No optimistic updates:** Modern users expect instant feedback, loading states feel dated

**Important note on versions:**
- Project uses Radix UI Switch v1.2.6 (current stable)
- TanStack Query v5.62.7 (latest, includes improved optimistic updates)
- React 19 (includes useOptimistic hook, but TanStack Query pattern works for all React versions)

## Open Questions

Things that couldn't be fully resolved:

1. **API Endpoint Design**
   - What we know: Need `/api/subscription/preference` endpoint to persist choice
   - What's unclear: Whether to add preference field to existing subscription record or create separate preference table
   - Recommendation: Add `preferred_chain` column to user subscription record (simpler, co-located with payment data)

2. **Preference During Grace Period**
   - What we know: Users can change preference anytime including grace period
   - What's unclear: Whether to show special messaging during grace period about preference taking effect on next successful payment
   - Recommendation: Show preference normally, add helper text "will be used for next payment attempt" if in grace period

3. **Analytics/Tracking**
   - What we know: Need to track fallback occurrences for product insights
   - What's unclear: Whether to add analytics events or rely on payment history records
   - Recommendation: Record `chain_used` and `chain_preferred` in payment history, allows query-based analytics without adding analytics system

4. **Toggle Placement on Mobile**
   - What we know: Toggle goes between wallet cards on desktop
   - What's unclear: Exact responsive behavior on mobile (cards stack vertically)
   - Recommendation: Place toggle above both cards on mobile, between cards on desktop (centered visually)

## Sources

### Primary (HIGH confidence)
- [Radix UI Switch Documentation](https://www.radix-ui.com/primitives/docs/components/switch) - Official component API and usage
- [TanStack Query Optimistic Updates Guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) - Official optimistic update pattern
- [React useOptimistic Hook](https://react.dev/reference/react/useOptimistic) - Official React 19 optimistic state
- [React Managing State Guide](https://react.dev/learn/managing-state) - Official state management best practices

### Secondary (MEDIUM confidence)
- [React State Management in 2025: What You Actually Need](https://www.developerway.com/posts/react-state-management-2025) - Modern state management trends
- [Designing for Failure: Building Reliable Crypto Payments with Provider Failover](https://dev.to/easyclick/designing-for-failure-building-reliable-crypto-to-utility-payments-with-provider-failover-3jck) - Fallback logic patterns for crypto payments
- [LocalStorage in React](https://www.robinwieruch.de/local-storage-react/) - LocalStorage vs API persistence tradeoffs
- [Using localStorage with Next.js](https://www.swhabitation.com/blogs/how-to-use-localstorage-with-nextjs) - Next.js SSR considerations
- [How We Store User Prefs in Local Storage Using Hooks in Next.js](https://hackernoon.com/how-we-store-user-prefs-in-local-storage-using-hooks-in-nextjs) - Next.js preference patterns
- [Understanding Optimistic UI and React's useOptimistic Hook](https://blog.logrocket.com/understanding-optimistic-ui-react-useoptimistic-hook/) - Optimistic UI implementation details

### Tertiary (LOW confidence)
- [Build UI Advanced Radix UI - Animated Switch](https://buildui.com/courses/advanced-radix-ui/animated-switch) - Advanced styling examples
- [AlignUI Switch Component](https://alignui.com/docs/v1.2/ui/switch) - Pre-styled Radix switch variations
- [7 Top React State Management Libraries in 2026](https://trio.dev/7-top-react-state-management-libraries/) - State management landscape overview

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project dependencies, official docs available
- Architecture: HIGH - Patterns verified against official docs, existing codebase uses similar approaches
- Pitfalls: HIGH - Common issues documented in React/Next.js community, SSR pitfalls well-known
- Fallback logic: MEDIUM - Pattern from crypto payment systems article (recent but not official library docs)
- Default preference logic: HIGH - Pure business logic from user-provided requirements

**Research date:** 2026-01-22
**Valid until:** ~90 days (stable domain, preference UI patterns evolve slowly)

**Key dependencies verified:**
- @radix-ui/react-switch: ^1.2.6 (installed, current)
- @tanstack/react-query: ^5.62.7 (installed, current)
- Tailwind CSS: ^3.4.16 (installed, current)
- React: 19.0.0 (installed, includes useOptimistic)

**API Design Recommendation:**
```typescript
// Suggested API additions for Phase 19

// GET /api/subscription/preference
// Response: { preferredChain: 'base' | 'solana' }

// PUT /api/subscription/preference
// Body: { preferredChain: 'base' | 'solana' }
// Response: { preferredChain: 'base' | 'solana', updated: boolean }

// The preference should be stored in subscription record:
// ALTER TABLE subscriptions ADD COLUMN preferred_chain VARCHAR(10) DEFAULT 'solana';
```
