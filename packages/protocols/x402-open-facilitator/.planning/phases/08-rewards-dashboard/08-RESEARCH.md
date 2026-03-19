# Phase 8: Rewards Dashboard - Research

**Researched:** 2026-01-20
**Domain:** Dashboard UI for volume progress, reward estimates, and campaign timing
**Confidence:** HIGH

## Summary

Phase 8 builds the user-facing rewards dashboard that displays progress toward earning rewards. The existing codebase provides all necessary infrastructure and data:

1. **Volume APIs exist** - `getUserTotalVolume()` returns snapshot + live delta volume for any user/campaign
2. **Campaign APIs exist** - `getActiveCampaign()`, `getCampaignById()`, campaign stats endpoints
3. **Auth context has multiplier info** - `isFacilitatorOwner` is already exposed in `useAuth()`
4. **UI components established** - Card, Badge, all Radix primitives, tailwind styling patterns
5. **Campaign rules component exists** - `CampaignRules` already shows threshold status and worked example
6. **Formatting utilities exist** - `formatUSDC()` helper for atomic unit conversion

The existing `CampaignRules` component already implements most of the dashboard functionality. This phase refactors it to match CONTEXT.md specifications: progress bar as hero element, motivational messaging, address breakdown, and conditional displays based on campaign state.

**Primary recommendation:** Refactor the existing `CampaignRules` component into a dedicated `ProgressDashboard` component that follows the hero progress bar layout. Add a new API endpoint for per-address volume breakdown. Leverage all existing patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.62.7 | Data fetching | Dashboard state management |
| date-fns | ^4.1.0 | Date calculations | `differenceInDays` for countdown |
| lucide-react | ^0.468.0 | Icons | Consistent icon set |
| tailwind-merge | ^2.5.5 | Class merging | cn() utility |
| class-variance-authority | (existing) | Variant styles | Badge/component variants |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | (existing) | Conditional classes | Progress bar color switching |

### No New Dependencies Required
All functionality can be built with existing stack. Progress bar is pure CSS/Tailwind.

## Architecture Patterns

### Recommended Project Structure

**Dashboard (apps/dashboard/src):**
```
components/
  rewards/
    progress-bar.tsx           # NEW: Hero progress bar component
    progress-dashboard.tsx     # NEW: Main dashboard layout
    reward-estimate.tsx        # NEW: Estimated reward display
    campaign-countdown.tsx     # NEW: Days remaining display
    address-breakdown.tsx      # NEW: Per-address volume list
    address-card.tsx           # (exists) - extend with volume display
    address-list.tsx           # (exists) - may reuse patterns
  campaigns/
    campaign-rules.tsx         # (exists) - refactor/simplify
    campaign-history.tsx       # (exists) - keep as-is
app/
  rewards/
    page.tsx                   # (exists) - update to use new components
```

**Server (packages/server/src):**
```
routes/
  rewards.ts                   # (exists) - add address volume breakdown endpoint
db/
  volume-aggregation.ts        # (exists) - add per-address volume function
```

### Pattern 1: Progress Bar with State-Based Styling

**What:** Horizontal progress bar that changes color when threshold is met
**When to use:** Hero element showing volume vs threshold
**Example:**
```tsx
// Based on CONTEXT.md: "Default brand color until threshold met, then turns green"
interface ProgressBarProps {
  current: number;
  threshold: number;
  className?: string;
}

export function ProgressBar({ current, threshold, className }: ProgressBarProps) {
  const percentage = Math.min((current / threshold) * 100, 100);
  const isComplete = current >= threshold;

  return (
    <div className={cn("w-full h-4 bg-muted rounded-full overflow-hidden", className)}>
      <div
        className={cn(
          "h-full transition-all duration-500",
          isComplete ? "bg-green-500" : "bg-primary"
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
```

### Pattern 2: Conditional Campaign State Display

**What:** Different UI states based on campaign status
**When to use:** Handling no campaign, active campaign, ended campaign scenarios
**Example:**
```tsx
// Based on CONTEXT.md decisions
// - No active campaign: show historical stats only, hide timing section
// - Campaign ended but claims not open: "Rewards being calculated..." status

function CampaignStateDisplay({ campaign, hasEnded }: Props) {
  if (!campaign) {
    // No active campaign - historical only
    return <HistoricalStats />;
  }

  if (hasEnded) {
    // Campaign ended, awaiting claims
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-lg font-medium">Rewards being calculated...</p>
        <p className="text-sm text-muted-foreground">Check back soon for final results</p>
      </div>
    );
  }

  // Active campaign
  return <ProgressDashboard campaign={campaign} />;
}
```

