"""ag402 Prepaid System — data models.

Defines prepaid package tiers, credential structure, and validation.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone

# Package definitions — 5 tiers
PACKAGES: dict[str, dict] = {
    "p3d_100":    {"name": "Starter",      "days": 3,   "calls": 100,   "price": 1.5},
    "p7d_500":    {"name": "Basic",        "days": 7,   "calls": 500,   "price": 5.0},
    "p30d_1000":  {"name": "Standard",     "days": 30,  "calls": 1000,  "price": 8.0},
    "p365d_5000": {"name": "Professional", "days": 365, "calls": 5000,  "price": 35.0},
    "p730d_10k":  {"name": "Enterprise",   "days": 730, "calls": 10000, "price": 60.0},
}


@dataclass
class PrepaidCredential:
    """Prepaid credential for API access.

    Issued by seller after USDC payment, stored locally by buyer.
    Presented via X-Prepaid-Credential header instead of on-chain payment.

    The ``signature`` is an HMAC-SHA256 over ``buyer_address|package_id|expires_at``
    using the seller's signing key. It does NOT cover ``remaining_calls`` since
    that value decrements locally on the buyer side after each use.

    All datetime fields are stored as UTC-aware to avoid timezone-related
    expiry errors across DST changes and server relocations.
    """

    buyer_address: str
    package_id: str
    remaining_calls: int
    expires_at: datetime
    signature: str
    seller_address: str
    created_at: datetime

    def is_valid(self) -> bool:
        """True if credential is not expired and has calls remaining."""
        return self.remaining_calls > 0 and datetime.now(timezone.utc) < self._utc(self.expires_at)

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) >= self._utc(self.expires_at)

    def has_calls(self) -> bool:
        return self.remaining_calls > 0

    @staticmethod
    def _utc(dt: datetime) -> datetime:
        """Ensure a datetime is UTC-aware (treat naive as UTC)."""
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def to_dict(self) -> dict:
        data = asdict(self)
        # Always store as UTC ISO string for portability
        data["expires_at"] = self._utc(self.expires_at).isoformat()
        data["created_at"] = self._utc(self.created_at).isoformat()
        return data

    @classmethod
    def from_dict(cls, data: dict) -> PrepaidCredential:
        d = dict(data)
        d["expires_at"] = datetime.fromisoformat(d["expires_at"])
        d["created_at"] = datetime.fromisoformat(d["created_at"])
        return cls(**d)

    def to_header_value(self) -> str:
        """Serialize for X-Prepaid-Credential header."""
        return json.dumps(self.to_dict())

    @classmethod
    def from_header_value(cls, header_value: str) -> PrepaidCredential:
        return cls.from_dict(json.loads(header_value))


def validate_package_id(package_id: str) -> bool:
    return package_id in PACKAGES


def get_package_info(package_id: str) -> dict | None:
    return PACKAGES.get(package_id)


def calculate_expiry(days: int) -> datetime:
    """Return UTC-aware expiry datetime."""
    return datetime.now(timezone.utc) + timedelta(days=days)
