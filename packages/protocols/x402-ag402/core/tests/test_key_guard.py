"""Tests for key_guard module — private key log redaction."""

from __future__ import annotations

import logging

from ag402_core.security.key_guard import PrivateKeyFilter, install_key_guard


class TestPrivateKeyFilter:
    """Direct tests on PrivateKeyFilter."""

    def _make_record(self, msg: str, args=None) -> logging.LogRecord:
        return logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=0,
            msg=msg, args=args, exc_info=None,
        )

    # ── Layer 1: label=value redaction ──────────────────────────────

    def test_redacts_private_key_with_equals(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("Loaded private_key=abc123")
        filt.filter(rec)
        assert "abc123" not in rec.msg
        assert "[REDACTED]" in rec.msg

    def test_redacts_secret_key_with_colon(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("Config secret_key: supersecret")
        filt.filter(rec)
        assert "supersecret" not in rec.msg
        assert "[REDACTED]" in rec.msg

    def test_redacts_mnemonic_with_colon(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("User mnemonic: word1 word2")
        filt.filter(rec)
        assert "word1" not in rec.msg
        assert "[REDACTED]" in rec.msg

    # ── Layer 2: bare label keyword redaction ──────────────────────

    def test_redacts_bare_private_key_label(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("private_key exposed!")
        filt.filter(rec)
        assert "private_key" not in rec.msg
        assert "[REDACTED]" in rec.msg

    def test_redacts_bare_secret_key_label(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("Config secret_key was set")
        filt.filter(rec)
        assert "secret_key" not in rec.msg
        assert "[REDACTED]" in rec.msg

    def test_redacts_bare_mnemonic_label(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("mnemonic found in log")
        filt.filter(rec)
        assert "mnemonic" not in rec.msg
        assert "[REDACTED]" in rec.msg

    def test_redacts_bare_seed_phrase_label(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("seed_phrase loaded from file")
        filt.filter(rec)
        assert "seed_phrase" not in rec.msg
        assert "[REDACTED]" in rec.msg

    # ── Layer 3: base58 key value redaction ────────────────────────

    def test_redacts_base58_key(self):
        # Simulated 64-char base58 string (Solana private key length)
        fake_key = "5" + "A" * 63
        filt = PrivateKeyFilter()
        rec = self._make_record(f"Key is {fake_key}")
        filt.filter(rec)
        assert fake_key not in rec.msg
        assert "[REDACTED]" in rec.msg

    def test_redacts_88_char_base58_key(self):
        fake_key = "4" + "z" * 87
        filt = PrivateKeyFilter()
        rec = self._make_record(f"Using {fake_key} for signing")
        filt.filter(rec)
        assert fake_key not in rec.msg
        assert "[REDACTED]" in rec.msg

    def test_does_not_redact_short_base58(self):
        """Strings shorter than 64 chars should not be caught by layer 3."""
        short = "5" + "A" * 20
        filt = PrivateKeyFilter()
        rec = self._make_record(f"Address is {short}")
        filt.filter(rec)
        assert short in rec.msg

    # ── Safe messages ──────────────────────────────────────────────

    def test_allows_safe_message(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("Normal payment processed successfully")
        filt.filter(rec)
        assert rec.msg == "Normal payment processed successfully"

    # ── Args handling ──────────────────────────────────────────────

    def test_redacts_args_tuple_with_sensitive_keyword(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("Value: %s", ("contains mnemonic data",))
        filt.filter(rec)
        assert rec.args[0] == "[REDACTED]"

    def test_redacts_args_tuple_with_base58_key(self):
        fake_key = "5" + "B" * 63
        filt = PrivateKeyFilter()
        rec = self._make_record("Key: %s", (fake_key,))
        filt.filter(rec)
        assert rec.args[0] == "[REDACTED]"

    def test_keeps_safe_args_tuple(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("Value: %s", ("safe_data",))
        filt.filter(rec)
        assert rec.args[0] == "safe_data"

    def test_redacts_args_dict(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("Config: %(key)s")
        rec.args = {"key": "my_private_key_value"}
        filt.filter(rec)
        assert rec.args["key"] == "[REDACTED]"

    def test_keeps_safe_args_dict(self):
        filt = PrivateKeyFilter()
        rec = self._make_record("Config: %(key)s")
        rec.args = {"key": "safe_value"}
        filt.filter(rec)
        assert rec.args["key"] == "safe_value"

    # ── Misc ───────────────────────────────────────────────────────

    def test_filter_always_returns_true(self):
        """Filter should always return True (redact, don't suppress)."""
        filt = PrivateKeyFilter()
        rec = self._make_record("private_key exposed!")
        assert filt.filter(rec) is True

    def test_no_args_handled(self):
        """Records with no args should not error."""
        filt = PrivateKeyFilter()
        rec = self._make_record("private_key in message")
        rec.args = None
        filt.filter(rec)
        assert "[REDACTED]" in rec.msg

    def test_case_insensitive(self):
        """Labels are matched case-insensitively."""
        filt = PrivateKeyFilter()
        rec = self._make_record("PRIVATE_KEY=secret123")
        filt.filter(rec)
        assert "secret123" not in rec.msg
        assert "[REDACTED]" in rec.msg


class TestInstallKeyGuard:
    """Tests for install_key_guard function."""

    def test_install_adds_filter(self):
        root = logging.getLogger()
        install_key_guard()
        after = sum(1 for f in root.filters if isinstance(f, PrivateKeyFilter))
        assert after >= 1

    def test_install_idempotent(self):
        root = logging.getLogger()
        install_key_guard()
        install_key_guard()
        install_key_guard()
        count = sum(1 for f in root.filters if isinstance(f, PrivateKeyFilter))
        assert count == 1
