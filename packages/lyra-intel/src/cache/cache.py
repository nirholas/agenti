"""
Cache - Smart caching layer for expensive operations.

Provides:
- Multiple backends (memory, file, Redis)
- TTL support
- LRU eviction
- Cache invalidation
"""

import asyncio
import hashlib
import json
import logging
from typing import Dict, Any, Optional, TypeVar, Generic, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class CacheConfig:
    """Configuration for cache."""
    backend: str = "memory"  # memory, file, redis
    max_size: int = 10000
    default_ttl: int = 3600  # seconds
    file_path: str = ".lyra_cache"
    redis_url: str = "redis://localhost:6379"
    eviction_policy: str = "lru"  # lru, ttl, random


@dataclass
class CacheEntry:
    """A cache entry."""
    key: str
    value: Any
    created_at: datetime = field(default_factory=datetime.now)
    accessed_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    access_count: int = 0
    
    @property
    def is_expired(self) -> bool:
        """Check if entry is expired."""
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at
    
    def touch(self) -> None:
        """Update access time and count."""
        self.accessed_at = datetime.now()
        self.access_count += 1


class Cache:
    """
    Smart caching layer.
    
    Features:
    - Multiple storage backends
    - TTL-based expiration
    - LRU eviction
    - Cache decorators
    """
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        self._backend = None
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "evictions": 0,
        }
    
    async def initialize(self) -> None:
        """Initialize the cache backend."""
        from .backends import get_backend
        self._backend = get_backend(self.config)
        await self._backend.initialize()
        logger.info(f"Cache initialized with {self.config.backend} backend")
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get a value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None
        """
        if self._backend is None:
            await self.initialize()
        
        entry = await self._backend.get(key)
        
        if entry is None:
            self._stats["misses"] += 1
            return None
        
        if entry.is_expired:
            await self._backend.delete(key)
            self._stats["misses"] += 1
            return None
        
        entry.touch()
        self._stats["hits"] += 1
        return entry.value
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> None:
        """
        Set a value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if None)
        """
        if self._backend is None:
            await self.initialize()
        
        ttl = ttl if ttl is not None else self.config.default_ttl
        expires_at = datetime.now() + timedelta(seconds=ttl) if ttl > 0 else None
        
        entry = CacheEntry(
            key=key,
            value=value,
            expires_at=expires_at,
        )
        
        # Check if eviction needed
        if await self._backend.size() >= self.config.max_size:
            await self._evict()
        
        await self._backend.set(key, entry)
        self._stats["sets"] += 1
    
    async def delete(self, key: str) -> bool:
        """
        Delete a value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if deleted, False if not found
        """
        if self._backend is None:
            return False
        
        return await self._backend.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        value = await self.get(key)
        return value is not None
    
    async def clear(self) -> int:
        """
        Clear all cache entries.
        
        Returns:
            Number of entries cleared
        """
        if self._backend is None:
            return 0
        
        return await self._backend.clear()
    
    async def _evict(self) -> None:
        """Evict entries based on eviction policy."""
        if self.config.eviction_policy == "lru":
            evicted = await self._backend.evict_lru()
        elif self.config.eviction_policy == "ttl":
            evicted = await self._backend.evict_expired()
        else:
            evicted = await self._backend.evict_random()
        
        self._stats["evictions"] += evicted
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total if total > 0 else 0.0
        
        return {
            **self._stats,
            "hit_rate": hit_rate,
            "backend": self.config.backend,
        }
    
    def cached(
        self,
        ttl: Optional[int] = None,
        key_prefix: str = ""
    ):
        """
        Decorator for caching function results.
        
        Args:
            ttl: Time-to-live in seconds
            key_prefix: Prefix for cache keys
            
        Usage:
            @cache.cached(ttl=3600)
            async def expensive_operation(arg1, arg2):
                ...
        """
        def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
            @wraps(func)
            async def wrapper(*args, **kwargs) -> T:
                # Generate cache key
                key_data = f"{key_prefix}:{func.__name__}:{args}:{kwargs}"
                key = hashlib.sha256(key_data.encode()).hexdigest()
                
                # Try cache
                cached_value = await self.get(key)
                if cached_value is not None:
                    return cached_value
                
                # Call function
                result = await func(*args, **kwargs)
                
                # Cache result
                await self.set(key, result, ttl)
                
                return result
            
            return wrapper
        return decorator
    
    @staticmethod
    def make_key(*args, **kwargs) -> str:
        """
        Create a cache key from arguments.
        
        Args:
            *args: Positional arguments
            **kwargs: Keyword arguments
            
        Returns:
            Hash-based cache key
        """
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
        return hashlib.sha256(key_data.encode()).hexdigest()


# Global cache instance
_global_cache: Optional[Cache] = None


def get_cache() -> Cache:
    """Get the global cache instance."""
    global _global_cache
    if _global_cache is None:
        _global_cache = Cache()
    return _global_cache
