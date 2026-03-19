# Phase 9: Wallet Connection - Research

**Researched:** 2026-01-20
**Domain:** Solana wallet adapter for token claiming UX
**Confidence:** HIGH

## Summary

Phase 9 implements wallet connection for claiming $OPEN token rewards. This is distinct from Phase 3/4 wallet connection which was for ADDRESS VERIFICATION (proving ownership of pay-to addresses). Phase 9 wallet connection is EPHEMERAL - user connects a Solana wallet at claim time to specify where tokens should be sent.

Key insight from CONTEXT.md: No permanent wallet storage is needed. Users can connect a different wallet each time they claim. The `claim_wallet` field on `RewardClaimRecord` stores which wallet received each claim (for history purposes only).

**Primary recommendation:** Reuse existing SolanaProvider and wallet adapter hooks. Create a ClaimModal component following the EnrollmentModal pattern but without signature verification - just wallet connection for receiving address.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @solana/wallet-adapter-react | ^0.15.39 | React hooks for wallet state | Official Solana adapter |
| @solana/wallet-adapter-react-ui | ^0.9.39 | Wallet modal UI components | Official modal provider |
| @solana/wallet-adapter-base | ^0.9.27 | Base types and utilities | Required foundation |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @solana/web3.js | ^1.98.4 | Solana RPC and types | PublicKey handling |

### No New Dependencies Needed
This phase uses entirely existing infrastructure. No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── rewards/
│       ├── claim-modal.tsx          # NEW: Modal for claim flow
│       ├── claim-button.tsx         # NEW: Button to trigger claiming
│       └── campaign-history.tsx     # MODIFY: Add claim button for pending
├── lib/
│   └── api.ts                       # MODIFY: Add initiateClaim endpoint
```

### Pattern 1: Ephemeral Wallet Connection (from CONTEXT.md)
**What:** User connects wallet ONLY at claim time, not stored to account
**When to use:** Each claim is independent - wallet specified per-claim
**Example:**
```typescript
// Source: Existing EnrollmentModal pattern + CONTEXT.md decisions
function ClaimModal({ claimId, amount, onSuccess }: ClaimModalProps) {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  // User clicks "Connect Wallet" -> wallet modal opens
  // Once connected, show confirmation: "Send X $OPEN to {wallet}"
  // User confirms -> API call with claim_wallet = publicKey

  const handleClaim = async () => {
    if (!publicKey) return;
    await api.initiateClaim(claimId, publicKey.toBase58());
    onSuccess();
  };

  return (
    <Dialog>
      {!connected ? (
        <Button onClick={() => setVisible(true)}>Connect Wallet</Button>
      ) : (
        <>
          <p>Send {amount} $OPEN to:</p>
          <code>{publicKey.toBase58()}</code>
          <Button onClick={handleClaim}>Confirm Claim</Button>
        </>
      )}
    </Dialog>
  );
}
```

### Pattern 2: Wallet Modal Trigger
**What:** Programmatically open wallet modal using useWalletModal hook
**When to use:** When button click should open wallet selection
**Example:**
```typescript
// Source: Existing EnrollmentModal (enrollment-modal.tsx:37,65)
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

const { setVisible } = useWalletModal();

// Trigger modal open
const handleConnect = () => {
  setVisible(true);
};
```

### Pattern 3: Claim Flow State Machine
**What:** Multi-step flow: idle -> connecting -> confirming -> processing -> success/error
**When to use:** For claim modal with multiple states
**Example:**
```typescript
type ClaimStatus = 'idle' | 'connecting' | 'confirming' | 'processing' | 'success' | 'error';

