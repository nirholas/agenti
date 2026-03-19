"""Rate limiting per wallet address / IP.

Bounded sliding-window implementation: tracks at most *max_keys* distinct
callers.  When a key's timestamps all expire, it is evicted automatically
on the next ``allow()`` call.  If the table is full and the incoming key
is new, the request is rejected — this caps memory usage under DDoS.
"""

from __future__ import annotations

import time
from collections import defaultdict


class RateLimiter:
    """In-memory sliding-window rate limiter with bounded key space."""

    def __init__(
        self,
        max_requests: int = 60,
        window_seconds: int = 60,
        max_keys: int = 10_000,
    ):
        self._max = max_requests
        self._window = window_seconds
        self._max_keys = max_keys
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._last_sweep: float = 0.0

    # ------------------------------------------------------------------

    def allow(self, key: str) -> bool:
        now = time.time()

        # Periodic full sweep: evict all expired keys once per window
        if now - self._last_sweep > self._window:
            self._sweep(now)

        cutoff = now - self._window

        # Prune timestamps for this key
        timestamps = self._requests.get(key)
        if timestamps is not None:
            timestamps[:] = [t for t in timestamps if t > cutoff]
            if not timestamps:
                # All entries expired — evict key entirely
                del self._requests[key]
                timestamps = None

        # New key and table full → reject
        if timestamps is None and len(self._requests) >= self._max_keys:
            return False

        # Check rate
        ts_list = self._requests[key]  # creates entry if new
        if len(ts_list) >= self._max:
            return False

        ts_list.append(now)
        return True

    # ------------------------------------------------------------------

    def _sweep(self, now: float) -> None:
        """Evict all keys whose timestamps have fully expired."""
        cutoff = now - self._window
        expired = [k for k, ts in self._requests.items() if not ts or ts[-1] <= cutoff]
        for k in expired:
            del self._requests[k]
        self._last_sweep = now
