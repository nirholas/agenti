# Phase 7: Campaign System - Research

**Researched:** 2026-01-20
**Domain:** Admin CRUD + User-facing campaign views
**Confidence:** HIGH

## Summary

Phase 7 builds the campaign management system where admins create/edit campaigns with configurable rules, and users view campaign details and their participation history. The existing codebase provides all necessary infrastructure:

1. **Database schema already exists** - The `campaigns` table was created in Phase 1 with all required fields (name, pool_amount, threshold_amount, multiplier_facilitator, starts_at, ends_at, status)
2. **Campaign CRUD functions exist** - `createCampaign`, `getCampaignById`, `getActiveCampaign`, `getAllCampaigns`, `updateCampaign`, `deleteCampaign` are already implemented
3. **Volume APIs ready** - The `getUserTotalVolume` function from Phase 6 provides total volume for any user/campaign combination
4. **Admin check utility exists** - `isAdmin(userId)` from `packages/server/src/utils/admin.ts` checks ADMIN_USER_IDS env var
5. **UI component library established** - Radix UI primitives (Dialog, Select, etc.) with shadcn/ui styling patterns

**Primary recommendation:** Extend existing patterns. Add admin campaign routes, update campaigns schema for Draft/Published workflow, create dashboard pages following established component patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.6.0 | Database | Already used for all tables |
| zod | ^3.24.1 | Validation | Server-side request validation |
| express | ^4.21.2 | API routes | Existing route patterns |
| @tanstack/react-query | ^5.62.7 | Data fetching | Dashboard state management |
| @radix-ui/* | various | UI primitives | Existing component library |
| lucide-react | ^0.468.0 | Icons | Consistent icon set |
| date-fns | ^4.1.0 | Date formatting | Already in dashboard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | ^5.0.9 | ID generation | Already used for all record IDs |
| tailwind-merge | ^2.5.5 | Class merging | cn() utility |

### No New Dependencies Required
All functionality can be built with existing stack. No additional libraries needed.

## Architecture Patterns

### Recommended Project Structure

**Server (packages/server/src):**
```
db/
  campaigns.ts           # Existing CRUD - extend for audit log
  campaign-audit.ts      # NEW: audit log functions
routes/
  rewards.ts             # Existing - add campaign endpoints
  # OR
  campaigns.ts           # NEW: dedicated campaign routes (admin + public)
```

**Dashboard (apps/dashboard/src):**
```
app/
  campaigns/
    page.tsx             # Campaign rules display + history
  admin/
    campaigns/
      page.tsx           # Admin campaign management
components/
  campaigns/
    campaign-card.tsx         # Single campaign display
    campaign-rules.tsx        # Rules explanation with worked example
    campaign-form.tsx         # Create/edit form
    campaign-history.tsx      # Past campaigns list
    lifetime-stats.tsx        # Aggregate stats display
lib/
  api.ts                      # Add campaign API methods
```

### Pattern 1: Admin Route Protection

**What:** Server middleware pattern for admin-only routes
**When to use:** All campaign CRUD endpoints
**Example:**
```typescript
// Source: packages/server/src/routes/rewards.ts (existing pattern)
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../utils/admin.js';

router.post('/campaigns', requireAuth, async (req, res) => {
  if (!isAdmin(req.user!.id)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  // ... create campaign
});
```

### Pattern 2: Controlled Form State

**What:** useState-based form handling (no react-hook-form in codebase)
**When to use:** Campaign create/edit forms
**Example:**
```typescript
// Source: apps/dashboard/src/components/create-facilitator-modal.tsx
const [name, setName] = useState('');
const [poolAmount, setPoolAmount] = useState('');
// ... more fields

const handleSubmit = () => {
  if (!isFormValid) return;
  mutation.mutate({ name, poolAmount, ... });
};
```

### Pattern 3: Dialog-based CRUD

**What:** Modal dialogs for create/edit operations
**When to use:** Campaign creation and editing
**Example:**
```typescript
// Source: apps/dashboard/src/components/create-facilitator-modal.tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Create Campaign</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    {/* Form fields */}
    <DialogFooter>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button onClick={handleSubmit} disabled={!isValid || isPending}>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Pattern 4: Query-based Data Fetching

**What:** TanStack Query for server state
**When to use:** All campaign data loading
**Example:**
```typescript
// Source: apps/dashboard/src/app/dashboard/page.tsx
const { data: campaigns, isLoading } = useQuery({
  queryKey: ['campaigns'],
  queryFn: () => api.getCampaigns(),
  enabled: isAuthenticated,
});
```

### Pattern 5: Auth Context for Admin Check

**What:** AuthProvider already exposes `isAdmin` boolean
**When to use:** Conditional UI rendering for admin features
**Example:**
```typescript
// Source: apps/dashboard/src/components/navbar.tsx
const { isAdmin } = useAuth();
// ...
{isAdmin && <span className="text-xs px-2 py-0.5 rounded bg-muted">Admin</span>}
```

