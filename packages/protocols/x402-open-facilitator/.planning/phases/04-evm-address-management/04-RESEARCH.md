# Phase 4: EVM Address Management - Research

**Researched:** 2026-01-19
**Domain:** EVM wallet connection, EIP-191 message signing, address verification
**Confidence:** HIGH

## Summary

Phase 4 implements EVM address enrollment for the rewards program, mirroring the Solana flow from Phase 3. The codebase already has substantial foundation:

1. **Wallet libraries installed** - `wagmi@2.14.1` and `viem@2.21.0` are already in the dashboard package, and `viem` is in the server package
2. **Database layer complete** - `reward_addresses` table already supports `chain_type: 'evm'` with lowercase normalization (per D-01-01-002)
3. **API routes ready** - `/api/rewards/enroll` endpoint exists but only validates Solana signatures currently; needs EVM verification branch
4. **Frontend patterns established** - Enrollment modal, address list, and address card components exist from Phase 3 and can be extended
5. **Provider structure ready** - QueryClientProvider already exists which wagmi also requires

The main work is: (1) Add wagmi provider with EVM config to dashboard, (2) Create EVM wallet connection UI in enrollment modal, (3) Add server-side EIP-191 signature verification using viem, (4) Extend enroll endpoint to handle EVM signatures.

**Primary recommendation:** Use wagmi v2 with `useSignMessage` hook for client-side signing, and viem's `verifyMessage` for server-side verification. Reuse the existing enrollment modal with a chain type selector.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `wagmi` | ^2.14.1 | React hooks for EVM wallet interaction | Already in dashboard, standard for React dApps |
| `viem` | ^2.21.0 | EVM utilities including signature verification | Already in dashboard, server, and core packages |
| `@tanstack/react-query` | ^5.x | Async state management for wagmi | Already installed for existing queries |

### No Additional Installation Required
| Library | Status | Notes |
|---------|--------|-------|
| `wagmi` | Installed | v2.14.1 - modern hooks-based API |
| `viem` | Installed | v2.21.0 - signature utilities |
| `@tanstack/react-query` | Installed | Required by wagmi, already in use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `wagmi` | `ethers.js` | wagmi is already installed, has React hooks |
| `viem` | `ethers.js` | viem is already installed, lighter weight |
| Custom connect modal | RainbowKit/ConnectKit | Adds another dependency, wagmi is sufficient |

**Installation:**
```bash
# No installation needed - wagmi and viem already present
# Just need to configure and use
```

## Architecture Patterns

### Recommended Project Structure
```
apps/dashboard/src/
├── components/
│   ├── providers/
│   │   ├── solana-provider.tsx     # Existing Solana wallet adapter
│   │   └── evm-provider.tsx        # NEW: Wagmi provider config
│   └── rewards/
│       ├── enrollment-modal.tsx    # MODIFY: Add EVM tab/option
│       ├── chain-selector.tsx      # NEW: Solana/EVM toggle
│       └── evm-wallet-connect.tsx  # NEW: EVM-specific connect flow
├── lib/
│   ├── solana/
│   │   └── verification.ts         # Existing Solana verification
│   └── evm/
│       └── verification.ts         # NEW: EVM signAndEnroll
└── config/
    └── wagmi.ts                    # NEW: Wagmi configuration

packages/server/src/
├── routes/
│   └── rewards.ts                  # MODIFY: Add EVM verification branch
└── utils/
    ├── solana-verify.ts            # Existing Solana verification
    └── evm-verify.ts               # NEW: EIP-191 verification
```

### Pattern 1: Wagmi Provider Setup with SSR
**What:** Configure wagmi with SSR support for Next.js
**When to use:** Root provider setup
**Example:**
```typescript
// Source: https://wagmi.sh/react/guides/ssr
'use client';

import { createConfig, http, cookieStorage, createStorage } from 'wagmi';
import { mainnet, base, polygon } from 'wagmi/chains';
import { WagmiProvider, type State } from 'wagmi';
import { injected, metaMask, safe } from 'wagmi/connectors';

const config = createConfig({
  chains: [mainnet, base, polygon],
  connectors: [
    injected(),
    metaMask(),
    safe(),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
  },
});

export function EVMProvider({
  children,
  initialState
}: {
  children: React.ReactNode;
  initialState?: State;
}) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      {children}
    </WagmiProvider>
  );
}
```

