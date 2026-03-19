# Phase 10: Claims Engine - Research

**Researched:** 2026-01-20
**Domain:** SPL Token Transfers, Claim Processing, Solana RPC
**Confidence:** HIGH

## Summary

Phase 10 implements the claims engine for the OpenFacilitator rewards program. Users who met the volume threshold during an ended campaign can claim their proportional share of $OPEN tokens. The codebase already has solid patterns for SPL token transfers (in `packages/server/src/services/claims.ts`) and claim record management (in `packages/server/src/db/reward-claims.ts`).

The implementation requires: (1) eligibility calculation combining threshold check + campaign ended status, (2) proportional share calculation with facilitator multiplier, (3) SPL token transfer execution from a rewards wallet, (4) success UI with confetti animation and Twitter/X share capability, and (5) claim history display.

**Primary recommendation:** Leverage the existing `executeGaslessSolanaTransfer` pattern from `services/claims.ts` for the reward token transfer, adapting it for the rewards wallet keypair and $OPEN token mint address.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @solana/web3.js | ^1.98.4 | Solana RPC, transactions, keypairs | Official Solana SDK |
| @solana/spl-token | ^0.4.14 | SPL token transfers, ATA management | Official SPL library |
| @solana/wallet-adapter-react | (existing) | Wallet connection in dashboard | Already used in Phase 9 |

### New Dependencies for Phase 10
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| canvas-confetti | ^1.9.3 | Confetti animation on success | Lightweight, no canvas setup needed |
| OR react-confetti-explosion | ^2.1.2 | CSS-based confetti (alternative) | Lighter, no canvas, CSS only |

**Recommendation:** Use `canvas-confetti` for its simplicity and existing pattern usage in the ecosystem. It works with any framework and doesn't require React bindings.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| canvas-confetti | react-confetti | react-confetti needs width/height props, more setup |
| Manual Twitter URL | react-share | Adds dependency for a single window.open() call |

**Installation:**
```bash
# From apps/dashboard
pnpm add canvas-confetti
pnpm add -D @types/canvas-confetti
```

## Architecture Patterns

### Recommended Flow Structure
```
User clicks Claim
    |
    v
ClaimModal opens (existing from Phase 9)
    |
    v
Connect Wallet -> Confirm Claim (two-step from CONTEXT.md)
    |
    v
API: POST /api/rewards/claims/:id/initiate
    |
    v
Backend validates eligibility:
  - Claim exists and belongs to user
  - Claim status is 'pending'
  - Campaign has ended
  - User meets threshold (volume >= threshold_amount)
    |
    v
If valid: set status='processing', store claim_wallet
    |
    v
Execute SPL transfer (rewards wallet -> claim_wallet)
    |
    v
On success: update status='completed', store tx_signature
    |
    v
Return tx_signature to frontend
    |
    v
Frontend: Show confetti + success with explorer link + share button
```

### Pattern 1: Reward Calculation (Proportional Share)
**What:** Calculate user's share of reward pool based on weighted volume
**When to use:** When campaign ends, creating claim records

```typescript
// Source: CONTEXT.md decisions + existing volume-aggregation.ts pattern
function calculateReward(
  userVolume: string,     // User's raw volume
  totalPoolVolume: string, // Sum of all qualifying users' volumes
  poolAmount: string,      // Campaign pool_amount
  isFacilitatorOwner: boolean,
  multiplier: number       // campaign.multiplier_facilitator (default 2.0)
): { baseReward: string; finalReward: string; effectiveMultiplier: number } {
  // Apply multiplier to get effective volume
  const effectiveMultiplier = isFacilitatorOwner ? multiplier : 1;
  const effectiveVolume = BigInt(userVolume) * BigInt(Math.floor(effectiveMultiplier * 100)) / 100n;

  // Proportional share: (effectiveVolume / totalPoolVolume) * poolAmount
  // Note: totalPoolVolume should already include multiplied volumes
  const baseReward = (BigInt(userVolume) * BigInt(poolAmount)) / BigInt(totalPoolVolume);
  const finalReward = (effectiveVolume * BigInt(poolAmount)) / BigInt(totalPoolVolume);

  return {
    baseReward: baseReward.toString(),
    finalReward: finalReward.toString(),
    effectiveMultiplier,
  };
}
```

