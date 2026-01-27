"""
JWT Authentication for Lyra Intel API.
"""

import base64
import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class TokenPayload:
    """JWT token payload."""
    sub: str  # Subject (user ID)
    iss: str  # Issuer
    aud: str  # Audience
    exp: int  # Expiration timestamp
    iat: int  # Issued at timestamp
    scopes: list
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TokenValidation:
    """Result of token validation."""
    valid: bool
    payload: Optional[TokenPayload] = None
    error: Optional[str] = None


class JWTAuth:
    """
    JWT authentication handler.
    
    Features:
    - Token generation and validation
    - Token refresh
    - Scope-based access control
    - Secure signing with HS256
    """
    
    def __init__(
        self,
        secret_key: str,
        issuer: str = "lyra-intel",
        audience: str = "lyra-intel-api",
        access_token_ttl_minutes: int = 60,
        refresh_token_ttl_days: int = 30,
    ):
        self._secret = secret_key.encode()
        self._issuer = issuer
        self._audience = audience
        self._access_ttl = access_token_ttl_minutes
        self._refresh_ttl = refresh_token_ttl_days
        self._revoked_tokens: set = set()
    
    def generate_access_token(
        self,
        user_id: str,
        scopes: list,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate an access token."""
        now = int(time.time())
        exp = now + (self._access_ttl * 60)
        
        payload = TokenPayload(
            sub=user_id,
            iss=self._issuer,
            aud=self._audience,
            exp=exp,
            iat=now,
            scopes=scopes,
            metadata=metadata or {},
        )
        
        return self._encode_token(payload)
    
    def generate_refresh_token(self, user_id: str) -> str:
        """Generate a refresh token."""
        now = int(time.time())
        exp = now + (self._refresh_ttl * 24 * 60 * 60)
        
        payload = TokenPayload(
            sub=user_id,
            iss=self._issuer,
            aud=self._audience,
            exp=exp,
            iat=now,
            scopes=["refresh"],
            metadata={"type": "refresh"},
        )
        
        return self._encode_token(payload)
    
    def validate_token(self, token: str) -> TokenValidation:
        """Validate a JWT token."""
        try:
            # Split token
            parts = token.split(".")
            if len(parts) != 3:
                return TokenValidation(valid=False, error="Invalid token format")
            
            header_b64, payload_b64, signature_b64 = parts
            
            # Verify signature
            expected_sig = self._sign(f"{header_b64}.{payload_b64}")
            if not hmac.compare_digest(signature_b64, expected_sig):
                return TokenValidation(valid=False, error="Invalid signature")
            
            # Decode payload
            payload_json = base64.urlsafe_b64decode(
                payload_b64 + "=" * (4 - len(payload_b64) % 4)
            ).decode()
            payload_dict = json.loads(payload_json)
            
            # Check expiration
            if payload_dict.get("exp", 0) < time.time():
                return TokenValidation(valid=False, error="Token expired")
            
            # Check issuer and audience
            if payload_dict.get("iss") != self._issuer:
                return TokenValidation(valid=False, error="Invalid issuer")
            
            if payload_dict.get("aud") != self._audience:
                return TokenValidation(valid=False, error="Invalid audience")
            
            # Check if revoked
            if token in self._revoked_tokens:
                return TokenValidation(valid=False, error="Token revoked")
            
            # Build payload object
            payload = TokenPayload(
                sub=payload_dict.get("sub", ""),
                iss=payload_dict.get("iss", ""),
                aud=payload_dict.get("aud", ""),
                exp=payload_dict.get("exp", 0),
                iat=payload_dict.get("iat", 0),
                scopes=payload_dict.get("scopes", []),
                metadata=payload_dict.get("metadata", {}),
            )
            
            return TokenValidation(valid=True, payload=payload)
            
        except Exception as e:
            return TokenValidation(valid=False, error=f"Token validation failed: {e}")
    
    def refresh_access_token(
        self,
        refresh_token: str,
        scopes: Optional[list] = None,
    ) -> Optional[str]:
        """Refresh an access token using a refresh token."""
        validation = self.validate_token(refresh_token)
        
        if not validation.valid:
            logger.warning(f"Invalid refresh token: {validation.error}")
            return None
        
        if validation.payload is None:
            return None
        
        if "refresh" not in validation.payload.scopes:
            logger.warning("Token is not a refresh token")
            return None
        
        # Generate new access token
        return self.generate_access_token(
            user_id=validation.payload.sub,
            scopes=scopes or ["read"],
            metadata=validation.payload.metadata,
        )
    
    def revoke_token(self, token: str):
        """Revoke a token."""
        self._revoked_tokens.add(token)
        logger.info("Token revoked")
    
    def _encode_token(self, payload: TokenPayload) -> str:
        """Encode a payload into a JWT token."""
        # Header
        header = {"alg": "HS256", "typ": "JWT"}
        header_b64 = base64.urlsafe_b64encode(
            json.dumps(header).encode()
        ).decode().rstrip("=")
        
        # Payload
        payload_dict = {
            "sub": payload.sub,
            "iss": payload.iss,
            "aud": payload.aud,
            "exp": payload.exp,
            "iat": payload.iat,
            "scopes": payload.scopes,
            "metadata": payload.metadata,
        }
        payload_b64 = base64.urlsafe_b64encode(
            json.dumps(payload_dict).encode()
        ).decode().rstrip("=")
        
        # Signature
        signature = self._sign(f"{header_b64}.{payload_b64}")
        
        return f"{header_b64}.{payload_b64}.{signature}"
    
    def _sign(self, message: str) -> str:
        """Sign a message with HMAC-SHA256."""
        signature = hmac.new(
            self._secret,
            message.encode(),
            hashlib.sha256
        ).digest()
        return base64.urlsafe_b64encode(signature).decode().rstrip("=")
    
    def has_scope(self, validation: TokenValidation, required_scope: str) -> bool:
        """Check if token has required scope."""
        if not validation.valid or validation.payload is None:
            return False
        
        # Admin scope grants all access
        if "admin" in validation.payload.scopes:
            return True
        
        return required_scope in validation.payload.scopes
    
    def decode_token_without_validation(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode token payload without validating (for debugging)."""
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None
            
            payload_b64 = parts[1]
            payload_json = base64.urlsafe_b64decode(
                payload_b64 + "=" * (4 - len(payload_b64) % 4)
            ).decode()
            return json.loads(payload_json)
        except Exception:
            return None
