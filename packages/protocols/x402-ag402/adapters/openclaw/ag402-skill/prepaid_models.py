"""ag402 Prepaid System - Data Models.

Defines prepaid package, credential, and usage log structures.
"""

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta

# Package definitions - 5 tiers
PACKAGES = {
    "p3d_100": {"name": "3天100次", "days": 3, "calls": 100, "price": 1.5},
    "p7d_500": {"name": "7天500次", "days": 7, "calls": 500, "price": 5.0},
    "p30d_1000": {"name": "30天1000次", "days": 30, "calls": 1000, "price": 8.0},
    "p365d_5000": {"name": "365天5000次", "days": 365, "calls": 5000, "price": 35.0},
    "p730d_10000": {"name": "730天10000次", "days": 730, "calls": 10000, "price": 60.0},
}


@dataclass
class PrepaidPackage:
    """Prepaid package definition."""
    package_id: str
    name: str
    days: int
    calls: int
    price: float
    created_at: datetime

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: dict) -> 'PrepaidPackage':
        """Create from dictionary."""
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)

    @classmethod
    def from_package_id(cls, package_id: str) -> 'PrepaidPackage':
        """Create package from package ID using PACKAGES definition."""
        if package_id not in PACKAGES:
            raise ValueError(f"Unknown package ID: {package_id}")
        pkg = PACKAGES[package_id]
        return cls(
            package_id=package_id,
            name=pkg["name"],
            days=pkg["days"],
            calls=pkg["calls"],
            price=pkg["price"],
            created_at=datetime.now(),
        )


@dataclass
class PrepaidCredential:
    """Prepaid credential for API access."""
    buyer_address: str
    package_id: str
    remaining_calls: int
    expires_at: datetime
    signature: str
    seller_address: str
    created_at: datetime

    def is_valid(self) -> bool:
        """Check if credential is valid (not expired, has remaining calls)."""
        return self.remaining_calls > 0 and datetime.now() < self.expires_at

    def is_expired(self) -> bool:
        """Check if credential is expired."""
        return datetime.now() >= self.expires_at

    def has_calls(self) -> bool:
        """Check if credential has remaining calls."""
        return self.remaining_calls > 0

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['expires_at'] = self.expires_at.isoformat()
        data['created_at'] = self.created_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: dict) -> 'PrepaidCredential':
        """Create from dictionary."""
        data['expires_at'] = datetime.fromisoformat(data['expires_at'])
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)

    def to_header_value(self) -> str:
        """Convert to header value for X-Prepaid-Credential."""
        return json.dumps(self.to_dict())

    @classmethod
    def from_header_value(cls, header_value: str) -> 'PrepaidCredential':
        """Create from header value."""
        return cls.from_dict(json.loads(header_value))


@dataclass
class UsageLog:
    """Usage log entry for API calls."""
    credential_id: str
    called_at: datetime
    api_endpoint: str
    status: str  # success/failed

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['called_at'] = self.called_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: dict) -> 'UsageLog':
        """Create from dictionary."""
        data['called_at'] = datetime.fromisoformat(data['called_at'])
        return cls(**data)


# Validation functions
def validate_package_id(package_id: str) -> bool:
    """Validate package ID exists."""
    return package_id in PACKAGES


def get_package_info(package_id: str) -> dict | None:
    """Get package information by ID."""
    return PACKAGES.get(package_id)


def calculate_expiry(days: int) -> datetime:
    """Calculate expiry date from now + days."""
    return datetime.now() + timedelta(days=days)
