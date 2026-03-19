"""Shared test fixtures for ag402-core tests."""

from __future__ import annotations

import sys

import httpx
from ag402_core.config import RunMode, X402Config
from ag402_core.wallet.agent_wallet import AgentWallet
from open402.spec import X402PaymentChallenge

# ---------------------------------------------------------------------------
# Conditionally register localnet / devnet fixtures based on which test
# files are being collected.  Avoids fixture name collisions between the two
# conftest modules (they both define `rpc_url`, `buyer_private_key_b58`, …).
#
# Heuristic: inspect sys.argv for ``localnet`` or ``devnet`` keywords.
# ---------------------------------------------------------------------------
_argv = " ".join(sys.argv)
_LOCALNET_REQUESTED = "localnet" in _argv
_DEVNET_REQUESTED = "devnet" in _argv

pytest_plugins: list[str] = [
    "tests.conftest_perf",  # Performance baseline tracking
]

if _LOCALNET_REQUESTED and not _DEVNET_REQUESTED:
    try:
        import tests.conftest_localnet  # noqa: F401
        pytest_plugins.append("tests.conftest_localnet")
    except Exception:
        pass
elif _DEVNET_REQUESTED and not _LOCALNET_REQUESTED:
    try:
        import tests.conftest_devnet  # noqa: F401
        pytest_plugins.append("tests.conftest_devnet")
    except Exception:
        pass


def _make_config(**overrides) -> X402Config:
    """Create a test config with defaults."""
    defaults = {
        "mode": RunMode.TEST,
        "single_tx_limit": 1.0,
        "per_minute_limit": 100.0,  # generous for tests
        "per_minute_count": 1000,   # generous for tests
    }
    defaults.update(overrides)
    return X402Config(**defaults)


async def _make_wallet(tmp_path, balance: float = 100.0) -> AgentWallet:
    """Create an initialized wallet with a given balance."""
    db_path = str(tmp_path / "test.db")
    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()
    if balance > 0:
        await wallet.deposit(balance, note="test setup")
    return wallet


class SequentialTransport(httpx.AsyncBaseTransport):
    """Mock transport that returns responses in sequence."""

    def __init__(self, responses: list[tuple[int, dict[str, str], bytes]]):
        self._responses = list(responses)
        self._call_index = 0

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if self._call_index >= len(self._responses):
            return httpx.Response(500, content=b"No more mock responses")
        status, headers, body = self._responses[self._call_index]
        self._call_index += 1
        return httpx.Response(status, headers=headers, content=body)


def _402_headers(
    chain: str = "solana",
    token: str = "USDC",
    amount: str = "0.05",
    address: str = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
) -> dict[str, str]:
    challenge = X402PaymentChallenge(chain=chain, token=token, amount=amount, address=address)
    return {"www-authenticate": challenge.to_header_value()}
