"""
Shared fixtures for Solana Devnet integration tests.

Environment variables (keypair loading):

  Buyer (needs private key for signing transactions):
    DEVNET_BUYER_PRIVATE_KEY  – buyer's full secret key in base58 (Method A)
    DEVNET_BUYER_KEY_PATH     – path to buyer keypair JSON (Method B, default: ~/.ag402/devnet-buyer.json)

  Seller (only needs PUBLIC address for receiving payments):
    DEVNET_SELLER_PUBKEY      – seller's public address (preferred)
    DEVNET_SELLER_PRIVATE_KEY – (legacy, test-only) only used to derive pubkey in E2E tests
    DEVNET_SELLER_KEY_PATH    – (legacy, test-only) only used to derive pubkey in E2E tests

  ⚠️  In production, sellers NEVER need a private key.
      Ag402 only uses the seller's public address for payment verification.

  Method A (base58) takes precedence when set.

Other variables:
    SOLANA_RPC_URL – devnet RPC (default: https://api.devnet.solana.com)

The fixtures handle:
    1. Loading keypairs from env var or JSON files
    2. Ensuring SOL balance (airdrop if needed)
    3. Creating a custom SPL token mint (6 decimals) as test USDC
    4. Minting test USDC to buyer
    5. Creating seller's ATA

Uses synchronous setup (SyncClient) to avoid pytest-asyncio session-scope issues,
mirroring the approach in conftest_localnet.py.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

import pytest

# Default timeout for each RPC call (seconds)
RPC_TIMEOUT = 60

# These imports require the [crypto] extra
pytest.importorskip("solana", reason="solana-py not installed (pip install 'ag402-core[crypto]')")
pytest.importorskip("solders", reason="solders not installed (pip install 'ag402-core[crypto]')")

import base58
from solana.rpc.api import Client as SyncClient
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from spl.token.client import Token as SyncToken
from spl.token.constants import TOKEN_PROGRAM_ID
from spl.token.instructions import get_associated_token_address

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_keypair(path: str) -> Keypair:
    """Load a Solana keypair from a JSON file (array of bytes)."""
    with open(path) as f:
        secret = json.load(f)
    return Keypair.from_bytes(bytes(secret))


def _keypair_from_base58(b58_key: str) -> Keypair:
    """Create a Keypair from a base58-encoded full secret key (e.g. Phantom export)."""
    return Keypair.from_base58_string(b58_key)


def _keypair_to_base58(kp: Keypair) -> str:
    """Export keypair's full secret key as base58 (for SolanaAdapter)."""
    return base58.b58encode(bytes(kp)).decode()


def _ensure_sol_balance_sync(
    client: SyncClient, pubkey: Pubkey, min_sol: float = 0.5,
    funder_kp: Keypair | None = None,
) -> None:
    """Ensure the account has at least min_sol SOL.

    Funding strategy:
    1. If *funder_kp* is provided, do a SOL transfer from funder.
    2. Otherwise, try airdrop (devnet rate limits are aggressive).
    """
    resp = client.get_balance(pubkey, commitment="confirmed")
    balance_sol = resp.value / 1e9
    if balance_sol >= min_sol:
        return

    # Strategy 1: direct SOL transfer from funder (bypasses airdrop rate limits)
    if funder_kp is not None:
        try:
            from solders.message import Message
            from solders.system_program import TransferParams, transfer
            from solders.transaction import Transaction

            transfer_amount = int(0.2 * 1e9)  # 0.2 SOL
            ix = transfer(TransferParams(
                from_pubkey=funder_kp.pubkey(),
                to_pubkey=pubkey,
                lamports=transfer_amount,
            ))
            blockhash_resp = client.get_latest_blockhash(commitment="confirmed")
            recent_bh = blockhash_resp.value.blockhash
            msg = Message.new_with_blockhash([ix], funder_kp.pubkey(), recent_bh)
            txn = Transaction.new_unsigned(msg)
            txn.sign([funder_kp], recent_bh)
            client.send_transaction(txn)
            # Wait for confirmation
            for _ in range(30):
                time.sleep(1)
                resp = client.get_balance(pubkey, commitment="confirmed")
                if resp.value / 1e9 >= min_sol:
                    return
        except Exception as e:
            logger_msg = f"SOL transfer from funder failed: {e}"
            # Fall through to airdrop
            import logging
            logging.getLogger(__name__).warning(logger_msg)

    # Strategy 2: airdrop (with retries)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            client.request_airdrop(pubkey, int(1e9))  # request 1 SOL at a time
        except Exception:
            if attempt < max_retries - 1:
                time.sleep(5 * (attempt + 1))  # backoff
                continue
            # Final attempt failed — skip tests instead of crashing
            pytest.skip(
                f"Devnet airdrop rate-limited for {pubkey}. "
                f"Balance: {balance_sol:.4f} SOL (need {min_sol}).\n"
                f"Please manually fund via https://faucet.solana.com/ or:\n"
                f"  solana airdrop 2 {pubkey} --url https://api.devnet.solana.com"
            )
            return

        # Poll until balance is visible
        for _ in range(60):
            time.sleep(1)
            resp = client.get_balance(pubkey, commitment="confirmed")
            if resp.value / 1e9 >= min_sol:
                return
        # If we got here, airdrop didn't reflect — retry
        time.sleep(3)

    pytest.skip(
        f"Devnet airdrop timed out for {pubkey}. "
        f"Please manually fund via https://faucet.solana.com/"
    )


