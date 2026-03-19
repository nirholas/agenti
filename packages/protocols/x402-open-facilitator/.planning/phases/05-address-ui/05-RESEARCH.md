# Phase 5: Address UI - Research

**Researched:** 2026-01-19
**Domain:** React component architecture for address management UI
**Confidence:** HIGH

## Summary

This phase builds UI for managing tracked addresses across Solana and EVM chains. The existing codebase already provides substantial foundation: `AddressCard` and `AddressList` components exist, along with the `EnrollmentModal` for adding addresses. The API layer (`api.ts`) includes `deleteRewardAddress` and `getRewardsStatus` methods, and auth context tracks enrollment state.

The primary work is enhancing the existing components to match the CONTEXT.md decisions: grouping by chain, three-dot menu with confirmation dialog, empty states, address limit display, and pending verification warnings. The codebase uses Radix UI primitives with Tailwind CSS styling, following established patterns from components like `products-section.tsx` and `refund-wallets.tsx`.

**Primary recommendation:** Extend existing `AddressCard` and `AddressList` components rather than building from scratch. Add AlertDialog component for removal confirmation, use existing DropdownMenu pattern for three-dot menus.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.0.0 | Component framework | Project standard |
| @radix-ui/react-dialog | ^1.1.4 | Modal dialogs | Already used for EnrollmentModal |
| @radix-ui/react-dropdown-menu | ^2.1.4 | Three-dot menus | Already used throughout codebase |
| lucide-react | ^0.468.0 | Icons | Project standard |
| class-variance-authority | ^0.7.1 | Variant styling | Used in Badge, Button components |

### Supporting (Need to Add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-alert-dialog | ^1.1.4 | Confirmation dialogs | Destructive actions like remove |

**Why AlertDialog over Dialog:**
- AlertDialog prevents accidental dismissal via overlay click or escape key
- Appropriate for destructive confirmation flows
- Radix provides accessible implementation

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AlertDialog | Browser confirm() | Already used in products-section.tsx; acceptable but less polished |
| AlertDialog | Dialog with custom handling | More code, less accessibility |

**Installation:**
```bash
cd apps/dashboard && npm install @radix-ui/react-alert-dialog
```

## Architecture Patterns

### Recommended Component Structure
```
src/components/rewards/
  address-card.tsx          # Existing - enhance with menu, status styling
  address-list.tsx          # Existing - enhance with grouping, empty states
  enrollment-modal.tsx      # Existing - no changes needed
  remove-address-dialog.tsx # NEW - AlertDialog for removal confirmation
```

### Pattern 1: Grouped Address List
**What:** Addresses displayed in chain-specific sections (Solana first, then EVM)
**When to use:** When rendering the address list
**Example:**
```typescript
// Group addresses by chain type
const solanaAddresses = addresses.filter(a => a.chain_type === 'solana');
const evmAddresses = addresses.filter(a => a.chain_type === 'evm');

// Render sections with headers
{solanaAddresses.length > 0 && (
  <section>
    <h4>Solana Addresses</h4>
    {solanaAddresses.map(addr => <AddressCard key={addr.id} ... />)}
  </section>
)}
```

### Pattern 2: Three-Dot Menu Pattern
**What:** DropdownMenu triggered by MoreVertical icon button
**When to use:** Card actions that include destructive options
**Example (from existing codebase):**
```typescript
// Source: src/components/products-section.tsx lines 654-694
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
      <MoreVertical className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>Verify</DropdownMenuItem>
    <DropdownMenuItem
      className="text-red-600"
      onClick={() => setRemoveDialogOpen(true)}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      Remove
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Pattern 3: AlertDialog for Destructive Confirmation
**What:** Radix AlertDialog with cancel/confirm buttons
**When to use:** Before destructive actions (removal)
**Example:**
```typescript
// Create src/components/ui/alert-dialog.tsx following shadcn pattern
// Then use in component:
<AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remove this address?</AlertDialogTitle>
      <AlertDialogDescription>
        Volume history will be preserved.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleRemove}>
        Remove
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Pattern 4: Status Badge Pattern
**What:** Color-coded badges with icons for verification status
**When to use:** Indicating verified vs pending status
**Example (from existing address-card.tsx):**
```typescript
{isVerified ? (
  <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
    <CheckCircle className="h-3 w-3" />
    Verified
  </span>
) : (
  <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded">
    <Clock className="h-3 w-3" />
    Pending
  </span>
)}
```

