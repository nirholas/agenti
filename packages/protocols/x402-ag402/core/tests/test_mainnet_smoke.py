"""
F2: Mainnet smoke test — small USDC transaction on Solana mainnet.

These tests are NOT run in CI. They require:
- A funded mainnet wallet (SOLANA_PRIVATE_KEY env var)
- X402_NETWORK=mainnet
- SOLANA_RPC_URL pointing to a mainnet RPC (e.g., Helius, QuickNode)

Run manually:
    X402_NETWORK=mainnet SOLANA_RPC_URL=https://... \
        SOLANA_PRIVATE_KEY=... \
        pytest tests/test_mainnet_smoke.py -v -m mainnet
"""

from __future__ import annotations

import os

import pytest

# Marker: skip unless explicitly selected with -m mainnet
pytestmark = [
    pytest.mark.mainnet,
    pytest.mark.skipif(
        os.getenv("X402_NETWORK") != "mainnet",
        reason="Mainnet smoke tests require X402_NETWORK=mainnet",
    ),
]

# Mainnet USDC mint (Circle official)
MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Minimum smoke test amount: 0.001 USDC (1000 lamports)
SMOKE_AMOUNT = 0.001


@pytest.fixture
def mainnet_config():
    """Build a mainnet-mode config from environment variables."""
    private_key = os.getenv("SOLANA_PRIVATE_KEY", "")
    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    rpc_backup = os.getenv("SOLANA_RPC_BACKUP_URL", "")
    assert private_key, "SOLANA_PRIVATE_KEY must be set for mainnet smoke test"

    return {
        "private_key": private_key,
        "rpc_url": rpc_url,
        "usdc_mint": MAINNET_USDC_MINT,
        "rpc_backup_url": rpc_backup,
        "confirm_timeout": 60,  # mainnet needs longer timeout
        "confirmation_level": "confirmed",
    }


@pytest.fixture
def adapter(mainnet_config):
    """Create a real SolanaAdapter pointed at mainnet."""
    from ag402_core.payment.solana_adapter import SolanaAdapter

    return SolanaAdapter(**mainnet_config)


class TestMainnetSmoke:
    """Mainnet smoke tests — verifies end-to-end payment on real chain."""

    async def test_check_balance(self, adapter):
        """Verify we can query USDC balance on mainnet."""
        balance = await adapter.check_balance()
        assert isinstance(balance, float)
        assert balance >= 0.0
        print(f"[MAINNET] Balance: {balance:.6f} USDC")

    async def test_get_address(self, adapter):
        """Verify the wallet address is valid base58."""
        address = adapter.get_address()
        assert len(address) >= 32
        assert len(address) <= 44
        print(f"[MAINNET] Address: {address}")

    async def test_self_transfer_smoke(self, adapter):
        """Smoke test: send 0.001 USDC from wallet to itself.

        This verifies the full payment pipeline:
        1. ATA lookup
        2. TransferChecked instruction
        3. Memo injection with request_id
        4. Transaction confirmation
        5. On-chain verification

        Since sender == recipient, the net balance change is zero
        (minus gas fees for the transaction).
        """
        my_address = adapter.get_address()
        balance_before = await adapter.check_balance()

        if balance_before < SMOKE_AMOUNT:
            pytest.skip(f"Insufficient balance ({balance_before:.6f} USDC < {SMOKE_AMOUNT})")

        result = await adapter.pay(
            to_address=my_address,
            amount=SMOKE_AMOUNT,
            token="USDC",
            request_id="mainnet-smoke-test",
        )

        assert result.success, f"Payment failed: {result.error}"
        assert result.tx_hash, "No tx_hash returned"
        assert result.chain == "solana"
        assert result.request_id == "mainnet-smoke-test"
        assert "Ag402-v1|mainnet-smoke-test" in result.memo

        print(f"[MAINNET] tx_hash: {result.tx_hash}")
        print(f"[MAINNET] confirmation: {result.confirmation_status}")
        print(f"[MAINNET] memo: {result.memo}")

        # Verify the transaction on-chain
        verified = await adapter.verify_payment(
            result.tx_hash,
            expected_amount=SMOKE_AMOUNT,
            expected_address=my_address,
            expected_sender=my_address,
        )
        assert verified, "On-chain verification failed"
        print("[MAINNET] On-chain verification: PASSED")

    async def test_small_transfer_with_priority_fee(self, mainnet_config):
        """Smoke test with priority fees enabled."""
        from ag402_core.payment.solana_adapter import SolanaAdapter

        config = {**mainnet_config, "priority_fee_microlamports": 1000, "compute_unit_limit": 200_000}
        adapter = SolanaAdapter(**config)
        my_address = adapter.get_address()
        balance = await adapter.check_balance()

        if balance < SMOKE_AMOUNT:
            pytest.skip(f"Insufficient balance ({balance:.6f} USDC)")

        result = await adapter.pay(
            to_address=my_address,
            amount=SMOKE_AMOUNT,
            token="USDC",
            request_id="mainnet-priority-fee-test",
        )

        assert result.success, f"Payment with priority fee failed: {result.error}"
        assert result.tx_hash
        print(f"[MAINNET+PRIORITY] tx_hash: {result.tx_hash}")


class TestMainnetVerification:
    """Test on-chain verification against known mainnet transactions."""

    async def test_verify_nonexistent_tx(self, adapter):
        """Verify that a random tx_hash returns False."""
        verified = await adapter.verify_payment(
            "5wHu1qwD7q4H7t3P8JXfQ2gNxVv7P9kYdYZ9mVZ4bFm3gQxKJxKJxKJxKJxKJxKJxKJxKJxKJxKJ",
        )
        # Should return False (not found or parse error)
        assert not verified
