# Task: Add Size Limits and TTL to In-Memory Data Structures

## Priority: MEDIUM

## Context
Multiple modules use unbounded in-memory Maps (`src/modules/alerts/index.ts:13-24`, `src/modules/portfolio/index.ts:13-26`, `src/modules/websockets/index.ts:13-23`, `src/modules/research/tools.ts:13`). Under sustained load, these grow without limit, causing OOM crashes.

## Requirements
1. Create a `BoundedMap<K, V>` utility class with:
   - Maximum size (evict LRU entries when full)
   - Optional TTL per entry
   - Periodic cleanup of expired entries (configurable interval)
   - `onEvict` callback for cleanup (e.g., closing WebSocket connections)
2. Replace all unbounded Maps with `BoundedMap`
3. Configure sensible defaults per module:
   - Alerts: max 10,000 entries, 24h TTL
   - Portfolio: max 1,000 entries, 1h TTL
   - WebSockets: max 500 connections, 8h TTL
   - Research cache: max 5,000 entries, 30min TTL
4. Expose current map sizes via metrics endpoint
5. Add memory usage monitoring with alerts at 80% threshold

## Acceptance Criteria
- [ ] `BoundedMap` utility with LRU eviction and TTL
- [ ] All unbounded Maps replaced
- [ ] Memory usage metrics exposed
- [ ] OOM test: sustained load does not crash server
