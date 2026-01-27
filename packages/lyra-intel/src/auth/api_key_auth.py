"""
API Key Authentication for Lyra Intel API.
"""

import hashlib
import hmac
import logging
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


@dataclass
class APIKey:
    """Represents an API key."""
    key_id: str
    key_hash: str  # Hashed key (never store plaintext)
    name: str
    owner: str
    scopes: Set[str]
    rate_limit: int  # Requests per hour
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime] = None
    is_active: bool = True


@dataclass
class APIKeyValidation:
    """Result of API key validation."""
    valid: bool
    key_id: Optional[str] = None
    owner: Optional[str] = None
    scopes: Set[str] = field(default_factory=set)
    error: Optional[str] = None


class APIKeyAuth:
    """
    API Key authentication manager.
    
    Features:
    - Key generation and validation
    - Scope-based access control
    - Key rotation support
    - Audit logging
    """
    
    def __init__(self, secret_key: str = ""):
        self._secret = secret_key or secrets.token_hex(32)
        self._keys: Dict[str, APIKey] = {}
        self._prefix = "lyra_"
    
    def generate_key(
        self,
        name: str,
        owner: str,
        scopes: Optional[List[str]] = None,
        rate_limit: int = 1000,
        expires_in_days: Optional[int] = None,
    ) -> tuple[str, APIKey]:
        """
        Generate a new API key.
        
        Returns tuple of (plaintext_key, APIKey object).
        The plaintext key should only be shown once to the user.
        """
        # Generate key components
        key_id = secrets.token_hex(8)
        key_secret = secrets.token_hex(24)
        
        # Full key: prefix + id + secret
        plaintext_key = f"{self._prefix}{key_id}_{key_secret}"
        
        # Hash the key for storage
        key_hash = self._hash_key(plaintext_key)
        
        # Set expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        # Create API key object
        api_key = APIKey(
            key_id=key_id,
            key_hash=key_hash,
            name=name,
            owner=owner,
            scopes=set(scopes or ["read"]),
            rate_limit=rate_limit,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
        )
        
        # Store the key
        self._keys[key_id] = api_key
        
        logger.info(f"Generated API key '{name}' for {owner}")
        
        return plaintext_key, api_key
    
    def validate_key(self, key: str) -> APIKeyValidation:
        """Validate an API key."""
        # Check format
        if not key.startswith(self._prefix):
            return APIKeyValidation(valid=False, error="Invalid key format")
        
        # Extract key_id
        try:
            parts = key[len(self._prefix):].split("_")
            if len(parts) != 2:
                return APIKeyValidation(valid=False, error="Invalid key format")
            
            key_id = parts[0]
        except (ValueError, IndexError):
            return APIKeyValidation(valid=False, error="Invalid key format")
        
        # Find stored key
        stored_key = self._keys.get(key_id)
        if not stored_key:
            return APIKeyValidation(valid=False, error="Key not found")
        
        # Verify hash
        if not self._verify_key(key, stored_key.key_hash):
            return APIKeyValidation(valid=False, error="Invalid key")
        
        # Check if active
        if not stored_key.is_active:
            return APIKeyValidation(valid=False, error="Key is deactivated")
        
        # Check expiration
        if stored_key.expires_at and datetime.utcnow() > stored_key.expires_at:
            return APIKeyValidation(valid=False, error="Key has expired")
        
        # Update last used
        stored_key.last_used = datetime.utcnow()
        
        return APIKeyValidation(
            valid=True,
            key_id=stored_key.key_id,
            owner=stored_key.owner,
            scopes=stored_key.scopes,
        )
    
    def _hash_key(self, key: str) -> str:
        """Hash an API key for storage."""
        return hashlib.sha256(
            (key + self._secret).encode()
        ).hexdigest()
    
    def _verify_key(self, key: str, stored_hash: str) -> bool:
        """Verify a key against its stored hash."""
        computed_hash = self._hash_key(key)
        return hmac.compare_digest(computed_hash, stored_hash)
    
    def revoke_key(self, key_id: str) -> bool:
        """Revoke an API key."""
        if key_id in self._keys:
            self._keys[key_id].is_active = False
            logger.info(f"Revoked API key {key_id}")
            return True
        return False
    
    def rotate_key(
        self,
        key_id: str,
        grace_period_hours: int = 24,
    ) -> Optional[tuple[str, APIKey]]:
        """
        Rotate an API key.
        
        Creates a new key and sets the old one to expire after grace period.
        """
        old_key = self._keys.get(key_id)
        if not old_key:
            return None
        
        # Generate new key with same settings
        new_key_plaintext, new_key = self.generate_key(
            name=f"{old_key.name} (rotated)",
            owner=old_key.owner,
            scopes=list(old_key.scopes),
            rate_limit=old_key.rate_limit,
        )
        
        # Set old key to expire after grace period
        old_key.expires_at = datetime.utcnow() + timedelta(hours=grace_period_hours)
        
        logger.info(f"Rotated API key {key_id} -> {new_key.key_id}")
        
        return new_key_plaintext, new_key
    
    def has_scope(self, validation: APIKeyValidation, required_scope: str) -> bool:
        """Check if a validated key has a required scope."""
        if not validation.valid:
            return False
        
        # Admin scope grants all access
        if "admin" in validation.scopes:
            return True
        
        # Wildcard scope matching
        for scope in validation.scopes:
            if scope == required_scope:
                return True
            if scope.endswith("*") and required_scope.startswith(scope[:-1]):
                return True
        
        return False
    
    def list_keys(self, owner: Optional[str] = None) -> List[APIKey]:
        """List API keys, optionally filtered by owner."""
        keys = list(self._keys.values())
        
        if owner:
            keys = [k for k in keys if k.owner == owner]
        
        return keys
    
    def get_key_info(self, key_id: str) -> Optional[Dict[str, Any]]:
        """Get info about a key (without the hash)."""
        key = self._keys.get(key_id)
        if not key:
            return None
        
        return {
            "key_id": key.key_id,
            "name": key.name,
            "owner": key.owner,
            "scopes": list(key.scopes),
            "rate_limit": key.rate_limit,
            "created_at": key.created_at.isoformat(),
            "expires_at": key.expires_at.isoformat() if key.expires_at else None,
            "last_used": key.last_used.isoformat() if key.last_used else None,
            "is_active": key.is_active,
        }
