"""Test mode auto-funding faucet."""

from __future__ import annotations

import logging
import os

from ag402_core.wallet.agent_wallet import AgentWallet

logger = logging.getLogger(__name__)

FAUCET_AMOUNT = 100.0


async def init_testnet_faucet(wallet: AgentWallet) -> None:
    mode = os.getenv("X402_MODE", "production")
    if mode != "test":
        logger.debug("Faucet skipped — not in test mode (mode=%s)", mode)
        return

    balance = await wallet.get_balance()
    if balance > 0:
        logger.debug("Faucet skipped — wallet already funded (balance=%.2f)", balance)
        return

    await wallet.deposit(FAUCET_AMOUNT, note="TEST MODE faucet auto-fund")
    logger.warning(
        "TEST MODE: Deposited %.2f virtual USD via faucet. "
        "These funds have no real value.",
        FAUCET_AMOUNT,
    )
