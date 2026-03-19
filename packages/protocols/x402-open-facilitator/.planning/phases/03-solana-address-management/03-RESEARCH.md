# Phase 3: Solana Address Management - Research

**Researched:** 2026-01-19
**Domain:** Solana wallet connection, message signing, address verification
**Confidence:** HIGH

## Summary

Phase 3 implements the enrollment flow for the rewards program where users connect their Solana pay-to wallet, sign a verification message, and complete enrollment. The codebase already has substantial foundation:

1. **Database layer complete** - `reward_addresses` table exists with `verification_status` field, address normalization, and all CRUD operations
2. **API routes partially built** - `/api/rewards/status` and `/api/rewards/enroll` exist but enrollment lacks signature verification
3. **Solana utilities exist** - `@solana/web3.js`, `bs58`, and `@noble/curves` are already installed; `isValidSolanaAddress()` exists in `@openfacilitator/core`
4. **Frontend patterns established** - Dialog components, `useMutation` patterns, toast notifications, and auth context all in place

The main work is: (1) Add Solana wallet adapter to dashboard, (2) Build enrollment modal with wallet connection and signing, (3) Add server-side signature verification to enroll endpoint, (4) Build address list view with removal capability.

**Primary recommendation:** Use `@solana/wallet-adapter-react` with `@noble/curves/ed25519` for signature verification. Follow the atomic connect-sign-save flow specified in CONTEXT.md.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@solana/web3.js` | ^1.98.4 | Solana SDK, PublicKey validation | Already in core and server packages |
| `bs58` | ^6.0.0 | Base58 encoding/decoding | Already installed, standard for Solana |
| `@noble/curves` | ^1.8+ | Ed25519 signature verification | Already installed via other deps |

### To Install (Dashboard)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@solana/wallet-adapter-react` | ^0.15+ | React hooks for wallet connection | All wallet interactions |
| `@solana/wallet-adapter-react-ui` | ^0.9+ | Pre-built wallet modal UI | Wallet selection modal |
| `@solana/wallet-adapter-wallets` | ^0.19+ | Wallet adapter implementations | Supporting multiple wallets |
| `@solana/wallet-adapter-base` | ^0.9+ | Base types and utilities | Required dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@solana/wallet-adapter-*` | Raw wallet extensions | Wallet adapter is standard, handles all wallets uniformly |
| `@noble/curves` | `tweetnacl` | Noble is already installed and more modern |
| Custom modal | `@solana/wallet-adapter-react-ui` | Standard UI, users recognize the modal pattern |

**Installation:**
```bash
# Dashboard package
cd apps/dashboard
pnpm add @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets @solana/wallet-adapter-base
```

## Architecture Patterns

### Recommended Project Structure
```
apps/dashboard/src/
├── components/
│   ├── providers/
│   │   └── solana-provider.tsx     # Wallet adapter providers (NEW)
│   └── rewards/
│       ├── enrollment-modal.tsx     # Main enrollment flow (NEW)
│       ├── address-list.tsx         # List of registered addresses (NEW)
│       └── address-card.tsx         # Individual address display (NEW)
├── lib/
│   └── solana/
│       └── verify-message.ts        # Client-side verification (NEW)
└── hooks/
    └── use-enrollment.ts            # Enrollment mutation hook (NEW)

packages/server/src/
├── routes/
│   └── rewards.ts                   # Add verify endpoint (MODIFY)
└── utils/
    └── solana-verify.ts             # Server signature verification (NEW)
```

### Pattern 1: Solana Provider Setup
**What:** Wrap app with wallet adapter providers
**When to use:** Root layout, needed for all wallet interactions
**Example:**
```typescript
// Source: https://solana.com/developers/cookbook/wallets/connect-wallet-react
"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

export const SolanaProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
```

### Pattern 2: Message Signing with useWallet
**What:** Sign verification message with connected wallet
**When to use:** After wallet connection, before enrollment
**Example:**
```typescript
// Source: https://github.com/anza-xyz/wallet-adapter/blob/master/packages/starter/example/src/components/SignMessage.tsx
import { useWallet } from '@solana/wallet-adapter-react';
import { ed25519 } from '@noble/curves/ed25519';
import bs58 from 'bs58';

