"""
Friendly error messages — translates technical errors into human-readable
guidance with actionable next steps.

Wraps the CLI entry point to catch common exceptions and display
"what went wrong" + "what to do next" instead of raw tracebacks.
"""

from __future__ import annotations

import os
import re
import sys
from collections.abc import Callable

from ag402_core.terminal import red, yellow

# ─── Error pattern registry ─────────────────────────────────────────

_ERROR_HANDLERS: list[tuple[type, str, str]] = []


def _register(exc_type: type, message: str, hint: str) -> None:
    _ERROR_HANDLERS.append((exc_type, message, hint))


# FileNotFoundError for wallet
_register(
    FileNotFoundError,
    "Wallet file not found",
    "Run `ag402 setup` to create a wallet and configure your environment",
)


def _match_error(exc: BaseException) -> tuple[str, str] | None:
    """Match an exception to a friendly message + hint."""
    exc_str = str(exc).lower()
    exc_str_raw = str(exc)  # preserve original case for numeric parsing

    # Special patterns by message content
    if isinstance(exc, FileNotFoundError):
        if "wallet" in exc_str or ".ag402" in exc_str:
            return (
                "Wallet file not found",
                "Run `ag402 setup` to create a wallet and configure your environment",
            )
        return None

    if isinstance(exc, ConnectionError) or "connection" in exc_str:
        if "solana" in exc_str or "rpc" in exc_str:
            return (
                "Cannot connect to Solana RPC",
                "Verify your RPC URL with `ag402 env show`, then run `ag402 doctor` to diagnose. For local testing: `ag402 demo --localnet`",
            )
        if "8899" in exc_str:
            return (
                "Cannot connect to local Solana validator",
                "Start the validator with `solana-test-validator --reset`, then retry",
            )
        return (
            "Network connection failed",
            "Run `ag402 doctor` to diagnose, or check your RPC URL with `ag402 env show`",
        )

    if isinstance(exc, TimeoutError) or "timeout" in exc_str or "timed out" in exc_str:
        if "solana" in exc_str or "rpc" in exc_str or "devnet" in exc_str:
            return (
                "Solana RPC timed out (network may be congested)",
                "Check your RPC URL with `ag402 env show`, or run `ag402 doctor`. For stable local testing: `ag402 demo --localnet`",
            )
        return (
            "Operation timed out",
            "Run `ag402 doctor` to check connectivity, or retry. For local testing: `ag402 demo --localnet`",
        )

    if isinstance(exc, PermissionError):
        return (
            "Permission denied accessing ~/.ag402/ directory",
            "Run `ag402 doctor` to check file permissions, or `ag402 setup` to reinitialize",
        )

    if isinstance(exc, ImportError):
        module = str(exc).split("'")[1] if "'" in str(exc) else str(exc)
        return (
            f"Missing dependency: {module}",
            f"Run `pip install ag402-core[all]` to install all dependencies, or `pip install {module}` for just this package",
        )

    # InsufficientBalance — "Balance X < requested Y"
    if "insufficient balance" in exc_str or (
        "balance" in exc_str and "<" in exc_str_raw and "requested" in exc_str
    ):
        # Try to extract balance and requested amounts for a precise message
        m = re.search(r"balance\s+([\d.]+)\s*<\s*requested\s+([\d.]+)", exc_str_raw, re.IGNORECASE)
        if m:
            have = float(m.group(1))
            need = float(m.group(2))
            shortfall = need - have
            return (
                f"Insufficient wallet balance: have ${have:.4f}, need ${need:.4f} (short ${shortfall:.4f})",
                "Run `ag402 balance` to check your current balance, or `ag402 init` to auto-fund a test wallet",
            )
        return (
            "Insufficient wallet balance",
            "Run `ag402 balance` to see your current balance, or `ag402 init` to auto-fund a test wallet",
        )

    # DailyLimitExceeded — "Daily spend X + Y > limit Z"
    if "daily limit" in exc_str or "daily_limit" in exc_str or (
        "daily spend" in exc_str and ">" in exc_str_raw
    ):
        m = re.search(
            r"daily spend\s+([\d.]+)\s*\+\s*([\d.]+)\s*>\s*limit\s+([\d.]+)",
            exc_str_raw,
            re.IGNORECASE,
        )
        if m:
            spent = float(m.group(1))
            requested = float(m.group(2))
            limit = float(m.group(3))
            return (
                f"Daily spending limit reached: spent ${spent:.2f} + request ${requested:.2f} > limit ${limit:.2f}",
                "Run `ag402 config` to view current limits, or set X402_DAILY_LIMIT=<amount> in your .env to increase",
            )
        return (
            "Daily spending limit reached",
            "Run `ag402 config` to view your current limits, or set X402_DAILY_LIMIT=<amount> in your .env to increase",
        )

    if "password" in exc_str and ("wrong" in exc_str or "invalid" in exc_str):
        return (
            "Incorrect wallet password",
            "Verify your password, or set AG402_UNLOCK_PASSWORD in your .env file. Run `ag402 env show` to check current config",
        )

    # Configuration / missing key errors
    if (
        "config" in exc_str and ("missing" in exc_str or "not set" in exc_str or "required" in exc_str)
    ) or (
        "private key" in exc_str and ("missing" in exc_str or "not set" in exc_str or "not configured" in exc_str)
    ) or (
        "not configured" in exc_str and ("wallet" in exc_str or "rpc" in exc_str or "key" in exc_str)
    ):
        return (
            "Configuration incomplete",
            "Run `ag402 setup` for guided setup, or `ag402 env show` to see what is missing. Use `ag402 doctor` to validate your environment",
        )

    return None


def friendly_cli_wrapper(main_func: Callable) -> Callable:
    """Wrap a CLI main() function with friendly error handling.

    Usage::

        @friendly_cli_wrapper
        def main():
            ...
    """
    def wrapper(*args, **kwargs):
        try:
            return main_func(*args, **kwargs)
        except KeyboardInterrupt:
            print(f"\n  {yellow('⚠')} Operation cancelled")
            sys.exit(130)
        except SystemExit:
            raise  # Don't catch SystemExit
        except Exception as exc:
            matched = _match_error(exc)
            if matched:
                message, hint = matched
                print()
                print(f"  {red('✗')} {message}")
                print(f"  → {hint}")
                print()
            else:
                # Unknown error: show a condensed traceback
                print()
                print(f"  {red('✗')} Unexpected error: {type(exc).__name__}: {exc}")
                print("  → Run `ag402 doctor` to diagnose")
                print("  → If the issue persists, please file an issue on GitHub")
                print()

                # Show traceback if DEBUG
                if os.getenv("AG402_DEBUG"):
                    import traceback
                    traceback.print_exc()

            sys.exit(1)

    return wrapper