### Anti-Patterns to Avoid
- **Direct delete without confirmation:** Always confirm destructive actions via dialog
- **Exposed delete icon:** Use three-dot menu to hide destructive actions
- **Mixing styles:** Use existing color tokens (green-100/green-900, yellow-100/yellow-900) not arbitrary colors

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown menu | Custom div with click handlers | @radix-ui/react-dropdown-menu | Focus management, keyboard navigation, click-outside |
| Confirmation dialog | window.confirm() or custom | @radix-ui/react-alert-dialog | Accessible, prevents accidental dismissal |
| Status badges | Custom styled spans | Existing badge pattern from address-card.tsx | Consistency with dark mode support |
| Address truncation | Manual string slicing | Existing pattern: `${addr.slice(0,6)}...${addr.slice(-4)}` | Already tested format |
| Chain icons | Custom SVGs | Wallet icon with chain label | Simpler, already established pattern |

**Key insight:** The existing codebase has solved most UI patterns already. Copy patterns from `products-section.tsx`, `refund-wallets.tsx`, and `subscription-confirm-dialog.tsx`.

## Common Pitfalls

### Pitfall 1: Forgetting Dark Mode Support
**What goes wrong:** Status badges look wrong in dark mode
**Why it happens:** Using only light mode colors like `bg-green-100`
**How to avoid:** Always pair with dark variants: `bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400`
**Warning signs:** Testing only in light mode

### Pitfall 2: Not Updating Auth Context After Removal
**What goes wrong:** UI shows stale enrollment status after last address removed
**Why it happens:** Only updating local state, not refetching auth context
**How to avoid:** Call `refetchRewardsStatus()` from auth context after delete
**Warning signs:** Auth provider's `isEnrolled` stays true when all addresses removed

### Pitfall 3: Address Limit Not Enforced in UI
**What goes wrong:** Users can attempt to add addresses when at limit
**Why it happens:** Only backend enforces limit, UI doesn't disable add button
**How to avoid:** Pass address count to AddressList, disable add when count >= 5
**Warning signs:** Error messages after clicking add at limit

### Pitfall 4: Missing Loading States on Remove
**What goes wrong:** User clicks remove multiple times, duplicate requests
**Why it happens:** No loading indicator during async operation
**How to avoid:** Track `removingId` state, disable button during removal
**Warning signs:** Double-delete API calls in network tab

### Pitfall 5: Lost Address on Verify Flow
**What goes wrong:** Unverified address loses verify button after modal closes
**Why it happens:** Re-adding from enrollment modal instead of verifying existing
**How to avoid:** Verify button triggers enrollment modal in verify mode for that address
**Warning signs:** Address count increases instead of status changing

## Code Examples

Verified patterns from existing codebase:

### Empty State Pattern
```typescript
// Source: src/components/empty-state.tsx
// Adapt for addresses:
<div className="text-center py-16">
  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
    <Wallet className="w-8 h-8 text-muted-foreground" />
  </div>
  <h2 className="text-xl font-semibold mb-2">No addresses yet</h2>
  <p className="text-muted-foreground max-w-md mx-auto mb-6">
    Add your first pay-to address to start tracking volume for rewards.
  </p>
  <Button onClick={onAddAddress}>
    <Plus className="w-4 h-4 mr-2" />
    Add Address
  </Button>
</div>
```

