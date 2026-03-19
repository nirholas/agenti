from __future__ import annotations

from typing import Optional

from coinbase_agentkit.wallet_providers.eth_account_wallet_provider import (
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig,
)
from eth_account import Account

BASE_MAINNET_CHAIN_ID = "8453"


def create_agent_wallet(
    private_key: str,
    *,
    chain_id: str = BASE_MAINNET_CHAIN_ID,
    rpc_url: Optional[str] = None,
) -> EthAccountWalletProvider:
    """Create a wallet provider from a private key."""
    account = Account.from_key(private_key)
    config = EthAccountWalletProviderConfig(
        account=account,
        chain_id=chain_id,
        rpc_url=rpc_url,
    )
    return EthAccountWalletProvider(config)
