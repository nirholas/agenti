# Phase 21: Notifications & Edge Cases - Research

**Researched:** 2026-01-22
**Domain:** In-app notification system with persistent storage
**Confidence:** HIGH

## Summary

This phase implements an in-app notification center for subscription payment events. The system requires a new database table for storing notifications, a bell icon dropdown in the header, and integration with the existing subscription billing system to generate notifications at appropriate trigger points.

The codebase already uses Radix UI with shadcn/ui patterns extensively. The notification center will follow established patterns from the user menu dropdown (DropdownMenu) and the existing toast system. A Popover component is preferred over DropdownMenu for richer content display (multiple notification items with dismiss buttons).

**Primary recommendation:** Add `@radix-ui/react-popover` component via shadcn CLI, create a notifications table in SQLite, and integrate notification creation into the existing subscription-billing service where payment outcomes are already logged.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-popover | ^1.1.x | Bell icon dropdown panel | Already using Radix primitives; better than DropdownMenu for rich content |
| lucide-react | ^0.468.0 | Bell icon | Already installed and used throughout |
| better-sqlite3 | (installed) | Notification storage | Existing database layer |
| @tanstack/react-query | ^5.62.7 | Notification fetching/caching | Already used for all data fetching |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | Notification severity variants | Already installed for variant styling |
| date-fns | ^4.1.0 | Relative time display ("2 hours ago") | Already installed |
| tailwind-merge | ^2.5.5 | Class merging for conditional styles | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Database storage | localStorage | localStorage would not persist across devices and has size limits; database enables future email notifications |
| Popover | DropdownMenu | DropdownMenu designed for menu items, Popover better for rich notification cards with actions |
| Custom polling | WebSockets | WebSockets are overkill for infrequent updates; polling on page focus is simpler |

**Installation:**
```bash
npx shadcn@latest add popover
```

## Architecture Patterns

### Recommended Project Structure
```
apps/dashboard/src/
├── components/
│   ├── notifications/
│   │   ├── notification-bell.tsx      # Bell icon trigger with badge
│   │   ├── notification-center.tsx    # Popover content with list
│   │   ├── notification-item.tsx      # Individual notification card
│   │   └── notification-provider.tsx  # Context for notification state (optional)
│   └── ui/
│       └── popover.tsx                # shadcn popover (new)
├── hooks/
│   └── use-notifications.ts           # React Query hook for notifications
packages/server/src/
├── db/
│   └── notifications.ts               # CRUD operations
├── routes/
│   └── notifications.ts               # API endpoints
└── services/
    └── subscription-billing.ts        # Add notification creation calls
```

### Pattern 1: Notification Generation at Payment Events
**What:** Create notifications inline with payment outcome logging
**When to use:** Billing cron runs daily, generates notifications during payment processing
**Example:**
```typescript
// In subscription-billing.ts after successful payment
createNotification({
  userId,
  type: 'payment_success',
  title: 'Payment Successful',
  message: `Your $5 subscription payment was processed successfully.`,
  severity: 'success',
  metadata: { txHash, chain, amount }
});
```

### Pattern 2: Low Balance Check During Billing
**What:** After payment processing, check remaining balance for warning
**When to use:** Daily billing cron, after each user's payment attempt
**Example:**
```typescript
// After payment attempt, regardless of success/failure
const balance = await getUSDCBalance(wallet.address);
const subscriptionCost = SUBSCRIPTION_PRICING.starter;
if (balance < BigInt(subscriptionCost * 2)) {
  createNotification({
    userId,
    type: 'low_balance',
    title: 'Low Balance Warning',
    message: `Your wallet balance is below $10. Consider funding to avoid payment failures.`,
    severity: 'warning'
  });
}
```

### Pattern 3: Expiration Reminder via Scheduled Check
**What:** 3-day advance notice before subscription expires
**When to use:** Part of daily billing cron, before payment processing
**Example:**
```typescript
// Check subscriptions expiring in 3 days
const expiringIn3Days = getSubscriptionsExpiringInDays(3);
for (const sub of expiringIn3Days) {
  // Skip if user is already in grace period
  if (!isInGracePeriod(sub.user_id)) {
    createNotification({
      userId: sub.user_id,
      type: 'expiration_reminder',
      title: 'Subscription Expiring Soon',
      message: 'Your subscription will expire in 3 days. Ensure your wallet is funded.',
      severity: 'warning'
    });
  }
}
```

