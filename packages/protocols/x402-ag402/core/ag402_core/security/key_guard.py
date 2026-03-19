"""Private key protection — logging filter and installation.

Three-layer redaction strategy:

1. **Label+value**: redacts values following sensitive key names separated
   by ``=`` or ``:`` (e.g. ``private_key=3abc…`` → ``private_key=[REDACTED]``).
2. **Label-only**: redacts the keyword itself when it appears without a
   separator (e.g. ``"exposed mnemonic in log"`` → ``"exposed [REDACTED] in log"``).
3. **Value-based**: redacts bare base58 strings (64-88 chars) that look like
   Solana private keys regardless of context.
"""

from __future__ import annotations

import logging
import re

from ag402_core.config import PRIVATE_KEY_LOG_PATTERNS

_PATTERNS_ALT = "|".join(re.escape(p) for p in PRIVATE_KEY_LOG_PATTERNS)

# Layer 1: label + separator + value  (e.g. ``private_key=VALUE``, ``mnemonic: words``)
_LABEL_VALUE_RE = re.compile(
    r"(?:" + _PATTERNS_ALT + r")\s*[=:]\s*\S+",
    re.IGNORECASE,
)

# Layer 2: bare label occurrence (no separator — just redact the keyword)
_LABEL_ONLY_RE = re.compile(
    r"(?:" + _PATTERNS_ALT + r")",
    re.IGNORECASE,
)

# Layer 3: base58-encoded Solana private keys (64-88 chars of base58 alphabet)
_BASE58_KEY_RE = re.compile(
    r"(?<![A-Za-z0-9])"
    r"[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{64,88}"
    r"(?![A-Za-z0-9])"
)


def _redact_label_value(m: re.Match) -> str:
    """Replace label=value with label=[REDACTED]."""
    full = m.group(0)
    # Find the separator position (first = or :)
    for i, ch in enumerate(full):
        if ch in ("=", ":"):
            return full[: i + 1] + "[REDACTED]"
    return "[REDACTED]"  # pragma: no cover


def _redact(text: str) -> str:
    """Apply all redaction layers to a string."""
    # Layer 1: label=value or label: value
    text = _LABEL_VALUE_RE.sub(_redact_label_value, text)
    # Layer 2: bare label keywords
    text = _LABEL_ONLY_RE.sub("[REDACTED]", text)
    # Layer 3: bare base58 keys
    text = _BASE58_KEY_RE.sub("[REDACTED]", text)
    return text


def _check_sensitive(text: str) -> bool:
    """Return True if text contains any sensitive pattern or base58 key."""
    return bool(
        _LABEL_ONLY_RE.search(text) or _BASE58_KEY_RE.search(text)
    )


class PrivateKeyFilter(logging.Filter):
    """Logging filter that redacts messages containing private key patterns.

    Uses three layers:
    - Label+value: catches ``private_key=VALUE`` style patterns
    - Label-only: catches bare sensitive keywords
    - Value-based: catches bare base58 strings that look like Solana keys
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, "msg") and isinstance(record.msg, str):
            record.msg = _redact(record.msg)
        if hasattr(record, "args") and record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: "[REDACTED]" if isinstance(v, str) and _check_sensitive(v) else v
                    for k, v in record.args.items()
                }
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    "[REDACTED]" if isinstance(a, str) and _check_sensitive(a) else a
                    for a in record.args
                )
        return True


def install_key_guard() -> None:
    """Install the PrivateKeyFilter on the root logger."""
    root = logging.getLogger()
    if not any(isinstance(f, PrivateKeyFilter) for f in root.filters):
        root.addFilter(PrivateKeyFilter())