### Pattern 3: Motivational Messaging

**What:** Encouraging text when user is below threshold
**When to use:** Per CONTEXT.md: "Encouraging/motivational tone when below threshold"
**Example:**
```tsx
// Based on CONTEXT.md: "Keep going! $37,550 more to qualify for rewards"
function ThresholdMessage({ current, threshold, metThreshold }: Props) {
  const remaining = threshold - current;

  if (metThreshold) {
    return (
      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
        <p className="font-medium text-green-700 dark:text-green-400">
          You've reached the threshold! You're eligible for rewards.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
      <p className="font-medium text-amber-700 dark:text-amber-400">
        Keep going! {formatUSDC(remaining)} more to qualify for rewards.
      </p>
    </div>
  );
}
```

### Pattern 4: USDC Amount Formatting

**What:** Convert atomic units to display format with currency symbol
**When to use:** All monetary displays
**Example:**
```tsx
// Already exists in campaign-card.tsx and campaign-rules.tsx
function formatUSDC(amount: string): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// CONTEXT.md format: "$12,450.00 / $50,000 (24.9%)"
function formatProgressDisplay(current: string, threshold: string): string {
  const currentNum = Number(current) / 1_000_000;
  const thresholdNum = Number(threshold) / 1_000_000;
  const percentage = thresholdNum > 0 ? (currentNum / thresholdNum) * 100 : 0;

  return `${formatUSDC(current)} / ${formatUSDC(threshold)} (${percentage.toFixed(1)}%)`;
}
```

### Pattern 5: Reward Estimate Display

**What:** Show projected reward with disclaimer
**When to use:** Reward estimate section
**Example:**
```tsx
// CONTEXT.md: "Est. Reward: ~1,234 $OPEN" with note "*based on current volume"
// CONTEXT.md: "If you qualify: ~1,234 $OPEN" when below threshold

interface RewardEstimateProps {
  estimatedReward: number;
  metThreshold: boolean;
  hasMultiplier: boolean;
  multiplier: number;
}

function RewardEstimate({ estimatedReward, metThreshold, hasMultiplier, multiplier }: RewardEstimateProps) {
  const formattedReward = estimatedReward.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">
          {metThreshold ? 'Est. Reward:' : 'If you qualify:'}
        </span>
        <span className="text-2xl font-bold text-primary">
          ~{formattedReward} $OPEN
        </span>
        {hasMultiplier && (
          <Badge variant="outline" className="text-primary border-primary">
            {multiplier}x
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">*based on current volume</p>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Don't recalculate volume client-side** - Use `getUserTotalVolume` API, includes snapshot + live delta
- **Don't hard-code multiplier values** - Read from campaign and auth context
- **Don't show progress bar for ended campaigns** - Show "Rewards being calculated..." instead
- **Don't use urgency styling for countdown** - CONTEXT.md: "No urgency styling"

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Volume calculation | Custom SQL queries | `api.getRewardsVolume(campaignId)` | Handles snapshot + live delta pattern |
| Multiplier detection | Check facilitator ownership manually | `useAuth().isFacilitatorOwner` | Already computed server-side |
| Days remaining | Manual date math | `differenceInDays(endsAt, now)` from date-fns | Already in use |
| Amount formatting | Custom formatters | Existing `formatUSDC()` in campaign components | Consistent with rest of app |
| Progress bar | Library component | Pure CSS/Tailwind div | Simple, no dependency needed |
| Badge styling | Custom styles | Existing `Badge` component | Consistent variants |

**Key insight:** The `CampaignRules` component already calculates and displays most of this information. Refactor rather than rebuild from scratch.

## Common Pitfalls

### Pitfall 1: Showing Progress Bar When Campaign Ended
**What goes wrong:** Progress bar visible when campaign is over
**Why it happens:** Not checking campaign end date
**How to avoid:** Check `hasEnded = now >= endsAt` and show "calculating" state instead
**Warning signs:** Users confused about whether campaign is still active

### Pitfall 2: Wrong Multiplier Display
**What goes wrong:** 2x badge shown when user isn't a facilitator owner
**Why it happens:** Not checking `isFacilitatorOwner` from auth context
**How to avoid:** Use `const { isFacilitatorOwner } = useAuth()` consistently
**Warning signs:** Users see 2x badge but don't own facilitators

### Pitfall 3: Stale Volume Data
**What goes wrong:** Volume doesn't update after user processes transactions
**Why it happens:** Query cache not invalidated
**How to avoid:** Use appropriate `staleTime` in query config, or invalidate on dashboard load
**Warning signs:** Volume shown doesn't match user's recent transactions

### Pitfall 4: Division by Zero in Percentage
**What goes wrong:** NaN or Infinity displayed in progress
**Why it happens:** Dividing by 0 when threshold is 0 or totalPoolVolume is 0
**How to avoid:** Guard all divisions: `if (threshold === 0) return 0`
**Warning signs:** "NaN%" or blank percentage displays

### Pitfall 5: Floating Point Display Artifacts
**What goes wrong:** Showing "24.900000000001%"
**Why it happens:** JavaScript floating point math
**How to avoid:** Use `toFixed(1)` or `Intl.NumberFormat` for all percentage displays
**Warning signs:** Long decimal strings in UI

### Pitfall 6: Missing "If you qualify" Messaging
**What goes wrong:** Showing reward estimate without context for non-qualifying users
**Why it happens:** Not conditionally formatting the label
**How to avoid:** Per CONTEXT.md: "If you qualify: ~1,234 $OPEN" for below-threshold users
**Warning signs:** Users think they'll get rewards when they haven't qualified

## Code Examples

Verified patterns from the existing codebase:

### Volume Data Fetching (Existing API Pattern)
```typescript
// Source: apps/dashboard/src/lib/api.ts
async getRewardsVolume(campaignId: string): Promise<{
  userId: string;
  campaignId: string;
  totalVolume: string;      // Total volume = snapshot + live
  uniquePayers: number;
  snapshotVolume: string;
  liveVolume: string;
  lastSnapshotDate: string | null;
}> {
  return this.request(`/api/rewards/volume?campaignId=${campaignId}`);
}