function ClaimModal() {
  const [status, setStatus] = useState<ClaimStatus>('idle');
  const { connected, publicKey } = useWallet();

  // When wallet connects, move to confirming
  useEffect(() => {
    if (status === 'connecting' && connected && publicKey) {
      setStatus('confirming');
    }
  }, [connected, publicKey, status]);

  // Render based on status
  switch (status) {
    case 'idle': return <ConnectPrompt />;
    case 'connecting': return <Loader text="Connecting..." />;
    case 'confirming': return <ConfirmationScreen />;
    case 'processing': return <Loader text="Processing claim..." />;
    case 'success': return <SuccessScreen />;
    case 'error': return <ErrorScreen />;
  }
}
```

### Anti-Patterns to Avoid
- **Storing claim wallet permanently:** CONTEXT.md specifies ephemeral connection - no pre-setup required
- **Requiring signature verification:** Unlike enrollment, claiming doesn't need to prove ownership - wallet connection IS proof of control
- **EVM wallet for claiming:** $OPEN is SPL token, Solana wallet required (explicit messaging needed for EVM-only users)
- **Pre-selecting from tracked addresses:** Claim wallet can be ANY Solana wallet, not limited to tracked pay-to addresses

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wallet connection UI | Custom wallet list/buttons | WalletModalProvider + setVisible(true) | Standard UI users expect, handles all wallets |
| Wallet state | Custom useState for wallet | useWallet() hook | Handles connection lifecycle, errors |
| PublicKey formatting | String manipulation | publicKey.toBase58() | Proper Solana address encoding |
| Modal open/close | Custom modal state | useWalletModal().setVisible | Integrated with wallet adapter |

**Key insight:** The entire wallet connection infrastructure exists. Phase 9 is primarily UI work to create the claiming flow using existing hooks.

## Common Pitfalls

### Pitfall 1: Wallet Not Ready After Connection
**What goes wrong:** Accessing publicKey immediately after setVisible(true) returns null
**Why it happens:** Connection is async, wallet state updates on next render
**How to avoid:** Use useEffect to watch for (connected && publicKey) before proceeding
**Warning signs:** "Cannot read property 'toBase58' of null" errors

### Pitfall 2: Modal Closes But Wallet Not Connected
**What goes wrong:** User closes modal without selecting wallet, app stuck in "connecting" state
**Why it happens:** No handler for modal close without connection
**How to avoid:** Reset to idle state when modal closes and wallet not connected
**Warning signs:** Perpetual loading spinner

### Pitfall 3: EVM-Only Users Confused
**What goes wrong:** Users with only EVM wallets don't understand why they can't claim
**Why it happens:** $OPEN is SPL token, requires Solana wallet
**How to avoid:** Clear messaging: "Connect Solana wallet to receive $OPEN" with help link
**Warning signs:** Support requests about "wrong wallet type"

### Pitfall 4: Multiple Claims to Same Wallet Assumption
**What goes wrong:** Building UI assuming user claims to same wallet repeatedly
**Why it happens:** Developer assumption about typical behavior
**How to avoid:** Per CONTEXT.md, each claim is independent - don't remember previous claim wallets
**Warning signs:** UI that "remembers" or "suggests" previous claim wallet

### Pitfall 5: Forgetting Disconnect on Modal Close
**What goes wrong:** User closes claim modal but wallet stays connected, affects other parts of app
**Why it happens:** Wallet adapter persists connection state
**How to avoid:** Call disconnect() when claim modal closes (following EnrollmentModal pattern)
**Warning signs:** Wallet connection persisting unexpectedly across page navigation

## Code Examples

Verified patterns from existing codebase:

### Wallet Connection with Modal (from enrollment-modal.tsx)
```typescript
// Source: apps/dashboard/src/components/rewards/enrollment-modal.tsx
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

const wallet = useWallet();
const { publicKey, connected, disconnect } = wallet;
const { setVisible } = useWalletModal();

// Open wallet modal
const handleConnect = useCallback(() => {
  setStatus('connecting');
  setErrorMessage(null);
  setVisible(true);
}, [setVisible]);