### Pattern 4: Popover for Notification List
**What:** Use Radix Popover for notification dropdown
**When to use:** Bell icon in header shows notification list on click
**Example:**
```typescript
// Source: shadcn/ui Popover pattern
<Popover>
  <PopoverTrigger asChild>
    <button className="relative p-2">
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-80 p-0">
    <NotificationList />
  </PopoverContent>
</Popover>
```

### Anti-Patterns to Avoid
- **Creating notifications in UI code:** Notifications must be created server-side to ensure persistence and consistency
- **Real-time WebSocket for notifications:** Over-engineering for this use case; polling on focus/interval is sufficient
- **Storing in localStorage:** Would not sync across devices, no persistence on logout
- **Auto-dismissing notifications:** CONTEXT.md specifies "persist until dismissed"

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown positioning | Custom absolute positioning | Radix Popover | Handles viewport collision, focus management |
| Relative time formatting | Manual date math | date-fns formatDistanceToNow | Edge cases like "just now", localization |
| Unread count badge styling | Custom CSS | shadcn Badge + absolute positioning | Consistent with existing codebase |
| Variant styling (success/warning/error) | Inline conditionals | class-variance-authority | Already used in toast.tsx |

**Key insight:** The existing toast system (`use-toast.ts`, `toast.tsx`) provides patterns for ephemeral notifications. The notification center extends this with persistence but should follow the same variant patterns.

## Common Pitfalls

### Pitfall 1: Duplicate Notifications
**What goes wrong:** Same notification created multiple times (e.g., daily low balance warning becoming spammy)
**Why it happens:** Billing cron runs daily without checking existing notifications
**How to avoid:** Check for recent duplicate before creating (e.g., no low_balance in last 24 hours already unread)
**Warning signs:** User has 30 identical "Low Balance Warning" notifications

### Pitfall 2: Stale Notification State
**What goes wrong:** Bell icon shows wrong unread count after dismissing notifications
**Why it happens:** React Query cache not invalidated after mutation
**How to avoid:** Use `queryClient.invalidateQueries({ queryKey: ['notifications'] })` in all mutation onSuccess
**Warning signs:** Badge count doesn't update until page refresh

### Pitfall 3: Missing User Context for Notifications
**What goes wrong:** Notifications reference data that changes (e.g., "payment failed" but user has since funded wallet)
**Why it happens:** Notification message is static at creation time
**How to avoid:** Store minimal context in notification; action buttons should fetch current state
**Warning signs:** "Low balance" warning visible even after funding

### Pitfall 4: Popover Z-Index Issues
**What goes wrong:** Notification dropdown appears behind other elements
**Why it happens:** Radix Portal renders in body, other elements have high z-index
**How to avoid:** Use consistent z-index scale; Radix handles this well by default
**Warning signs:** Dropdown partially obscured by modals or navbar

### Pitfall 5: Notification Timing Race Conditions
**What goes wrong:** Billing cron creates notification after user already manually triggered payment
**Why it happens:** Cron and manual payment compete without coordination
**How to avoid:** Check subscription state before creating "payment failed" notification
**Warning signs:** User sees failure notification despite successful manual payment

## Code Examples

Verified patterns from official sources and existing codebase:

### Notification Database Schema
```sql
-- Source: Follows existing codebase patterns (better-sqlite3)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'payment_success',
    'payment_failed',
    'low_balance',
    'expiration_reminder',
    'subscription_restored',
    'subscription_expired'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('success', 'warning', 'error', 'info')),
  read INTEGER NOT NULL DEFAULT 0,
  dismissed INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(user_id, dismissed);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
```

