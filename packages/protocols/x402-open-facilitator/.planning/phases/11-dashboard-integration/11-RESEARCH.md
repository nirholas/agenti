# Phase 11: Dashboard Integration - Research

**Researched:** 2026-01-20
**Domain:** React/Next.js Dashboard Navigation & Tabbed UI Integration
**Confidence:** HIGH

## Summary

This phase integrates the complete rewards program (built in phases 3-10) into the existing OpenFacilitator dashboard. The codebase analysis reveals:

1. **All rewards components exist** - Progress dashboard, address management, claim flow, and history views are complete and functional
2. **Navigation needs modification** - The current WalletDropdown shows Dashboard link; Settings submenu does not exist yet
3. **No Tabs component** - Despite having `@radix-ui/react-tabs` installed, no UI wrapper exists; one must be created

**Primary recommendation:** Create a new `/rewards` page with tabbed interface (Progress, Addresses, History), add "Rewards" to WalletDropdown with claimable badge, and create a landing page for non-enrolled users.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-tabs | 1.1.2 | Accessible tabbed interface | Project already uses Radix UI for all primitives |
| lucide-react | 0.468.0 | Icons (Trophy, Gift, etc.) | Already project standard |
| @tanstack/react-query | 5.62.7 | Data fetching and caching | Already used for all API calls |
| class-variance-authority | 0.7.1 | Component variants | Already used for badges, buttons |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwind-merge | 2.5.5 | Merge Tailwind classes | Already via `cn()` utility |
| date-fns | 4.1.0 | Date formatting | Already used in history components |
| canvas-confetti | 1.9.4 | Celebration effects | Available for claim success |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom tabs | Radix Tabs | Already have Radix installed, use it |
| New navigation system | Extend WalletDropdown | Keep navigation minimal per user decision |

