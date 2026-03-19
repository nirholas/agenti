"""
Shared fixtures for Solana local-validator integration tests.

Uses `solana-test-validator` (http://127.0.0.1:8899) for fast, reliable testing.

Start the validator before running tests:
    solana-test-validator --reset
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import pytest

pytest.importorskip("solana", reason="solana-py not installed")
pytest.importorskip("solders", reason="solders not installed")

import base58
from solana.rpc.api import Client as SyncClient
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from spl.token.client import Token as SyncToken
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import get_associated_token_address

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LOCALNET_URL = "http://127.0.0.1:8899"
RPC_TIMEOUT = 30


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _keypair_to_base58(kp: Keypair) -> str:
    """Export keypair's full secret key as base58 (for SolanaAdapter)."""
    return base58.b58encode(bytes(kp)).decode()


def _airdrop_and_wait(client: SyncClient, pubkey: Pubkey, sol: float = 10.0) -> None:
    """Airdrop SOL and poll until balance is visible at confirmed level."""
    sig = client.request_airdrop(pubkey, int(sol * 1e9))

    for _ in range(60):
        time.sleep(0.5)
        bal = client.get_balance(pubkey, commitment="confirmed")
        if bal.value > 0:
            return
    raise RuntimeError(f"Airdrop to {pubkey} failed: balance still 0 after 30s")


# ---------------------------------------------------------------------------
# Synchronous setup
# ---------------------------------------------------------------------------

@dataclass
class LocalnetState:
    rpc_url: str
    buyer_kp: Keypair
    seller_kp: Keypair
    buyer_private_key_b58: str
    buyer_pubkey: str
    seller_pubkey: str
    test_usdc_mint_str: str
    buyer_usdc_ata: Pubkey


def _sync_setup() -> LocalnetState:
    """Synchronous setup: airdrop, create mint, mint USDC."""
    rpc_url = os.getenv("SOLANA_RPC_URL", LOCALNET_URL)
    client = SyncClient(rpc_url, timeout=RPC_TIMEOUT, commitment="confirmed")

    buyer_kp = Keypair()
    seller_kp = Keypair()

    # Airdrop SOL — wait for confirmed balance
    _airdrop_and_wait(client, buyer_kp.pubkey(), sol=100.0)
    _airdrop_and_wait(client, seller_kp.pubkey(), sol=10.0)

    # Create test token mint (6 decimals = USDC-like)
    token = SyncToken.create_mint(
        conn=client,
        payer=buyer_kp,
        mint_authority=buyer_kp.pubkey(),
        decimals=6,
        program_id=TOKEN_PROGRAM_ID,
    )
    mint_pubkey = token.pubkey

    # Create buyer ATA and mint 1000 test USDC
    tc = SyncToken(conn=client, pubkey=mint_pubkey, program_id=TOKEN_PROGRAM_ID, payer=buyer_kp)
    buyer_ata = get_associated_token_address(buyer_kp.pubkey(), mint_pubkey)

    try:
        info = client.get_account_info(buyer_ata, commitment="confirmed")
        if info.value is None:
            tc.create_associated_token_account(buyer_kp.pubkey())
    except Exception:
        tc.create_associated_token_account(buyer_kp.pubkey())

    tc.mint_to(dest=buyer_ata, mint_authority=buyer_kp, amount=int(1000 * 1_000_000))

    # Wait briefly for state to propagate (confirmed is enough for localnet)
    # We use confirmed commitment everywhere on localnet, so no need to wait
    # for finalized which can take 30s+ on test-validator.
    time.sleep(1)

    return LocalnetState(
        rpc_url=rpc_url,
        buyer_kp=buyer_kp,
        seller_kp=seller_kp,
        buyer_private_key_b58=_keypair_to_base58(buyer_kp),
        buyer_pubkey=str(buyer_kp.pubkey()),
        seller_pubkey=str(seller_kp.pubkey()),
        test_usdc_mint_str=str(mint_pubkey),
        buyer_usdc_ata=buyer_ata,
    )


# ---------------------------------------------------------------------------
# Cached state
# ---------------------------------------------------------------------------

_state: LocalnetState | None = None


def _get_state() -> LocalnetState:
    global _state
    if _state is None:
        _state = _sync_setup()
    return _state


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def localnet_state():
    return _get_state()


@pytest.fixture(scope="session")
def rpc_url(localnet_state: LocalnetState) -> str:
    return localnet_state.rpc_url


@pytest.fixture(scope="session")
def buyer_keypair(localnet_state: LocalnetState) -> Keypair:
    return localnet_state.buyer_kp


@pytest.fixture(scope="session")
def seller_keypair(localnet_state: LocalnetState) -> Keypair:
    return localnet_state.seller_kp


@pytest.fixture(scope="session")
def buyer_private_key_b58(localnet_state: LocalnetState) -> str:
    return localnet_state.buyer_private_key_b58


@pytest.fixture(scope="session")
def buyer_pubkey(localnet_state: LocalnetState) -> str:
    return localnet_state.buyer_pubkey


@pytest.fixture(scope="session")
def seller_pubkey(localnet_state: LocalnetState) -> str:
    return localnet_state.seller_pubkey


@pytest.fixture(scope="session")
def funded_accounts(localnet_state: LocalnetState):
    return True


@pytest.fixture(scope="session")
def test_usdc_mint_str(localnet_state: LocalnetState) -> str:
    return localnet_state.test_usdc_mint_str


@pytest.fixture(scope="session")
def buyer_usdc_ata(localnet_state: LocalnetState) -> Pubkey:
    return localnet_state.buyer_usdc_ata


@pytest.fixture
async def solana_client(rpc_url: str):
    """Per-test async client — avoids event loop scope issues."""
    client = AsyncClient(rpc_url, timeout=RPC_TIMEOUT, commitment="confirmed")
    yield client
    await client.close()
