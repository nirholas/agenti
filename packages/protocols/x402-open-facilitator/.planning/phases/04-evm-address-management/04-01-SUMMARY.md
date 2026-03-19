---
phase: 04-evm-address-management
plan: 01
subsystem: auth
tags: [evm, wagmi, viem, eip-191, signature-verification, ethereum]

# Dependency graph
requires:
  - phase: 03-solana-address-management
    provides: Solana enrollment pattern, signature verification structure
provides:
  - EVM wallet connection via wagmi
  - Server-side EIP-191 signature verification using viem
  - Dual-chain enrollment modal (Solana + EVM)
affects: [05-facilitator-management]

# Tech tracking
tech-stack:
  added:
    - "wagmi@2.14.1"
    - "viem@2.21.0 (server-side verification)"
  patterns:
    - Wagmi provider nesting (WagmiProvider wrapping app)
    - EIP-191 signature verification using viem verifyMessage
    - Chain selector UI pattern for multi-chain enrollment

key-files:
  created:
    - apps/dashboard/src/config/wagmi.ts
    - apps/dashboard/src/components/providers/evm-provider.tsx
    - apps/dashboard/src/lib/evm/verification.ts
    - packages/server/src/utils/evm-verify.ts
  modified:
    - apps/dashboard/src/components/providers.tsx
    - apps/dashboard/src/components/rewards/enrollment-modal.tsx
    - packages/server/src/routes/rewards.ts

key-decisions:
  - "D-04-01-001: mainnet, base, polygon chains supported - most common EVM networks"
  - "D-04-01-002: injected, MetaMask, Safe connectors - covers browser extensions and Safe wallets"
  - "D-04-01-003: Chain selector tabs in modal - simple toggle between Solana and EVM"

patterns-established:
  - "EVM verification message format mirrors Solana: title, blank, ownership line, address, blank, cost disclaimer (ETH vs SOL)"
  - "Wagmi hooks pattern: useAccount, useConnect, useSignMessage, useDisconnect"
  - "Provider order extended: EVMProvider wraps SolanaProvider (both inside QueryClientProvider/ThemeProvider)"

# Metrics
duration: 4min
completed: 2026-01-20
---

# Phase 4 Plan 1: EVM Address Enrollment Summary

**Wagmi provider with mainnet/base/polygon chains and EIP-191 signature verification via viem, enabling dual-chain enrollment modal with Solana/EVM tabs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-20T03:06:23Z
- **Completed:** 2026-01-20T03:10:25Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 3

## Accomplishments

- EVM wallet connection infrastructure ready (wagmi + viem)
- Server-side EIP-191 signature verification using viem's verifyMessage
- Enrollment modal supports both Solana and EVM addresses via chain selector tabs
- Users can connect MetaMask, injected wallets, or Safe wallets
- Signature verification pattern mirrors Solana flow (message format, verify-then-save)

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side EVM signature verification** - `35f12a8` (feat)
2. **Task 2: Wagmi provider and EVM client verification** - `d6b6bea` (feat)
3. **Task 3: Update enrollment modal with chain selector** - `47e1d15` (feat)

## Files Created/Modified

**Created:**
- `packages/server/src/utils/evm-verify.ts` - createEVMVerificationMessage() and verifyEVMSignature() functions
- `apps/dashboard/src/config/wagmi.ts` - Wagmi config with mainnet, base, polygon and common connectors
- `apps/dashboard/src/components/providers/evm-provider.tsx` - WagmiProvider wrapper component
- `apps/dashboard/src/lib/evm/verification.ts` - Client-side signing and enrollment for EVM

**Modified:**
- `packages/server/src/routes/rewards.ts` - Enroll endpoint now handles chain_type: 'evm' with EIP-191 verification
- `apps/dashboard/src/components/providers.tsx` - Added EVMProvider to provider tree
- `apps/dashboard/src/components/rewards/enrollment-modal.tsx` - Added chain selector tabs and EVM wallet connection

## Decisions Made

1. **Mainnet, Base, Polygon chains** - Most common EVM networks for rewards
2. **Injected, MetaMask, Safe connectors** - Covers browser extensions and multi-sig wallets
3. **Chain selector tabs** - Simple UI pattern for switching between Solana and EVM
4. **ETH cost disclaimer** - Message says "This will not cost any ETH" for EVM (vs SOL for Solana)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - wagmi and viem were already installed in the respective packages.

## Next Phase Readiness

- Dual-chain enrollment complete
- Users can register both Solana and EVM pay-to addresses
- All builds pass
- Ready for Phase 5 (Facilitator Management)

---
*Phase: 04-evm-address-management*
*Completed: 2026-01-20*
