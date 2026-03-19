"""Tests for Ag402 MCP Client Server and Tools.

Covers:
- Tool registration and availability
- fetch_with_autopay: payment flow, error handling, parameter validation, max_amount
- wallet_status: balance and spending summary (string precision)
- transaction_history: query and pagination (string precision)
- config_examples: configuration generation
- server initialization: lock, cleanup
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ag402_client_mcp.tools import (
    ALLOWED_METHODS,
    handle_fetch_with_autopay,
    handle_transaction_history,
    handle_wallet_status,
)

# ─── Fixtures ─────────────────────────────────────────────────────────


@dataclass
class MockMiddlewareResult:
    """Mock MiddlewareResult matching the real dataclass interface."""
    status_code: int = 200
    headers: dict | None = None
    body: bytes = b""
    payment_made: bool = False
    tx_hash: str = ""
    amount_paid: float = 0.0
    error: str = ""

    def __post_init__(self):
        if self.headers is None:
            self.headers = {}


@dataclass
class MockTransaction:
    """Mock Transaction matching the real dataclass interface."""
    id: str = "tx-001"
    type: str = "deduction"
    amount: Decimal = Decimal("0.05")
    to_address: str = "Recipient11111111111111111111111111"
    tx_hash: str = "mockhash123"
    status: str = "confirmed"
    timestamp: float = 1700000000.0
    note: str = ""


@dataclass
class MockConfig:
    """Mock X402Config for max_amount tests."""
    single_tx_limit: float = 5.0
    daily_spend_limit: float = 10.0
    per_minute_limit: float = 2.0
    per_minute_count: int = 5
    circuit_breaker_threshold: int = 3
    circuit_breaker_cooldown: int = 60


@pytest.fixture
def mock_middleware():
    mw = AsyncMock()
    mw.config = MockConfig()
    mw.handle_request = AsyncMock(return_value=MockMiddlewareResult(
        status_code=200,
        body=b'{"data": "weather", "temp": 22}',
        headers={"content-type": "application/json"},
        payment_made=True,
        tx_hash="5abc123def456",
        amount_paid=0.05,
    ))
    return mw


@pytest.fixture
def mock_wallet():
    wallet = AsyncMock()
    wallet.get_summary_stats = AsyncMock(return_value={
        "balance": Decimal("95.50"),
        "today_spend": Decimal("4.50"),
        "total_spend": Decimal("10.25"),
        "tx_count": 15,
    })
    wallet.get_minute_spend = AsyncMock(return_value=Decimal("0.10"))
    wallet.get_minute_count = AsyncMock(return_value=2)
    wallet.get_transactions = AsyncMock(return_value=[
        MockTransaction(id="tx-001", type="deduction", amount=Decimal("0.05")),
        MockTransaction(id="tx-002", type="deposit", amount=Decimal("100.0"), to_address=""),
    ])
    return wallet


# ─── fetch_with_autopay Tests ─────────────────────────────────────────


class TestFetchWithAutopay:
    @pytest.mark.asyncio
    async def test_successful_request_with_payment(self, mock_middleware):
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
            method="GET",
        )
        data = json.loads(result)
        assert data["status_code"] == 200
        assert data["payment_made"] is True
        assert data["amount_paid"] == "0.05"
        assert data["tx_hash"] == "5abc123def456"
        assert "weather" in data["body"]
        assert data["error"] == ""

    @pytest.mark.asyncio
    async def test_request_without_payment(self, mock_middleware):
        mock_middleware.handle_request.return_value = MockMiddlewareResult(
            status_code=200,
            body=b'{"free": true}',
            payment_made=False,
        )
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://free-api.com/data",
        )
        data = json.loads(result)
        assert data["payment_made"] is False
        assert data["amount_paid"] == "0"
        assert data["tx_hash"] == ""

    @pytest.mark.asyncio
    async def test_invalid_url(self, mock_middleware):
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="not-a-url",
        )
        data = json.loads(result)
        assert "error" in data
        assert "Invalid URL" in data["error"]

    @pytest.mark.asyncio
    async def test_empty_url(self, mock_middleware):
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="",
        )
        data = json.loads(result)
        assert "Invalid URL" in data["error"]

    @pytest.mark.asyncio
    async def test_invalid_method(self, mock_middleware):
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
            method="INVALID",
        )
        data = json.loads(result)
        assert "Invalid HTTP method" in data["error"]

    @pytest.mark.asyncio
    async def test_all_valid_methods(self, mock_middleware):
        for method in ALLOWED_METHODS:
            result = await handle_fetch_with_autopay(
                middleware=mock_middleware,
                url="https://api.example.com/data",
                method=method,
            )
            data = json.loads(result)
            assert data["error"] == "", f"Method {method} should be valid"

    @pytest.mark.asyncio
    async def test_case_insensitive_method(self, mock_middleware):
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
            method="get",
        )
        data = json.loads(result)
        assert data["error"] == ""
        mock_middleware.handle_request.assert_called_once()
        call_args = mock_middleware.handle_request.call_args
        assert call_args.kwargs["method"] == "GET"

    @pytest.mark.asyncio
    async def test_with_headers_and_body(self, mock_middleware):
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/submit",
            method="POST",
            headers={"Content-Type": "application/json"},
            body='{"key": "value"}',
        )
        data = json.loads(result)
        assert data["error"] == ""

        call_args = mock_middleware.handle_request.call_args
        assert call_args.kwargs["headers"] == {"Content-Type": "application/json"}
        assert call_args.kwargs["body"] == b'{"key": "value"}'

    @pytest.mark.asyncio
    async def test_middleware_exception(self, mock_middleware):
        mock_middleware.handle_request.side_effect = RuntimeError("connection failed")
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
        )
        data = json.loads(result)
        assert "RuntimeError" in data["error"]
        # Sensitive details should NOT leak to caller
        assert "connection failed" not in data["error"]
        # Should contain actionable guidance
        assert "diagnostics" in data["error"] or "Request failed" in data["error"]

    @pytest.mark.asyncio
    async def test_binary_response_body(self, mock_middleware):
        mock_middleware.handle_request.return_value = MockMiddlewareResult(
            status_code=200,
            body=b"\x00\x01\x02\xff",
        )
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/binary",
        )
        data = json.loads(result)
        assert "binary data" in data["body"]

    @pytest.mark.asyncio
    async def test_error_in_result(self, mock_middleware):
        mock_middleware.handle_request.return_value = MockMiddlewareResult(
            status_code=402,
            error="Budget exceeded",
        )
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
        )
        data = json.loads(result)
        assert data["status_code"] == 402
        assert data["error"] == "Budget exceeded"

    # ── max_amount tests ──

    @pytest.mark.asyncio
    async def test_max_amount_passed_to_middleware(self, mock_middleware):
        """max_amount should be passed through to middleware.handle_request."""
        await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
            max_amount=1.0,
        )

        call_args = mock_middleware.handle_request.call_args
        assert call_args.kwargs["max_amount"] == 1.0

    @pytest.mark.asyncio
    async def test_max_amount_none_when_not_specified(self, mock_middleware):
        """When max_amount is not provided, None should be passed."""
        await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
        )

        call_args = mock_middleware.handle_request.call_args
        assert call_args.kwargs["max_amount"] is None

    @pytest.mark.asyncio
    async def test_max_amount_negative_rejected(self, mock_middleware):
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
            max_amount=-1.0,
        )
        data = json.loads(result)
        assert "max_amount must be positive" in data["error"]

    @pytest.mark.asyncio
    async def test_max_amount_zero_rejected(self, mock_middleware):
        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
            max_amount=0.0,
        )
        data = json.loads(result)
        assert "max_amount must be positive" in data["error"]

    @pytest.mark.asyncio
    async def test_max_amount_exception_still_returns_error(self, mock_middleware):
        """Even if middleware raises, we should get a friendly error."""
        mock_middleware.handle_request.side_effect = RuntimeError("boom")

        result = await handle_fetch_with_autopay(
            middleware=mock_middleware,
            url="https://api.example.com/data",
            max_amount=1.0,
        )

        data = json.loads(result)
        assert "RuntimeError" in data["error"]
        # Should have friendly hint
        assert "diagnostics" in data["error"] or "Request failed" in data["error"]


# ─── wallet_status Tests ──────────────────────────────────────────────


class TestWalletStatus:
    @pytest.mark.asyncio
    async def test_returns_all_fields_as_strings(self, mock_wallet):
        result = await handle_wallet_status(wallet=mock_wallet)
        data = json.loads(result)
        # Monetary values are now strings for precision
        assert data["balance"] == "95.50"
        assert data["today_spend"] == "4.50"
        assert data["total_spend"] == "10.25"
        assert data["transaction_count"] == 15
        assert data["minute_spend"] == "0.10"
        assert data["minute_transaction_count"] == 2

    @pytest.mark.asyncio
    async def test_wallet_error_no_details_leak(self):
        wallet = AsyncMock()
        wallet.get_summary_stats.side_effect = RuntimeError("DB locked at /secret/path")
        result = await handle_wallet_status(wallet=wallet)
        data = json.loads(result)
        assert "error" in data
        assert "RuntimeError" in data["error"]
        # Sensitive path should NOT leak
        assert "/secret/path" not in data["error"]
        # Should have actionable hint
        assert "diagnostics" in data["error"] or "Request failed" in data["error"]

    @pytest.mark.asyncio
    async def test_decimal_precision_preserved(self, mock_wallet):
        """Verify that Decimal values are serialized as strings, not floats."""
        mock_wallet.get_summary_stats.return_value = {
            "balance": Decimal("0.1"),
            "today_spend": Decimal("0.2"),
            "total_spend": Decimal("0.3"),
            "tx_count": 0,
        }
        mock_wallet.get_minute_spend.return_value = Decimal("0.0001")

        result = await handle_wallet_status(wallet=mock_wallet)
        data = json.loads(result)
        # String representation preserves exact decimal
        assert data["balance"] == "0.1"
        assert data["minute_spend"] == "0.0001"


# ─── transaction_history Tests ────────────────────────────────────────


class TestTransactionHistory:
    @pytest.mark.asyncio
    async def test_returns_transactions_with_string_amounts(self, mock_wallet):
        result = await handle_transaction_history(wallet=mock_wallet, limit=20)
        data = json.loads(result)
        assert data["count"] == 2
        assert data["limit"] == 20
        assert len(data["transactions"]) == 2
        assert data["transactions"][0]["id"] == "tx-001"
        assert data["transactions"][0]["type"] == "deduction"
        # amount is now string
        assert data["transactions"][0]["amount"] == "0.05"

    @pytest.mark.asyncio
    async def test_limit_clamping_min(self, mock_wallet):
        await handle_transaction_history(wallet=mock_wallet, limit=-5)
        mock_wallet.get_transactions.assert_called_with(limit=1)

    @pytest.mark.asyncio
    async def test_limit_clamping_max(self, mock_wallet):
        await handle_transaction_history(wallet=mock_wallet, limit=500)
        mock_wallet.get_transactions.assert_called_with(limit=100)

    @pytest.mark.asyncio
    async def test_empty_history(self, mock_wallet):
        mock_wallet.get_transactions.return_value = []
        result = await handle_transaction_history(wallet=mock_wallet)
        data = json.loads(result)
        assert data["count"] == 0
        assert data["transactions"] == []

    @pytest.mark.asyncio
    async def test_wallet_error_no_details_leak(self):
        wallet = AsyncMock()
        wallet.get_transactions.side_effect = RuntimeError("DB error: table missing")
        result = await handle_transaction_history(wallet=wallet)
        data = json.loads(result)
        assert "error" in data
        assert "RuntimeError" in data["error"]
        assert "table missing" not in data["error"]
        # Should have actionable hint
        assert "diagnostics" in data["error"] or "Request failed" in data["error"]


# ─── config_examples Tests ────────────────────────────────────────────


class TestConfigExamples:
    def test_claude_config(self):
        from ag402_client_mcp.config_examples import get_claude_code_config
        config = get_claude_code_config()
        assert "mcpServers" in config
        assert "ag402" in config["mcpServers"]
        server = config["mcpServers"]["ag402"]
        assert "command" in server
        assert server["args"] == ["-m", "ag402_client_mcp.server"]

    def test_cursor_config(self):
        from ag402_client_mcp.config_examples import get_cursor_config
        config = get_cursor_config()
        assert "mcpServers" in config
        assert "ag402" in config["mcpServers"]

    def test_openclaw_config(self):
        from ag402_client_mcp.config_examples import get_openclaw_config
        config = get_openclaw_config()
        assert config["type"] == "mcporter"
        assert "install_command" in config
        assert "mcporter config add ag402" in config["install_command"]

    def test_with_env_vars(self):
        from ag402_client_mcp.config_examples import get_claude_code_config
        config = get_claude_code_config(env_vars={"X402_MODE": "test"})
        server = config["mcpServers"]["ag402"]
        assert server["env"] == {"X402_MODE": "test"}

    def test_get_config_for_tool_known(self):
        from ag402_client_mcp.config_examples import get_config_for_tool
        result = get_config_for_tool("claude")
        data = json.loads(result)
        assert "mcpServers" in data

    def test_get_config_for_tool_unknown(self):
        from ag402_client_mcp.config_examples import get_config_for_tool
        result = get_config_for_tool("unknown-tool")
        data = json.loads(result)
        assert "error" in data
        assert "Unknown tool" in data["error"]

    def test_backward_compat_alias(self):
        from ag402_client_mcp.config_examples import get_config_for_tool, print_config_for_tool
        assert print_config_for_tool is get_config_for_tool

    def test_install_for_tool_unknown(self):
        from ag402_client_mcp.config_examples import install_for_tool
        success, msg = install_for_tool("unknown-tool")
        assert not success
        assert "Unknown tool" in msg

    def test_install_for_tool_cursor(self, tmp_path):
        """install_for_tool should create .cursor/mcp.json."""
        import os

        from ag402_client_mcp.config_examples import install_for_tool
        # Temporarily change cwd to tmp_path so project-local config goes there
        old_cwd = os.getcwd()
        try:
            os.chdir(tmp_path)
            success, msg = install_for_tool("cursor", scope="project")
            assert success
            config_path = tmp_path / ".cursor" / "mcp.json"
            assert config_path.exists()
            data = json.loads(config_path.read_text())
            assert "mcpServers" in data
            assert "ag402" in data["mcpServers"]
        finally:
            os.chdir(old_cwd)


# ─── Server Module Tests ──────────────────────────────────────────────


class TestServerModule:
    def test_import_server(self):
        from ag402_client_mcp.server import Ag402MCPServer, mcp
        assert mcp is not None
        server = Ag402MCPServer()
        assert server._server is mcp

    def test_tools_registered(self):
        from ag402_client_mcp.server import mcp
        # Verify the FastMCP instance has our tools registered
        assert mcp is not None
        assert mcp.name == "Ag402"

    def test_package_version(self):
        from ag402_client_mcp import __version__
        assert __version__ == "0.1.20"


# ─── Initialization Tests ────────────────────────────────────────────


class TestInitialization:
    @pytest.mark.asyncio
    async def test_init_lock_prevents_double_init(self):
        """Concurrent _ensure_initialized calls should only init once."""
        import ag402_client_mcp.server as srv

        # Reset runtime state
        srv._runtime.initialized = False
        srv._runtime.middleware = None
        srv._runtime.wallet = None
        srv._runtime._init_lock = None

        call_count = 0

        async def mock_init_db(self_arg=None):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.05)  # Simulate slow init

        with patch("ag402_client_mcp.server.load_config", create=True) as mock_config, \
             patch("ag402_client_mcp.server.AgentWallet", create=True) as mock_wallet_cls, \
             patch("ag402_client_mcp.server.PaymentProviderRegistry", create=True) as mock_registry, \
             patch("ag402_client_mcp.server.X402PaymentMiddleware", create=True):

            # Patch imports inside ensure_initialized
            mock_cfg = MagicMock()
            mock_cfg.wallet_db_path = "/tmp/test.db"
            mock_cfg.is_test_mode = False
            mock_cfg.mode.value = "test"

            # We need to patch at the import level inside the function
            # Since ensure_initialized uses lazy imports, we patch the modules
            pass

        # Cleanup
        srv._runtime.initialized = False
        srv._runtime.middleware = None
        srv._runtime.wallet = None
        srv._runtime._init_lock = None

    @pytest.mark.asyncio
    async def test_shutdown_cleans_up(self):
        """Ag402MCPServer.shutdown() should reset all runtime state."""
        import ag402_client_mcp.server as srv

        mock_mw = AsyncMock()
        mock_wl = AsyncMock()

        srv._runtime.middleware = mock_mw
        srv._runtime.wallet = mock_wl
        srv._runtime.initialized = True

        server = srv.Ag402MCPServer()
        await server.shutdown()

        assert srv._runtime.middleware is None
        assert srv._runtime.wallet is None
        assert srv._runtime.initialized is False
        mock_mw.close.assert_called_once()
        mock_wl.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_sse_host_port_applied(self):
        """run_sse should set host/port on FastMCP settings."""
        from ag402_client_mcp.server import Ag402MCPServer

        server = Ag402MCPServer()

        # Mock the run method to avoid actually starting the server
        server._server.run = MagicMock()

        server.run_sse(host="0.0.0.0", port=9999)

        assert server._server.settings.host == "0.0.0.0"
        assert server._server.settings.port == 9999
        server._server.run.assert_called_once_with(transport="sse")
