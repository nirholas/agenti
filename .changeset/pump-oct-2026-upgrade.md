---
'@agenti/sdk': minor
---

Move to `@pump-fun/pump-sdk` 4.0 and `@pump-fun/pump-swap-sdk` 2.1 for the October 2026 Pump and PumpSwap program upgrade.

- `watchPumpEvents` reports the pool leg of a synthetic migration buy. A v3 buy that empties a bonding curve can now buy past the end of the curve at the future PumpSwap pool's price; that part is logged as `PostCompleteBuyEvent` and now arrives as a `trade` event with `postComplete: true`, so the buyer's full size is no longer under-reported.
- The decoder reads only each event's known prefix, so the longer `CreateEvent` (new `depth`) and `TradeEvent` (new `creator_fee_unclaimed`) decode, and so do events from before the upgrade. Tests cover both layouts against the SDK's own decoders.