### Notification Item Component
```typescript
// Source: Follows existing badge.tsx and toast.tsx patterns
import { cva } from 'class-variance-authority';
import { formatDistanceToNow } from 'date-fns';
import { Check, AlertTriangle, AlertCircle, X } from 'lucide-react';

const notificationVariants = cva(
  'p-4 border-b last:border-0',
  {
    variants: {
      severity: {
        success: 'bg-green-50 dark:bg-green-950/20',
        warning: 'bg-amber-50 dark:bg-amber-950/20',
        error: 'bg-red-50 dark:bg-red-950/20',
        info: 'bg-background',
      },
    },
    defaultVariants: {
      severity: 'info',
    },
  }
);

const iconMap = {
  success: <Check className="w-5 h-5 text-green-600" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-600" />,
  error: <AlertCircle className="w-5 h-5 text-red-600" />,
  info: null,
};
```

### API Endpoint Pattern
```typescript
// Source: Follows existing routes/subscriptions.ts pattern
router.get('/api/notifications', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const notifications = getNotificationsForUser(userId);
  const unreadCount = getUnreadCount(userId);

  res.json({ notifications, unreadCount });
});

router.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  markNotificationAsRead(id, userId);
  res.json({ success: true });
});

router.post('/api/notifications/:id/dismiss', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  dismissNotification(id, userId);
  res.json({ success: true });
});

router.post('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
  const userId = req.user.id;

  markAllNotificationsAsRead(userId);
  res.json({ success: true });
});
```

### React Query Hook
```typescript
// Source: Follows existing lib/api.ts and hooks/use-toast.ts patterns
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(),
    refetchOnWindowFocus: true,
    staleTime: 30_000, // 30 seconds
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.dismissNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    dismiss: dismissMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Toast-only notifications | Persistent notification center | Current trend | Users don't miss important payment alerts |
| WebSocket for real-time | Polling on focus + after mutations | Simplification | Less infrastructure, sufficient for infrequent events |
| Email-first notifications | In-app first, email later | Modern SaaS pattern | Faster user feedback loop |

**Deprecated/outdated:**
- Browser notification API: Requires permissions, often blocked; in-app is more reliable for web apps
- Custom notification libraries: Radix primitives + shadcn provide everything needed

## Open Questions

Things that couldn't be fully resolved:

1. **Notification retention period**
   - What we know: CONTEXT.md says "persist until dismissed"
   - What's unclear: Should there be a maximum age for old notifications?
   - Recommendation: Keep dismissed=0 notifications indefinitely; dismissed=1 can be cleaned after 30 days via cron

2. **Notification grouping**
   - What we know: Multiple low balance warnings repeat daily
   - What's unclear: Should identical notifications be grouped (e.g., "5 low balance warnings")?
   - Recommendation: For v1, show all individually; grouping is a future enhancement

3. **Reactivation notification specifics**
   - What we know: CONTEXT.md mentions "Subscription restored" notification
   - What's unclear: Should this trigger on manual reactivation or also on successful auto-billing after failure?
   - Recommendation: Trigger on any transition from inactive/pending to active

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns: `toast.tsx`, `use-toast.ts`, `user-menu.tsx`, `dropdown-menu.tsx`
- Existing database schema: `packages/server/src/db/index.ts`, `subscription-payments.ts`
- shadcn/ui official docs: https://ui.shadcn.com/docs/components/popover

### Secondary (MEDIUM confidence)
- [shadcn Popover documentation](https://ui.shadcn.com/docs/components/popover) - Component structure and installation
- [Radix UI Popover](https://www.radix-ui.com/primitives/docs/components/popover) - Underlying primitive API
- [shadcn Badge + Button patterns](https://www.shadcn.io/patterns/button-group-badges-1) - Notification count badge overlay

### Tertiary (LOW confidence)
- [Novu notification patterns](https://novu.co/blog/react-notifications) - General notification UX patterns
- [SuprSend notification center](https://www.suprsend.com/post/real-time-notification-center-in-react) - Architecture reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components exist in codebase or are direct shadcn additions
- Architecture: HIGH - Follows established patterns exactly (React Query, Radix, SQLite)
- Pitfalls: MEDIUM - Based on general experience, not verified against this specific codebase
- Database schema: HIGH - Follows existing table patterns in `db/index.ts`

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (30 days - stable domain, no rapid changes expected)
