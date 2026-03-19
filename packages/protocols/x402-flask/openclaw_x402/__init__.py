"""
OpenClaw x402 — Drop-in x402 payment middleware for Flask APIs.

Usage:
    from openclaw_x402 import X402Middleware

    app = Flask(__name__)
    x402 = X402Middleware(app, treasury="0xYourAddress")

    @app.route("/api/premium/data")
    @x402.premium(price="10000", description="Premium data export")
    def premium_data():
        return jsonify({"data": "..."})
"""

__version__ = "0.1.0"

from .middleware import X402Middleware
from .config import (
    X402_NETWORK, USDC_BASE, WRTC_BASE, AERODROME_POOL,
    FACILITATOR_URL, SWAP_INFO, is_free, has_cdp_credentials,
)

__all__ = [
    "X402Middleware",
    "X402_NETWORK", "USDC_BASE", "WRTC_BASE", "AERODROME_POOL",
    "FACILITATOR_URL", "SWAP_INFO", "is_free", "has_cdp_credentials",
]
