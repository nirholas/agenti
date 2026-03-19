"""
Tests for the rate limiter module.
"""

import asyncio
import time
from unittest.mock import patch

import pytest

from agent.rate_limiter import (
    AsyncRateLimiter,
    RateLimitConfig,
    RateLimitExceeded,
    RateLimiter,
    create_rate_limiter,
)


class TestRateLimitConfig:
    """Tests for RateLimitConfig."""

    def test_default_config(self):
        """Test default configuration values."""
        config = RateLimitConfig()
        assert config.requests_per_second == 10.0
        assert config.burst_capacity == 20
        assert config.block_on_limit is True
        assert config.max_wait_time == 30.0
        assert config.enable_logging is True

    def test_custom_config(self):
        """Test custom configuration values."""
        config = RateLimitConfig(
            requests_per_second=5.0,
            burst_capacity=10,
            block_on_limit=False,
            max_wait_time=60.0,
        )
        assert config.requests_per_second == 5.0
        assert config.burst_capacity == 10
        assert config.block_on_limit is False
        assert config.max_wait_time == 60.0


class TestRateLimiter:
    """Tests for RateLimiter."""

    def test_initial_state(self):
        """Test initial state of rate limiter."""
        limiter = RateLimiter()
        assert limiter.available_tokens == 20  # burst_capacity
        assert limiter.stats.total_requests == 0
        assert limiter.stats.allowed_requests == 0
        assert limiter.stats.throttled_requests == 0

    def test_try_acquire_success(self):
        """Test successful token acquisition."""
        limiter = RateLimiter()
        assert limiter.try_acquire() is True
        assert limiter.stats.total_requests == 1
        assert limiter.stats.allowed_requests == 1
        assert limiter.stats.throttled_requests == 0

    def test_try_acquire_exhausted(self):
        """Test token acquisition when exhausted."""
        config = RateLimitConfig(
            requests_per_second=1.0,
            burst_capacity=2,
        )
        limiter = RateLimiter(config)
        
        # Exhaust tokens
        assert limiter.try_acquire() is True
        assert limiter.try_acquire() is True
        assert limiter.try_acquire() is False
        
        assert limiter.stats.total_requests == 3
        assert limiter.stats.allowed_requests == 2
        assert limiter.stats.throttled_requests == 1

    def test_acquire_blocking(self):
        """Test blocking acquisition."""
        config = RateLimitConfig(
            requests_per_second=10.0,
            burst_capacity=1,
            block_on_limit=True,
        )
        limiter = RateLimiter(config)
        
        # First request should succeed immediately
        wait_time = limiter.acquire()
        assert wait_time == 0.0
        
        # Second request should block briefly
        start = time.monotonic()
        wait_time = limiter.acquire(timeout=1.0)
        elapsed = time.monotonic() - start
        
        assert wait_time > 0
        assert elapsed >= 0.05  # Should have waited at least a bit

    def test_acquire_non_blocking_raises(self):
        """Test non-blocking acquisition raises exception."""
        config = RateLimitConfig(
            requests_per_second=1.0,
            burst_capacity=1,
            block_on_limit=False,
        )
        limiter = RateLimiter(config)
        
        # First request succeeds
        limiter.acquire()
        
        # Second request should raise
        with pytest.raises(RateLimitExceeded) as exc_info:
            limiter.acquire()
        
        assert exc_info.value.wait_time > 0

    def test_token_refill(self):
        """Test that tokens refill over time."""
        config = RateLimitConfig(
            requests_per_second=100.0,  # Fast refill for testing
            burst_capacity=1,
        )
        limiter = RateLimiter(config)
        
        # Exhaust tokens
        limiter.try_acquire()
        assert limiter.try_acquire() is False
        
        # Wait for refill
        time.sleep(0.02)  # 20ms should give us ~2 tokens at 100/s
        
        assert limiter.try_acquire() is True

    def test_rate_limited_context_manager(self):
        """Test context manager usage."""
        limiter = RateLimiter()
        
        with limiter.rate_limited() as wait_time:
            assert wait_time == 0.0
        
        assert limiter.stats.allowed_requests == 1

    def test_reset(self):
        """Test reset functionality."""
        limiter = RateLimiter()
        
        # Make some requests
        limiter.try_acquire()
        limiter.try_acquire()
        
        assert limiter.stats.total_requests == 2
        
        # Reset
        limiter.reset()
        
        assert limiter.stats.total_requests == 0
        assert limiter.available_tokens == 20

    def test_reset_stats(self):
        """Test stats reset only."""
        config = RateLimitConfig(burst_capacity=5)
        limiter = RateLimiter(config)
        
        # Make some requests
        limiter.try_acquire()
        limiter.try_acquire()
        
        initial_tokens = limiter.available_tokens
        
        # Reset stats only
        limiter.reset_stats()
        
        assert limiter.stats.total_requests == 0
        # Tokens should be approximately the same (may have refilled slightly)
        assert abs(limiter.available_tokens - initial_tokens) < 1

    def test_throttle_rate_calculation(self):
        """Test throttle rate calculation."""
        config = RateLimitConfig(
            requests_per_second=1.0,
            burst_capacity=2,
        )
        limiter = RateLimiter(config)
        
        # 2 allowed, 2 throttled = 50% throttle rate
        limiter.try_acquire()
        limiter.try_acquire()
        limiter.try_acquire()
        limiter.try_acquire()
        
        assert limiter.stats.throttle_rate == 50.0