### Address Count with Limit Display
```typescript
// Source: Pattern from CONTEXT.md decision
const ADDRESS_LIMIT = 5; // From D-03-01-001

<div className="flex items-center justify-between">
  <h4 className="font-medium text-sm">Registered Addresses</h4>
  <div className="flex items-center gap-3">
    <span className="text-sm text-muted-foreground">
      {addresses.length}/{ADDRESS_LIMIT} addresses
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={onAddAddress}
      disabled={addresses.length >= ADDRESS_LIMIT}
    >
      <Plus className="h-4 w-4 mr-1" />
      Add Address
    </Button>
  </div>
</div>
```

### Pending Verification Warning Banner
```typescript
// For when all addresses are unverified
const hasVerified = addresses.some(a => a.verification_status === 'verified');

{!hasVerified && addresses.length > 0 && (
  <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
    <div className="flex items-start gap-2">
      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          Verify your addresses to start earning
        </p>
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          Volume won't be tracked until at least one address is verified.
        </p>
      </div>
    </div>
  </div>
)}
```

### Unverified Card Styling (Dimmed)
```typescript
// Add opacity and warning to unverified cards
<div className={cn(
  "flex items-center justify-between p-3 rounded-lg border border-border bg-card",
  !isVerified && "opacity-60"
)}>
  {/* card content */}
  {!isVerified && (
    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
      Verify to start tracking volume
    </p>
  )}
</div>
```

### Last Address Warning in Remove Dialog
```typescript
// Check if this is the last verified address
const isLastVerified = addresses.filter(a =>
  a.verification_status === 'verified' && a.id !== addressToRemove?.id
).length === 0;

<AlertDialogDescription>
  {isLastVerified ? (
    <>
      This is your last verified address. Removing it will stop earning rewards
      until you add and verify another address.
    </>
  ) : (
    <>Volume history will be preserved.</>
  )}
</AlertDialogDescription>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Browser confirm() | Radix AlertDialog | Adopted in codebase | Better UX, accessibility |
| Inline delete buttons | Three-dot menu | Design decision | Cleaner UI, prevents accidents |

**Deprecated/outdated:**
- None identified - codebase patterns are current

## Open Questions

Things that couldn't be fully resolved:

1. **Chain icons vs text labels**
   - What we know: CONTEXT.md specifies "chain icon" in metadata
   - What's unclear: Whether to use chain-specific icons (Solana logo, Ethereum logo) or generic network icon
   - Recommendation: Use generic Wallet icon with chain type text label (e.g., "Solana" badge) - simpler, consistent with existing codebase

2. **Activity data display**
   - What we know: CONTEXT.md mentions "last transaction date or volume hint if available"
   - What's unclear: Volume tracking (Phase 6) isn't implemented yet
   - Recommendation: Show "No activity yet" placeholder; leave hook for Phase 6 integration

## Sources

### Primary (HIGH confidence)
- `/Users/rawgroundbeef/Projects/openfacilitator/apps/dashboard/src/components/rewards/address-card.tsx` - Existing component patterns
- `/Users/rawgroundbeef/Projects/openfacilitator/apps/dashboard/src/components/rewards/address-list.tsx` - Existing list component
- `/Users/rawgroundbeef/Projects/openfacilitator/apps/dashboard/src/components/ui/dropdown-menu.tsx` - Radix DropdownMenu wrapper
- `/Users/rawgroundbeef/Projects/openfacilitator/apps/dashboard/src/components/products-section.tsx` - Three-dot menu pattern
- `/Users/rawgroundbeef/Projects/openfacilitator/apps/dashboard/src/components/empty-state.tsx` - Empty state pattern
- `/Users/rawgroundbeef/Projects/openfacilitator/apps/dashboard/src/lib/api.ts` - API methods available

### Secondary (MEDIUM confidence)
- Radix UI documentation - AlertDialog component API
- `.planning/phases/05-address-ui/05-CONTEXT.md` - User decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified against existing package.json and components
- Architecture: HIGH - Directly derived from existing codebase patterns
- Pitfalls: HIGH - Based on codebase patterns and CONTEXT.md decisions

**Research date:** 2026-01-19
**Valid until:** 60 days (stable UI patterns, no external dependencies changing)
