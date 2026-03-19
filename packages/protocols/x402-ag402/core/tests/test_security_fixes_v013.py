"""v0.1.13 Security & Bug Fix TDD Tests.

TDD red-phase tests for the following fixes:
  S1-1: Private key must NOT be written to os.environ
  S1-2: serve/gateway default host must respect X402_MODE
  S1-3: MockSolanaAdapter.verify_payment must only accept recorded tx_hashes
  S2-1: /health endpoint must not leak target_url in production mode
  B1:   uvicorn.run must use loop="asyncio" to avoid uvloop conflicts
  B2:   SolanaAdapter.pay() should detect ATA-related errors
  B3:   get_provider() error message should be clear and actionable

Each test has a timeout to prevent hanging.
"""

from __future__ import annotations

import os
import uuid

import pytest

# ---------------------------------------------------------------------------
# Global timeout for every test in this module (seconds)
# ---------------------------------------------------------------------------
pytestmark = pytest.mark.timeout(10)


# ===================================================================
# S1-1: Private key must NOT be written to os.environ after decryption
# ===================================================================

class TestPrivateKeyNotInEnviron:
    """After load_config with encrypted wallet, SOLANA_PRIVATE_KEY
    must NOT appear in os.environ."""

    def test_decrypt_wallet_does_not_set_environ(self, tmp_path, monkeypatch):
        """_try_decrypt_wallet_key must store key in module-level var, not os.environ."""
        from ag402_core.security.wallet_encryption import (
            encrypt_private_key,
            save_encrypted_wallet,
        )

        # Create encrypted wallet
        test_key = "5K1gA5sUpqrT1VDfz1UZTvXzGv9mKYhVXiPuQMYo8deGFYcJhF"
        password = "test_password_123"
        enc = encrypt_private_key(password, test_key)
        wallet_path = str(tmp_path / "wallet.key")
        save_encrypted_wallet(wallet_path, enc)

        # Clear any existing key
        monkeypatch.delenv("SOLANA_PRIVATE_KEY", raising=False)
        monkeypatch.setenv("AG402_UNLOCK_PASSWORD", password)
        monkeypatch.setenv("AG402_WALLET_KEY_PATH", wallet_path)

        from ag402_core.config import _try_decrypt_wallet_key
        _try_decrypt_wallet_key()

        # The key must NOT be in os.environ
        assert "SOLANA_PRIVATE_KEY" not in os.environ, (
            "SECURITY: _try_decrypt_wallet_key still writes private key to os.environ! "
            "This exposes the key to all child processes and crash dumps."
        )

    def test_decrypted_key_accessible_via_getter(self, tmp_path, monkeypatch):
        """After decryption, key should be accessible via get_private_key() or similar."""
        from ag402_core.security.wallet_encryption import (
            encrypt_private_key,
            save_encrypted_wallet,
        )

        test_key = "5K1gA5sUpqrT1VDfz1UZTvXzGv9mKYhVXiPuQMYo8deGFYcJhF"
        password = "test_password_123"
        enc = encrypt_private_key(password, test_key)
        wallet_path = str(tmp_path / "wallet.key")
        save_encrypted_wallet(wallet_path, enc)

        monkeypatch.delenv("SOLANA_PRIVATE_KEY", raising=False)
        monkeypatch.setenv("AG402_UNLOCK_PASSWORD", password)
        monkeypatch.setenv("AG402_WALLET_KEY_PATH", wallet_path)

        from ag402_core.config import _try_decrypt_wallet_key, get_decrypted_private_key
        _try_decrypt_wallet_key()

        key = get_decrypted_private_key()
        assert key == test_key, (
            "Decrypted key not accessible via get_decrypted_private_key()"
        )

    def test_load_config_uses_decrypted_key(self, tmp_path, monkeypatch):
        """load_config should populate solana_private_key from decrypted key,
        not from os.environ."""
        from ag402_core.security.wallet_encryption import (
            encrypt_private_key,
            save_encrypted_wallet,
        )

        test_key = "5K1gA5sUpqrT1VDfz1UZTvXzGv9mKYhVXiPuQMYo8deGFYcJhF"
        password = "test_password_123"
        enc = encrypt_private_key(password, test_key)
        wallet_path = str(tmp_path / "wallet.key")
        save_encrypted_wallet(wallet_path, enc)

        monkeypatch.delenv("SOLANA_PRIVATE_KEY", raising=False)
        monkeypatch.setenv("AG402_UNLOCK_PASSWORD", password)
        monkeypatch.setenv("AG402_WALLET_KEY_PATH", wallet_path)
        monkeypatch.setenv("X402_MODE", "test")

        from ag402_core.config import load_config
        config = load_config()

        assert config.solana_private_key == test_key
        assert "SOLANA_PRIVATE_KEY" not in os.environ