### Pattern 2: Message Signing with useSignMessage
**What:** Sign verification message with connected EVM wallet
**When to use:** After wallet connection, in enrollment flow
**Example:**
```typescript
// Source: https://wagmi.sh/react/api/hooks/useSignMessage
'use client';

import { useSignMessage, useAccount } from 'wagmi';
import { api } from '@/lib/api';

export function createVerificationMessage(address: string): string {
  // Must match server-side exactly
  return `OpenFacilitator Rewards

Sign to verify ownership of:
${address}

This will not cost any ETH.`;
}

export async function signAndEnrollEVM(
  signMessageAsync: (args: { message: string }) => Promise<string>,
  address: string
): Promise<{ success: boolean; error?: string }> {
  const message = createVerificationMessage(address);

  try {
    const signature = await signMessageAsync({ message });

    await api.enrollInRewards({
      chain_type: 'evm',
      address,
      signature,
      message,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      // Handle user rejection gracefully
      if (error.message.includes('rejected') || error.message.includes('denied')) {
        return { success: false, error: 'Signature request was rejected' };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown error' };
  }
}
```

### Pattern 3: Server-Side EIP-191 Verification
**What:** Verify signature on server before saving address
**When to use:** In /api/rewards/enroll endpoint for EVM addresses
**Example:**
```typescript
// Source: https://viem.sh/docs/utilities/verifyMessage
import { verifyMessage, getAddress, isAddress } from 'viem';

/**
 * Create verification message for EVM address.
 * MUST match client-side createVerificationMessage exactly.
 */
export function createEVMVerificationMessage(address: string): string {
  return `OpenFacilitator Rewards

Sign to verify ownership of:
${address}

This will not cost any ETH.`;
}

/**
 * Verify an EIP-191 signature from an EVM wallet.
 * Uses viem's verifyMessage which handles the Ethereum prefix internally.
 */
export async function verifyEVMSignature(
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    // Validate address format
    if (!isAddress(address, { strict: false })) {
      return false;
    }

    // Normalize to checksum format for verification
    const checksumAddress = getAddress(address);

    // Verify signature (viem handles EIP-191 prefix)
    const isValid = await verifyMessage({
      address: checksumAddress,
      message,
      signature: signature as `0x${string}`,
    });

    return isValid;
  } catch {
    return false;
  }
}
```

