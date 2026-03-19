"""Local SQLite ledger for agent wallet.

P1-1: Uses Decimal internally for financial precision.
Amounts are stored as TEXT in SQLite to preserve full precision.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from time import time
from uuid import uuid4

import aiosqlite

from ag402_core.wallet.models import Transaction, _to_decimal

logger = logging.getLogger(__name__)


class InsufficientBalance(Exception):
    """Raised when wallet balance is too low for a deduction."""


class DailyLimitExceeded(Exception):
    """Raised when daily spend limit would be exceeded."""


class AgentWallet:
    """Async SQLite-backed agent wallet with atomic balance operations.

    All monetary values are handled as ``Decimal`` internally.
    The public API accepts both ``float`` and ``Decimal`` for convenience.
    """

    def __init__(self, db_path: str = "x402_wallet.db", max_daily_spend: float | Decimal | None = None):
        self.db_path = db_path
        # Create parent directory if it doesn't exist
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        self._lock = asyncio.Lock()
        self._db: aiosqlite.Connection | None = None
        if max_daily_spend is not None:
            self._max_daily_spend = _to_decimal(max_daily_spend)
        else:
            from ag402_core.config import load_config
            self._max_daily_spend = _to_decimal(load_config().daily_spend_limit)

    async def init_db(self) -> None:
        import contextlib

        # Only backup if this is a re-initialization of an existing DB
        # (i.e., the DB already exists and we're opening it, not creating fresh)
        is_existing = os.path.exists(self.db_path)

        self._db = await aiosqlite.connect(self.db_path, timeout=10.0)
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA busy_timeout=5000")
        await self._db.execute("PRAGMA synchronous=FULL")

        # Check if the transactions table already exists (schema version check)
        cursor = await self._db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
        )
        table_exists = await cursor.fetchone() is not None

        # Backup only if the DB existed AND had the transactions table
        # (protects against schema migration issues, not routine opens)
        if is_existing and table_exists:
            # Only create a backup if one doesn't already exist from today
            bak_path = f"{self.db_path}.bak"
            try:
                if os.path.exists(bak_path):
                    bak_age = time() - os.path.getmtime(bak_path)
                    if bak_age > 86400:  # older than 24h
                        with contextlib.suppress(Exception):
                            shutil.copy2(self.db_path, bak_path)
                            os.chmod(bak_path, 0o600)  # L-2 FIX: restrictive permissions
                else:
                    with contextlib.suppress(Exception):
                        shutil.copy2(self.db_path, bak_path)
                        os.chmod(bak_path, 0o600)  # L-2 FIX: restrictive permissions
            except Exception:
                pass

        # --- Schema version management ---
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_version (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                version INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        cursor = await self._db.execute("SELECT version FROM schema_version WHERE id = 1")
        row = await cursor.fetchone()
        current_version = row[0] if row else 0

        if current_version == 0:
            # Fresh DB or pre-versioning DB — create/ensure transactions table
            await self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS transactions (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    amount TEXT NOT NULL,
                    to_address TEXT DEFAULT '',
                    tx_hash TEXT DEFAULT '',
                    status TEXT DEFAULT 'pending',
                    timestamp REAL NOT NULL,
                    note TEXT DEFAULT ''
                )
                """
            )
            await self._db.execute(
                "INSERT OR REPLACE INTO schema_version (id, version) VALUES (1, 1)"
            )
            current_version = 1

        # Future migrations go here:
        # if current_version < 2:
        #     await self._db.execute("ALTER TABLE transactions ADD COLUMN ...")
        #     await self._db.execute(
        #         "UPDATE schema_version SET version = 2 WHERE id = 1"
        #     )
        #     current_version = 2

        await self._db.commit()

        # Set restrictive file permissions (best-effort, may fail on Windows)
        with contextlib.suppress(Exception):
            os.chmod(self.db_path, 0o600)

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    def _ensure_db(self) -> None:
        """Raise if database connection is not available."""
        if self._db is None:
            raise RuntimeError(
                "Wallet database not initialized. Call await wallet.init_db() first."
            )

    async def deposit(self, amount: float | Decimal, note: str = "") -> Transaction:
        self._ensure_db()
        amount_d = _to_decimal(amount)
        if amount_d <= 0:
            raise ValueError("Amount must be positive")
        async with self._lock:
            tx = Transaction(
                id=str(uuid4()),
                type="deposit",
                amount=amount_d,
                status="confirmed",
                timestamp=time(),
                note=note,
            )
            await self._insert_tx(tx)
            await self._db.commit()
            logger.info("Deposited %s USD — %s", amount_d, note or "no note")
            return tx

    async def deduct(self, amount: float | Decimal, to_address: str, tx_hash: str = "") -> Transaction:
        self._ensure_db()
        amount_d = _to_decimal(amount)
        if amount_d <= 0:
            raise ValueError("Amount must be positive")
        async with self._lock:
            balance = await self._calc_balance()
            if balance < amount_d:
                raise InsufficientBalance(
                    f"Balance {balance} < requested {amount_d}"
                )
            daily = await self._calc_daily_spend()
            if daily + amount_d > self._max_daily_spend:
                raise DailyLimitExceeded(
                    f"Daily spend {daily} + {amount_d} > limit {self._max_daily_spend}"
                )
            tx = Transaction(
                id=str(uuid4()),
                type="deduction",
                amount=amount_d,
                to_address=to_address,
                tx_hash=tx_hash,
                status="confirmed",
                timestamp=time(),
            )
            await self._insert_tx(tx)
            await self._db.commit()
            logger.info("Deducted %s USD to %s", amount_d, to_address)
            return tx

    async def rollback(self, transaction_id: str) -> Transaction:
        self._ensure_db()
        async with self._lock:
            cursor = await self._db.execute(
                "SELECT id, type, amount, to_address, tx_hash, status, timestamp, note "
                "FROM transactions WHERE id = ?",
                (transaction_id,),
            )
            row = await cursor.fetchone()
            if row is None:
                raise ValueError(f"Transaction {transaction_id} not found")
            original = Transaction(
                id=row[0], type=row[1], amount=_to_decimal(row[2]),
                to_address=row[3], tx_hash=row[4], status=row[5],
                timestamp=row[6], note=row[7],
            )
            if original.type != "deduction":
                raise ValueError(f"Can only rollback deductions, got {original.type}")
            if original.status == "rolled_back":
                raise ValueError(f"Transaction {transaction_id} already rolled back")

            # Mark original as rolled_back
            await self._db.execute(
                "UPDATE transactions SET status = 'rolled_back' WHERE id = ?",
                (transaction_id,),
            )

            # Create rollback record (for audit trail; balance is restored by
            # the status change on the original deduction)
            tx = Transaction(
                id=str(uuid4()),
                type="rollback",
                amount=original.amount,
                to_address=original.to_address,
                status="confirmed",
                timestamp=time(),
                note=f"Rollback of {transaction_id}",
            )
            await self._insert_tx(tx)
            await self._db.commit()
            logger.info("Rolled back transaction %s (%s USD)", transaction_id, original.amount)
            return tx

    async def get_balance(self) -> Decimal:
        self._ensure_db()
        async with self._lock:
            return await self._calc_balance()

    async def get_daily_spend(self) -> Decimal:
        self._ensure_db()
        async with self._lock:
            return await self._calc_daily_spend()

    async def get_minute_spend(self) -> Decimal:
        """Total spend in the last 60 seconds."""
        self._ensure_db()
        async with self._lock:
            return await self._calc_minute_spend()

    async def get_minute_count(self) -> int:
        """Number of confirmed deductions in the last 60 seconds."""
        self._ensure_db()
        async with self._lock:
            return await self._calc_minute_count()

    async def get_transactions(self, limit: int = 50) -> list[Transaction]:
        self._ensure_db()
        async with self._lock:
            cursor = await self._db.execute(
                "SELECT id, type, amount, to_address, tx_hash, status, timestamp, note "
                "FROM transactions ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
            rows = await cursor.fetchall()
            return [
                Transaction(
                    id=r[0], type=r[1], amount=_to_decimal(r[2]),
                    to_address=r[3], tx_hash=r[4], status=r[5],
                    timestamp=r[6], note=r[7],
                )
                for r in rows
            ]

    @staticmethod
    def _escape_like(pattern: str, escape_char: str = "\\") -> str:
        """Escape LIKE wildcards (%, _, \\) so they are treated as literals."""
        return (
            pattern
            .replace(escape_char, escape_char + escape_char)
            .replace("%", escape_char + "%")
            .replace("_", escape_char + "_")
        )

    async def find_transactions_by_prefix(self, id_prefix: str, limit: int = 10) -> list[Transaction]:
        """Find transactions whose ID starts with the given prefix (SQL LIKE).

        LIKE wildcards in *id_prefix* are escaped so they are treated as
        literal characters.
        """
        self._ensure_db()
        escaped = self._escape_like(id_prefix)
        async with self._lock:
            cursor = await self._db.execute(
                "SELECT id, type, amount, to_address, tx_hash, status, timestamp, note "
                "FROM transactions WHERE id LIKE ? ESCAPE '\\' ORDER BY timestamp DESC LIMIT ?",
                (escaped + "%", limit),
            )
            rows = await cursor.fetchall()
            return [
                Transaction(
                    id=r[0], type=r[1], amount=_to_decimal(r[2]),
                    to_address=r[3], tx_hash=r[4], status=r[5],
                    timestamp=r[6], note=r[7],
                )
                for r in rows
            ]

    async def export_history(self, path: str, format: str = "json") -> None:
        """Export transaction records to a file.

        Args:
            path: Output file path.
            format: Export format ('json' or 'csv').

        Raises:
            ValueError: If the resolved path escapes the allowed directory.
        """
        import csv as csv_module

        # Path validation: resolve to absolute and prevent directory traversal
        import tempfile

        resolved = os.path.realpath(path)
        allowed_dirs = [
            os.path.realpath(os.getcwd()),
            os.path.realpath(str(Path.home())),
            os.path.realpath(tempfile.gettempdir()),
        ]
        if not any(resolved == d or resolved.startswith(d + os.sep) for d in allowed_dirs):
            raise ValueError(
                f"Export path must be under CWD, HOME, or TMPDIR, got: {resolved}"
            )

        txns = await self.get_transactions(limit=10000)
        fieldnames = [
            "id", "type", "amount", "to_address", "tx_hash",
            "status", "timestamp", "note",
        ]
        records = [
            {
                "id": t.id,
                "type": t.type,
                "amount": str(t.amount),
                "to_address": t.to_address,
                "tx_hash": t.tx_hash,
                "status": t.status,
                "timestamp": t.timestamp,
                "note": t.note,
            }
            for t in txns
        ]
        if format == "json":
            with open(path, "w") as f:
                json.dump(records, f, indent=2)
        elif format == "csv":
            with open(path, "w", newline="") as f:
                writer = csv_module.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(records)
        else:
            raise ValueError(f"Unsupported export format: {format}")

    async def get_summary_stats(self) -> dict:
        """Return summary statistics for the wallet."""
        self._ensure_db()
        async with self._lock:
            balance = await self._calc_balance()
            daily = await self._calc_daily_spend()
            # Total spend = sum of all confirmed deductions
            cursor = await self._db.execute(
                "SELECT amount FROM transactions "
                "WHERE type = 'deduction' AND status = 'confirmed'"
            )
            rows = await cursor.fetchall()
            total_spend = sum((_to_decimal(r[0]) for r in rows), Decimal("0"))
            tx_count = len(rows)
            return {
                "balance": balance,
                "today_spend": daily,
                "total_spend": total_spend,
                "tx_count": tx_count,
            }

    async def get_spend_by_address(self) -> dict[str, Decimal]:
        """Return total confirmed spend grouped by recipient address."""
        self._ensure_db()
        async with self._lock:
            cursor = await self._db.execute(
                "SELECT to_address, amount FROM transactions "
                "WHERE type = 'deduction' AND status = 'confirmed' AND to_address != '' "
                "ORDER BY to_address"
            )
            rows = await cursor.fetchall()
            result: dict[str, Decimal] = {}
            for row in rows:
                addr = row[0]
                amt = _to_decimal(row[1])
                result[addr] = result.get(addr, Decimal("0")) + amt
            return result

    # --- Private helpers (MUST be called inside self._lock) ---

    async def _insert_tx(self, tx: Transaction) -> None:
        await self._db.execute(
            "INSERT INTO transactions (id, type, amount, to_address, tx_hash, status, timestamp, note) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (tx.id, tx.type, str(tx.amount), tx.to_address, tx.tx_hash, tx.status, tx.timestamp, tx.note),
        )

    async def _calc_balance(self) -> Decimal:
        """Balance = deposits - confirmed_deductions.
        Rollback entries are purely for audit; the balance effect comes from
        changing the original deduction's status to 'rolled_back'."""
        cursor = await self._db.execute(
            "SELECT type, amount, status FROM transactions "
            "WHERE status = 'confirmed' AND type IN ('deposit', 'deduction')"
        )
        rows = await cursor.fetchall()
        total = Decimal("0")
        for row in rows:
            amt = _to_decimal(row[1])
            if row[0] == "deposit":
                total += amt
            elif row[0] == "deduction":
                total -= amt
        return total

    async def _calc_daily_spend(self) -> Decimal:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).timestamp()
        cursor = await self._db.execute(
            "SELECT amount FROM transactions "
            "WHERE type = 'deduction' AND status = 'confirmed' AND timestamp >= ?",
            (today_start,),
        )
        rows = await cursor.fetchall()
        return sum((_to_decimal(r[0]) for r in rows), Decimal("0"))

    async def _calc_minute_spend(self) -> Decimal:
        """Sum of confirmed deductions in the last 60 seconds."""
        cutoff = time() - 60.0
        cursor = await self._db.execute(
            "SELECT amount FROM transactions "
            "WHERE type = 'deduction' AND status = 'confirmed' AND timestamp >= ?",
            (cutoff,),
        )
        rows = await cursor.fetchall()
        return sum((_to_decimal(r[0]) for r in rows), Decimal("0"))

    async def _calc_minute_count(self) -> int:
        """Count of confirmed deductions in the last 60 seconds."""
        cutoff = time() - 60.0
        cursor = await self._db.execute(
            "SELECT COUNT(*) FROM transactions "
            "WHERE type = 'deduction' AND status = 'confirmed' AND timestamp >= ?",
            (cutoff,),
        )
        row = await cursor.fetchone()
        return row[0]
