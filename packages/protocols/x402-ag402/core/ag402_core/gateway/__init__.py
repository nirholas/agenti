"""Payment Gateway -- server-side payment gating for HTTP APIs."""

from ag402_core.gateway.auth import PaymentVerifier, VerifyResult

__all__ = ["PaymentVerifier", "VerifyResult"]
