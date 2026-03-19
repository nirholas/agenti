"""Solana USDC payment adapter and mock for test mode."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import uuid

from ag402_core.payment.base import BasePaymentProvider, PaymentResult

logger = logging.getLogger(__name__)

# SPL Memo Program ID (official)
MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"

# Brand memo injected into every transaction
AG402_MEMO = "Ag402-v1"

# ---------------------------------------------------------------------------
# Real Solana adapter
# ---------------------------------------------------------------------------

class SolanaAdapter(BasePaymentProvider):
    """SPL-Token (USDC) payments on Solana via solana-py / solders.

    Heavy dependencies (``solana``, ``solders``) are imported lazily so the
    rest of the package works even when they are not installed.

    Features:
    - Automatic retry with exponential backoff on RPC failures
    - Multi-endpoint failover via ``rpc_backup_url``
    - ATA auto-creation for recipients
    - Memo injection ("Ag402-v1")
    - ``confirmation_status`` in PaymentResult for clarity on confirmation outcome
    """

    def __init__(
        self,
        private_key: str | bytearray,
        rpc_url: str = "https://api.devnet.solana.com",
        usdc_mint: str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        confirm_timeout: int = 30,
        confirmation_level: str = "confirmed",
        rpc_backup_url: str = "",
        max_rpc_retries: int = 2,
        priority_fee_microlamports: int = 0,
        compute_unit_limit: int = 0,
    ) -> None:
        # Lazy-import heavy crypto dependencies
        try:
            from solana.rpc.async_api import AsyncClient  # type: ignore[import-untyped]
            from solders.keypair import Keypair  # type: ignore[import-untyped]
            from solders.pubkey import Pubkey  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "Solana dependencies are not installed. "
                "Install them with:  pip install 'ag402-core[crypto]'"
            ) from exc

        self._Pubkey = Pubkey
        self._AsyncClient = AsyncClient

        # Accept both str and bytearray; wipe the mutable buffer after use.
        key_str = private_key.decode("utf-8") if isinstance(private_key, bytearray) else private_key
        self._keypair: Keypair = Keypair.from_base58_string(key_str)
        del key_str
        # If caller passed a bytearray, securely zero it now that Keypair holds the key.
        if isinstance(private_key, bytearray):
            from ag402_core.security.wallet_encryption import secure_zero
            secure_zero(private_key)

        self._rpc_url = rpc_url
        self._usdc_mint = Pubkey.from_string(usdc_mint)
        self._confirm_timeout = confirm_timeout
        self._max_rpc_retries = max_rpc_retries

        # P2-3.1: Configurable confirmation level ("confirmed" or "finalized")
        if confirmation_level not in ("confirmed", "finalized"):
            raise ValueError(
                f"confirmation_level must be 'confirmed' or 'finalized', got {confirmation_level!r}"
            )
        self._confirmation_level = confirmation_level

        # Multi-endpoint failover
        from ag402_core.payment.retry import MultiEndpointClient

        backup_urls = [rpc_backup_url] if rpc_backup_url else []
        self._endpoint_mgr = MultiEndpointClient(rpc_url, backup_urls)
        self._client = AsyncClient(self._endpoint_mgr.current_url, commitment=confirmation_level)

        # Priority fee configuration (0 = disabled)
        self._priority_fee_microlamports = priority_fee_microlamports
        self._compute_unit_limit = compute_unit_limit

        logger.info(
            "Private key loaded into Keypair object (source buffer wiped if bytearray)."
        )

    async def _reconnect_client(self) -> None:
        """Reconnect to the current endpoint (after failover).

        Closes the old client to prevent httpx session leaks.
        """
        old_client = self._client
        self._client = self._AsyncClient(
            self._endpoint_mgr.current_url, commitment=self._confirmation_level
        )
        if old_client is not None:
            with contextlib.suppress(Exception):
                await old_client.close()

    # -- BasePaymentProvider interface --------------------------------------

    async def pay(
        self, to_address: str, amount: float, token: str = "USDC",
        *, request_id: str = "",
    ) -> PaymentResult:
        """Execute an SPL Token transfer of USDC on Solana.

        Includes:
        - ATA auto-creation for recipient if needed
        - Memo instruction "Ag402-v1" or "Ag402-v1|<request_id>" for idempotency
        - Transaction confirmation wait

        Args:
            request_id: Optional unique identifier embedded in the transaction
                memo for idempotency deduplication.

        Compatible with solana-py >=0.36.0 / solders >=0.21.0.
        """
        try:
            from solders.instruction import AccountMeta, Instruction  # type: ignore[import-untyped]
            from solders.message import Message  # type: ignore[import-untyped]
            from solders.pubkey import Pubkey  # type: ignore[import-untyped]
            from solders.transaction import Transaction  # type: ignore[import-untyped]
            from spl.token.constants import TOKEN_PROGRAM_ID  # type: ignore[import-untyped]
            from spl.token.instructions import (  # type: ignore[import-untyped]
                TransferCheckedParams,
                get_associated_token_address,
                transfer_checked,
            )

            recipient = Pubkey.from_string(to_address)

            # Derive associated token accounts
            sender_ata = get_associated_token_address(
                self._keypair.pubkey(), self._usdc_mint
            )
            recipient_ata = get_associated_token_address(
                recipient, self._usdc_mint
            )

            # USDC has 6 decimals — use round() to avoid float truncation
            lamport_amount = round(amount * 1_000_000)

            instructions = []
            needs_ata_creation = False

            # F4: Priority fee instructions (computeBudget program)
            # These must come first in the transaction.
            if self._compute_unit_limit > 0 or self._priority_fee_microlamports > 0:
                try:
                    COMPUTE_BUDGET_PROGRAM_ID = Pubkey.from_string(
                        "ComputeBudget111111111111111111111111111"
                    )
                    import struct

                    if self._compute_unit_limit > 0:
                        # SetComputeUnitLimit instruction (discriminator = 2)
                        cu_data = struct.pack("<BI", 2, self._compute_unit_limit)
                        instructions.append(Instruction(
                            program_id=COMPUTE_BUDGET_PROGRAM_ID,
                            data=cu_data,
                            accounts=[],
                        ))

                    if self._priority_fee_microlamports > 0:
                        # SetComputeUnitPrice instruction (discriminator = 3)
                        fee_data = struct.pack("<BQ", 3, self._priority_fee_microlamports)
                        instructions.append(Instruction(
                            program_id=COMPUTE_BUDGET_PROGRAM_ID,
                            data=fee_data,
                            accounts=[],
                        ))

                    logger.info(
                        "[PRIORITY] CU limit=%d, fee=%d µlamp",
                        self._compute_unit_limit, self._priority_fee_microlamports,
                    )
                except Exception as pf_err:
                    logger.warning("[PRIORITY] Failed to add priority fees: %s", pf_err)

            # 7.2: ATA auto-creation — check if recipient ATA exists
            # Always use "confirmed" commitment for ATA check to avoid
            # false negatives when client defaults to "finalized".
            try:
                acct_info = await asyncio.wait_for(
                    self._client.get_account_info(
                        recipient_ata, commitment="confirmed"
                    ),
                    timeout=self._confirm_timeout,
                )
                if acct_info.value is None:
                    from spl.token.instructions import (  # type: ignore[import-untyped]
                        create_associated_token_account,
                    )
                    create_ata_ix = create_associated_token_account(
                        payer=self._keypair.pubkey(),
                        owner=recipient,
                        mint=self._usdc_mint,
                    )
                    instructions.append(create_ata_ix)
                    needs_ata_creation = True
                    logger.info("[ATA] Creating recipient ATA for %s", to_address[:16])
            except asyncio.TimeoutError:
                logger.warning("[ATA] Timed out checking ATA for %s", to_address[:16])
            except Exception as ata_err:
                logger.warning("[ATA] Could not check/create ATA: %s", ata_err)

            # Transfer instruction
            ix = transfer_checked(
                TransferCheckedParams(
                    program_id=TOKEN_PROGRAM_ID,
                    source=sender_ata,
                    mint=self._usdc_mint,
                    dest=recipient_ata,
                    owner=self._keypair.pubkey(),
                    amount=lamport_amount,
                    decimals=6,
                )
            )
            instructions.append(ix)

            # 7.1: Memo injection (best-effort — failure doesn't block payment)
            # Embed request_id for idempotency: "Ag402-v1|<request_id>"
            effective_memo = f"{AG402_MEMO}|{request_id}" if request_id else AG402_MEMO
            try:
                memo_program = Pubkey.from_string(MEMO_PROGRAM_ID)
                memo_ix = Instruction(
                    program_id=memo_program,
                    data=effective_memo.encode("utf-8"),
                    accounts=[
                        AccountMeta(
                            pubkey=self._keypair.pubkey(),
                            is_signer=True,
                            is_writable=False,
                        )
                    ],
                )
                instructions.append(memo_ix)
            except Exception as memo_err:
                logger.warning("[MEMO] Failed to add memo: %s", memo_err)

            # Build transaction with solders API (solana-py >= 0.36)
            # Use retry_with_backoff + multi-endpoint failover for RPC calls
            from ag402_core.payment.retry import retry_with_backoff

            async def _get_blockhash():
                return await asyncio.wait_for(
                    self._client.get_latest_blockhash(),
                    timeout=self._confirm_timeout,
                )

            try:
                blockhash_resp = await retry_with_backoff(
                    _get_blockhash,
                    max_retries=self._max_rpc_retries,
                    base_delay=0.5,
                    label="get_latest_blockhash",
                )
            except Exception:
                # Try failover endpoint before giving up
                new_url = self._endpoint_mgr.failover()
                if new_url:
                    await self._reconnect_client()
                    blockhash_resp = await asyncio.wait_for(
                        self._client.get_latest_blockhash(),
                        timeout=self._confirm_timeout,
                    )
                else:
                    raise

            recent_blockhash = blockhash_resp.value.blockhash

            msg = Message.new_with_blockhash(
                instructions,
                self._keypair.pubkey(),
                recent_blockhash,
            )
            txn = Transaction.new_unsigned(msg)
            txn.sign([self._keypair], recent_blockhash)

            # Always use "confirmed" for preflight simulation to avoid
            # AccountNotFound errors on test-validator where finalized
            # bank lags behind confirmed bank.
            #
            # When ATA creation is included, skip preflight entirely:
            # the RPC preflight simulator cannot reliably handle
            # "create-then-use" in a single atomic transaction, causing
            # spurious InvalidAccountData errors — especially on devnet.
            from solana.rpc.types import TxOpts  # type: ignore[import-untyped]

            opts = TxOpts(
                skip_preflight=needs_ata_creation,
                preflight_commitment="confirmed",
            )

            async def _send_tx():
                return await asyncio.wait_for(
                    self._client.send_transaction(txn, opts=opts),
                    timeout=self._confirm_timeout,
                )

            try:
                resp = await retry_with_backoff(
                    _send_tx,
                    max_retries=self._max_rpc_retries,
                    base_delay=0.5,
                    label="send_transaction",
                )
            except Exception:
                new_url = self._endpoint_mgr.failover()
                if new_url:
                    await self._reconnect_client()
                    resp = await asyncio.wait_for(
                        self._client.send_transaction(txn, opts=opts),
                        timeout=self._confirm_timeout,
                    )
                else:
                    raise

            tx_hash = str(resp.value)

            # Reset endpoint manager to primary after successful send
            self._endpoint_mgr.reset()

            # 7.3: Wait for transaction confirmation at configured level
            # Use a shorter timeout for confirm (max 15s) to avoid hanging
            confirm_wait = min(self._confirm_timeout, 15)
            confirmation_status = "sent"  # default: sent but not yet confirmed
            try:
                confirm_resp = await asyncio.wait_for(
                    self._client.confirm_transaction(
                        resp.value, commitment=self._confirmation_level
                    ),
                    timeout=confirm_wait,
                )
                # When skip_preflight was used, the transaction may have been
                # accepted by the cluster but failed during execution (e.g.
                # insufficient balance, invalid account data).  Check the
                # confirmation response for an error field.
                tx_err = getattr(
                    getattr(confirm_resp, "value", None), "err", None
                )
                if tx_err is not None:
                    logger.error(
                        "[CONFIRM] Transaction %s failed on-chain: %s",
                        tx_hash[:16], tx_err,
                    )
                    # B2 FIX: Detect ATA-related on-chain errors
                    err_str = str(tx_err)
                    err_lower = err_str.lower()
                    ata_hints = ["accountnotfound", "invalid account owner",
                                 "insufficient funds", "token account"]
                    if any(h in err_lower for h in ata_hints):
                        err_str = (
                            f"Transaction failed — the recipient may not have a "
                            f"USDC token account (ATA). Contact the API provider. "
                            f"(Detail: {err_str[:120]})"
                        )
                    return PaymentResult(
                        tx_hash=tx_hash,
                        success=False,
                        error=err_str,
                        chain="solana",
                        confirmation_status="failed",
                    )

                confirmation_status = self._confirmation_level
                logger.info("[CONFIRM] Transaction %s at %s",
                            tx_hash[:16], self._confirmation_level)
            except asyncio.TimeoutError:
                # P-C1 FIX: Clearly flag as unconfirmed instead of silently succeeding.
                # The tx was broadcast and may or may not confirm on-chain.
                # Money is at risk — caller must handle this status appropriately.
                confirmation_status = "unconfirmed"
                logger.critical(
                    "[CONFIRM] UNCONFIRMED: Timed out waiting for %s confirmation of tx %s. "
                    "Transaction was broadcast but confirmation status is unknown. "
                    "USDC may have been sent — manual verification recommended: "
                    "https://solscan.io/tx/%s",
                    self._confirmation_level, tx_hash[:16], tx_hash,
                )
            except Exception as confirm_err:
                confirmation_status = "unconfirmed"
                logger.critical(
                    "[CONFIRM] UNCONFIRMED: Confirmation wait failed for tx %s: %s. "
                    "Transaction was broadcast but confirmation status is unknown. "
                    "USDC may have been sent — manual verification recommended.",
                    tx_hash[:16], confirm_err, exc_info=True,
                )

            return PaymentResult(
                tx_hash=tx_hash, success=True, chain="solana",
                memo=effective_memo, request_id=request_id,
                confirmation_status=confirmation_status,
            )

        except Exception as exc:
            logger.error("[PAY] Payment failed: %s", exc, exc_info=True)
            # B2 FIX: Detect ATA-related errors and provide friendly hints
            error_str = str(exc)
            error_lower = error_str.lower()
            ata_indicators = [
                "accountnotfound",
                "invalid account owner",
                "insufficient funds",
                "token account not found",
                "associated token account",
            ]
            if any(ind in error_lower for ind in ata_indicators):
                friendly = (
                    f"Payment failed — the recipient may not have a USDC token "
                    f"account (ATA). Contact the API provider to create one. "
                    f"(Detail: {error_str[:120]})"
                )
                return PaymentResult(
                    tx_hash="", success=False, error=friendly, chain="solana"
                )
            return PaymentResult(
                tx_hash="", success=False, error=error_str, chain="solana"
            )

    async def check_balance(self) -> float:
        """Query USDC token balance for this wallet (with RPC failover)."""
        try:
            return await self._check_balance_impl()
        except Exception:
            # Failover to backup endpoint
            new_url = self._endpoint_mgr.failover()
            if new_url:
                await self._reconnect_client()
                try:
                    return await self._check_balance_impl()
                except Exception:
                    pass
            return 0.0

    async def _check_balance_impl(self) -> float:
        """Internal balance query implementation."""
        from spl.token.async_client import AsyncToken  # type: ignore[import-untyped]
        from spl.token.constants import TOKEN_PROGRAM_ID  # type: ignore[import-untyped]
        from spl.token.instructions import (
            get_associated_token_address,  # type: ignore[import-untyped]
        )

        token_client = AsyncToken(
            conn=self._client,
            pubkey=self._usdc_mint,
            program_id=TOKEN_PROGRAM_ID,
            payer=self._keypair,
        )
        ata = get_associated_token_address(
            self._keypair.pubkey(), self._usdc_mint
        )
        info = await asyncio.wait_for(
            token_client.get_balance(ata),
            timeout=self._confirm_timeout,
        )
        return float(info.value.ui_amount or 0.0)

    async def verify_payment(
        self,
        tx_hash: str,
        expected_amount: float = 0,
        expected_address: str = "",
        expected_sender: str = "",
    ) -> bool:
        """Verify a payment transaction exists, is confirmed, and matches expected amount/address/sender."""
        try:
            from solders.signature import Signature  # type: ignore[import-untyped]

            sig = Signature.from_string(tx_hash)
            # Use "confirmed" commitment for get_transaction to ensure
            # recently landed transactions are visible (test-validator
            # finalized bank can lag significantly).
            # Retry a few times because recently confirmed txs may not
            # be immediately queryable.
            resp = None
            for _attempt in range(5):
                resp = await asyncio.wait_for(
                    self._client.get_transaction(
                        sig, max_supported_transaction_version=0,
                        commitment="confirmed",
                    ),
                    timeout=self._confirm_timeout,
                )
                if resp.value is not None:
                    break
                await asyncio.sleep(0.5)

            if resp is None or resp.value is None:
                return False

            # If no expected amount/address, just confirm existence
            if expected_amount <= 0:
                return True

            # Parse the transaction to verify amount and recipient
            # The transaction meta contains pre/post token balances
            meta = resp.value.transaction.meta
            if meta is None:
                logger.warning("[VERIFY] Transaction has no meta — cannot verify amount")
                return False

            # Check pre/post token balances for USDC transfer verification
            pre_balances = meta.pre_token_balances or []
            post_balances = meta.post_token_balances or []

            expected_lamports = round(expected_amount * 1_000_000)
            usdc_mint_str = str(self._usdc_mint)

            # Find USDC balance changes for the expected recipient
            for post_bal in post_balances:
                if str(post_bal.mint) != usdc_mint_str:
                    continue
                if expected_address and str(post_bal.owner) != expected_address:
                    continue

                # Find matching pre-balance
                pre_amount = 0
                for pre_bal in pre_balances:
                    if pre_bal.account_index == post_bal.account_index:
                        pre_amount = int(pre_bal.ui_token_amount.amount)
                        break

                post_amount = int(post_bal.ui_token_amount.amount)
                transfer_amount = post_amount - pre_amount

                if transfer_amount >= expected_lamports:
                    # P0-1.1: Verify sender if expected_sender is provided
                    if expected_sender:
                        sender_verified = self._verify_sender(
                            pre_balances, post_balances, usdc_mint_str, expected_sender
                        )
                        if not sender_verified:
                            logger.warning(
                                "[VERIFY] Sender mismatch — expected %s but tx %s was not sent by them",
                                expected_sender[:20], tx_hash[:16],
                            )
                            return False
                    return True

            logger.warning(
                "[VERIFY] Transaction %s does not match expected amount %.6f to %s",
                tx_hash[:16], expected_amount, expected_address[:20],
            )
            return False

        except asyncio.TimeoutError:
            logger.error("[VERIFY] Timed out verifying tx %s", tx_hash[:16])
            return False
        except Exception as exc:
            logger.error("[VERIFY] Verification failed for %s: %s", tx_hash[:16], exc, exc_info=True)
            return False

    @staticmethod
    def _verify_sender(
        pre_balances: list,
        post_balances: list,
        usdc_mint_str: str,
        expected_sender: str,
    ) -> bool:
        """Check that the expected sender's balance decreased (proving they sent the funds)."""
        for pre_bal in pre_balances:
            if str(pre_bal.mint) != usdc_mint_str:
                continue
            if str(pre_bal.owner) != expected_sender:
                continue
            # Found the sender's pre-balance — check that it decreased
            for post_bal in post_balances:
                if post_bal.account_index == pre_bal.account_index:
                    pre_amt = int(pre_bal.ui_token_amount.amount)
                    post_amt = int(post_bal.ui_token_amount.amount)
                    if post_amt < pre_amt:
                        return True
            # Sender found but balance didn't decrease
            return False
        # Sender not found in pre_token_balances at all
        return False

    def get_address(self) -> str:
        """Return this wallet's public key as a base58 string."""
        return str(self._keypair.pubkey())

    async def aclose(self) -> None:
        """Async close: properly shut down the httpx session inside AsyncClient."""
        import gc

        if self._client is not None:
            with contextlib.suppress(Exception):
                await self._client.close()
        self._keypair = None  # type: ignore[assignment]
        self._client = None  # type: ignore[assignment]
        gc.collect()

    def close(self) -> None:
        """Sync close: clear the private key from memory.

        Prefer ``aclose()`` in async contexts to properly shut down
        the underlying httpx session.
        """
        import gc

        self._keypair = None  # type: ignore[assignment]
        self._client = None  # type: ignore[assignment]
        gc.collect()

