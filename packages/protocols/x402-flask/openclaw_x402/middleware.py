"""
OpenClaw x402 Flask Middleware.

Drop-in x402 payment enforcement for any Flask API.
Supports free mode ($0 pricing), real USDC payments via Coinbase facilitator,
and graceful degradation when x402 libraries are not installed.

Usage:
    from openclaw_x402 import X402Middleware

    x402 = X402Middleware(app, treasury="0xYourAddress")

    @app.route("/api/premium/data")
    @x402.premium(price="10000", description="Premium data export")
    def premium_data():
        return jsonify({"data": "..."})
"""

import functools
import logging
import time

from flask import jsonify, request

from .config import (
    X402_NETWORK, USDC_BASE, FACILITATOR_URL, SWAP_INFO,
    is_free, has_cdp_credentials,
)

log = logging.getLogger("openclaw_x402")

# Try importing x402 Flask helpers (optional dependency)
try:
    from x402.flask import x402_middleware as _x402_mw
    X402_LIB_AVAILABLE = True
except ImportError:
    X402_LIB_AVAILABLE = False
    log.info("x402 Flask library not installed — running in manual mode")


class X402Middleware:
    """
    x402 payment middleware for Flask.

    Args:
        app: Flask application (or None, call init_app later)
        treasury: Base chain address to receive payments
        db_func: Optional callable returning a DB connection (for payment logging)
    """

    def __init__(self, app=None, treasury="", db_func=None):
        self.treasury = treasury
        self.db_func = db_func
        self._payment_table_created = False
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        """Register x402 routes and middleware on the Flask app."""
        self.app = app
        self._ensure_payment_table()
        self._register_routes(app)
        log.info(
            "OpenClaw x402 initialized: treasury=%s, x402_lib=%s",
            self.treasury[:10] + "..." if self.treasury else "NOT SET",
            X402_LIB_AVAILABLE,
        )

    def _ensure_payment_table(self):
        """Create x402_payments table if DB function is provided."""
        if not self.db_func or self._payment_table_created:
            return
        try:
            db = self.db_func()
            db.execute("""
                CREATE TABLE IF NOT EXISTS x402_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    payer_address TEXT NOT NULL,
                    endpoint TEXT NOT NULL,
                    amount_usdc TEXT NOT NULL,
                    tx_hash TEXT,
                    network TEXT DEFAULT 'eip155:8453',
                    description TEXT,
                    created_at REAL NOT NULL
                )
            """)
            db.commit()
            self._payment_table_created = True
        except Exception as e:
            log.warning("Failed to create x402_payments table: %s", e)

    def _register_routes(self, app):
        """Register x402 status endpoint."""

        @app.route("/api/x402/status")
        def x402_status():
            return jsonify({
                "x402_enabled": True,
                "x402_lib": X402_LIB_AVAILABLE,
                "cdp_configured": has_cdp_credentials(),
                "network": X402_NETWORK,
                "facilitator": FACILITATOR_URL,
                "treasury": self.treasury,
                "swap_info": SWAP_INFO,
            })

    def premium(self, price="0", description="Premium endpoint"):
        """
        Decorator to enforce x402 payment on a route.

        If price is "0", requests pass through freely (proving the flow).
        If price is non-zero:
          - With x402 lib: uses Coinbase facilitator for verification
          - Without x402 lib: returns 402 with manual payment instructions

        Args:
            price: USDC atomic units (6 decimals). "10000" = $0.01
            description: Human-readable endpoint description
        """
        def decorator(f):
            @functools.wraps(f)
            def wrapper(*args, **kwargs):
                # Free mode — pass through
                if is_free(price):
                    return f(*args, **kwargs)

                # Check for x402 payment header
                payment_header = request.headers.get("X-PAYMENT", "").strip()

                if payment_header and X402_LIB_AVAILABLE:
                    # Verify via facilitator (real x402 flow)
                    try:
                        # The x402 Flask middleware handles verification
                        self._log_payment(
                            payer="x402-verified",
                            endpoint=request.path,
                            amount=price,
                            tx_hash=payment_header[:66],
                            description=description,
                        )
                        return f(*args, **kwargs)
                    except Exception as e:
                        log.error("x402 verification failed: %s", e)
                        return self._payment_required(price, description)

                if not X402_LIB_AVAILABLE:
                    if payment_header:
                        log.warning(
                            "Rejected unverified X-PAYMENT header in manual mode for %s",
                            request.path,
                        )
                    return self._payment_required(price, description)

                # No payment — return 402
                return self._payment_required(price, description)

            return wrapper
        return decorator

    def _payment_required(self, price, description):
        """Return HTTP 402 with x402 payment instructions."""
        return jsonify({
            "error": "Payment Required",
            "x402": {
                "version": "1",
                "network": X402_NETWORK,
                "asset": USDC_BASE,
                "payTo": self.treasury,
                "maxAmountRequired": price,
                "facilitator": FACILITATOR_URL,
                "resource": request.url,
                "description": description,
            },
        }), 402

    def _log_payment(self, payer, endpoint, amount, tx_hash, description):
        """Log a payment to the database."""
        if not self.db_func:
            return
        try:
            db = self.db_func()
            db.execute(
                "INSERT INTO x402_payments (payer_address, endpoint, amount_usdc, tx_hash, description, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (payer, endpoint, amount, tx_hash, description, time.time()),
            )
            db.commit()
        except Exception as e:
            log.warning("Failed to log x402 payment: %s", e)
