"""
Client-side Rate Limiter for AgentCore Gateway.

This module provides a token bucket rate limiter that can be used to
prevent exceeding the Gateway's rate limits. It implements both
synchronous and asynchronous rate limiting.

Usage:
    from agent.rate_limiter import RateLimiter, RateLimitConfig
    
    # Create rate limiter with default config
    limiter = RateLimiter()
    
    # Or with custom config
    config = RateLimitConfig(requests_per_second=10, burst_capacity=20)
    limiter = RateLimiter(config)
    
    # Use with context manager
    with limiter.acquire():
        # Make request
        pass
    
    # Or check manually
    if limiter.try_acquire():
        # Make request
        pass
    else:
        # Handle rate limit
        pass
"""

import asyncio
import logging
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for the rate limiter."""
    
    # Maximum requests per second
    requests_per_second: float = 10.0
    
    # Burst capacity (max tokens in bucket)
    burst_capacity: int = 20
    
    # Whether to block when rate limited (vs raising exception)
    block_on_limit: bool = True
    
    # Maximum time to wait when blocking (seconds)
    max_wait_time: float = 30.0
    
    # Enable logging of rate limit events
    enable_logging: bool = True


@dataclass
class RateLimitStats:
    """Statistics for rate limiting."""
    
    total_requests: int = 0
    allowed_requests: int = 0
    throttled_requests: int = 0
    total_wait_time: float = 0.0
    last_request_time: Optional[float] = None
    
    @property
    def throttle_rate(self) -> float:
        """Percentage of requests that were throttled."""
        if self.total_requests == 0:
            return 0.0
        return (self.throttled_requests / self.total_requests) * 100


class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded and blocking is disabled."""
    
    def __init__(self, wait_time: float, message: str = "Rate limit exceeded"):
        self.wait_time = wait_time
        self.message = message
        super().__init__(f"{message}. Retry after {wait_time:.2f} seconds")