### Anti-Patterns to Avoid
- **Don't use react-hook-form** - Codebase uses useState for forms
- **Don't create new route files unnecessarily** - Extend existing rewards.ts or follow exact patterns
- **Don't add client-side admin checks only** - Always verify server-side
- **Don't bypass existing isAdmin utility** - Use the established pattern

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID generation | Custom UUIDs | `nanoid()` | Consistent with all existing records |
| Date formatting | Manual format | `date-fns` | Already in dashboard deps |
| Admin check | Inline env parsing | `isAdmin(userId)` | Centralized, tested pattern |
| Volume calculation | Custom queries | `getUserTotalVolume()` | Handles snapshot + live delta |
| Dialog modals | Custom components | Radix Dialog | Consistent accessibility, animations |
| Form validation | Custom logic | zod schemas | Server-side validation pattern |

**Key insight:** All campaign functionality extends existing patterns. The database schema and CRUD functions already exist from Phase 1. Focus on wiring them to routes and UI.

## Common Pitfalls

### Pitfall 1: Overlapping Active Campaigns
**What goes wrong:** Admin creates new campaign while another is active
**Why it happens:** No database constraint prevents multiple active campaigns
**How to avoid:** Enforce in application logic: check `getActiveCampaign()` before allowing status='active'
**Warning signs:** Queries returning multiple active campaigns

### Pitfall 2: Editing Published Campaigns Without Audit
**What goes wrong:** Changes to live campaigns are untracked
**Why it happens:** CONTEXT.md requires audit logging but schema lacks audit table
**How to avoid:** Create campaign_audit table and log all updates with timestamp, admin_id, field changed, old/new values
**Warning signs:** Users dispute campaign rules changed mid-campaign

### Pitfall 3: Date Timezone Issues
**What goes wrong:** Campaign starts/ends at wrong time
**Why it happens:** SQLite stores TEXT dates, client/server timezone mismatch
**How to avoid:** Always use ISO 8601 with UTC (ends with 'Z'), display with user's locale
**Warning signs:** Campaign showing as active/inactive unexpectedly

### Pitfall 4: Pool Rollover Calculation
**What goes wrong:** Unused tokens not rolled over correctly
**Why it happens:** No tracking of distributed vs remaining pool
**How to avoid:** Add `distributed_amount` column to campaigns, calculate rollover as `pool_amount - distributed_amount`
**Warning signs:** Pool amounts don't match expected totals

### Pitfall 5: Missing Multiplier in History
**What goes wrong:** History shows wrong reward amounts
**Why it happens:** Multiplier not captured at claim time
**How to avoid:** Store actual multiplier applied in reward_claims table (already has `multiplier` column)
**Warning signs:** Users see different rewards than expected

## Code Examples

Verified patterns from official sources:

### Campaign Status Transitions
```typescript
// Source: 07-CONTEXT.md decisions
// Draft -> Published -> Active -> Ended

type CampaignStatus = 'draft' | 'published' | 'active' | 'ended';

// Admin publishes: draft -> published (visible to users)
// System activates: published -> active (when starts_at reached)
// System ends: active -> ended (when ends_at reached OR admin ends early)
// Claims auto-enable when status = 'ended'
```

### Volume with Multiplier Display
```typescript
// Source: packages/server/src/db/volume-aggregation.ts + CONTEXT.md
const volumeData = getUserTotalVolume(userId, campaignId);
const isFacilitatorOwner = await checkFacilitatorOwnership(userId);
const multiplier = isFacilitatorOwner ? 2.0 : 1.0;
const effectiveVolume = BigInt(volumeData.total_volume) * BigInt(multiplier);

// Display: "Your volume: $50,000 (2x multiplier = $100,000 effective)"
```

### Worked Example Calculation
```typescript
// Source: CONTEXT.md requirement
// "If you process $50K of $500K total pool with 100K $OPEN..."

interface WorkedExample {
  userVolume: string;      // e.g., "50000"
  totalPoolVolume: string; // e.g., "500000" (sum of all user volumes)
  poolAmount: string;      // e.g., "100000" (total $OPEN to distribute)
  userShare: string;       // userVolume / totalPoolVolume
  estimatedReward: string; // poolAmount * userShare
}

function calculateEstimatedReward(
  userVolume: string,
  totalPoolVolume: string,
  poolAmount: string
): string {
  if (BigInt(totalPoolVolume) === 0n) return '0';
  return (
    (BigInt(userVolume) * BigInt(poolAmount)) / BigInt(totalPoolVolume)
  ).toString();
}
```

