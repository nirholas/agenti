# Task: Implement Response Caching Layer

## Priority: MEDIUM

## Context
Many MCP tools make expensive external API calls (CoinGecko prices, on-chain reads) that return data valid for seconds to minutes. Caching reduces latency, costs, and rate limit consumption.

## Requirements
1. Create a caching middleware with configurable TTLs per tool category:
   - Market data (prices, volumes): 30s TTL
   - On-chain reads (balances, allowances): 15s TTL
   - Static data (token metadata, contract ABIs): 1h TTL
   - Write operations (transfers, swaps): never cached
2. Cache key: hash of tool name + normalized input parameters
3. Support cache backends:
   - In-memory LRU (default, for single instance)
   - Redis (for multi-instance)
4. Add cache headers in response: `X-Cache: HIT|MISS`, `X-Cache-TTL: <seconds>`
5. Implement cache invalidation:
   - Manual: `POST /cache/invalidate` with pattern
   - Automatic: invalidate balance cache after transfer/swap operations
6. Add cache hit rate metrics for monitoring
7. Configurable max cache size (default 500MB)
8. Support stale-while-revalidate for read-heavy tools

## Acceptance Criteria
- [ ] Caching reduces external API calls by >50% under normal load
- [ ] Cache hit/miss metrics exposed
- [ ] Automatic invalidation after write operations
- [ ] Stale-while-revalidate prevents thundering herd
- [ ] Memory usage bounded