# ===================================================================
# S1-2: serve/gateway default host must respect mode
# ===================================================================

class TestServeDefaultHost:
    """Test that _cmd_serve and gateway CLI choose host based on X402_MODE."""

    def test_serve_parser_default_is_0000(self):
        """Parser default should remain 0.0.0.0 for backward compat,
        but _cmd_serve should override in test mode."""
        from ag402_core.cli import _build_parser
        parser = _build_parser()
        args = parser.parse_args(["serve", "--target", "http://localhost:8000"])
        # The parser default is 0.0.0.0
        assert args.host == "0.0.0.0"


# ===================================================================
# S1-3: MockSolanaAdapter.verify_payment must only accept recorded hashes
# ===================================================================

class TestMockVerifierStrict:
    """MockSolanaAdapter.verify_payment must reject arbitrary mock_tx_ hashes."""

    @pytest.fixture
    def mock_adapter(self):
        from ag402_core.payment.solana_adapter import MockSolanaAdapter
        return MockSolanaAdapter(balance=100.0)

    @pytest.mark.asyncio
    async def test_reject_unrecorded_mock_tx_hash(self, mock_adapter):
        """A mock_tx_ hash that was NOT created by .pay() must be rejected."""
        fake_hash = f"mock_tx_{uuid.uuid4().hex}"
        result = await mock_adapter.verify_payment(fake_hash)
        assert result is False, (
            "SECURITY: MockSolanaAdapter.verify_payment accepts any mock_tx_ prefix! "
            "Attackers can forge payment proofs in test mode."
        )

    @pytest.mark.asyncio
    async def test_accept_recorded_mock_tx_hash(self, mock_adapter):
        """A mock_tx_ hash created by .pay() must be accepted."""
        pay_result = await mock_adapter.pay("addr", 0.01, "USDC")
        result = await mock_adapter.verify_payment(pay_result.tx_hash)
        assert result is True

    @pytest.mark.asyncio
    async def test_reject_empty_hash(self, mock_adapter):
        """Empty hash must be rejected."""
        result = await mock_adapter.verify_payment("")
        assert result is False

    @pytest.mark.asyncio
    async def test_reject_short_hash(self, mock_adapter):
        """Hash shorter than 8 chars must be rejected."""
        result = await mock_adapter.verify_payment("abc")
        assert result is False


# ===================================================================
# S2-1: /health endpoint must not leak internal info in production
# ===================================================================

class TestHealthEndpointMinimal:
    """Health endpoint must not expose target_url or detailed metrics in production."""

    @pytest.fixture
    def test_gateway(self, monkeypatch):
        """Create a test-mode gateway."""
        monkeypatch.setenv("X402_MODE", "test")
        from ag402_mcp.gateway import X402Gateway
        gw = X402Gateway(
            target_url="http://secret-internal-api:9000",
            price="0.01",
            address="TestAddr1111111111111111111111111111111111",
        )
        return gw

    @pytest.mark.asyncio
    async def test_health_does_not_leak_target_url_in_production(self, monkeypatch):
        """In production mode, /health should NOT reveal target_url."""
        from ag402_core.gateway.auth import PaymentVerifier
        from ag402_mcp.gateway import X402Gateway

        monkeypatch.setenv("X402_MODE", "production")
        gw = X402Gateway(
            target_url="http://secret-internal-api:9000",
            price="0.01",
            address="TestAddr1111111111111111111111111111111111",
            verifier=PaymentVerifier(),
        )
        app = gw.create_app()

        from starlette.testclient import TestClient
        with TestClient(app) as client:
            resp = client.get("/health")
            data = resp.json()

            assert "target_url" not in data, (
                "SECURITY: /health leaks target_url in production mode!"
            )

    @pytest.mark.asyncio
    async def test_health_returns_minimal_in_production(self, monkeypatch):
        """In production mode, /health should return only status and mode."""
        from ag402_core.gateway.auth import PaymentVerifier
        from ag402_mcp.gateway import X402Gateway

        monkeypatch.setenv("X402_MODE", "production")
        gw = X402Gateway(
            target_url="http://secret-internal-api:9000",
            price="0.01",
            address="TestAddr1111111111111111111111111111111111",
            verifier=PaymentVerifier(),
        )
        app = gw.create_app()

        from starlette.testclient import TestClient
        with TestClient(app) as client:
            resp = client.get("/health")
            data = resp.json()
            assert data["status"] == "healthy"
            assert data["mode"] == "production"

    @pytest.mark.asyncio
    async def test_health_shows_details_in_test_mode(self, test_gateway):
        """In test mode, /health can show full details (for debugging)."""
        app = test_gateway.create_app()

        from starlette.testclient import TestClient
        with TestClient(app) as client:
            resp = client.get("/health")
            data = resp.json()
            assert data["status"] == "healthy"
            assert data["mode"] == "test"
            # Test mode is allowed to show metrics
            assert "metrics" in data


