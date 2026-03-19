---
phase: 18-multi-chain-wallet-infrastructure
plan: 01
subsystem: backend
tags: [wallet, multi-chain, base, solana, api]
requires: [17]
provides: [multi-wallet-db, base-wallet-generation, multi-wallet-api]
affects: [18-02, 19]
tech-stack:
  added: []
  patterns: [multi-chain-wallet-storage, viem-wallet-generation]
key-files:
  created:
    - packages/server/src/db/migrations/003_user_wallets_multi_chain.ts
  modified:
    - packages/server/src/db/user-wallets.ts
    - packages/server/src/db/index.ts
    - packages/server/src/db/migrations/index.ts
    - packages/server/src/services/wallet.ts
    - packages/server/src/routes/admin.ts
    - apps/dashboard/src/lib/api.ts
decisions: []
metrics:
  duration: 4m 5s
  completed: 2026-01-22
---

# Phase 18 Plan 01: Multi-Wallet Backend Infrastructure Summary

**One-liner:** Extended backend to support multiple subscription wallets per user (Solana + Base) with dual-chain balance fetching.

## What Was Done

### Task 1: Extended user_wallets Database Schema
- Added `getUserWalletsByUserId(userId)` to return all wallets for a user
- Added `getUserWalletByUserIdAndNetwork(userId, network)` for specific wallet lookup
- Added `deleteUserWalletByNetwork(userId, network)` for network-specific deletion
- Updated `createUserWallet` to check for existing wallet on same network before creating
- Created migration 003 to change UNIQUE constraint from `user_id` to `(user_id, network)`
- Updated CREATE TABLE for fresh installs with new schema
- Changed default network from 'base' to 'solana'

### Task 2: Added Base Wallet Generation Service
- Added `generateBaseWalletForUser(userId)` using viem's `generatePrivateKey` and `privateKeyToAccount`
- Added `getBaseUSDCBalance(address)` to fetch USDC balance from Base chain via viem publicClient
- Added `getAllWalletsForUser(userId)` to return all wallets for a user
- Added `getWalletForUserByNetwork(userId, network)` for specific wallet lookup
- Updated `decryptUserPrivateKey` to accept network parameter
- Base USDC contract: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### Task 3: Added Multi-Wallet API Endpoints
Server endpoints (all require auth):
- `GET /api/admin/wallets` - returns all wallets with balances
- `GET /api/admin/wallets/:chain` - returns specific wallet by chain (solana | base)
- `POST /api/admin/wallets/:chain/create` - creates wallet for specific chain
- `GET /api/admin/wallets/:chain/balance` - refreshes balance for specific wallet
- Kept existing `/wallet` endpoint for backward compatibility

Dashboard API client additions:
- `SubscriptionWallet`, `SubscriptionWalletCreateResponse`, `WalletBalanceResponse` types
- `getSubscriptionWallets()`, `getSubscriptionWallet(chain)` methods
- `createSubscriptionWallet(chain)`, `refreshWalletBalance(chain)` methods

## Commits

| Hash | Description |
|------|-------------|
| cb3b524 | feat(18-01): extend user_wallets for multi-chain support |
| bbd955f | feat(18-01): add Base wallet generation service |
| c5df45e | feat(18-01): add multi-wallet API endpoints |

## Must-Have Verification

| Truth/Artifact | Status |
|----------------|--------|
| User can have both Solana and Base wallet stored | UNIQUE(user_id, network) constraint allows this |
| API returns balance for each wallet by chain | GET /wallets returns array with balance per wallet |
| User can create wallets for both chains independently | POST /wallets/:chain/create works for solana and base |
| `getUserWalletsByUserId` exists in user-wallets.ts | Line 66 |
| `generateBaseWalletForUser` exists in wallet.ts | Line 55 |
| `/wallets` endpoint exists in admin.ts | Line 237 |
| admin.ts calls generateBaseWalletForUser | Line 332 |
| wallet.ts calls createUserWallet with network param | Lines 46, 68 |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for Plan 18-02:** Frontend wallet cards can now use the multi-wallet API endpoints.

**Dependencies satisfied:**
- Multi-wallet DB operations with unique constraint on (user_id, network)
- Base wallet generation alongside Solana
- Multi-wallet API endpoints
- API client has all new methods