// Usage in component:
const { data: volumeData, isLoading: volumeLoading } = useQuery({
  queryKey: ['rewardsVolume', campaign?.id],
  queryFn: () => api.getRewardsVolume(campaign!.id),
  enabled: !!campaign?.id,
});
```

### Campaign Data Fetching (Existing Pattern)
```typescript
// Source: apps/dashboard/src/app/rewards/page.tsx
const { data: activeCampaign, isLoading: campaignLoading } = useQuery({
  queryKey: ['activeCampaign'],
  queryFn: () => api.getActiveCampaign(),
});

// Response includes campaign and total pool volume:
// { campaign: Campaign | null, totalVolume: string }
```

### Estimated Reward Calculation (Existing Pattern)
```typescript
// Source: apps/dashboard/src/components/campaigns/campaign-rules.tsx
// Apply multiplier to user volume for calculation
const effectiveVolume = userVolumeNum * multiplier;
const metThreshold = userVolumeNum >= thresholdNum;

// Calculate user's share only if they met threshold
const userShare = metThreshold && totalVolumeNum > 0
  ? effectiveVolume / totalVolumeNum
  : 0;
const estimatedReward = userShare * poolAmountNum;
```

### Days Remaining Calculation (Existing Pattern)
```typescript
// Source: apps/dashboard/src/components/campaigns/campaign-rules.tsx
import { differenceInDays } from 'date-fns';

const now = new Date();
const endsAt = new Date(campaign.ends_at);
const daysRemaining = differenceInDays(endsAt, now);
const hasEnded = now >= endsAt;
```

### Threshold Status Display (Existing Pattern)
```typescript
// Source: apps/dashboard/src/components/campaigns/campaign-rules.tsx
<div className={`rounded-lg p-4 ${
  metThreshold
    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
}`}>
  {metThreshold ? (
    <p className="font-medium text-green-700 dark:text-green-400">
      You've reached the threshold! You're eligible for rewards.
    </p>
  ) : (
    <p className="font-medium text-amber-700 dark:text-amber-400">
      Process {formatUSDC((remainingToThreshold * 1_000_000).toString())} more to qualify for rewards.
    </p>
  )}
</div>
```

## New API Endpoint Needed

### Per-Address Volume Breakdown
```typescript
// NEW endpoint for CONTEXT.md requirement:
// "Show tracked addresses with their individual volume contribution"

