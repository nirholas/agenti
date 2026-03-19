"""
Payment verification for the gateway (server side).

Verifies x402 payment proofs submitted by clients in the Authorization header.
In test mode (no provider), accepts any well-formatted x402 proof.
With a provider, verifies the transaction on-chain.

Supports request_id-based idempotency deduplication via PersistentReplayGuard.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from open402.headers import parse_authorization

from ag402_core.config import RunMode, X402Config
from ag402_core.payment.base import BasePaymentProvider
from ag402_core.security.replay_guard import PersistentReplayGuard

logger = logging.getLogger(__name__)


@dataclass
class VerifyResult:
    """Result of payment verification."""

    valid: bool
    tx_hash: str = ""
    error: str = ""
    request_id: str = ""


class PaymentVerifier:
    """Verifies x402 payment proofs submitted by clients.

    When a ``replay_guard`` is provided (recommended for production), the
    verifier automatically deduplicates payment proofs by ``tx_hash``,
    preventing replay attacks where a client resubmits the same proof
    multiple times.
    """

    def __init__(
        self,
        provider: BasePaymentProvider | None = None,
        config: X402Config | None = None,
        replay_guard: PersistentReplayGuard | None = None,
    ):
        """Provider is optional -- if None, only basic format checks are done (test mode).

        Args:
            provider: Payment provider for on-chain verification.
            config: Optional configuration. When provided in production mode,
                    a provider is required.
            replay_guard: Optional persistent replay guard for tx_hash
                deduplication.
        """
        self._provider = provider
        self._config = config
        self._replay_guard = replay_guard

        # Production mode safety: require a provider
        if config is not None and config.mode != RunMode.TEST and provider is None:
            raise ValueError("Production mode requires a payment provider")

        # Warn about test mode
        if provider is None:
            logger.warning("[VERIFY] Running in test mode — no payment provider configured")

        # Warn about real private key in test mode
        if (
            config is not None
            and config.mode == RunMode.TEST
            and config.solana_private_key
        ):
            logger.warning(
                "[VERIFY] Real Solana private key detected in TEST mode — "
                "consider removing it to avoid accidental use"
            )

    async def verify(
        self,
        authorization: str,
        expected_amount: float = 0,
        expected_address: str = "",
    ) -> VerifyResult:
        """
        Verify an Authorization header.

        1. Validate expected_amount and expected_address (if provided)
        2. Parse as x402 proof (format check)
        3. If provider available, verify tx_hash on-chain (including sender check)
        4. Return result

        Args:
            authorization: The raw Authorization header value.
            expected_amount: Expected payment amount. When > 0, the gateway
                is declaring the price it expects. A negative or zero value
                (when explicitly passed) is rejected.
            expected_address: Expected recipient address. When expected_amount > 0,
                this must be non-empty.

        Returns:
            VerifyResult with valid=True if the proof is accepted.
        """
        # 0. Validate expected parameters (gateway-side safety)
        if expected_amount < 0:
            return VerifyResult(
                valid=False,
                error=f"Invalid expected amount: {expected_amount} -- must be >= 0",
            )
        if expected_amount > 0 and not expected_address:
            return VerifyResult(
                valid=False,
                error="Expected address is required when expected amount > 0",
            )

        # 1. Parse the authorization header
        proof = parse_authorization(authorization)

        if proof is None:
            logger.warning("[VERIFY] Invalid x402 authorization format: %s", authorization[:80])
            return VerifyResult(
                valid=False,
                error="Invalid x402 authorization format",
            )

        tx_hash = proof.tx_hash
        request_id = proof.request_id
        logger.info("[VERIFY] Parsed x402 proof -- tx_hash: %s, request_id: %s",
                     tx_hash, request_id or "n/a")

        # 1.5. Replay guard: check tx_hash deduplication
        if self._replay_guard is not None:
            is_new = await self._replay_guard.check_and_record_tx(tx_hash)
            if not is_new:
                logger.warning("[VERIFY] Duplicate tx_hash rejected (replay): %s", tx_hash[:32])
                return VerifyResult(
                    valid=False,
                    tx_hash=tx_hash,
                    request_id=request_id,
                    error="Duplicate payment proof (tx_hash already used)",
                )

        # 2. If provider is available, verify on-chain
        if self._provider is not None:
            try:
                # P0-1.1: Pass payer_address as expected_sender to prevent
                # attackers from re-using third-party tx_hashes
                verified = await self._provider.verify_payment(
                    tx_hash,
                    expected_amount=expected_amount,
                    expected_address=expected_address,
                    expected_sender=proof.payer_address,
                )
            except Exception as exc:
                logger.error("[VERIFY] On-chain verification error: %s", exc)
                return VerifyResult(
                    valid=False,
                    tx_hash=tx_hash,
                    error=f"Verification error: {exc}",
                )

            if not verified:
                logger.warning("[VERIFY] On-chain verification failed for tx: %s", tx_hash)
                return VerifyResult(
                    valid=False,
                    tx_hash=tx_hash,
                    request_id=request_id,
                    error="Payment not confirmed on-chain",
                )

            logger.info("[VERIFY] On-chain verification succeeded for tx: %s", tx_hash)
            return VerifyResult(valid=True, tx_hash=tx_hash, request_id=request_id)

        # 3. No provider -- test mode: accept any well-formatted x402 proof
        logger.info("[VERIFY] No provider -- accepting proof in test mode (tx: %s)", tx_hash)
        return VerifyResult(valid=True, tx_hash=tx_hash, request_id=request_id)
