"""
Rate Limiter for API request throttling.
"""

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Rate limiter configuration."""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000
    burst_limit: int = 10  # Max requests in a burst
    burst_window_seconds: int = 1


@dataclass
class RateLimitResult:
    """Result of rate limit check."""
    allowed: bool
    remaining: int
    reset_time: float
    retry_after: Optional[float] = None


class RateLimiter:
    """
    Token bucket rate limiter with multiple time windows.
    
    Features:
    - Per-user/IP rate limiting
    - Multiple time windows (minute, hour, day)
    - Burst handling
    - Sliding window algorithm
    """
    
    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self._windows: Dict[str, Dict[str, List[float]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self._lock = Lock()
    
    def check(self, identifier: str) -> RateLimitResult:
        """Check if request is allowed."""
        with self._lock:
            now = time.time()
            
            # Clean old entries
            self._clean_old_entries(identifier, now)
            
            # Get request counts for each window
            minute_count = self._count_requests(identifier, "minute", now, 60)
            hour_count = self._count_requests(identifier, "hour", now, 3600)
            day_count = self._count_requests(identifier, "day", now, 86400)
            burst_count = self._count_requests(
                identifier, "burst", now, self.config.burst_window_seconds
            )
            
            # Check limits
            if burst_count >= self.config.burst_limit:
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=now + self.config.burst_window_seconds,
                    retry_after=self.config.burst_window_seconds,
                )
            
            if minute_count >= self.config.requests_per_minute:
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=now + 60,
                    retry_after=60.0,
                )
            
            if hour_count >= self.config.requests_per_hour:
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=now + 3600,
                    retry_after=3600.0,
                )
            
            if day_count >= self.config.requests_per_day:
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=now + 86400,
                    retry_after=86400.0,
                )
            
            # Record request
            self._record_request(identifier, now)
            
            # Calculate remaining
            remaining = min(
                self.config.requests_per_minute - minute_count - 1,
                self.config.requests_per_hour - hour_count - 1,
                self.config.requests_per_day - day_count - 1,
            )
            
            return RateLimitResult(
                allowed=True,
                remaining=max(0, remaining),
                reset_time=now + 60,
            )
    
    def _count_requests(
        self,
        identifier: str,
        window: str,
        now: float,
        duration: float,
    ) -> int:
        """Count requests in a time window."""
        cutoff = now - duration
        timestamps = self._windows[identifier][window]
        return sum(1 for ts in timestamps if ts > cutoff)
    
    def _record_request(self, identifier: str, timestamp: float):
        """Record a request timestamp."""
        self._windows[identifier]["minute"].append(timestamp)
        self._windows[identifier]["hour"].append(timestamp)
        self._windows[identifier]["day"].append(timestamp)
        self._windows[identifier]["burst"].append(timestamp)
    
    def _clean_old_entries(self, identifier: str, now: float):
        """Clean old entries from windows."""
        windows = self._windows[identifier]
        
        # Clean each window
        windows["burst"] = [
            ts for ts in windows["burst"]
            if ts > now - self.config.burst_window_seconds
        ]
        windows["minute"] = [ts for ts in windows["minute"] if ts > now - 60]
        windows["hour"] = [ts for ts in windows["hour"] if ts > now - 3600]
        windows["day"] = [ts for ts in windows["day"] if ts > now - 86400]
    
    def get_usage(self, identifier: str) -> Dict[str, int]:
        """Get current usage for an identifier."""
        now = time.time()
        
        return {
            "burst": self._count_requests(
                identifier, "burst", now, self.config.burst_window_seconds
            ),
            "minute": self._count_requests(identifier, "minute", now, 60),
            "hour": self._count_requests(identifier, "hour", now, 3600),
            "day": self._count_requests(identifier, "day", now, 86400),
        }
    
    def reset(self, identifier: str):
        """Reset rate limits for an identifier."""
        with self._lock:
            if identifier in self._windows:
                del self._windows[identifier]
    
    def set_custom_limit(
        self,
        identifier: str,
        requests_per_minute: Optional[int] = None,
        requests_per_hour: Optional[int] = None,
    ):
        """Set custom limits for a specific identifier."""
        # This would typically be stored in a database
        # For now, we'll just log it
        logger.info(
            f"Custom limit set for {identifier}: "
            f"minute={requests_per_minute}, hour={requests_per_hour}"
        )


class SlidingWindowRateLimiter:
    """
    Sliding window log rate limiter for more precise rate limiting.
    """
    
    def __init__(
        self,
        max_requests: int,
        window_seconds: int,
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._logs: Dict[str, List[float]] = defaultdict(list)
        self._lock = Lock()
    
    def check(self, identifier: str) -> Tuple[bool, int]:
        """
        Check if request is allowed.
        
        Returns (allowed, remaining_requests).
        """
        with self._lock:
            now = time.time()
            cutoff = now - self.window_seconds
            
            # Clean old entries
            self._logs[identifier] = [
                ts for ts in self._logs[identifier] if ts > cutoff
            ]
            
            # Check limit
            current = len(self._logs[identifier])
            
            if current >= self.max_requests:
                return False, 0
            
            # Record request
            self._logs[identifier].append(now)
            
            return True, self.max_requests - current - 1


class TokenBucketRateLimiter:
    """
    Token bucket rate limiter for smooth rate limiting with bursts.
    """
    
    def __init__(
        self,
        capacity: int,
        refill_rate: float,  # Tokens per second
    ):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self._buckets: Dict[str, Tuple[float, float]] = {}  # identifier -> (tokens, last_update)
        self._lock = Lock()
    
    def check(self, identifier: str, tokens: int = 1) -> Tuple[bool, float]:
        """
        Check if request is allowed.
        
        Returns (allowed, current_tokens).
        """
        with self._lock:
            now = time.time()
            
            # Get or initialize bucket
            if identifier not in self._buckets:
                self._buckets[identifier] = (float(self.capacity), now)
            
            current_tokens, last_update = self._buckets[identifier]
            
            # Refill tokens
            elapsed = now - last_update
            current_tokens = min(
                self.capacity,
                current_tokens + elapsed * self.refill_rate
            )
            
            # Check if enough tokens
            if current_tokens >= tokens:
                current_tokens -= tokens
                self._buckets[identifier] = (current_tokens, now)
                return True, current_tokens
            
            self._buckets[identifier] = (current_tokens, now)
            return False, current_tokens
