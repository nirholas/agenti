"""
Retry utilities with exponential backoff for RPC calls.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def retry_with_backoff(
    func: Callable[..., Any],
    *args: Any,
    max_retries: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 10.0,
    label: str = "operation",
    **kwargs: Any,
) -> Any:
    """
    Retry an async function with exponential backoff.

    Args:
        func: Async function to call
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries (seconds)
        max_delay: Maximum delay cap (seconds)
        label: Label for logging
    """
    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except Exception as exc:
            last_error = exc
            if attempt < max_retries:
                delay = min(base_delay * (2 ** attempt), max_delay)
                logger.warning(
                    "[RETRY] %s failed (attempt %d/%d): %s — retrying in %.1fs",
                    label, attempt + 1, max_retries + 1, exc, delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "[RETRY] %s failed after %d attempts: %s",
                    label, max_retries + 1, exc,
                )
    raise last_error  # type: ignore[misc]


class MultiEndpointClient:
    """
    Manages multiple RPC endpoints with automatic failover.

    Primary endpoint is tried first. If it fails, switches to backup.
    Periodically re-tries primary to recover.
    """

    def __init__(self, primary_url: str, backup_urls: list[str] | None = None):
        self._endpoints = [primary_url] + (backup_urls or [])
        self._current_index = 0

    @property
    def current_url(self) -> str:
        return self._endpoints[self._current_index]

    def failover(self) -> str | None:
        """Switch to next endpoint. Returns new URL or None if exhausted."""
        if self._current_index < len(self._endpoints) - 1:
            self._current_index += 1
            new_url = self._endpoints[self._current_index]
            logger.warning("[FAILOVER] Switching RPC to: %s", new_url)
            return new_url
        return None

    def reset(self) -> None:
        """Reset to primary endpoint."""
        self._current_index = 0
