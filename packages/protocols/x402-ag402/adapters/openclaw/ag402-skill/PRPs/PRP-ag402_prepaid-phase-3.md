# PRP: ag402 Prepaid System - Phase 3

## Goal
Implement seller verification service (prepaid_server.py) - validates credentials and processes prepaid API calls.

## Why
Sellers need to verify incoming prepaid credentials, check validity, decrement calls, and return appropriate HTTP responses. This server-side component validates the X-Prepaid-Credential header.

## What
- Verify credential signature and validity
- Memory cache for verified credentials
- Call decrement on successful verification
- Return 200 for valid, 402 for invalid/missing

### Success Criteria
- [ ] PrepaidServer class with verify_and_process method
- [ ] Signature verification (mock for now)
- [ ] In-memory cache for verified credentials
- [ ] Returns proper HTTP responses
- [ ] Integrates with existing 402 flow

## All Needed Context

### Documentation & References
```yaml
- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/prepaid_models.py
  why: Credential data model
- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/skill.py
  why: Existing patterns
```

### Environment Check
```yaml
model: minimax/MiniMax-M2.5
project_type: Python/OpenClaw Skill
```

## Implementation Blueprint

### prepaid_server.py

```python
"""ag402 Prepaid Server - Seller side credential verification."""

import json
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from prepaid_models import PrepaidCredential


@dataclass
class CachedCredential:
    """Cached credential with timestamp."""
    credential: PrepaidCredential
    verified_at: float  # Unix timestamp


class PrepaidServer:
    """Server-side prepaid credential verification."""
    
    def __init__(self, cache_ttl: int = 300):
        """Initialize server.
        
        Args:
            cache_ttl: Cache time-to-live in seconds (default 5 min)
        """
        self._cache: dict[str, CachedCredential] = {}
        self.cache_ttl = cache_ttl
        self.seller_address: Optional[str] = None
    
    def set_seller_address(self, address: str) -> None:
        """Set the seller address for verification."""
        self.seller_address = address
    
    def _get_cache_key(self, credential: PrepaidCredential) -> str:
        """Generate cache key for credential."""
        return f"{credential.buyer_address}:{credential.package_id}"
    
    def _is_cache_valid(self, cached: CachedCredential) -> bool:
        """Check if cached credential is still valid."""
        return time.time() - cached.verified_at < self.cache_ttl
    
    def verify_signature(self, credential: PrepaidCredential) -> bool:
        """Verify credential signature.
        
        In production, this would verify against seller's public key.
        For now, accepts any non-empty signature.
        
        Args:
            credential: Credential to verify
            
        Returns:
            True if signature is valid
        """
        # TODO: Implement proper signature verification
        # For now, accept any non-empty signature
        return bool(credential.signature)
    
    def verify_credential(
        self, 
        credential: PrepaidCredential,
        check_seller: bool = True,
    ) -> tuple[bool, str]:
        """Verify credential validity.
        
        Args:
            credential: Credential to verify
            check_seller: Whether to verify seller address matches
            
        Returns:
            Tuple of (is_valid, reason)
        """
        # Check seller address
        if check_seller and self.seller_address:
            if credential.seller_address != self.seller_address:
                return False, "seller_address_mismatch"
        
        # Check expiry
        if credential.is_expired():
            return False, "credential_expired"
        
        # Check remaining calls
        if not credential.has_calls():
            return False, "no_remaining_calls"
        
        # Verify signature
        if not self.verify_signature(credential):
            return False, "invalid_signature"
        
        return True, "valid"
    
    def get_from_cache(self, credential: PrepaidCredential) -> Optional[PrepaidCredential]:
        """Get credential from cache if valid.
        
        Args:
            credential: Credential to look up
            
        Returns:
            Cached credential if valid, None otherwise
        """
        cache_key = self._get_cache_key(credential)
        cached = self._cache.get(cache_key)
        
        if cached and self._is_cache_valid(cached):
            return cached.credential
        
        return None
    
    def add_to_cache(self, credential: PrepaidCredential) -> None:
        """Add credential to cache.
        
        Args:
            credential: Credential to cache
        """
        cache_key = self._get_cache_key(credential)
        self._cache[cache_key] = CachedCredential(
            credential=credential,
            verified_at=time.time(),
        )
    
    def clear_cache(self) -> None:
        """Clear all cached credentials."""
        self._cache.clear()
    
    def verify_and_process(
        self,
        credential_header: Optional[str],
        check_seller: bool = True,
    ) -> tuple[int, dict]:
        """Verify credential and process request.
        
        Args:
            credential_header: X-Prepaid-Credential header value
            check_seller: Whether to verify seller address
            
        Returns:
            Tuple of (status_code, response_body)
        """
        # No credential provided
        if not credential_header:
            return 402, {
                "error": "payment_required",
                "message": "No prepaid credential provided",
                "x402-payment": json.dumps({
                    "scheme": "prepaid",
                    "message": "Prepaid credential required",
                }),
            }
        
        # Parse credential
        try:
            credential = PrepaidCredential.from_header_value(credential_header)
        except (json.JSONDecodeError, ValueError) as e:
            return 402, {
                "error": "invalid_credential",
                "message": f"Failed to parse credential: {str(e)}",
            }
        
        # Check cache first
        cached = self.get_from_cache(credential)
        if cached:
            # Use cached version
            credential = cached
        else:
            # Verify credential
            is_valid, reason = self.verify_credential(credential, check_seller)
            if not is_valid:
                return 402, {
                    "error": reason,
                    "message": f"Credential verification failed: {reason}",
                }
            
            # Add to cache
            self.add_to_cache(credential)
        
        # Decrement remaining calls
        credential.remaining_calls -= 1
        
        # Return success
        return 200, {
            "status": "success",
            "remaining_calls": credential.remaining_calls,
            "expires_at": credential.expires_at.isoformat(),
        }
    
    def get_cache_stats(self) -> dict:
        """Get cache statistics.
        
        Returns:
            Dict with cache stats
        """
        now = time.time()
        valid_count = sum(
            1 for c in self._cache.values() 
            if self._is_cache_valid(c)
        )
        return {
            "total_cached": len(self._cache),
            "valid_cached": valid_count,
            "cache_ttl": self.cache_ttl,
        }


# Global server instance (for use in gateway/handler)
_server: Optional[PrepaidServer] = None


def get_server() -> PrepaidServer:
    """Get or create global server instance."""
    global _server
    if _server is None:
        _server = PrepaidServer()
    return _server


def process_prepaid_request(
    credential_header: Optional[str],
    seller_address: Optional[str] = None,
) -> tuple[int, dict]:
    """Process prepaid request (convenience function).
    
    Args:
        credential_header: X-Prepaid-Credential header value
        seller_address: Seller address to verify against
        
    Returns:
        Tuple of (status_code, response_body)
    """
    server = get_server()
    if seller_address:
        server.set_seller_address(seller_address)
    
    return server.verify_and_process(credential_header)
```