### Pattern 4: Wallet Connection UI
**What:** Provide wallet selection and connection flow
**When to use:** In enrollment modal when EVM is selected
**Example:**
```typescript
// Source: https://wagmi.sh/react/guides/connect-wallet
'use client';

import { useConnect, useAccount, useDisconnect, useConnectors } from 'wagmi';

export function EVMWalletConnect({ onConnected }: { onConnected: (address: string) => void }) {
  const { connect } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const connectors = useConnectors();

  // When connected, notify parent
  useEffect(() => {
    if (isConnected && address) {
      onConnected(address);
    }
  }, [isConnected, address, onConnected]);

  if (isConnected) {
    return (
      <div>
        <p>Connected: {address}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
        >
          {connector.name}
        </button>
      ))}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Not normalizing addresses for comparison:** EVM addresses are case-insensitive; normalize to lowercase before DB operations
- **Checking signature against lowercase address:** verifyMessage needs checksum address; recover then normalize
- **Not handling user rejection:** Users can cancel signing; handle gracefully without breaking the flow
- **SSR hydration mismatches:** Use `ssr: true` and cookie storage in wagmi config
- **Hardcoding chain IDs:** Support multiple EVM chains for flexibility

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EIP-191 message prefix | Manual prefix concatenation | viem `verifyMessage` | Handles prefix automatically |
| Address checksumming | Custom implementation | viem `getAddress` | EIP-55 compliant |
| Address validation | Regex patterns | viem `isAddress` | Handles edge cases |
| Wallet connection | Custom per-wallet code | wagmi connectors | Handles 10+ wallets uniformly |
| Signature verification | Manual ecrecover | viem `verifyMessage` | Audited, handles edge cases |

**Key insight:** viem and wagmi handle all the complexity of EIP-191 signing and verification. The `verifyMessage` function automatically prefixes the message with the Ethereum Signed Message header.

## Common Pitfalls

### Pitfall 1: Address Case Sensitivity in Comparisons
**What goes wrong:** Signature verifies but address comparison fails
**Why it happens:** `verifyMessage` returns checksummed address, DB stores lowercase
**How to avoid:**
- Always normalize addresses to lowercase before DB operations
- Use `getAddress(address).toLowerCase()` for consistent handling
- Database already normalizes EVM addresses per D-01-01-002
**Warning signs:** "Address already registered" for addresses that should match

### Pitfall 2: SSR Hydration Errors
**What goes wrong:** `Hydration failed because the initial UI does not match` errors
**Why it happens:** wagmi state differs between server and client renders
**How to avoid:**
- Use `ssr: true` in wagmi config
- Use `cookieStorage` for state persistence
- Pass `initialState` from server to client via cookies
- Keep EVMProvider as a client component with 'use client'
**Warning signs:** Console errors about hydration, flash of disconnected state

### Pitfall 3: User Rejected Signature Not Handled
**What goes wrong:** App crashes or gets stuck when user cancels signing
**Why it happens:** Promise rejection not caught properly
**How to avoid:**
- Wrap `signMessageAsync` in try/catch
- Check error message for 'rejected', 'denied', 'cancelled' strings
- Reset UI state and allow retry
- Show user-friendly error message
**Warning signs:** Unhandled promise rejection in console

### Pitfall 4: Message Mismatch Between Client and Server
**What goes wrong:** Valid signatures rejected by server
**Why it happens:** Different message content or encoding
**How to avoid:**
- Define message template in shared location or duplicate exactly
- Use identical string including whitespace and newlines
- Include address in message to bind signature to specific address
- Test with actual wallet signing
**Warning signs:** "Invalid signature" for known-good signatures

### Pitfall 5: Wrong Signature Format
**What goes wrong:** Signature verification fails even with correct address
**Why it happens:** Signature not in `0x${string}` hex format expected by viem
**How to avoid:**
- wagmi `signMessageAsync` returns hex string with `0x` prefix
- Cast to `0x${string}` type for viem functions
- Don't strip or modify the signature
**Warning signs:** Type errors about signature format

### Pitfall 6: Cannot Re-request Signature After Rejection
**What goes wrong:** After user rejects once, subsequent signing requests fail
**Why it happens:** MetaMask may cache rejection state
**How to avoid:**
- Disconnect wallet and reconnect for fresh state
- Use the `reset` function from `useSignMessage`
- Clear wagmi state before retry
**Warning signs:** "Method not authorized" errors after previous rejection

## Code Examples

Verified patterns from official sources:

### Complete EVM Verification Message Format
```typescript
// Client and server must use IDENTICAL message format
const createVerificationMessage = (address: string): string => {
  return `OpenFacilitator Rewards

Sign to verify ownership of:
${address}

This will not cost any ETH.`;
};
```

### Using wagmi Hooks Together
```typescript
// Source: https://wagmi.sh/react/guides/connect-wallet
'use client';

import { useAccount, useConnect, useSignMessage, useDisconnect } from 'wagmi';

function EnrollmentFlow() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync, isPending } = useSignMessage();
  const { disconnect } = useDisconnect();

  const handleEnroll = async () => {
    if (!address) return;

    const message = createVerificationMessage(address);
    const signature = await signMessageAsync({ message });

    // Send to API...
  };

  // Component JSX...
}
```

### Server-side Verification with Address Normalization
```typescript
// packages/server/src/utils/evm-verify.ts
import { verifyMessage, getAddress, isAddress } from 'viem';