const { publicKey, signMessage } = useWallet();

const onClick = async () => {
  if (!publicKey) throw new Error('Wallet not connected!');
  if (!signMessage) throw new Error('Wallet does not support message signing!');

  const message = new TextEncoder().encode(
    `OpenFacilitator Rewards\n\nSign to verify ownership of:\n${publicKey.toBase58()}\n\nThis will not cost any SOL.`
  );
  const signature = await signMessage(message);

  // Client-side verification (optional, server will verify)
  if (!ed25519.verify(signature, message, publicKey.toBytes())) {
    throw new Error('Message signature invalid!');
  }

  return { address: publicKey.toBase58(), signature: bs58.encode(signature) };
};
```

### Pattern 3: Server-Side Signature Verification
**What:** Verify signature on server before saving address
**When to use:** In /api/rewards/enroll endpoint
**Example:**
```typescript
// Server-side verification
import { ed25519 } from '@noble/curves/ed25519';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

function verifySignature(
  address: string,
  signature: string,
  message: string
): boolean {
  try {
    const publicKey = new PublicKey(address);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);

    return ed25519.verify(signatureBytes, messageBytes, publicKey.toBytes());
  } catch {
    return false;
  }
}

// In endpoint:
const expectedMessage = `OpenFacilitator Rewards\n\nSign to verify ownership of:\n${address}\n\nThis will not cost any SOL.`;
if (!verifySignature(address, signature, expectedMessage)) {
  return res.status(400).json({ error: 'Invalid signature' });
}
```

### Anti-Patterns to Avoid
- **Storing unverified addresses:** CONTEXT.md specifies atomic flow - only save after verification succeeds
- **Custom wallet connection UI:** Use standard `WalletModalProvider` - users recognize it
- **Client-only verification:** Always verify on server before database write
- **Blocking signature errors:** Show clear error, allow retry immediately

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wallet connection | Custom adapter per wallet | `@solana/wallet-adapter-*` | Handles 10+ wallets uniformly |
| Wallet selection UI | Custom modal | `WalletModalProvider` | Recognized pattern, handles all states |
| Signature verification | Custom ed25519 impl | `@noble/curves/ed25519` | Audited, already installed |
| Address validation | Regex patterns | `new PublicKey(address)` | Catches all edge cases, already in core |
| Base58 encoding | Custom implementation | `bs58` | Already installed, battle-tested |

**Key insight:** Solana wallet adapter is the standard - every dApp uses it. Users expect the modal pattern.

## Common Pitfalls

### Pitfall 1: SSR Issues with Wallet Adapter
**What goes wrong:** `ReferenceError: window is not defined` during Next.js SSR
**Why it happens:** Wallet adapter accesses browser APIs not available server-side
**How to avoid:**
- Use `'use client'` directive on components using wallet hooks
- Dynamic import `WalletModalProvider` with `{ ssr: false }` if needed
**Warning signs:** Build errors mentioning `window` or `localStorage`

### Pitfall 2: Message Mismatch Between Client and Server
**What goes wrong:** Valid signatures rejected by server
**Why it happens:** Different message encoding or content on client vs server
**How to avoid:**
- Define message template in one place, share between client/server
- Use identical `TextEncoder().encode()` on both sides
- Include address in message to bind signature to specific address
**Warning signs:** "Invalid signature" errors for known-good signatures

### Pitfall 3: Wallet Not Supporting signMessage
**What goes wrong:** Runtime error when user connects unsupported wallet
**Why it happens:** Not all wallets implement message signing
**How to avoid:**
- Check `signMessage !== undefined` before attempting
- Show clear error: "This wallet doesn't support message signing"
- All major wallets (Phantom, Solflare, Backpack) support it
**Warning signs:** `signMessage is undefined` errors in console

### Pitfall 4: Duplicate Address Registration
**What goes wrong:** Constraint violation or user confusion
**Why it happens:** User tries to register same address twice, or address already registered by another user
**How to avoid:**
- Database has `UNIQUE(user_id, address)` - handles same user case
- Query `getRewardAddressByAddress()` to check global uniqueness before insert
- Return specific error messages for each case
**Warning signs:** "UNIQUE constraint failed" in error logs

### Pitfall 5: Forgetting to Refresh Auth Context
**What goes wrong:** `isEnrolled` stays false after successful enrollment
**Why it happens:** Auth context caches rewards status
**How to avoid:**
- Call `refetchRewardsStatus()` from auth context after successful enrollment
- Function already exists in `AuthProvider`
**Warning signs:** Banner still shows after enrollment completes

## Code Examples

Verified patterns from official sources and existing codebase:

### Verification Message Format
```typescript
// Recommended message format (Claude's discretion per CONTEXT.md)
const createVerificationMessage = (address: string): string => {
  return `OpenFacilitator Rewards

Sign to verify ownership of:
${address}

This will not cost any SOL.`;
};
```

### Address Validation (Already Exists)
```typescript
// Source: packages/core/src/solana.ts
import { PublicKey } from '@solana/web3.js';

