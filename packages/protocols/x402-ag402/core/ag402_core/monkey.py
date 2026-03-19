"""
ag402.enable() / disable() — process-level monkey-patch for automatic x402 payments.

Patches httpx.AsyncClient.send and requests.Session.send to intercept
HTTP 402 Payment Required responses, auto-pay via the configured provider,
and retry with payment proof.

Design principles:
- Non-402 responses are passed through **completely untouched** (no exception swallowing)
- Original exception stacks are preserved exactly
- Provides enable(), disable(), and enabled() context manager
- Thread-safe via a lock and reference-counted enable/disable
"""

from __future__ import annotations

import asyncio
import contextlib
import contextvars
import functools
import logging
import threading
from collections.abc import Generator
from typing import Any

logger = logging.getLogger(__name__)

# ─── State ───────────────────────────────────────────────────────────

_lock = threading.Lock()
_enable_depth: int = 0  # reference counter — patched while > 0
_patched_httpx: bool = False
_patched_requests: bool = False
_original_httpx_send: Any = None
_original_requests_send: Any = None
_middleware: Any = None  # X402PaymentMiddleware instance (lazy-created)
_middleware_init_lock: asyncio.Lock | None = None  # async lock for init serialization
_thread_pool: Any = None  # shared ThreadPoolExecutor for sync→async bridging

# Re-entrancy guard: prevents middleware's own httpx requests from being
# intercepted by _patched_send, which would cause infinite recursion.
_handling_payment: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "_handling_payment", default=False
)


# ─── Public API ──────────────────────────────────────────────────────


def enable(
    *,
    wallet_db: str | None = None,
    config: Any = None,
) -> None:
    """Enable automatic x402 payment for all HTTP requests in this process.

    Monkey-patches httpx.AsyncClient.send and requests.Session.send.
    Non-402 responses are completely transparent — no behavior change.

    Reference-counted: nested enable() calls are safe. Each enable()
    must be paired with a disable() — patches are removed only when the
    count returns to zero.

    Args:
        wallet_db: Optional wallet DB path. Defaults to ~/.ag402/wallet.db.
        config: Optional X402Config instance. Defaults to load_config().
    """
    global _enable_depth
    with _lock:
        _enable_depth += 1
        if _enable_depth > 1:
            logger.debug("ag402.enable() called (depth=%d)", _enable_depth)
            return

        _ensure_middleware(wallet_db=wallet_db, config=config)
        _patch_httpx()
        _patch_requests()
    logger.info("Ag402 enabled — x402 auto-payment active for all HTTP clients")


def disable() -> None:
    """Disable automatic x402 payment and restore original HTTP behavior.

    Decrements the reference counter. Patches are only removed when the
    counter reaches zero. Safe to call even if not currently enabled (no-op).
    """
    global _enable_depth, _middleware, _middleware_init_lock, _thread_pool
    with _lock:
        if _enable_depth <= 0:
            return

        _enable_depth -= 1
        if _enable_depth > 0:
            logger.debug("ag402.disable() called (depth=%d, still active)", _enable_depth)
            return

        _unpatch_httpx()
        _unpatch_requests()
        _middleware = None
        _middleware_init_lock = None
        if _thread_pool is not None:
            _thread_pool.shutdown(wait=False)
            _thread_pool = None
    logger.info("Ag402 disabled — original HTTP behavior restored")


def is_enabled() -> bool:
    """Check if ag402 auto-payment is currently active."""
    return _enable_depth > 0


@contextlib.contextmanager
def enabled(
    *,
    wallet_db: str | None = None,
    config: Any = None,
) -> Generator[None, None, None]:
    """Context manager for scoped x402 payment.

    Usage::

        with ag402.enabled():
            resp = httpx.get("https://paid-api.example.com/data")
            # 402 responses are auto-paid within this block

        # Outside the block, original behavior is restored
    """
    enable(wallet_db=wallet_db, config=config)
    try:
        yield
    finally:
        disable()


# ─── Middleware initialization ───────────────────────────────────────


def _ensure_middleware(
    *,
    wallet_db: str | None = None,
    config: Any = None,
) -> None:
    """Lazily create the x402 middleware instance."""
    global _middleware
    if _middleware is not None:
        return

    import os

    from ag402_core.config import load_config
    from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
    from ag402_core.payment.registry import PaymentProviderRegistry
    from ag402_core.wallet.agent_wallet import AgentWallet

    if config is None:
        config = load_config()

    db_path = wallet_db or config.wallet_db_path or os.path.expanduser(
        "~/.ag402/wallet.db"
    )

    # Create wallet (sync init — will be async-inited on first use)
    wallet = AgentWallet(db_path=db_path)
    provider = PaymentProviderRegistry.get_provider(config=config)

    _middleware = X402PaymentMiddleware(
        wallet=wallet,
        provider=provider,
        config=config,
    )
    _middleware._wallet_initialized = False  # track if init_db has been called