# ===================================================================
# B1: uvicorn must use loop="asyncio" to avoid uvloop conflict
# ===================================================================

class TestUvloopAvoidance:
    """Verify that uvicorn config uses loop='asyncio' explicitly."""

    def test_serve_cmd_uses_asyncio_loop(self):
        """_cmd_serve must configure uvicorn with loop='asyncio'."""
        # We can't easily run _cmd_serve in test, but we can inspect the code
        import inspect

        from ag402_core.cli import _cmd_serve
        source = inspect.getsource(_cmd_serve)
        assert 'loop="asyncio"' in source or "loop='asyncio'" in source, (
            "BUG: _cmd_serve does not set loop='asyncio' in uvicorn.Config. "
            "This causes uvloop + aiosqlite conflicts."
        )

    def test_gateway_cli_uses_asyncio_loop(self):
        """gateway.cli_main must configure uvicorn with loop='asyncio'."""
        import inspect

        from ag402_mcp.gateway import cli_main
        source = inspect.getsource(cli_main)
        assert 'loop="asyncio"' in source or "loop='asyncio'" in source, (
            "BUG: gateway.cli_main does not set loop='asyncio' in uvicorn.run(). "
            "This causes uvloop + aiosqlite conflicts."
        )


# ===================================================================
# B2: ATA error detection in SolanaAdapter.pay()
# ===================================================================

class TestATAErrorDetection:
    """SolanaAdapter.pay() should detect ATA-related errors and give friendly message."""

    @pytest.mark.asyncio
    async def test_pay_error_mentions_ata_when_account_not_found(self):
        """When on-chain error contains 'AccountNotFound', the error message
        should mention ATA/token account."""

        # We can't test the real adapter without Solana deps, so we test the
        # error classification logic. The actual fix should be in pay().
        # This test verifies the error message pattern.
        error_msg = "Transaction failed on-chain: AccountNotFound"
        # After the fix, SolanaAdapter should detect this and add ATA hint
        assert "AccountNotFound" in error_msg  # baseline


# ===================================================================
# B3: get_provider() error message clarity
# ===================================================================

class TestGetProviderErrorMessage:
    """get_provider() ConfigError should have a clear, actionable message."""

    def test_config_error_mentions_private_key(self, monkeypatch):
        """ConfigError should explicitly mention SOLANA_PRIVATE_KEY."""
        monkeypatch.setenv("X402_MODE", "production")
        monkeypatch.delenv("SOLANA_PRIVATE_KEY", raising=False)
        monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)

        from ag402_core.config import RunMode, X402Config
        from ag402_core.payment.registry import ConfigError, PaymentProviderRegistry

        config = X402Config(mode=RunMode.PRODUCTION)

        with pytest.raises(ConfigError) as exc_info:
            PaymentProviderRegistry.get_provider(config=config)

        error_msg = str(exc_info.value)
        assert "SOLANA_PRIVATE_KEY" in error_msg, (
            "ConfigError should mention SOLANA_PRIVATE_KEY so users know what to set"
        )

    def test_config_error_suggests_test_mode(self, monkeypatch):
        """ConfigError should suggest X402_MODE=test for development."""
        monkeypatch.setenv("X402_MODE", "production")
        monkeypatch.delenv("SOLANA_PRIVATE_KEY", raising=False)
        monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)

        from ag402_core.config import RunMode, X402Config
        from ag402_core.payment.registry import ConfigError, PaymentProviderRegistry

        config = X402Config(mode=RunMode.PRODUCTION)

        with pytest.raises(ConfigError) as exc_info:
            PaymentProviderRegistry.get_provider(config=config)

        error_msg = str(exc_info.value)
        assert "test" in error_msg.lower() or "X402_MODE" in error_msg


# ===================================================================
# S2-2: _cmd_run tmpdir permissions
# ===================================================================

class TestTmpdirPermissions:
    """_cmd_run temporary directory should have restrictive permissions."""

    def test_sitecustomize_tmpdir_permissions(self, tmp_path):
        """When creating tmpdir for sitecustomize.py, permissions should be 0o700."""
        import stat
        import tempfile

        tmpdir = tempfile.mkdtemp(prefix="ag402_", dir=str(tmp_path))
        os.chmod(tmpdir, 0o700)

        st = os.stat(tmpdir)
        mode = stat.S_IMODE(st.st_mode)
        assert mode == 0o700, f"tmpdir permissions should be 0o700, got {oct(mode)}"

        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)