export async function verifyEVMSignature(
  address: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    if (!isAddress(address, { strict: false })) {
      return false;
    }

    // verifyMessage needs checksum address
    const checksumAddress = getAddress(address);

    return await verifyMessage({
      address: checksumAddress,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

// For DB storage, normalize to lowercase (per D-01-01-002)
export function normalizeEVMAddress(address: string): string {
  return address.toLowerCase();
}
```

### Extending Enroll Endpoint for EVM
```typescript
// In packages/server/src/routes/rewards.ts
if (chain_type === 'evm') {
  const expectedMessage = createEVMVerificationMessage(address);
  if (message !== expectedMessage) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Message format mismatch',
    });
  }

  if (!await verifyEVMSignature(address, signature, message)) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Invalid signature - could not verify address ownership',
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ethers.js` for everything | `viem` + `wagmi` | 2023+ | Lighter, better TypeScript support |
| Custom wallet detection | wagmi EIP-6963 discovery | 2024+ | Auto-detects injected wallets |
| Manual signature prefix | viem auto-prefix | N/A | Less error-prone |
| Session storage | Cookie storage + SSR | wagmi v2 | Better Next.js App Router support |

**Deprecated/outdated:**
- Manual Ethereum message prefix handling (use viem)
- ethers.js in new wagmi projects (use viem)
- Web3Modal v2 (superseded by v3+, but wagmi native is sufficient)

## Open Questions

Things that couldn't be fully resolved:

1. **Chain Display in UI**
   - What we know: Database stores `chain_type: 'evm'` not specific chain
   - What's unclear: Should UI show which EVM chain the address is from?
   - Recommendation: **Chain-agnostic** - EVM addresses work across all EVM chains. Just show "EVM" badge.

2. **WalletConnect Project ID**
   - What we know: WalletConnect connector requires a project ID from cloud.walletconnect.com
   - What's unclear: Whether to include WalletConnect or stick with injected wallets only
   - Recommendation: **Start with injected + metaMask connectors** (covers most users), add WalletConnect later if needed

3. **Consistent UI Between Solana and EVM**
   - What we know: Phase 3 uses Solana wallet adapter modal
   - What's unclear: Should EVM use identical modal pattern or different?
   - Recommendation: **Add chain selector tab** to existing enrollment modal, keep flows parallel

## Sources

### Primary (HIGH confidence)
- [Wagmi Connect Wallet Guide](https://wagmi.sh/react/guides/connect-wallet) - Provider setup, useConnect
- [Wagmi useSignMessage API](https://wagmi.sh/react/api/hooks/useSignMessage) - Signing hook documentation
- [Wagmi SSR Guide](https://wagmi.sh/react/guides/ssr) - Next.js App Router configuration
- [Viem verifyMessage](https://viem.sh/docs/utilities/verifyMessage) - Signature verification
- [Viem getAddress](https://viem.sh/docs/utilities/getAddress) - Address normalization
- Existing codebase: `packages/server/src/db/reward-addresses.ts`, `apps/dashboard/src/lib/solana/verification.ts`

### Secondary (MEDIUM confidence)
- [EIP-191 Specification](https://eips.ethereum.org/EIPS/eip-191) - Signed data standard
- [EIP-55 Checksum](https://eips.ethereum.org/EIPS/eip-55) - Address checksumming
- [GitHub wagmi Issues](https://github.com/wevm/wagmi/issues/1499) - User rejection handling

### Tertiary (LOW confidence)
- Medium articles on wagmi v2 setup - general guidance, verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - wagmi and viem already installed, official documentation clear
- Architecture: HIGH - Mirrors Phase 3 patterns, official wagmi examples
- Pitfalls: HIGH - Well-documented issues in wagmi GitHub discussions

**Research date:** 2026-01-19
**Valid until:** 30 days (wagmi v2 ecosystem is stable)