### Pattern 2: SPL Token Transfer (Existing Pattern)
**What:** Transfer $OPEN tokens from rewards wallet to user's claim wallet
**When to use:** When executing a claim payout

```typescript
// Source: packages/server/src/services/claims.ts - executeGaslessSolanaTransfer
// Adapt this pattern for reward claims

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

async function executeRewardTransfer(params: {
  rewardsWalletPrivateKey: string;  // Base58 encoded
  recipientAddress: string;
  amount: string;  // In atomic units (9 decimals for $OPEN)
  tokenMint: string;  // $OPEN token mint address
}): Promise<{ success: boolean; signature?: string; error?: string }> {
  const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
  const rewardsKeypair = Keypair.fromSecretKey(bs58.decode(params.rewardsWalletPrivateKey));
  const recipientPubkey = new PublicKey(params.recipientAddress);
  const mintPubkey = new PublicKey(params.tokenMint);

  // Get ATAs
  const senderAta = await getAssociatedTokenAddress(mintPubkey, rewardsKeypair.publicKey);
  const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

  const transaction = new Transaction();

  // Check if recipient ATA exists, create if not
  try {
    await getAccount(connection, recipientAta);
  } catch {
    // Create ATA for recipient (rewards wallet pays)
    transaction.add(
      createAssociatedTokenAccountInstruction(
        rewardsKeypair.publicKey,  // Payer
        recipientAta,
        recipientPubkey,
        mintPubkey
      )
    );
  }

  // Transfer instruction
  transaction.add(
    createTransferInstruction(
      senderAta,
      recipientAta,
      rewardsKeypair.publicKey,
      BigInt(params.amount)
    )
  );

  // Sign and send
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = rewardsKeypair.publicKey;
  transaction.sign(rewardsKeypair);

  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature, 'confirmed');

  return { success: true, signature };
}
```

### Pattern 3: Confetti Animation
**What:** Celebratory confetti on successful claim
**When to use:** When claim completes successfully

```typescript
// Source: canvas-confetti npm documentation
import confetti from 'canvas-confetti';

function celebrateClaim() {
  // Fire from both sides for dramatic effect
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });

  // Optional: multiple bursts
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 }
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 }
    });
  }, 200);
}
```

### Pattern 4: Twitter/X Share Intent
**What:** Pre-filled tweet for sharing claim success
**When to use:** On claim success modal

```typescript
// Source: X Developer Platform Web Intent documentation
function shareOnTwitter(params: {
  amount: string;
  txSignature: string;
}) {
  const text = `I just claimed ${params.amount} $OPEN tokens from @OpenFacilitator rewards!`;
  const url = `https://solscan.io/tx/${params.txSignature}`;

  // X/Twitter intent URL
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  // Open in popup window (better UX than new tab)
  window.open(
    twitterUrl,
    'twitter-share',
    'width=550,height=450,menubar=no,toolbar=no,resizable=yes,scrollbars=yes'
  );
}
```

### Pattern 5: Claim Eligibility Check
**What:** Determine if user can claim for a campaign
**When to use:** Before enabling claim button, before processing claim

```typescript
// Eligibility criteria from CONTEXT.md:
// 1. Campaign has ended (now >= ends_at)
// 2. User met threshold (volume >= threshold_amount)
// 3. Within 30-day claim window (now <= ends_at + 30 days)
// 4. No existing completed claim for this campaign

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  claim?: RewardClaimRecord;
}

