"""ag402-openclaw: Ag402 adapter for OpenClaw.

Bridges Ag402 x402 auto-payment into the OpenClaw agent framework via
mcporter. OpenClaw agents can call paid HTTP APIs transparently — the
adapter handles 402 negotiation, payment, and retry behind the scenes.

Integration via mcporter (recommended):
    mcporter config add ag402 \
        --command python -m ag402_openclaw.bridge \
        --scope home

Or use the ag402 CLI:
    ag402 install openclaw

Configuration:
    The bridge supports configuration via:
    - Environment variables (prefix: AG402_*)
    - JSON config file (--config flag)

    Key settings:
    - AG402_BRIDGE_MODE: test|production (default: test)
    - AG402_DAILY_LIMIT: daily spend limit in USD (default: 10.0)
    - AG402_SINGLE_TX_LIMIT: single transaction limit (default: 5.0)
    - AG402_PER_MINUTE_LIMIT: per-minute limit (default: 2.0)
    - AG402_MAX_RETRIES: max retry attempts (default: 3)
    - AG402_TIMEOUT: request timeout in seconds (default: 30.0)
    - AG402_BUDGET_CHECK: enable budget checks (default: true)
    - AG402_CONFIRM_PAYMENT: require payment confirmation (default: false)
    - AG402_AUDIT_LOG: enable audit logging (default: true)
"""

__version__ = "0.1.10"

from ag402_openclaw.bridge import (
    AtomicBalance,
    BudgetState,
    OpenClawBridge,
    _is_url_safe,
    confirm_payment,
)

__all__ = [
    "__version__",
    "OpenClawBridge",
    "BudgetState",
    "AtomicBalance",
    "confirm_payment",
    "_is_url_safe",
]
