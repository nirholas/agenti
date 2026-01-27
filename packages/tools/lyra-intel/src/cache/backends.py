"""
Cache Backends - Storage backends for caching.

Supports:
- Memory (in-process)
- File (disk-based)
- Redis (distributed)
"""

import asyncio
import json
import logging
import random
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime

from .cache import CacheEntry, CacheConfig

logger = logging.getLogger(__name__)


class CacheBackend(ABC):
    """Abstract base class for cache backends."""
    
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the backend."""
        pass
    
    @abstractmethod
    async def get(self, key: str) -> Optional[CacheEntry]:
        """Get an entry by key."""
        pass
    
    @abstractmethod
    async def set(self, key: str, entry: CacheEntry) -> None:
        """Set an entry."""
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete an entry."""
        pass
    
    @abstractmethod
    async def size(self) -> int:
        """Get number of entries."""
        pass
    
    @abstractmethod
    async def clear(self) -> int:
        """Clear all entries."""
        pass
    
    @abstractmethod
    async def evict_lru(self, count: int = 1) -> int:
        """Evict least recently used entries."""
        pass
    
    @abstractmethod
    async def evict_expired(self) -> int:
        """Evict expired entries."""
        pass
    
    @abstractmethod
    async def evict_random(self, count: int = 1) -> int:
        """Evict random entries."""
        pass