class RateLimiter:
    """
    Token bucket rate limiter for controlling request rates.
    
    This implementation uses the token bucket algorithm:
    - Tokens are added at a fixed rate (requests_per_second)
    - Each request consumes one token
    - Tokens accumulate up to burst_capacity
    - If no tokens available, request is either blocked or rejected
    
    Thread-safe for use in multi-threaded applications.
    """
    
    def __init__(self, config: Optional[RateLimitConfig] = None):
        """
        Initialize the rate limiter.
        
        Args:
            config: Rate limit configuration. Uses defaults if not provided.
        """
        self.config = config or RateLimitConfig()
        self._tokens = float(self.config.burst_capacity)
        self._last_update = time.monotonic()
        self._lock = threading.Lock()
        self._stats = RateLimitStats()
    
    @property
    def stats(self) -> RateLimitStats:
        """Get current rate limiting statistics."""
        return self._stats
    
    @property
    def available_tokens(self) -> float:
        """Get the current number of available tokens."""
        with self._lock:
            self._refill_tokens()
            return self._tokens
    
    def _refill_tokens(self) -> None:
        """Refill tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self._last_update
        self._last_update = now
        
        # Add tokens based on elapsed time
        tokens_to_add = elapsed * self.config.requests_per_second
        self._tokens = min(
            self.config.burst_capacity,
            self._tokens + tokens_to_add
        )
    
    def _calculate_wait_time(self) -> float:
        """Calculate time to wait for a token to become available."""
        if self._tokens >= 1:
            return 0.0
        tokens_needed = 1 - self._tokens
        return tokens_needed / self.config.requests_per_second
    
    def try_acquire(self) -> bool:
        """
        Try to acquire a token without blocking.
        
        Returns:
            True if token was acquired, False if rate limited.
        """
        with self._lock:
            self._refill_tokens()
            self._stats.total_requests += 1
            self._stats.last_request_time = time.time()
            
            if self._tokens >= 1:
                self._tokens -= 1
                self._stats.allowed_requests += 1
                return True
            else:
                self._stats.throttled_requests += 1
                if self.config.enable_logging:
                    logger.warning(
                        "Rate limit exceeded. Available tokens: %.2f",
                        self._tokens
                    )
                return False
    
    def acquire(self, timeout: Optional[float] = None) -> float:
        """
        Acquire a token, blocking if necessary.
        
        Args:
            timeout: Maximum time to wait. Uses config.max_wait_time if not provided.
            
        Returns:
            Time spent waiting (0 if no wait was needed).
            
        Raises:
            RateLimitExceeded: If blocking is disabled or timeout exceeded.
        """
        timeout = timeout if timeout is not None else self.config.max_wait_time
        start_time = time.monotonic()
        
        with self._lock:
            self._refill_tokens()
            self._stats.total_requests += 1
            self._stats.last_request_time = time.time()
            
            if self._tokens >= 1:
                self._tokens -= 1
                self._stats.allowed_requests += 1
                return 0.0
            
            wait_time = self._calculate_wait_time()
            
            if not self.config.block_on_limit:
                self._stats.throttled_requests += 1
                raise RateLimitExceeded(wait_time)
            
            if wait_time > timeout:
                self._stats.throttled_requests += 1
                raise RateLimitExceeded(
                    wait_time,
                    f"Rate limit exceeded. Wait time ({wait_time:.2f}s) exceeds timeout ({timeout:.2f}s)"
                )
        
        # Wait outside the lock
        if self.config.enable_logging:
            logger.info("Rate limited. Waiting %.2f seconds", wait_time)
        
        time.sleep(wait_time)
        
        # Try again after waiting
        with self._lock:
            self._refill_tokens()
            if self._tokens >= 1:
                self._tokens -= 1
                self._stats.allowed_requests += 1
                actual_wait = time.monotonic() - start_time
                self._stats.total_wait_time += actual_wait
                return actual_wait
            else:
                # Still no tokens (shouldn't happen normally)
                self._stats.throttled_requests += 1
                raise RateLimitExceeded(
                    self._calculate_wait_time(),
                    "Rate limit still exceeded after waiting"
                )
    
    @contextmanager
    def rate_limited(self, timeout: Optional[float] = None):
        """
        Context manager for rate-limited operations.
        
        Usage:
            with limiter.rate_limited():
                # Make request
                pass
        
        Args:
            timeout: Maximum time to wait for a token.
            
        Yields:
            Time spent waiting for the token.
        """
        wait_time = self.acquire(timeout)
        try:
            yield wait_time
        finally:
            pass  # Token already consumed
    
    def reset(self) -> None:
        """Reset the rate limiter to initial state."""
        with self._lock:
            self._tokens = float(self.config.burst_capacity)
            self._last_update = time.monotonic()
            self._stats = RateLimitStats()
    
    def reset_stats(self) -> None:
        """Reset statistics only."""
        with self._lock:
            self._stats = RateLimitStats()


class AsyncRateLimiter:
    """
    Async version of the token bucket rate limiter.
    
    Use this for async/await code patterns.
    """
    
    def __init__(self, config: Optional[RateLimitConfig] = None):
        """
        Initialize the async rate limiter.
        
        Args:
            config: Rate limit configuration. Uses defaults if not provided.
        """
        self.config = config or RateLimitConfig()
        self._tokens = float(self.config.burst_capacity)
        self._last_update = time.monotonic()
        self._lock = asyncio.Lock()
        self._stats = RateLimitStats()
    
    @property
    def stats(self) -> RateLimitStats:
        """Get current rate limiting statistics."""
        return self._stats
    
    def _refill_tokens(self) -> None:
        """Refill tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self._last_update
        self._last_update = now
        
        tokens_to_add = elapsed * self.config.requests_per_second
        self._tokens = min(
            self.config.burst_capacity,
            self._tokens + tokens_to_add
        )
    
    def _calculate_wait_time(self) -> float:
        """Calculate time to wait for a token to become available."""
        if self._tokens >= 1:
            return 0.0
        tokens_needed = 1 - self._tokens
        return tokens_needed / self.config.requests_per_second
    
    async def try_acquire(self) -> bool:
        """
        Try to acquire a token without blocking.
        
        Returns:
            True if token was acquired, False if rate limited.
        """
        async with self._lock:
            self._refill_tokens()
            self._stats.total_requests += 1
            self._stats.last_request_time = time.time()
            
            if self._tokens >= 1:
                self._tokens -= 1
                self._stats.allowed_requests += 1
                return True
            else:
                self._stats.throttled_requests += 1
                if self.config.enable_logging:
                    logger.warning(
                        "Rate limit exceeded. Available tokens: %.2f",
                        self._tokens
                    )
                return False
    
    async def acquire(self, timeout: Optional[float] = None) -> float:
        """
        Acquire a token, blocking if necessary.
        
        Args:
            timeout: Maximum time to wait. Uses config.max_wait_time if not provided.
            
        Returns:
            Time spent waiting (0 if no wait was needed).
            
        Raises:
            RateLimitExceeded: If blocking is disabled or timeout exceeded.
        """
        timeout = timeout if timeout is not None else self.config.max_wait_time
        start_time = time.monotonic()
        
        async with self._lock:
            self._refill_tokens()
            self._stats.total_requests += 1
            self._stats.last_request_time = time.time()
            
            if self._tokens >= 1:
                self._tokens -= 1
                self._stats.allowed_requests += 1
                return 0.0
            
            wait_time = self._calculate_wait_time()
            
            if not self.config.block_on_limit:
                self._stats.throttled_requests += 1
                raise RateLimitExceeded(wait_time)
            
            if wait_time > timeout:
                self._stats.throttled_requests += 1
                raise RateLimitExceeded(
                    wait_time,
                    f"Rate limit exceeded. Wait time ({wait_time:.2f}s) exceeds timeout ({timeout:.2f}s)"
                )
        
        # Wait outside the lock
        if self.config.enable_logging:
            logger.info("Rate limited. Waiting %.2f seconds", wait_time)
        
        await asyncio.sleep(wait_time)
        
        # Try again after waiting
        async with self._lock:
            self._refill_tokens()
            if self._tokens >= 1:
                self._tokens -= 1
                self._stats.allowed_requests += 1
                actual_wait = time.monotonic() - start_time
                self._stats.total_wait_time += actual_wait
                return actual_wait
            else:
                self._stats.throttled_requests += 1
                raise RateLimitExceeded(
                    self._calculate_wait_time(),
                    "Rate limit still exceeded after waiting"
                )


def create_rate_limiter(
    requests_per_second: float = 10.0,
    burst_capacity: int = 20,
    block_on_limit: bool = True,
    async_mode: bool = False,
) -> RateLimiter | AsyncRateLimiter:
    """
    Factory function to create a rate limiter.
    
    Args:
        requests_per_second: Maximum requests per second
        burst_capacity: Maximum burst capacity
        block_on_limit: Whether to block when rate limited
        async_mode: Whether to create an async rate limiter
        
    Returns:
        RateLimiter or AsyncRateLimiter instance
    """
    config = RateLimitConfig(
        requests_per_second=requests_per_second,
        burst_capacity=burst_capacity,
        block_on_limit=block_on_limit,
    )
    
    if async_mode:
        return AsyncRateLimiter(config)
    return RateLimiter(config)
