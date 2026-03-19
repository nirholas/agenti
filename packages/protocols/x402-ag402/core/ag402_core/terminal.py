"""
Shared terminal utilities — ANSI color helpers with auto-detection.

Centralized module to avoid duplicating color functions across cli.py,
setup_wizard.py, and friendly_errors.py.
"""

from __future__ import annotations

import os
import platform
import sys


def supports_color() -> bool:
    """Check if the terminal supports ANSI colors."""
    if os.getenv("NO_COLOR"):
        return False
    if os.getenv("FORCE_COLOR"):
        return True
    if platform.system() == "Windows":
        return os.getenv("ANSICON") is not None or "WT_SESSION" in os.environ
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()


COLOR_ENABLED = supports_color()


def _c(code: str, text: str) -> str:
    """Wrap text in ANSI color codes if supported."""
    if not COLOR_ENABLED:
        return text
    return f"\033[{code}m{text}\033[0m"


def green(t: str) -> str: return _c("32", t)
def yellow(t: str) -> str: return _c("33", t)
def red(t: str) -> str: return _c("31", t)
def cyan(t: str) -> str: return _c("36", t)
def bold(t: str) -> str: return _c("1", t)
def dim(t: str) -> str: return _c("2", t)