**Installation:**
No new packages needed - all dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
apps/dashboard/src/
├── app/
│   └── rewards/
│       └── page.tsx           # Main rewards page (routing logic)
├── components/
│   ├── ui/
│   │   └── tabs.tsx           # NEW: Radix Tabs wrapper
│   └── rewards/
│       ├── landing-page.tsx   # NEW: Non-enrolled user view
│       ├── rewards-dashboard.tsx  # NEW: Tabbed container for enrolled users
│       ├── progress-tab.tsx   # NEW: Progress tab content (wraps existing)
│       ├── addresses-tab.tsx  # NEW: Addresses tab content (wraps existing)
│       ├── history-tab.tsx    # NEW: Combined history tab
│       ├── progress-dashboard.tsx  # EXISTING: Reuse with modifications
│       ├── address-list.tsx        # EXISTING: Reuse as-is
│       ├── claim-history.tsx       # EXISTING: Reuse as-is
│       └── enrollment-modal.tsx    # EXISTING: Reuse as-is
```

### Pattern 1: Conditional Page Rendering
**What:** Page renders landing page or tabbed dashboard based on enrollment status
**When to use:** Root rewards page needs to handle enrolled vs non-enrolled state
**Example:**
```typescript
// Source: Pattern from existing rewards-info-banner.tsx
export default function RewardsPage() {
  const { isEnrolled, isLoading } = useAuth();

  if (isLoading) return <LoadingSkeleton />;

  if (!isEnrolled) {
    return <RewardsLandingPage />;
  }

  return <RewardsDashboard />;
}
```

### Pattern 2: Tabbed Interface with URL State
**What:** Tabs sync with URL for shareable links and browser history
**When to use:** Multi-view interfaces where users might want to link to specific tabs
**Example:**
```typescript
// Source: Standard Next.js pattern
'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function RewardsDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') || 'progress';

  const handleTabChange = (value: string) => {
    router.push(`/rewards?tab=${value}`, { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="progress">Progress</TabsTrigger>
        <TabsTrigger value="addresses">Addresses</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      {/* Tab contents */}
    </Tabs>
  );
}
```

### Pattern 3: Badge with API-Driven State
**What:** Navigation badge shows when rewards are claimable
**When to use:** Persistent notification that updates based on server state
**Example:**
```typescript
// Source: Derived from existing useAuth pattern
// Add to AuthProvider - fetch includes claimable status
interface RewardsStatus {
  isEnrolled: boolean;
  isFacilitatorOwner: boolean;
  hasClaimable: boolean;  // NEW: true when pending claims exist
}

// In WalletDropdown, show badge conditionally
{hasClaimable && (
  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
)}
```

### Anti-Patterns to Avoid
- **Creating Settings page:** User decided rewards lives in WalletDropdown as "Rewards" link, NOT a full Settings page
- **Separating claims tab:** User decided claim button is on Progress tab when eligible, NOT a separate Claims tab
- **Making landing page accessible after enrollment:** Per Claude's discretion, keep it simple - once enrolled, no need to see landing page

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tabbed interface | Custom div switching | Radix Tabs | Accessibility, keyboard nav, ARIA |
| Notification badge | Custom polling | Extend existing getRewardsStatus API | Already fetched on auth |
| Enrollment check | New API call | useAuth().isEnrolled | Already available in context |
| Claim eligibility | Client-side logic | api.getClaimEligibility() | Already implemented |

**Key insight:** Most functionality already exists. This phase is reorganization and UI polish, not new features.

## Common Pitfalls

### Pitfall 1: Duplicate Data Fetching
**What goes wrong:** Each tab component fetches its own data independently, causing unnecessary API calls
**Why it happens:** Components written in isolation without considering shared data
**How to avoid:** Lift data fetching to RewardsDashboard container, pass as props to tabs
**Warning signs:** Multiple loading spinners, data inconsistency between tabs

### Pitfall 2: Enrollment Modal State Leak
**What goes wrong:** Opening enrollment modal from landing page doesn't properly update isEnrolled state
**Why it happens:** Modal manages local state but auth context not refreshed
**How to avoid:** Modal already calls refetchRewardsStatus() on success - ensure page responds to context change
**Warning signs:** User enrolls but stays on landing page

### Pitfall 3: Badge State Staleness
**What goes wrong:** Badge shows "claimable" but user already claimed
**Why it happens:** Badge state cached, not invalidated after claim
**How to avoid:** Invalidate relevant queries after claim success (already done via queryClient.invalidateQueries)
**Warning signs:** Badge persists after claiming

### Pitfall 4: Tab State Lost on Navigation
**What goes wrong:** User clicks away and returns to rewards, tab resets to Progress
**Why it happens:** Tab state stored only in component state, not URL
**How to avoid:** Use URL query param for tab state as shown in Pattern 2
**Warning signs:** Users losing their place in the interface

## Code Examples

Verified patterns from existing codebase:

### Creating Radix Tabs UI Component
```typescript
// Source: Standard shadcn/ui pattern matching existing components
// File: apps/dashboard/src/components/ui/tabs.tsx
'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

### Adding Rewards Link to WalletDropdown
```typescript
// Source: Existing WalletDropdown pattern (wallet-dropdown.tsx line 85-98)
// Add after Dashboard link, before Billing Wallet section
{isAuthenticated && (
  <>
    <div className="border-t border-border" />
    <div className="p-2">
      <Link
        href="/rewards"
        className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted/50 transition-colors relative"
      >
        <Trophy className="w-4 h-4 shrink-0" />
        Rewards
        {hasClaimable && (
          <span className="absolute right-3 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </Link>
    </div>
  </>
)}
```

### Landing Page Structure
```typescript
// Source: Derived from existing page patterns
// Professional/clean tone per user decision
export function RewardsLandingPage({ onEnroll }: { onEnroll: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold tracking-tight">
          Get Rewarded for Using OpenFacilitator
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your payment volume and earn $OPEN tokens.
        </p>
      </div>

      {/* Progress Preview - shows sample bar per user decision */}
      <Card className="mb-8">
        <CardContent className="py-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Your Reward Journey
          </h3>
          <ProgressBar current="500000000" threshold="1000000000" />
          <p className="text-xs text-muted-foreground mt-2">
            Example: $500 of $1,000 threshold
          </p>
        </CardContent>
      </Card>

      {/* Expandable details per user decision */}
      <Collapsible>
        <CollapsibleTrigger className="text-sm text-muted-foreground">
          How are rewards calculated?
        </CollapsibleTrigger>
        <CollapsibleContent>
          {/* Calculation details */}
        </CollapsibleContent>
      </Collapsible>

      <Button onClick={onEnroll} className="w-full mt-8">
        Get Started
      </Button>
    </div>
  );
}
```

## Existing Components to Reuse

| Component | Location | Use For | Modifications Needed |
|-----------|----------|---------|---------------------|
| ProgressDashboard | `rewards/progress-dashboard.tsx` | Progress tab | Extract from current page, minimal changes |
| AddressList | `rewards/address-list.tsx` | Addresses tab | None - use as-is |
| ClaimHistory | `rewards/claim-history.tsx` | History tab | None - use as-is |
| CampaignHistory | `campaigns/campaign-history.tsx` | History tab | None - combine with ClaimHistory |
| EnrollmentModal | `rewards/enrollment-modal.tsx` | Landing page enrollment | None - use as-is |
| ProgressBar | `rewards/progress-bar.tsx` | Landing page preview | None - use as-is |

## Existing APIs to Use

| API Method | Purpose | Used For |
|------------|---------|----------|
| api.getRewardsStatus() | Enrollment + addresses | Auth context, badge state |
| api.getActiveCampaign() | Current campaign data | Progress tab |
| api.getRewardsVolume(campaignId) | User's volume | Progress tab |
| api.getVolumeBreakdown(campaignId) | Per-address breakdown | Progress tab |
| api.getCampaignHistory() | Past campaigns | History tab |
| api.getClaimHistory() | Past claims | History tab |
| api.getMyClaim(campaignId) | Current claim status | Progress tab claim button |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate /rewards page with all views | Tabbed interface within rewards | This phase | Better organization |
| RewardsInfoBanner on dashboard | Dedicated rewards section in nav | This phase | Cleaner dashboard |
| Ad-hoc enrollment flow | Structured landing page | This phase | Better onboarding |

**Deprecated/outdated:**
- RewardsInfoBanner: Will remain for now but rewards entry point moves to nav

## Open Questions

Things that couldn't be fully resolved:

1. **Badge Animation Details**
   - What we know: Show badge when claimable, persist until claimed
   - What's unclear: Exact animation style (pulse? glow? static?)
   - Recommendation: Start with subtle pulse animation, iterate based on feedback

2. **Landing Page After Enrollment**
   - What we know: User deferred to Claude's discretion
   - What's unclear: Should there be any way to view it?
   - Recommendation: No access after enrollment - keeps UI simpler

3. **Mobile Tab Layout**
   - What we know: Three tabs (Progress, Addresses, History)
   - What's unclear: How tabs behave on very small screens
   - Recommendation: Full-width tabs with shorter labels if needed

## Sources

### Primary (HIGH confidence)
- Codebase analysis of existing components
- apps/dashboard/src/components/rewards/*.tsx - All existing implementations
- apps/dashboard/src/components/navbar.tsx - Current navigation
- apps/dashboard/src/components/wallet-dropdown.tsx - Settings location
- apps/dashboard/src/lib/api.ts - All available API methods
- apps/dashboard/src/components/auth/auth-provider.tsx - Auth context structure

### Secondary (MEDIUM confidence)
- @radix-ui/react-tabs package documentation
- shadcn/ui tabs component pattern (standard implementation)

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages already installed and used
- Architecture: HIGH - follows existing patterns in codebase
- Pitfalls: HIGH - based on direct code analysis
- API coverage: HIGH - all APIs verified in api.ts

**Research date:** 2026-01-20
**Valid until:** 60 days (stable codebase patterns)