async def _get_initialized_middleware() -> Any:
    """Get middleware with initialized wallet (async).

    Uses an asyncio.Lock to prevent concurrent callers from both running
    init_db() and auto-depositing test funds at the same time.
    """
    global _middleware, _middleware_init_lock
    if _middleware is None:
        raise RuntimeError("ag402 not enabled — call ag402.enable() first")

    # Fast path: already initialized
    if getattr(_middleware, "_wallet_initialized", False):
        return _middleware

    # Lazy-create the lock (must happen inside an event loop)
    if _middleware_init_lock is None:
        _middleware_init_lock = asyncio.Lock()

    async with _middleware_init_lock:
        # Double-check after acquiring lock
        if getattr(_middleware, "_wallet_initialized", False):
            return _middleware

        await _middleware.wallet.init_db()

        # Auto-deposit test funds if in test mode
        if _middleware.config.is_test_mode:
            balance = await _middleware.wallet.get_balance()
            if balance == 0:
                await _middleware.wallet.deposit(100.0, note="ag402.enable() auto-fund")

        _middleware._wallet_initialized = True

    return _middleware


# ─── httpx monkey-patch ──────────────────────────────────────────────


def _patch_httpx() -> None:
    """Patch httpx.AsyncClient.send to intercept 402 responses."""
    global _patched_httpx, _original_httpx_send

    if _patched_httpx:
        return

    try:
        import httpx
    except ImportError:
        logger.debug("httpx not installed — skipping httpx patch")
        return

    _original_httpx_send = httpx.AsyncClient.send

    @functools.wraps(_original_httpx_send)
    async def _patched_send(self: httpx.AsyncClient, request: httpx.Request, **kwargs: Any) -> httpx.Response:
        """Intercept 402 responses and auto-pay via x402.

        Stream-safe: only reads body for 402 responses. Non-402 responses
        (including streams) are returned completely untouched.
        """
        # Forward the request normally first
        response = await _original_httpx_send(self, request, **kwargs)

        # Only intercept 402 — everything else passes through untouched
        # (safe for streaming: we never call .read()/.json() on non-402 responses)
        if response.status_code != 402 or not is_enabled():
            return response

        # Re-entrancy guard: if we're already handling a payment (i.e. this
        # request was made by the middleware itself), skip interception to
        # prevent infinite recursion.
        if _handling_payment.get():
            return response

        # Check for x402 challenge
        from open402.headers import parse_www_authenticate

        www_auth = response.headers.get("www-authenticate", "")
        challenge = parse_www_authenticate(www_auth)
        if challenge is None:
            # Not an x402 402 — return original response untouched
            return response

        logger.info(
            "[ag402] Intercepted 402 for %s — price: $%s %s",
            str(request.url), challenge.amount, challenge.token,
        )

        # Use the middleware to handle payment + retry
        # Set re-entrancy guard so middleware's internal httpx calls skip interception.
        token = _handling_payment.set(True)
        try:
            mw = await _get_initialized_middleware()
            result = await mw.handle_request(
                method=request.method,
                url=str(request.url),
                headers=dict(request.headers),
                body=request.content if request.content else None,
            )

            if result.payment_made:
                if result.tx_hash == "prepaid":
                    logger.info("[ag402] Prepaid credential used — %s", challenge.token)
                else:
                    logger.info(
                        "[ag402] Paid $%.4f %s — tx: %s",
                        result.amount_paid, challenge.token, result.tx_hash[:16],
                    )

            # Build a new httpx.Response from the middleware result
            return httpx.Response(
                status_code=result.status_code,
                headers=result.headers,
                content=result.body,
                request=request,
            )
        except Exception:
            # If payment handling fails, return the original 402 response
            # DO NOT swallow the exception context — log it for debugging
            logger.exception("[ag402] Payment handling failed — returning original 402")
            return response
        finally:
            _handling_payment.reset(token)

    httpx.AsyncClient.send = _patched_send  # type: ignore[assignment]
    _patched_httpx = True
    logger.debug("httpx.AsyncClient.send patched")