## Validation

### Test Script
```bash
cd /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill
python3 -c "
from prepaid_server import PrepaidServer, process_prepaid_request
from prepaid_models import PrepaidCredential
from datetime import datetime, timedelta
import json

# Test server
server = PrepaidServer()
server.set_seller_address('test_seller')

# Create test credential
cred = PrepaidCredential(
    buyer_address='buyer1',
    package_id='p30d_1000',
    remaining_calls=100,
    expires_at=datetime.now() + timedelta(days=30),
    signature='test_sig',
    seller_address='test_seller',
    created_at=datetime.now()
)

# Test verification
status, body = server.verify_and_process(cred.to_header_value())
print(f'Status: {status}')
print(f'Body: {body}')

# Test missing credential
status, body = server.verify_and_process(None)
print(f'Missing cred status: {status}')
print(f'Missing cred body: {body}')

# Test cache stats
print('Cache stats:', server.get_cache_stats())

print('All server tests passed')
"
```

## Final Validation Checklist
- [ ] PrepaidServer class created
- [ ] verify_and_process returns 200 for valid credential
- [ ] Returns 402 with proper error for missing/invalid credential
- [ ] Memory cache works correctly
- [ ] Signature verification (mock) works
- [ ] Cache stats available

## Anti-Patterns to Avoid
- Don't implement actual payment processing
- Don't store credentials server-side (stateless verification)
- Don't use database - use in-memory cache only
