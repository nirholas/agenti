---
'@agenti/sdk': minor
---

Move to `@pump-fun/pump-sdk` 2.0 and `@pump-fun/pump-swap-sdk` 1.20, and fix the pump.fun event decoder.

- `watchPumpEvents` emits launches again. The decoder matched the `create` and `create_v2` instruction discriminators instead of the `CreateEvent` event discriminator, so no launch was ever reported (and the MCP `watch_pump_launches` tool always came back empty).
- Launch events report the real coin `creator` (previously the signer) and add `user`, `mayhemMode`, `cashback`, `holderReward` and `creatorFeeBps`. Shorter events from older program deployments still decode, with those fields at their defaults.
- Graduation events from the PumpSwap migration now carry the `pool` address and the event's own timestamp.
- New `holder_reward_distribution` event for `DistributeFeeToHoldersEvent`.
- Claim events use the timestamp recorded in the event instead of the time the log was seen.
