"""ag402-core: Payment engine for AI Agents.

Quick start::

    import ag402_core
    ag402_core.enable()  # monkey-patch httpx/requests for auto x402 payment

    # Or with context manager:
    with ag402_core.enabled():
        resp = httpx.get("https://paid-api.example.com/data")
"""

__version__ = "0.1.20"

from ag402_core.monkey import disable, enable, enabled, is_enabled

__all__ = ["__version__", "enable", "disable", "enabled", "is_enabled"]