// Watch for connection
useEffect(() => {
  if (status === 'connecting' && connected && publicKey) {
    // Wallet connected, proceed to next step
    handleNextStep();
  }
}, [connected, publicKey, status]);

// Clean up on modal close
const handleClose = useCallback((newOpen: boolean) => {
  if (!newOpen) {
    setStatus('idle');
    setErrorMessage(null);
    disconnect();
  }
  onOpenChange(newOpen);
}, [onOpenChange, disconnect]);
```

### SolanaProvider Setup (existing)
```typescript
// Source: apps/dashboard/src/components/providers/solana-provider.tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

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

### Existing Database Schema (claim_wallet field)
```typescript
// Source: packages/server/src/db/types.ts (RewardClaimRecord)
export interface RewardClaimRecord {
  id: string;
  user_id: string;
  campaign_id: string;
  volume_amount: string;
  base_reward_amount: string;
  multiplier: number;
  final_reward_amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  claim_wallet: string | null;  // <-- Wallet used for THIS claim
  tx_signature: string | null;
  claimed_at: string | null;
  created_at: string;
}
```

### API Client Pattern (for new endpoint)
```typescript
// Source: apps/dashboard/src/lib/api.ts (pattern for new method)
async initiateClaim(claimId: string, walletAddress: string): Promise<{
  success: boolean;
  txSignature?: string;
  error?: string;
}> {
  return this.request(`/api/rewards/claims/${claimId}/initiate`, {
    method: 'POST',
    body: JSON.stringify({ claim_wallet: walletAddress }),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WalletMultiButton component | useWalletModal + custom button | Always supported | More control over UX |
| Manual wallet list | Empty wallets array (auto-detect) | Wallet adapter v0.15+ | Simpler setup |
| Require wallet pre-connection | Connect at action time | Best practice | Better UX |

**Deprecated/outdated:**
- Manually listing wallet adapters in WalletProvider: Empty array now auto-detects standard wallets (Phantom, Solflare, Backpack, etc.)

## Open Questions

Things that couldn't be fully resolved:

1. **Pre-selecting already-connected wallet**
   - What we know: CONTEXT.md lists this as Claude's discretion
   - What's unclear: Should we auto-use wallet if already connected from enrollment?
   - Recommendation: If wallet already connected, skip to confirmation screen. User can disconnect and reconnect different wallet if desired.

2. **Wallet persistence during claim session**
   - What we know: Listed as Claude's discretion
   - What's unclear: Should wallet stay connected between multiple claims?
   - Recommendation: Disconnect on modal close (match EnrollmentModal pattern). For rare claiming events, fresh connection each time is fine.

3. **Wallet disconnect mid-flow**
   - What we know: Listed as Claude's discretion
   - What's unclear: Exact handling if user disconnects during confirmation
   - Recommendation: Reset to idle state, show "Wallet disconnected" message with "Reconnect" button.

4. **Info notice when claim wallet differs from tracked addresses**
   - What we know: CONTEXT.md says claiming wallet separate from tracked addresses
   - What's unclear: Should we show informational notice?
   - Recommendation: No notice needed. This is expected behavior - don't add friction.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `enrollment-modal.tsx`, `solana-provider.tsx`, `types.ts`
- CONTEXT.md decisions from /gsd:discuss-phase

### Secondary (MEDIUM confidence)
- [Solana Cookbook: Connect Wallet React](https://solana.com/developers/cookbook/wallets/connect-wallet-react) - Provider structure
- [GitHub wallet-adapter APP.md](https://github.com/anza-xyz/wallet-adapter/blob/master/APP.md) - Hook documentation

### Tertiary (LOW confidence)
- WebSearch for general DeFi claiming UX patterns (verified against existing code patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already installed and used in codebase
- Architecture: HIGH - Following existing EnrollmentModal pattern
- Pitfalls: HIGH - Based on existing code patterns and CONTEXT.md decisions

**Research date:** 2026-01-20
**Valid until:** 60 days (stable libraries, existing patterns)
