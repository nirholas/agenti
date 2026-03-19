"""
Replay attack protection using timestamp + nonce.

Client side: inject X-x402-Timestamp and X-x402-Nonce into requests.
Server side: reject requests older than replay_window_seconds or with duplicate nonces.

P0-4: Added PersistentReplayGuard for tx_hash deduplication backed by SQLite.
P1-RECEIPT-REUSE: Added grace window support — previously consumed tx_hashes can
    be retried within a configurable window to handle upstream delivery failures.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import time
import uuid
from collections import OrderedDict
from enum import Enum

import aiosqlite

logger = logging.getLogger(__name__)

# Max nonces to remember (prevents unbounded memory growth)
_MAX_NONCE_CACHE = 10_000

# Max nonce length — reject oversized nonces to prevent memory abuse
_MAX_NONCE_LENGTH = 128

# Default grace window for tx_hash reuse (seconds)
DEFAULT_RECEIPT_GRACE_SECONDS = 300  # 5 minutes


class ReplayGuard:
    """Server-side replay attack protection."""

    def __init__(self, window_seconds: int = 30, max_cache: int = _MAX_NONCE_CACHE):
        self._window = window_seconds
        self._max_cache = max_cache
        self._seen_nonces: OrderedDict[str, float] = OrderedDict()

    def check(self, timestamp_str: str, nonce: str) -> tuple[bool, str]:
        """
        Check if a request is fresh (not a replay).

        Returns:
            (is_valid, error_message)
        """
        # 1. Validate timestamp
        if not timestamp_str:
            return False, "Missing X-x402-Timestamp header"
        if not nonce:
            return False, "Missing X-x402-Nonce header"

        # P2-3.3: Reject oversized nonces to prevent memory abuse
        if len(nonce) > _MAX_NONCE_LENGTH:
            return False, f"Nonce too long ({len(nonce)} > {_MAX_NONCE_LENGTH})"

        try:
            request_time = float(timestamp_str)
        except (ValueError, TypeError):
            return False, f"Invalid timestamp format: {timestamp_str}"

        now = time.time()
        age = now - request_time

        if age > self._window:
            logger.warning(
                "[REPLAY] Rejected stale request (age: %.1fs > %ds)",
                age, self._window,
            )
            return False, f"Request too old ({age:.1f}s > {self._window}s window)"

        if age < -self._window:
            # Clock skew: request from the future
            logger.warning("[REPLAY] Rejected future request (age: %.1fs)", age)
            return False, f"Request timestamp is in the future ({-age:.1f}s ahead)"

        # 2. Check nonce uniqueness
        if nonce in self._seen_nonces:
            logger.warning("[REPLAY] Rejected duplicate nonce: %s", nonce[:32])
            return False, "Duplicate nonce (possible replay)"

        # P2-3.3: If cache is full after pruning, reject (anti-flood)
        self._prune()
        if len(self._seen_nonces) >= self._max_cache:
            logger.warning("[REPLAY] Nonce cache full (%d) — rejecting request", self._max_cache)
            return False, "Server overloaded — too many requests, try again later"

        # 3. Record nonce
        self._seen_nonces[nonce] = now

        return True, ""

    def _prune(self) -> None:
        """Remove old nonces to prevent unbounded memory growth."""
        now = time.time()
        cutoff = now - self._window * 2  # Keep 2x window for safety

        # Prune by time
        while self._seen_nonces:
            oldest_nonce, oldest_time = next(iter(self._seen_nonces.items()))
            if oldest_time < cutoff:
                self._seen_nonces.pop(oldest_nonce)
            else:
                break

        # Prune by size
        while len(self._seen_nonces) > self._max_cache:
            self._seen_nonces.popitem(last=False)


class TxHashStatus(Enum):
    """Result of checking a tx_hash against the persistent replay guard."""

    NEW = "NEW"                      # Never seen before — record and allow
    WITHIN_GRACE = "WITHIN_GRACE"    # Previously consumed, within grace window — allow retry
    EXPIRED = "EXPIRED"              # Previously consumed, grace window expired — reject


class PersistentReplayGuard:
    """SQLite-backed tx_hash deduplication for gateway replay protection.

    Unlike the in-memory ReplayGuard (for nonce checks), this persists
    consumed tx_hashes to disk so they survive process restarts.

    Supports a grace window: when a tx_hash was previously consumed but the
    upstream delivery failed, the buyer can retry with the same tx_hash
    within ``grace_seconds``. After the grace window expires, retries are
    rejected as replays.
    """

    def __init__(
        self,
        db_path: str = "x402_replay.db",
        grace_seconds: float = DEFAULT_RECEIPT_GRACE_SECONDS,
    ) -> None:
        self.db_path = db_path
        self.grace_seconds = grace_seconds
        self._db: aiosqlite.Connection | None = None

    @property
    def db(self) -> aiosqlite.Connection | None:
        """Expose the underlying DB connection for shared-table usage.

        The gateway uses this to create prepaid tables on the same connection,
        avoiding dual-connection issues (SQLITE_BUSY, deadlocks) when two
        independent connections write to the same file.
        """
        return self._db

    async def init_db(self) -> None:
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            try:
                os.makedirs(db_dir, exist_ok=True)
            except PermissionError as e:
                # M-4 FIX: os.getuid/getgid don't exist on Windows
                uid_info = f"uid: {os.getuid()}" if hasattr(os, "getuid") else "user: N/A (Windows)"
                raise PermissionError(
                    f"Cannot create directory {db_dir} — permission denied. "
                    f"Current {uid_info}. "
                    f"For Docker: ensure volume mount has correct ownership."
                ) from e

        # Pre-flight permission check: provide a clear error message instead of
        # the opaque sqlite3.OperationalError when the directory is not writable.
        if db_dir and os.path.isdir(db_dir) and not os.access(db_dir, os.W_OK):
            stat_info = os.stat(db_dir)
            uid_info = (
                f"uid: {os.getuid()}, dir owner uid: {stat_info.st_uid}, "
                f"dir mode: {oct(stat_info.st_mode)[-3:]}"
                if hasattr(os, "getuid")
                else f"dir mode: {oct(stat_info.st_mode)[-3:]}"
            )
            raise PermissionError(
                f"Cannot write to {db_dir} — check directory permissions. "
                f"Current {uid_info}."
            )

        self._db = await aiosqlite.connect(self.db_path, timeout=10.0)
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA busy_timeout=5000")
        await self._db.execute("PRAGMA synchronous=FULL")
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS consumed_tx_hashes (
                tx_hash TEXT PRIMARY KEY,
                recorded_at REAL NOT NULL,
                delivered INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        await self._db.execute(
            "CREATE INDEX IF NOT EXISTS idx_consumed_at ON consumed_tx_hashes(recorded_at)"
        )
        # Response cache table for grace-window retries
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS response_cache (
                tx_hash TEXT PRIMARY KEY,
                status_code INTEGER NOT NULL,
                headers TEXT NOT NULL,
                body BLOB NOT NULL,
                cached_at REAL NOT NULL
            )
            """
        )
        # Migrate: add 'delivered' column if it doesn't exist (upgrade from pre-grace schema)
        with contextlib.suppress(Exception):
            await self._db.execute(
                "ALTER TABLE consumed_tx_hashes ADD COLUMN delivered INTEGER NOT NULL DEFAULT 0"
            )
        await self._db.commit()

        # M-6 FIX: Auto-prune stale entries on startup (7-day default)
        pruned = await self.prune()
        if pruned:
            logger.info("[REPLAY] Auto-pruned %d stale entries on startup", pruned)

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    async def _ensure_db(self) -> None:
        """Lazy-init DB connection if not yet initialized.

        Uses an asyncio.Lock to prevent concurrent callers from both
        running init_db() (which would cause 'database is locked' errors).
        """
        if self._db is not None:
            return
        if not hasattr(self, "_init_lock"):
            self._init_lock = asyncio.Lock()
        async with self._init_lock:
            if self._db is None:
                await self.init_db()

    async def check_tx_status(self, tx_hash: str) -> TxHashStatus:
        """Check the status of a tx_hash without recording it.

        Returns:
            TxHashStatus.NEW if never seen.
            TxHashStatus.WITHIN_GRACE if consumed but within grace window.
            TxHashStatus.EXPIRED if consumed and grace window expired.
        """
        await self._ensure_db()
        cursor = await self._db.execute(
            "SELECT recorded_at, delivered FROM consumed_tx_hashes WHERE tx_hash = ?",
            (tx_hash,),
        )
        row = await cursor.fetchone()
        if row is None:
            return TxHashStatus.NEW

        recorded_at, delivered = row
        # If already delivered successfully, treat as expired (no retry needed)
        if delivered:
            return TxHashStatus.EXPIRED

        age = time.time() - recorded_at
        if age <= self.grace_seconds:
            return TxHashStatus.WITHIN_GRACE
        return TxHashStatus.EXPIRED

    async def check_and_record_tx(self, tx_hash: str) -> bool:
        """Check if tx_hash is new; if so, record it.

        Uses INSERT OR IGNORE for atomicity — eliminates the TOCTOU race
        condition that existed in the previous SELECT-then-INSERT approach.

        Returns:
            True if the tx_hash is new (first time seen).
            False if it was already consumed (replay).
        """
        await self._ensure_db()
        cursor = await self._db.execute(
            "INSERT OR IGNORE INTO consumed_tx_hashes (tx_hash, recorded_at, delivered) VALUES (?, ?, 0)",
            (tx_hash, time.time()),
        )
        await self._db.commit()
        is_new = cursor.rowcount > 0
        if not is_new:
            logger.warning("[REPLAY] Duplicate tx_hash rejected: %s", tx_hash[:32])
        return is_new

    async def mark_delivered(self, tx_hash: str) -> None:
        """Mark a tx_hash as successfully delivered.

        Once marked, the grace window no longer applies — further retries
        for this tx_hash will be rejected as EXPIRED.
        """
        await self._ensure_db()
        await self._db.execute(
            "UPDATE consumed_tx_hashes SET delivered = 1 WHERE tx_hash = ?",
            (tx_hash,),
        )
        await self._db.commit()

    async def get_cached_response(self, tx_hash: str) -> tuple[int, dict, bytes] | None:
        """Retrieve a cached upstream response for a delivered tx_hash.

        Returns:
            (status_code, headers_dict, body_bytes) or None if not cached.
        """
        await self._ensure_db()
        cursor = await self._db.execute(
            "SELECT status_code, headers, body FROM response_cache WHERE tx_hash = ?",
            (tx_hash,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None

        import json
        status_code = row[0]
        headers = json.loads(row[1]) if row[1] else {}
        body = row[2] if row[2] else b""
        if isinstance(body, str):
            body = body.encode()
        return (status_code, headers, body)

    async def cache_response(
        self, tx_hash: str, status_code: int, headers: dict, body: bytes
    ) -> None:
        """Cache a successful upstream response for a tx_hash.

        This allows the gateway to serve the cached response when a buyer
        retries with the same tx_hash within the grace window.
        """
        await self._ensure_db()
        import json

        await self._db.execute(
            "INSERT OR REPLACE INTO response_cache (tx_hash, status_code, headers, body, cached_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (tx_hash, status_code, json.dumps(headers), body, time.time()),
        )
        await self._db.commit()

    async def prune(self, max_age_seconds: float = 86400 * 7) -> int:
        """Remove tx_hashes older than max_age_seconds.

        Returns the number of pruned entries.
        """
        await self._ensure_db()
        cutoff = time.time() - max_age_seconds
        cursor = await self._db.execute(
            "DELETE FROM consumed_tx_hashes WHERE recorded_at < ?",
            (cutoff,),
        )
        # Also prune response cache
        with contextlib.suppress(Exception):
            await self._db.execute(
                "DELETE FROM response_cache WHERE cached_at < ?",
                (cutoff,),
            )
        await self._db.commit()
        return cursor.rowcount


def generate_replay_headers() -> dict[str, str]:
    """Generate timestamp + nonce headers for a client request."""
    return {
        "X-x402-Timestamp": f"{time.time():.3f}",
        "X-x402-Nonce": uuid.uuid4().hex,
    }