def _unpatch_httpx() -> None:
    """Restore original httpx.AsyncClient.send."""
    global _patched_httpx, _original_httpx_send

    if not _patched_httpx:
        return

    try:
        import httpx

        if _original_httpx_send is not None:
            httpx.AsyncClient.send = _original_httpx_send  # type: ignore[assignment]
    except ImportError:
        pass

    _patched_httpx = False
    _original_httpx_send = None
    logger.debug("httpx.AsyncClient.send restored")


# ─── requests monkey-patch ───────────────────────────────────────────


def _patch_requests() -> None:
    """Patch requests.Session.send to intercept 402 responses."""
    global _patched_requests, _original_requests_send

    if _patched_requests:
        return

    try:
        import requests
    except ImportError:
        logger.debug("requests not installed — skipping requests patch")
        return

    _original_requests_send = requests.Session.send

    @functools.wraps(_original_requests_send)
    def _patched_send(self: requests.Session, request: requests.PreparedRequest, **kwargs: Any) -> requests.Response:
        """Intercept 402 responses and auto-pay via x402 (sync wrapper)."""
        # Forward the request normally first
        response = _original_requests_send(self, request, **kwargs)

        # Only intercept 402 — everything else passes through untouched
        if response.status_code != 402 or not is_enabled():
            return response

        # Check for x402 challenge
        from open402.headers import parse_www_authenticate

        www_auth = response.headers.get("www-authenticate", "")
        challenge = parse_www_authenticate(www_auth)
        if challenge is None:
            return response

        logger.info(
            "[ag402] Intercepted 402 for %s — price: $%s %s",
            request.url, challenge.amount, challenge.token,
        )

        # Run async middleware in a sync context
        # Handle case where we're already inside an event loop (e.g. Jupyter, async frameworks)
        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop is not None and loop.is_running():
                # Already in an async context — schedule as a task using a thread
                global _thread_pool
                if _thread_pool is None:
                    import concurrent.futures
                    _thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                future = _thread_pool.submit(
                    lambda: asyncio.run(_handle_payment_for_requests(
                        method=request.method or "GET",
                        url=request.url or "",
                        headers=dict(request.headers) if request.headers else {},
                        body=request.body,
                    ))
                )
                result = future.result(timeout=60)
            else:
                # No running loop — safe to use asyncio.run()
                result = asyncio.run(_handle_payment_for_requests(
                    method=request.method or "GET",
                    url=request.url or "",
                    headers=dict(request.headers) if request.headers else {},
                    body=request.body,
                ))

            if result is None:
                return response

            if result.payment_made:
                if result.tx_hash == "prepaid":
                    logger.info("[ag402] Prepaid credential used — %s", challenge.token)
                else:
                    logger.info(
                        "[ag402] Paid $%.4f %s — tx: %s",
                        result.amount_paid, challenge.token, result.tx_hash[:16],
                    )

            # Build a new requests.Response from the middleware result
            new_resp = requests.Response()
            new_resp.status_code = result.status_code
            new_resp.headers.update(result.headers)
            new_resp._content = result.body if isinstance(result.body, bytes) else result.body.encode() if result.body else b""
            new_resp.request = request
            new_resp.url = request.url or ""
            new_resp.encoding = new_resp.headers.get(
                "content-type", ""
            ).partition("charset=")[2].partition(";")[0].strip() or "utf-8"
            return new_resp

        except Exception:
            logger.exception("[ag402] Payment handling failed — returning original 402")
            return response

    requests.Session.send = _patched_send  # type: ignore[assignment]
    _patched_requests = True
    logger.debug("requests.Session.send patched")


async def _handle_payment_for_requests(
    method: str, url: str, headers: dict, body: Any,
) -> Any:
    """Async helper for requests monkey-patch."""
    # Set re-entrancy guard so middleware's internal httpx calls skip interception.
    # This is needed because asyncio.run() creates a fresh context where
    # _handling_payment defaults to False.
    token = _handling_payment.set(True)
    try:
        mw = await _get_initialized_middleware()
        body_bytes = None
        if body:
            if isinstance(body, bytes):
                body_bytes = body
            elif isinstance(body, str):
                body_bytes = body.encode()
        return await mw.handle_request(method=method, url=url, headers=headers, body=body_bytes)
    finally:
        _handling_payment.reset(token)


def _unpatch_requests() -> None:
    """Restore original requests.Session.send."""
    global _patched_requests, _original_requests_send

    if not _patched_requests:
        return

    try:
        import requests

        if _original_requests_send is not None:
            requests.Session.send = _original_requests_send  # type: ignore[assignment]
    except ImportError:
        pass

    _patched_requests = False
    _original_requests_send = None
    logger.debug("requests.Session.send restored")