### Admin Campaign Edit with Audit
```typescript
// Pattern for audit logging
interface CampaignAudit {
  id: string;
  campaign_id: string;
  admin_user_id: string;
  action: 'create' | 'update' | 'publish' | 'end';
  changes: string; // JSON: { field: { old: value, new: value } }
  created_at: string;
}

function updateCampaignWithAudit(
  campaignId: string,
  adminId: string,
  updates: Partial<CampaignRecord>
): CampaignRecord {
  const existing = getCampaignById(campaignId);
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const [key, newValue] of Object.entries(updates)) {
    if (existing[key] !== newValue) {
      changes[key] = { old: existing[key], new: newValue };
    }
  }

  // Create audit record
  createCampaignAudit({
    campaign_id: campaignId,
    admin_user_id: adminId,
    action: 'update',
    changes: JSON.stringify(changes),
  });

  // Perform update
  return updateCampaign(campaignId, updates);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CAMP-05: "edit before start date" | Any time editing with audit | CONTEXT.md decision | More flexibility, need audit trail |
| Manual claim enable | Auto-enable when ended | CONTEXT.md decision | Simpler admin workflow |
| Overlap checking | Must end current first | CONTEXT.md decision | Prevents confusion |

**Note:** The original REQUIREMENTS.md said "edit existing campaigns (before start date)" but CONTEXT.md explicitly allows "Admin can fully edit campaigns anytime (even after start) - audit changes". Follow CONTEXT.md.

## Schema Changes Required

### New: campaign_audit table
```sql
CREATE TABLE IF NOT EXISTS campaign_audit (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  admin_user_id TEXT NOT NULL REFERENCES "user"(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'end')),
  changes TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaign_audit_campaign ON campaign_audit(campaign_id);
```

### Update: campaigns table
```sql
-- Add 'published' status to existing CHECK constraint
-- Current: CHECK (status IN ('draft', 'active', 'ended'))
-- New: CHECK (status IN ('draft', 'published', 'active', 'ended'))

-- Add distributed_amount for pool rollover tracking
ALTER TABLE campaigns ADD COLUMN distributed_amount TEXT NOT NULL DEFAULT '0';
```

## API Endpoints Needed

### Admin Routes (require isAdmin)
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/rewards/campaigns | Create draft campaign |
| GET | /api/rewards/campaigns | List all campaigns (admin sees all statuses) |
| GET | /api/rewards/campaigns/:id | Get campaign details |
| PATCH | /api/rewards/campaigns/:id | Update campaign (with audit) |
| POST | /api/rewards/campaigns/:id/publish | Transition draft -> published |
| POST | /api/rewards/campaigns/:id/end | End campaign early |
| DELETE | /api/rewards/campaigns/:id | Delete draft campaign only |

### Public Routes (authenticated users)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/rewards/campaigns/active | Get current active/published campaign |
| GET | /api/rewards/campaigns/history | Get user's campaign participation history |
| GET | /api/rewards/campaigns/:id/stats | Get campaign totals (total volume, participant count) |

## Open Questions

Things that couldn't be fully resolved:

1. **Cron for status transitions**
   - What we know: Need to transition published->active at starts_at, active->ended at ends_at
   - What's unclear: Use existing CRON_SECRET pattern or new mechanism?
   - Recommendation: Add to existing snapshot cron job or create separate campaign-status cron endpoint

2. **Notification implementation details**
   - What we know: CONTEXT.md says "banner/toast for campaign start, end, claims open"
   - What's unclear: Poll interval? WebSocket? Just on page load?
   - Recommendation: Simple polling on dashboard page load, show banner if status changed

3. **Pool rollover mechanics**
   - What we know: "unused tokens from no-qualifier campaigns add to next campaign's pool"
   - What's unclear: Where to store rollover amount? Manual admin input or automatic?
   - Recommendation: Add `rollover_from_campaign_id` field, auto-calculate when creating new campaign

## Sources

### Primary (HIGH confidence)
- packages/server/src/db/campaigns.ts - Existing CRUD implementation
- packages/server/src/db/types.ts - CampaignRecord interface
- packages/server/src/db/index.ts - Schema definition (lines 630-642)
- packages/server/src/db/volume-aggregation.ts - Volume calculation
- packages/server/src/utils/admin.ts - Admin check utility
- apps/dashboard/src/components/auth/auth-provider.tsx - isAdmin in auth context

### Secondary (MEDIUM confidence)
- apps/dashboard/src/lib/api.ts - API client patterns
- apps/dashboard/src/components/create-facilitator-modal.tsx - Form/dialog patterns
- apps/dashboard/src/components/rewards-info-banner.tsx - Rewards UI patterns

### Tertiary (LOW confidence)
- None - all findings verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from package.json and existing code
- Architecture: HIGH - Follows established codebase patterns exactly
- Pitfalls: HIGH - Derived from CONTEXT.md requirements and schema analysis

**Research date:** 2026-01-20
**Valid until:** 60 days (stable internal patterns)