function checkClaimEligibility(
  userId: string,
  campaignId: string
): EligibilityResult {
  const campaign = getCampaignById(campaignId);
  if (!campaign) return { eligible: false, reason: 'Campaign not found' };

  const now = new Date();
  const endsAt = new Date(campaign.ends_at);
  const claimDeadline = new Date(endsAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Check campaign ended
  if (now < endsAt) {
    return { eligible: false, reason: 'Campaign has not ended yet' };
  }

  // Check claim window
  if (now > claimDeadline) {
    return { eligible: false, reason: 'Claim window has expired' };
  }

  // Check existing claim
  const existingClaim = getRewardClaimByUserAndCampaign(userId, campaignId);
  if (existingClaim) {
    if (existingClaim.status === 'completed') {
      return { eligible: false, reason: 'Already claimed', claim: existingClaim };
    }
    // Return existing pending/processing claim
    return { eligible: true, claim: existingClaim };
  }

  // Check threshold met
  const volumeData = getUserTotalVolume(userId, campaignId);
  if (BigInt(volumeData.total_volume) < BigInt(campaign.threshold_amount)) {
    return {
      eligible: false,
      reason: `Volume ${volumeData.total_volume} below threshold ${campaign.threshold_amount}`
    };
  }

  return { eligible: true };
}
```

### Anti-Patterns to Avoid
- **Double claiming:** Always check for existing claim record before creating new one
- **Race conditions:** Use database transactions or claim status checks to prevent concurrent claim processing
- **Floating point for tokens:** Use BigInt for all token amount calculations (9 decimals = multiply by 1e9)
- **Hardcoded RPC:** Use environment variables for Solana RPC URL
- **Blocking UI during transfer:** Keep modal open with spinner, don't close until confirmed

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token transfers | Manual instruction building | @solana/spl-token helpers | ATA creation, instruction construction handled |
| Confetti animation | CSS keyframes, canvas drawing | canvas-confetti library | Cross-browser, performance optimized |
| Twitter sharing | Embed SDK | Web Intent URL | No external script loading, simpler |
| Wallet address validation | Regex only | bs58 decode + length check | Base58 has specific character set |

**Key insight:** The codebase already has SPL token transfer logic in `services/claims.ts`. Reuse that pattern rather than building from scratch.

## Common Pitfalls

### Pitfall 1: Insufficient SOL for Transaction Fees
**What goes wrong:** Rewards wallet has tokens but no SOL for fees
**Why it happens:** Forgot to fund rewards wallet with SOL, or SOL depleted over time
**How to avoid:**
- Check SOL balance before attempting transfer
- Return clear error message: "Rewards wallet needs SOL for transaction fees"
- Consider monitoring/alerting on low SOL balance
**Warning signs:** Transfers fail with "insufficient funds for fees"

### Pitfall 2: Missing Token Account Creation
**What goes wrong:** Transfer fails because recipient doesn't have ATA for $OPEN
**Why it happens:** First-time claimant, ATA doesn't exist yet
**How to avoid:** Always check for ATA existence, create if needed (pattern above handles this)
**Warning signs:** "Account not found" errors on transfer

### Pitfall 3: Race Condition on Claim Status
**What goes wrong:** User clicks claim button twice, two transfers initiated
**Why it happens:** No locking between status check and status update
**How to avoid:**
- Update status to 'processing' atomically before starting transfer
- Disable button immediately on click (frontend)
- Backend: reject if status !== 'pending'
**Warning signs:** Duplicate claims, double payouts

### Pitfall 4: BigInt Conversion Errors
**What goes wrong:** Calculation produces wrong amounts due to precision loss
**Why it happens:** Using Number instead of BigInt for large token amounts
**How to avoid:**
- All token amounts as strings in DB and API
- Convert to BigInt for calculations
- $OPEN has 9 decimals: 1 token = 1_000_000_000 atomic units
**Warning signs:** Amounts like 1.9999999999 instead of 2

### Pitfall 5: Claim Window Expiry Not Checked
**What goes wrong:** User claims after 30-day window, system allows it
**Why it happens:** Backend doesn't validate claim window
**How to avoid:** Check `now <= campaign.ends_at + 30 days` in eligibility check
**Warning signs:** Very late claims being processed

### Pitfall 6: Wrong Token Decimals
**What goes wrong:** User receives 1 billion tokens instead of 1
**Why it happens:** Confusing $OPEN (9 decimals) with USDC (6 decimals)
**How to avoid:**
- $OPEN uses 9 decimals (standard SPL token)
- USDC uses 6 decimals
- Keep these separate, use named constants
**Warning signs:** Massive over/under payments

## Code Examples

Verified patterns from the existing codebase:

### Existing Claim Initiation Endpoint
```typescript
// Source: packages/server/src/routes/rewards.ts lines 996-1075
// Already implemented - sets claim_wallet and status='processing'
router.post('/claims/:id/initiate', requireAuth, async (req, res) => {
  // Validates ownership, status='pending', Solana address format
  // Updates: claim_wallet, status='processing'
  // Returns: { success: true, claim: updated }
});
```

### Existing Claim Record Structure
```typescript
// Source: packages/server/src/db/types.ts
interface RewardClaimRecord {
  id: string;
  user_id: string;
  campaign_id: string;
  volume_amount: string;
  base_reward_amount: string;
  multiplier: number;
  final_reward_amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  claim_wallet: string | null;
  tx_signature: string | null;
  claimed_at: string | null;
  created_at: string;
}
```

### Existing Frontend Claim Flow
```typescript
// Source: apps/dashboard/src/components/rewards/claim-modal.tsx
// Phase 9 implementation - wallet connect + initiate claim API call
// Missing: actual transfer execution, confetti, share button
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Token2022 complexity | Standard SPL Token | Stable | $OPEN uses standard SPL, simpler |
| Manual ATA creation | @solana/spl-token helpers | v0.4+ | createAssociatedTokenAccountInstruction simplifies |

**Deprecated/outdated:**
- Direct `transfer` instructions without ATA check (fails on new recipients)
- Using `SystemProgram.transfer` for SPL tokens (wrong program)

## Open Questions

Things that require implementation decisions:

1. **Rewards Wallet Key Storage**
   - What we know: Need a funded wallet with $OPEN tokens
   - What's unclear: Where is the private key stored? New env var? Encrypted in DB?
   - Recommendation: New env var `REWARDS_WALLET_PRIVATE_KEY` (base58 encoded)

2. **$OPEN Token Mint Address**
   - What we know: Need the mint address to construct transfers
   - What's unclear: Production mint address not specified
   - Recommendation: Env var `OPEN_TOKEN_MINT` for flexibility

3. **Claim Record Creation Timing**
   - What we know: Records need user_id, campaign_id, calculated amounts
   - What's unclear: When are claim records created? Campaign end? First check?
   - Recommendation: Create on first eligibility check when campaign ends (lazy creation)

4. **Insufficient Funds Handling**
   - Context decision: Claude's discretion
   - Recommendation: Return clear error, keep claim in 'pending' status so user can retry later when wallet is funded

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/server/src/services/claims.ts` - SPL transfer pattern
- Existing codebase: `packages/server/src/db/reward-claims.ts` - Claim record CRUD
- Existing codebase: `packages/server/src/routes/rewards.ts` - API patterns
- Existing codebase: `apps/dashboard/src/components/rewards/claim-modal.tsx` - UI pattern

### Secondary (MEDIUM confidence)
- [X Developer Platform - Web Intent](https://developer.x.com/en/docs/x-for-websites/tweet-button/guides/web-intent) - Twitter share URL format
- [canvas-confetti npm](https://www.npmjs.com/package/canvas-confetti) - Confetti library

### Tertiary (LOW confidence)
- General WebSearch for confetti libraries - verified against npm

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already in codebase, proven patterns
- Architecture: HIGH - Follows existing patterns, clear flow
- Pitfalls: HIGH - Derived from existing code and Solana best practices

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - stable domain)