export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
```

### Existing Enrollment Endpoint Pattern
```typescript
// Source: packages/server/src/routes/rewards.ts (to modify)
router.post('/enroll', requireAuth, async (req, res) => {
  // Existing: validates chain_type, address
  // TO ADD: signature verification before createRewardAddress()
  // TO ADD: mark as verified immediately (atomic flow)
});
```

### Using Auth Context (Existing Pattern)
```typescript
// Source: apps/dashboard/src/components/auth/auth-provider.tsx
const { isEnrolled, refetchRewardsStatus } = useAuth();

// After successful enrollment:
await refetchRewardsStatus();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tweetnacl for verification | @noble/curves | 2023+ | Better security, audited, already installed |
| Custom wallet adapters | @solana/wallet-adapter-* | 2022+ | Standard pattern, all wallets supported |
| Connect then sign separately | Atomic connect+sign flow | N/A | Better UX per CONTEXT.md |

**Deprecated/outdated:**
- Manual wallet detection (use adapter)
- tweetnacl for new projects (use @noble/curves)

## Open Questions

Things that couldn't be fully resolved:

1. **Address Limit Per User**
   - What we know: CONTEXT.md says "reasonable limit" and "Claude decides specific number"
   - What's unclear: Exact number
   - Recommendation: **5 addresses per user** - enough for multiple pay-to addresses without enabling abuse

2. **Post-Enrollment Banner Behavior**
   - What we know: CONTEXT.md lists this as "Claude's Discretion"
   - What's unclear: Show different message? Hide entirely?
   - Recommendation: Hide banner once enrolled (cleaner UX), show address count elsewhere

3. **Volume Display Format**
   - What we know: Address list should show "volume tracked"
   - What's unclear: Format and source (volume_snapshots table exists)
   - Recommendation: Show "$X tracked" or "Tracking started" if zero volume yet

## Sources

### Primary (HIGH confidence)
- [Solana Cookbook - Connect Wallet React](https://solana.com/developers/cookbook/wallets/connect-wallet-react) - Provider setup, useWallet
- [Solana Cookbook - Sign Message](https://solana.com/developers/cookbook/wallets/sign-message) - Signature verification
- [Anza Wallet Adapter - SignMessage.tsx](https://github.com/anza-xyz/wallet-adapter/blob/master/packages/starter/example/src/components/SignMessage.tsx) - Official signing pattern
- Existing codebase: `packages/core/src/solana.ts`, `packages/server/src/db/reward-addresses.ts`

### Secondary (MEDIUM confidence)
- [QuickNode - Authenticate with Solana Wallet](https://www.quicknode.com/guides/solana-development/dapps/how-to-authenticate-users-with-a-solana-wallet) - Authentication patterns
- [@noble/curves npm](https://www.npmjs.com/package/@noble/curves) - ed25519 API documentation

### Tertiary (LOW confidence)
- Medium articles on wallet adapter setup - general guidance, verify against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Solana docs + existing codebase patterns
- Architecture: HIGH - Follows existing codebase patterns, official wallet adapter examples
- Pitfalls: HIGH - Common issues documented in official repos and guides

**Research date:** 2026-01-19
**Valid until:** 30 days (wallet adapter ecosystem is stable)