class MemoryBackend(CacheBackend):
    """In-memory cache backend."""
    
    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = asyncio.Lock()
    
    async def initialize(self) -> None:
        """Initialize memory backend."""
        pass
    
    async def get(self, key: str) -> Optional[CacheEntry]:
        """Get entry from memory."""
        async with self._lock:
            return self._cache.get(key)
    
    async def set(self, key: str, entry: CacheEntry) -> None:
        """Set entry in memory."""
        async with self._lock:
            self._cache[key] = entry
    
    async def delete(self, key: str) -> bool:
        """Delete entry from memory."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    async def size(self) -> int:
        """Get cache size."""
        return len(self._cache)
    
    async def clear(self) -> int:
        """Clear all entries."""
        async with self._lock:
            count = len(self._cache)
            self._cache.clear()
            return count
    
    async def evict_lru(self, count: int = 1) -> int:
        """Evict least recently used entries."""
        async with self._lock:
            if not self._cache:
                return 0
            
            # Sort by access time
            sorted_keys = sorted(
                self._cache.keys(),
                key=lambda k: self._cache[k].accessed_at
            )
            
            evicted = 0
            for key in sorted_keys[:count]:
                del self._cache[key]
                evicted += 1
            
            return evicted
    
    async def evict_expired(self) -> int:
        """Evict expired entries."""
        async with self._lock:
            expired_keys = [
                k for k, v in self._cache.items()
                if v.is_expired
            ]
            
            for key in expired_keys:
                del self._cache[key]
            
            return len(expired_keys)
    
    async def evict_random(self, count: int = 1) -> int:
        """Evict random entries."""
        async with self._lock:
            if not self._cache:
                return 0
            
            keys = list(self._cache.keys())
            to_evict = random.sample(keys, min(count, len(keys)))
            
            for key in to_evict:
                del self._cache[key]
            
            return len(to_evict)


class FileBackend(CacheBackend):
    """File-based cache backend."""
    
    def __init__(self, cache_dir: str = ".lyra_cache"):
        self._cache_dir = Path(cache_dir)
        self._index: Dict[str, dict] = {}
        self._lock = asyncio.Lock()
    
    async def initialize(self) -> None:
        """Initialize file backend."""
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Load index
        index_path = self._cache_dir / "index.json"
        if index_path.exists():
            try:
                self._index = json.loads(index_path.read_text())
            except Exception as e:
                logger.warning(f"Failed to load cache index: {e}")
                self._index = {}
    
    def _save_index(self) -> None:
        """Save index to disk."""
        index_path = self._cache_dir / "index.json"
        index_path.write_text(json.dumps(self._index))
    
    def _get_path(self, key: str) -> Path:
        """Get file path for key."""
        return self._cache_dir / f"{key}.cache"
    
    async def get(self, key: str) -> Optional[CacheEntry]:
        """Get entry from file."""
        async with self._lock:
            if key not in self._index:
                return None
            
            path = self._get_path(key)
            if not path.exists():
                del self._index[key]
                return None
            
            try:
                data = json.loads(path.read_text())
                entry = CacheEntry(
                    key=data["key"],
                    value=data["value"],
                    created_at=datetime.fromisoformat(data["created_at"]),
                    accessed_at=datetime.fromisoformat(data["accessed_at"]),
                    expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
                    access_count=data.get("access_count", 0),
                )
                return entry
            except Exception as e:
                logger.warning(f"Failed to read cache entry {key}: {e}")
                return None
    
    async def set(self, key: str, entry: CacheEntry) -> None:
        """Set entry in file."""
        async with self._lock:
            path = self._get_path(key)
            
            data = {
                "key": entry.key,
                "value": entry.value,
                "created_at": entry.created_at.isoformat(),
                "accessed_at": entry.accessed_at.isoformat(),
                "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
                "access_count": entry.access_count,
            }
            
            path.write_text(json.dumps(data))
            self._index[key] = {
                "created_at": entry.created_at.isoformat(),
                "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
            }
            self._save_index()
    
    async def delete(self, key: str) -> bool:
        """Delete entry from file."""
        async with self._lock:
            path = self._get_path(key)
            if path.exists():
                path.unlink()
            
            if key in self._index:
                del self._index[key]
                self._save_index()
                return True
            return False
    
    async def size(self) -> int:
        """Get cache size."""
        return len(self._index)
    
    async def clear(self) -> int:
        """Clear all entries."""
        async with self._lock:
            count = len(self._index)
            
            for key in list(self._index.keys()):
                path = self._get_path(key)
                if path.exists():
                    path.unlink()
            
            self._index.clear()
            self._save_index()
            
            return count
    
    async def evict_lru(self, count: int = 1) -> int:
        """Evict least recently used entries."""
        # File backend uses creation time as proxy for LRU
        async with self._lock:
            sorted_keys = sorted(
                self._index.keys(),
                key=lambda k: self._index[k].get("created_at", "")
            )
            
            evicted = 0
            for key in sorted_keys[:count]:
                path = self._get_path(key)
                if path.exists():
                    path.unlink()
                del self._index[key]
                evicted += 1
            
            if evicted:
                self._save_index()
            
            return evicted
    
    async def evict_expired(self) -> int:
        """Evict expired entries."""
        async with self._lock:
            now = datetime.now().isoformat()
            expired_keys = []
            
            for key, meta in self._index.items():
                expires_at = meta.get("expires_at")
                if expires_at and expires_at < now:
                    expired_keys.append(key)
            
            for key in expired_keys:
                path = self._get_path(key)
                if path.exists():
                    path.unlink()
                del self._index[key]
            
            if expired_keys:
                self._save_index()
            
            return len(expired_keys)
    
    async def evict_random(self, count: int = 1) -> int:
        """Evict random entries."""
        async with self._lock:
            if not self._index:
                return 0
            
            keys = list(self._index.keys())
            to_evict = random.sample(keys, min(count, len(keys)))
            
            for key in to_evict:
                path = self._get_path(key)
                if path.exists():
                    path.unlink()
                del self._index[key]
            
            self._save_index()
            return len(to_evict)


class RedisBackend(CacheBackend):
    """Redis cache backend for distributed caching."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self._redis_url = redis_url
        self._client = None
        self._prefix = "lyra_cache:"
    
    async def initialize(self) -> None:
        """Initialize Redis connection."""
        try:
            import redis.asyncio as redis
            self._client = redis.from_url(self._redis_url)
            await self._client.ping()
            logger.info("Redis cache backend connected")
        except ImportError:
            logger.warning("redis package not installed")
            self._client = None
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._client = None
    
    def _make_key(self, key: str) -> str:
        """Add prefix to key."""
        return f"{self._prefix}{key}"
    
    async def get(self, key: str) -> Optional[CacheEntry]:
        """Get entry from Redis."""
        if self._client is None:
            return None
        
        try:
            data = await self._client.get(self._make_key(key))
            if data is None:
                return None
            
            entry_data = json.loads(data)
            return CacheEntry(
                key=entry_data["key"],
                value=entry_data["value"],
                created_at=datetime.fromisoformat(entry_data["created_at"]),
                accessed_at=datetime.fromisoformat(entry_data["accessed_at"]),
                expires_at=datetime.fromisoformat(entry_data["expires_at"]) if entry_data.get("expires_at") else None,
                access_count=entry_data.get("access_count", 0),
            )
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")
            return None
    
    async def set(self, key: str, entry: CacheEntry) -> None:
        """Set entry in Redis."""
        if self._client is None:
            return
        
        try:
            data = {
                "key": entry.key,
                "value": entry.value,
                "created_at": entry.created_at.isoformat(),
                "accessed_at": entry.accessed_at.isoformat(),
                "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
                "access_count": entry.access_count,
            }
            
            redis_key = self._make_key(key)
            await self._client.set(redis_key, json.dumps(data))
            
            # Set TTL if expires_at is set
            if entry.expires_at:
                ttl = int((entry.expires_at - datetime.now()).total_seconds())
                if ttl > 0:
                    await self._client.expire(redis_key, ttl)
                    
        except Exception as e:
            logger.warning(f"Redis set failed: {e}")
    
    async def delete(self, key: str) -> bool:
        """Delete entry from Redis."""
        if self._client is None:
            return False
        
        try:
            result = await self._client.delete(self._make_key(key))
            return result > 0
        except Exception as e:
            logger.warning(f"Redis delete failed: {e}")
            return False
    
    async def size(self) -> int:
        """Get approximate cache size."""
        if self._client is None:
            return 0
        
        try:
            keys = await self._client.keys(f"{self._prefix}*")
            return len(keys)
        except Exception:
            return 0
    
    async def clear(self) -> int:
        """Clear all entries with our prefix."""
        if self._client is None:
            return 0
        
        try:
            keys = await self._client.keys(f"{self._prefix}*")
            if keys:
                await self._client.delete(*keys)
            return len(keys)
        except Exception as e:
            logger.warning(f"Redis clear failed: {e}")
            return 0
    
    async def evict_lru(self, count: int = 1) -> int:
        """Redis handles eviction automatically with maxmemory-policy."""
        return 0
    
    async def evict_expired(self) -> int:
        """Redis handles TTL expiration automatically."""
        return 0
    
    async def evict_random(self, count: int = 1) -> int:
        """Evict random entries."""
        if self._client is None:
            return 0
        
        try:
            keys = await self._client.keys(f"{self._prefix}*")
            if not keys:
                return 0
            
            to_evict = random.sample(keys, min(count, len(keys)))
            if to_evict:
                await self._client.delete(*to_evict)
            return len(to_evict)
        except Exception:
            return 0


def get_backend(config: CacheConfig) -> CacheBackend:
    """
    Get the appropriate cache backend.
    
    Args:
        config: Cache configuration
        
    Returns:
        Cache backend instance
    """
    backends = {
        "memory": lambda: MemoryBackend(),
        "file": lambda: FileBackend(config.file_path),
        "redis": lambda: RedisBackend(config.redis_url),
    }
    
    factory = backends.get(config.backend.lower())
    if factory is None:
        factory = lambda: MemoryBackend()
    
    return factory()
