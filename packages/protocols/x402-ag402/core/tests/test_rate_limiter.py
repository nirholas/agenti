"""Tests for rate_limiter module — sliding window rate limiting."""

from __future__ import annotations

import time
from unittest.mock import patch

from ag402_core.security.rate_limiter import RateLimiter


class TestRateLimiter:
    """Sliding-window rate limiter tests."""

    def test_allow_within_limit(self):
        """Requests within limit should be allowed."""
        limiter = RateLimiter(max_requests=5, window_seconds=60)
        for _ in range(5):
            assert limiter.allow("wallet_a") is True

    def test_block_exceeding_limit(self):
        """Requests exceeding limit should be blocked."""
        limiter = RateLimiter(max_requests=3, window_seconds=60)
        for _ in range(3):
            assert limiter.allow("wallet_a") is True
        assert limiter.allow("wallet_a") is False

    def test_separate_keys(self):
        """Different keys should have separate limits."""
        limiter = RateLimiter(max_requests=2, window_seconds=60)
        assert limiter.allow("wallet_a") is True
        assert limiter.allow("wallet_a") is True
        assert limiter.allow("wallet_a") is False
        # Different key should still be allowed
        assert limiter.allow("wallet_b") is True
        assert limiter.allow("wallet_b") is True
        assert limiter.allow("wallet_b") is False

    def test_window_expiry_allows_again(self):
        """Requests should be allowed again after window expires."""
        limiter = RateLimiter(max_requests=2, window_seconds=1)
        assert limiter.allow("key") is True
        assert limiter.allow("key") is True
        assert limiter.allow("key") is False

        # Mock time to advance past window
        with patch.object(time, "time", return_value=time.time() + 2):
            assert limiter.allow("key") is True

    def test_default_parameters(self):
        """Default parameters should be 60 requests / 60 seconds."""
        limiter = RateLimiter()
        assert limiter._max == 60
        assert limiter._window == 60

    def test_exactly_at_limit(self):
        """Exactly at the limit should be the last allowed request."""
        limiter = RateLimiter(max_requests=1, window_seconds=60)
        assert limiter.allow("key") is True
        assert limiter.allow("key") is False
        assert limiter.allow("key") is False