class TestAsyncRateLimiter:
    """Tests for AsyncRateLimiter."""

    @pytest.mark.asyncio
    async def test_async_try_acquire(self):
        """Test async token acquisition."""
        limiter = AsyncRateLimiter()
        
        result = await limiter.try_acquire()
        assert result is True
        assert limiter.stats.allowed_requests == 1

    @pytest.mark.asyncio
    async def test_async_acquire_blocking(self):
        """Test async blocking acquisition."""
        config = RateLimitConfig(
            requests_per_second=10.0,
            burst_capacity=1,
            block_on_limit=True,
        )
        limiter = AsyncRateLimiter(config)
        
        # First request should succeed immediately
        wait_time = await limiter.acquire()
        assert wait_time == 0.0
        
        # Second request should block briefly
        start = time.monotonic()
        wait_time = await limiter.acquire(timeout=1.0)
        elapsed = time.monotonic() - start
        
        assert wait_time > 0
        assert elapsed >= 0.05

    @pytest.mark.asyncio
    async def test_async_acquire_non_blocking_raises(self):
        """Test async non-blocking acquisition raises exception."""
        config = RateLimitConfig(
            requests_per_second=1.0,
            burst_capacity=1,
            block_on_limit=False,
        )
        limiter = AsyncRateLimiter(config)
        
        # First request succeeds
        await limiter.acquire()
        
        # Second request should raise
        with pytest.raises(RateLimitExceeded):
            await limiter.acquire()


class TestCreateRateLimiter:
    """Tests for factory function."""

    def test_create_sync_limiter(self):
        """Test creating sync rate limiter."""
        limiter = create_rate_limiter(
            requests_per_second=5.0,
            burst_capacity=10,
            async_mode=False,
        )
        
        assert isinstance(limiter, RateLimiter)
        assert limiter.config.requests_per_second == 5.0
        assert limiter.config.burst_capacity == 10

    def test_create_async_limiter(self):
        """Test creating async rate limiter."""
        limiter = create_rate_limiter(
            requests_per_second=5.0,
            burst_capacity=10,
            async_mode=True,
        )
        
        assert isinstance(limiter, AsyncRateLimiter)
        assert limiter.config.requests_per_second == 5.0
        assert limiter.config.burst_capacity == 10


class TestRateLimitExceeded:
    """Tests for RateLimitExceeded exception."""

    def test_exception_message(self):
        """Test exception message formatting."""
        exc = RateLimitExceeded(wait_time=1.5)
        assert "1.50 seconds" in str(exc)
        assert exc.wait_time == 1.5

    def test_custom_message(self):
        """Test custom exception message."""
        exc = RateLimitExceeded(wait_time=2.0, message="Custom error")
        assert "Custom error" in str(exc)
        assert "2.00 seconds" in str(exc)