class MockSolanaAdapter(BasePaymentProvider):
    """In-memory mock that simulates Solana payments without touching any chain.

    Used when ``X402_MODE=test``.
    """

    def __init__(self, balance: float = 100.0, address: str = "MockWa11etAddress1111111111111111111111111111") -> None:
        self._balance = balance
        self._address = address
        self._payments: list[PaymentResult] = []

    async def pay(
        self, to_address: str, amount: float, token: str = "USDC",
        *, request_id: str = "",
    ) -> PaymentResult:
        tx_hash = f"mock_tx_{uuid.uuid4().hex}"
        effective_memo = f"{AG402_MEMO}|{request_id}" if request_id else AG402_MEMO
        result = PaymentResult(
            tx_hash=tx_hash, success=True, chain="solana-mock",
            memo=effective_memo, request_id=request_id,
        )
        self._payments.append(result)
        self._balance -= amount
        return result

    async def check_balance(self) -> float:
        return self._balance

    async def verify_payment(
        self,
        tx_hash: str,
        expected_amount: float = 0,
        expected_address: str = "",
        expected_sender: str = "",
    ) -> bool:
        """Mock verification — only accepts tx_hashes actually issued by this adapter.

        S1-3 FIX: Removed the fallback ``tx_hash.startswith("mock_tx_")`` which
        allowed anyone to forge a valid-looking payment proof in test mode.
        Now only hashes recorded by ``.pay()`` are accepted.
        """
        if not tx_hash or len(tx_hash) < 8:
            return False
        # S1-3: Only accept tx_hashes that we actually created via .pay()
        return any(p.tx_hash == tx_hash for p in self._payments)

    def get_address(self) -> str:
        return self._address