// GET /api/rewards/volume/breakdown?campaignId=xxx
// Response:
interface AddressVolumeBreakdown {
  userId: string;
  campaignId: string;
  totalVolume: string;
  addresses: Array<{
    id: string;
    address: string;
    chain_type: 'solana' | 'evm' | 'facilitator';
    volume: string;
    uniquePayers: number;
  }>;
  facilitatorVolume: string | null; // Volume from facilitator ownership (if applicable)
}
```

Implementation in `volume-aggregation.ts`:
```typescript
export function getVolumeBreakdownByUser(
  userId: string,
  campaignId: string
): AddressVolumeBreakdown {
  const db = getDatabase();

  // Get all user's verified addresses with their volumes
  const addressStmt = db.prepare(`
    SELECT
      ra.id,
      ra.address,
      ra.chain_type,
      COALESCE(SUM(CAST(vs.volume AS INTEGER)), 0) as volume,
      COALESCE(SUM(vs.unique_payers), 0) as unique_payers
    FROM reward_addresses ra
    LEFT JOIN volume_snapshots vs ON vs.reward_address_id = ra.id AND vs.campaign_id = ?
    WHERE ra.user_id = ?
      AND ra.verification_status = 'verified'
    GROUP BY ra.id
  `);

  const addresses = addressStmt.all(campaignId, userId) as Array<{
    id: string;
    address: string;
    chain_type: string;
    volume: number;
    unique_payers: number;
  }>;

  // Calculate total
  const totalVolume = addresses.reduce((sum, addr) => sum + addr.volume, 0);

  return {
    userId,
    campaignId,
    totalVolume: String(totalVolume),
    addresses: addresses.map(addr => ({
      id: addr.id,
      address: addr.address,
      chain_type: addr.chain_type as 'solana' | 'evm' | 'facilitator',
      volume: String(addr.volume),
      uniquePayers: addr.unique_payers,
    })),
    facilitatorVolume: null, // Set if user owns facilitator
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CampaignRules as info card | Progress bar as hero element | CONTEXT.md decision | Visual hierarchy change |
| Worked example prominent | Estimate with asterisk note | CONTEXT.md decision | Cleaner display |
| Campaign name displayed | Campaign name de-emphasized | CONTEXT.md decision | Focus on progress |

**Key refactoring:** The existing `CampaignRules` component contains good calculation logic but wrong visual hierarchy. Extract the calculation logic, create new layout components.

## UI Component Specifications

### Progress Bar (Hero Element)
```
+--------------------------------------------------+
| $12,450.00 / $50,000 (24.9%)                     |
+--------------------------------------------------+
| [=================                              ] |
| ^^^^^^^^^^^^^^--- primary color (or green if met)|
+--------------------------------------------------+
```

### Reward Estimate Section
```
+--------------------------------------------------+
| Est. Reward: ~1,234 $OPEN  [2x]                  |
| *based on current volume                         |
+--------------------------------------------------+
```

### Campaign Countdown
```
+--------------------------------------------------+
| 14 days remaining                                |
+--------------------------------------------------+
```
No urgency colors. Simple text.

### Address Breakdown
```
+--------------------------------------------------+
| Tracked Addresses                                |
+--------------------------------------------------+
| [S] ABC...XYZ     $8,500.00 (68%)               |
| [E] 0x1...234     $3,950.00 (32%)               |
+--------------------------------------------------+
```

## Open Questions

Things that couldn't be fully resolved:

1. **Volume breakdown granularity**
   - What we know: CONTEXT.md wants "individual volume contribution" per address
   - What's unclear: Show snapshot volume only or include live delta per address?
   - Recommendation: Show snapshot volume for consistency; total includes live delta

2. **Historical stats when no campaign**
   - What we know: CONTEXT.md says "show historical stats only" when no active campaign
   - What's unclear: What historical stats to show? Lifetime volume? Past campaigns?
   - Recommendation: Use existing `CampaignHistory` component with lifetime stats

3. **Refresh interval**
   - What we know: Volume should feel "live"
   - What's unclear: How often to refetch? Real-time websocket?
   - Recommendation: Refetch on page load + 60-second stale time (no websocket complexity)

## Sources

### Primary (HIGH confidence)
- `apps/dashboard/src/components/campaigns/campaign-rules.tsx` - Existing calculation logic
- `apps/dashboard/src/components/campaigns/campaign-history.tsx` - History display patterns
- `apps/dashboard/src/lib/api.ts` - API client patterns, type definitions
- `packages/server/src/routes/rewards.ts` - Volume endpoint implementation
- `packages/server/src/db/volume-aggregation.ts` - Volume calculation logic
- `08-CONTEXT.md` - User decisions on visual design

### Secondary (MEDIUM confidence)
- `apps/dashboard/src/components/rewards/address-card.tsx` - Address display patterns
- `apps/dashboard/src/components/ui/badge.tsx` - Badge styling
- `apps/dashboard/src/lib/utils.ts` - Utility functions

### Tertiary (LOW confidence)
- None - all findings verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use
- Architecture: HIGH - Follows established codebase patterns exactly
- Pitfalls: HIGH - Derived from CONTEXT.md requirements and existing code analysis
- API endpoint: HIGH - Extends existing volume-aggregation patterns

**Research date:** 2026-01-20
**Valid until:** 60 days (stable internal patterns)
