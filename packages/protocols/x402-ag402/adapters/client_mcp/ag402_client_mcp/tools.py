"""Tool definitions and business logic for Ag402 MCP Client.

Three MCP Tools:
- fetch_with_autopay: HTTP request with automatic x402 payment
- wallet_status: Query wallet balance and budget usage
- transaction_history: Query payment transaction history
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from decimal import Decimal, InvalidOperation

from ag402_core.middleware.x402_middleware import MiddlewareResult, X402PaymentMiddleware
from ag402_core.wallet.agent_wallet import AgentWallet

logger = logging.getLogger("ag402_client_mcp.tools")

# ─── Tool Input/Output Models ────────────────────────────────────────

ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}


@dataclass
class FetchResult:
    """Structured result from fetch_with_autopay."""

    status_code: int = 0
    body: str = ""
    headers: dict[str, str] = field(default_factory=dict)
    payment_made: bool = False
    amount_paid: str = "0.00"
    tx_hash: str = ""
    error: str = ""


# ─── Decimal JSON Helper ─────────────────────────────────────────────

def _decimal_to_str(obj: object) -> str:
    """Serialize Decimal as string to preserve financial precision."""
    if isinstance(obj, Decimal):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _to_json(data: dict) -> str:
    return json.dumps(data, default=_decimal_to_str, ensure_ascii=False, indent=2)


def _safe_str(value: Decimal | float | int) -> str:
    """Convert numeric value to string for JSON, preserving precision."""
    if isinstance(value, Decimal):
        return str(value)
    return f"{value:.6f}".rstrip("0").rstrip(".")


# ─── Friendly Error Messages (AI & Human readable) ───────────────────

_ERROR_HINTS: dict[str, str] = {
    "ConnectionError": "Cannot connect to the target API. Check the URL and ensure the service is running.",
    "ConnectError": "Cannot connect to the target API. Check the URL and ensure the service is running.",
    "TimeoutError": "Request timed out. The target API may be slow or unreachable.",
    "FileNotFoundError": "Wallet database not found. Run `ag402 setup` to initialize.",
    "PermissionError": "Cannot access ~/.ag402/ directory. Check file permissions.",
    "ValueError": "Invalid parameter value. Check the request parameters.",
    "InvalidOperation": "Invalid numeric value. Amount must be a valid number.",
}


def _friendly_error(exc: Exception) -> str:
    """Convert exception to AI-friendly error message with actionable hint.

    Avoids leaking sensitive info (file paths, stack traces) while giving
    both AI agents and human developers clear guidance on what to do next.
    """
    exc_name = type(exc).__name__
    hint = _ERROR_HINTS.get(exc_name)
    if hint:
        return f"{exc_name}: {hint}"
    return f"Request failed: {exc_name}. Run `ag402 doctor` for diagnostics."


# ─── Tool Implementations ────────────────────────────────────────────

async def handle_fetch_with_autopay(
    middleware: X402PaymentMiddleware,
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: str | None = None,
    max_amount: float | None = None,
) -> str:
    """Execute an HTTP request with automatic x402 payment.

    If the target API returns HTTP 402, the middleware automatically:
    1. Parses the x402 payment challenge
    2. Checks budget limits (6-layer guard)
    3. Deducts from local wallet
    4. Pays on-chain (Solana USDC)
    5. Retries with payment proof

    If max_amount is set, an additional pre-flight check ensures the
    middleware's configured single-tx limit does not exceed the caller's
    requested cap.

    Returns JSON string with response data and payment metadata.
    """
    method = method.upper()
    if method not in ALLOWED_METHODS:
        return _to_json(asdict(FetchResult(error=f"Invalid HTTP method: {method}. Allowed: {', '.join(sorted(ALLOWED_METHODS))}")))

    if not url or not url.startswith(("http://", "https://")):
        return _to_json(asdict(FetchResult(error=f"Invalid URL: {url}. Must start with http:// or https://")))

    # Validate max_amount if provided
    if max_amount is not None:
        if max_amount <= 0:
            return _to_json(asdict(FetchResult(error=f"max_amount must be positive, got {max_amount}")))
        # Validate it's a valid number
        try:
            Decimal(str(max_amount))
        except (InvalidOperation, ValueError):
            return _to_json(asdict(FetchResult(error=f"Invalid max_amount value: {max_amount}")))

    body_bytes: bytes | None = None
    if body:
        body_bytes = body.encode("utf-8")

    try:
        result: MiddlewareResult = await middleware.handle_request(
            method=method,
            url=url,
            headers=headers,
            body=body_bytes,
            max_amount=max_amount,
        )

        body_text = ""
        if result.body:
            try:
                body_text = result.body.decode("utf-8")
            except UnicodeDecodeError:
                body_text = f"<binary data, {len(result.body)} bytes>"

        fetch_result = FetchResult(
            status_code=result.status_code,
            body=body_text,
            headers=result.headers,
            payment_made=result.payment_made,
            amount_paid=_safe_str(result.amount_paid),
            tx_hash=result.tx_hash,
            error=result.error,
        )

        return _to_json(asdict(fetch_result))

    except Exception as e:
        logger.exception("[fetch_with_autopay] Unexpected error")
        return _to_json(asdict(FetchResult(error=_friendly_error(e))))


async def handle_wallet_status(wallet: AgentWallet) -> str:
    """Query wallet balance, daily spend, and budget usage.

    Returns JSON string with wallet status information.
    All monetary values are returned as strings to preserve precision.
    """
    try:
        stats = await wallet.get_summary_stats()

        balance = stats.get("balance", Decimal("0"))
        today_spend = stats.get("today_spend", Decimal("0"))
        total_spend = stats.get("total_spend", Decimal("0"))
        tx_count = stats.get("tx_count", 0)
        minute_spend = await wallet.get_minute_spend()
        minute_count = await wallet.get_minute_count()

        status = {
            "balance": str(balance),
            "today_spend": str(today_spend),
            "total_spend": str(total_spend),
            "transaction_count": tx_count,
            "minute_spend": str(minute_spend),
            "minute_transaction_count": minute_count,
        }

        return _to_json(status)

    except Exception as e:
        logger.exception("[wallet_status] Unexpected error")
        return _to_json({"error": _friendly_error(e)})


async def handle_transaction_history(
    wallet: AgentWallet,
    limit: int = 20,
) -> str:
    """Query recent transaction history.

    Returns JSON string with transaction list.
    """
    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100

    try:
        transactions = await wallet.get_transactions(limit=limit)

        tx_list = []
        for tx in transactions:
            tx_list.append({
                "id": tx.id,
                "type": tx.type,
                "amount": str(tx.amount),
                "to_address": tx.to_address,
                "tx_hash": tx.tx_hash,
                "status": tx.status,
                "timestamp": tx.timestamp,
                "note": tx.note,
            })

        result = {
            "count": len(tx_list),
            "limit": limit,
            "transactions": tx_list,
        }

        return _to_json(result)

    except Exception as e:
        logger.exception("[transaction_history] Unexpected error")
        return _to_json({"error": _friendly_error(e)})