# ---------------------------------------------------------------------------
# Synchronous setup (avoids pytest-asyncio session-scope issues)
# ---------------------------------------------------------------------------

@dataclass
class DevnetState:
    rpc_url: str
    buyer_kp: Keypair
    seller_kp: Keypair
    buyer_private_key_b58: str
    buyer_pubkey: str
    seller_pubkey: str
    test_usdc_mint_str: str
    buyer_usdc_ata: Pubkey


def _sync_setup() -> DevnetState:
    """Synchronous devnet setup: load keys, airdrop, create mint, mint USDC."""
    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")

    # Load keypairs — prefer base58 env vars (Method A), fall back to JSON files (Method B)
    buyer_b58 = os.getenv("DEVNET_BUYER_PRIVATE_KEY", "")
    seller_b58 = os.getenv("DEVNET_SELLER_PRIVATE_KEY", "")

    if buyer_b58:
        buyer_kp = _keypair_from_base58(buyer_b58)
    else:
        buyer_path = os.getenv(
            "DEVNET_BUYER_KEY_PATH",
            str(Path.home() / ".ag402" / "devnet-buyer.json"),
        )
        if not os.path.exists(buyer_path):
            pytest.skip(f"Buyer keypair not found: {buyer_path} (set DEVNET_BUYER_PRIVATE_KEY or DEVNET_BUYER_KEY_PATH)")
        buyer_kp = _load_keypair(buyer_path)

    if seller_b58:
        # ⚠️ SELLER PRIVATE KEY — E2E TEST ONLY
        # In production, sellers NEVER provide or need a private key.
        # This is only used in E2E tests to derive a pubkey + create ATA.
        seller_kp = _keypair_from_base58(seller_b58)
    else:
        seller_path = os.getenv(
            "DEVNET_SELLER_KEY_PATH",
            str(Path.home() / ".ag402" / "devnet-seller.json"),
        )
        # No seller private key — generate an ephemeral one when the file
        # is missing.  The seller role in Ag402 ONLY needs a public address.
        # The keypair here is solely for test setup (creating ATA, etc.).
        seller_kp = _load_keypair(seller_path) if os.path.exists(seller_path) else Keypair()

    # If DEVNET_SELLER_PUBKEY is set, use it as the destination address for payments;
    # otherwise derive from the seller keypair.
    seller_pubkey_override = os.getenv("DEVNET_SELLER_PUBKEY", "")

    client = SyncClient(rpc_url, timeout=RPC_TIMEOUT, commitment="confirmed")

    # Ensure SOL balance
    _ensure_sol_balance_sync(client, buyer_kp.pubkey(), min_sol=0.5)
    # Seller ephemeral keypair — fund from buyer if airdrop fails
    _ensure_sol_balance_sync(client, seller_kp.pubkey(), min_sol=0.1, funder_kp=buyer_kp)

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

    # Wait for state propagation on devnet
    time.sleep(2)

    return DevnetState(
        rpc_url=rpc_url,
        buyer_kp=buyer_kp,
        seller_kp=seller_kp,
        buyer_private_key_b58=_keypair_to_base58(buyer_kp),
        buyer_pubkey=str(buyer_kp.pubkey()),
        seller_pubkey=seller_pubkey_override or str(seller_kp.pubkey()),
        test_usdc_mint_str=str(mint_pubkey),
        buyer_usdc_ata=buyer_ata,
    )


# ---------------------------------------------------------------------------
# Cached state
# ---------------------------------------------------------------------------

_state: DevnetState | None = None


def _get_state() -> DevnetState:
    global _state
    if _state is None:
        _state = _sync_setup()
    return _state


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def devnet_state():
    return _get_state()


@pytest.fixture(scope="session")
def rpc_url(devnet_state: DevnetState) -> str:
    return devnet_state.rpc_url


@pytest.fixture(scope="session")
def buyer_keypair(devnet_state: DevnetState) -> Keypair:
    return devnet_state.buyer_kp


@pytest.fixture(scope="session")
def seller_keypair(devnet_state: DevnetState) -> Keypair:
    return devnet_state.seller_kp


@pytest.fixture(scope="session")
def buyer_private_key_b58(devnet_state: DevnetState) -> str:
    return devnet_state.buyer_private_key_b58


@pytest.fixture(scope="session")
def buyer_pubkey(devnet_state: DevnetState) -> str:
    return devnet_state.buyer_pubkey


@pytest.fixture(scope="session")
def seller_pubkey(devnet_state: DevnetState) -> str:
    return devnet_state.seller_pubkey


@pytest.fixture(scope="session")
def funded_accounts(devnet_state: DevnetState):
    return True


@pytest.fixture(scope="session")
def test_usdc_mint_str(devnet_state: DevnetState) -> str:
    return devnet_state.test_usdc_mint_str


@pytest.fixture(scope="session")
def buyer_usdc_ata(devnet_state: DevnetState) -> Pubkey:
    return devnet_state.buyer_usdc_ata


@pytest.fixture
async def solana_client(rpc_url: str):
    """Per-test async client — avoids event loop scope issues."""
    client = AsyncClient(rpc_url, timeout=RPC_TIMEOUT, commitment="confirmed")
    yield client
    await client.close()
