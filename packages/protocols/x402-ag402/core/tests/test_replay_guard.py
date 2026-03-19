"""Tests for replay protection hardening -- P0-4 fix.

Ensures:
1. Gateway REJECTS requests missing X-x402-Timestamp / X-x402-Nonce headers.
2. tx_hash deduplication is persisted (survives restart).
3. Duplicate tx_hash with valid proof is rejected.
"""

from __future__ import annotations

import pytest
from ag402_core.security.replay_guard import PersistentReplayGuard, ReplayGuard

# --- 1. ReplayGuard enforces mandatory headers ---


class TestReplayGuardMandatory:
    def test_missing_timestamp_rejected(self):
        guard = ReplayGuard(window_seconds=10)
        ok, err = guard.check("", "some-nonce")
        assert ok is False
        assert "Timestamp" in err

    def test_missing_nonce_rejected(self):
        guard = ReplayGuard(window_seconds=10)
        import time
        ok, err = guard.check(str(time.time()), "")
        assert ok is False
        assert "Nonce" in err

    def test_valid_request_accepted(self):
        guard = ReplayGuard(window_seconds=10)
        import time
        ok, err = guard.check(str(time.time()), "unique-nonce-123")
        assert ok is True
        assert err == ""

    def test_duplicate_nonce_rejected(self):
        guard = ReplayGuard(window_seconds=10)
        import time
        ts = str(time.time())
        ok1, _ = guard.check(ts, "same-nonce")
        assert ok1 is True
        ok2, err2 = guard.check(ts, "same-nonce")
        assert ok2 is False
        assert "replay" in err2.lower() or "duplicate" in err2.lower()


# --- 2. PersistentReplayGuard for tx_hash deduplication ---


class TestPersistentReplayGuard:
    @pytest.mark.asyncio
    async def test_first_tx_hash_accepted(self, tmp_path):
        db_path = str(tmp_path / "replay.db")
        guard = PersistentReplayGuard(db_path=db_path)
        await guard.init_db()

        is_new = await guard.check_and_record_tx("tx_abc123")
        assert is_new is True

        await guard.close()

    @pytest.mark.asyncio
    async def test_duplicate_tx_hash_rejected(self, tmp_path):
        db_path = str(tmp_path / "replay.db")
        guard = PersistentReplayGuard(db_path=db_path)
        await guard.init_db()

        await guard.check_and_record_tx("tx_abc123")
        is_new = await guard.check_and_record_tx("tx_abc123")
        assert is_new is False

        await guard.close()

    @pytest.mark.asyncio
    async def test_persistence_survives_restart(self, tmp_path):
        """tx_hash recorded in one session is still known after reopen."""
        db_path = str(tmp_path / "replay.db")

        # Session 1: record tx
        guard1 = PersistentReplayGuard(db_path=db_path)
        await guard1.init_db()
        await guard1.check_and_record_tx("tx_persist_test")
        await guard1.close()

        # Session 2: same DB — tx should be known
        guard2 = PersistentReplayGuard(db_path=db_path)
        await guard2.init_db()
        is_new = await guard2.check_and_record_tx("tx_persist_test")
        assert is_new is False
        await guard2.close()

    @pytest.mark.asyncio
    async def test_different_tx_hashes_both_accepted(self, tmp_path):
        db_path = str(tmp_path / "replay.db")
        guard = PersistentReplayGuard(db_path=db_path)
        await guard.init_db()

        assert await guard.check_and_record_tx("tx_1") is True
        assert await guard.check_and_record_tx("tx_2") is True

        await guard.close()
