# PRP: ag402 Prepaid System - Phase 2

## Goal
Implement buyer budget pool management (prepaid_client.py) - local storage and deduction logic.

## Why
Buyers need to store their prepaid credentials locally and use them when making API calls. The client module manages the credential lifecycle: purchase, storage, deduction, and fallback to standard 402.

## What
- Local SQLite/JSON storage for credentials
- Check and deduct from prepaid pool before API calls
- Fallback to standard payment when prepaid exhausted
- Balance query and expiry check

### Success Criteria
- [ ] Credentials stored in ~/.ag402/prepaid_credentials.json
- [ ] Function to find valid credential for a seller
- [ ] Deduct call count atomically
- [ ] Fallback to standard 402 when no valid credential
- [ ] Expiry check on load
- [ ] Works with existing skill.py cmd_pay()

## All Needed Context

### Documentation & References
```yaml
- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/skill.py
  why: Existing storage patterns to follow
  sections: lines 40-140 (storage patterns), lines 200-300 (cmd_pay)

- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/prepaid_models.py
  why: Data models to use
```

### Environment Check
```yaml
model: minimax/MiniMax-M2.5
project_type: Python/OpenClaw Skill
```

## Implementation Blueprint

### prepaid_client.py

```python
"""ag402 Prepaid Client - Buyer side budget pool management."""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from prepaid_models import PrepaidCredential, PACKAGES, calculate_expiry

# Storage path
PREPAID_DIR = Path.home() / ".ag402"
CREDENTIALS_FILE = PREPAID_DIR / "prepaid_credentials.json"


def _ensure_prepaid_dir() -> None:
    """Ensure prepaid directory exists."""
    PREPAID_DIR.mkdir(parents=True, exist_ok=True)


def _load_credentials() -> list[dict]:
    """Load credentials from storage."""
    _ensure_prepaid_dir()
    if not CREDENTIALS_FILE.exists():
        return []
    with open(CREDENTIALS_FILE) as f:
        return json.load(f)


def _save_credentials(credentials: list[dict]) -> None:
    """Save credentials to storage."""
    _ensure_prepaid_dir()
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(credentials, f, indent=2)


def add_credential(credential: PrepaidCredential) -> bool:
    """Add a new credential to local storage."""
    credentials = _load_credentials()
    credentials.append(credential.to_dict())
    _save_credentials(credentials)
    return True


def get_valid_credential(seller_address: str) -> Optional[PrepaidCredential]:
    """Find a valid credential for a seller."""
    credentials = _load_credentials()
    for cred_dict in credentials:
        cred = PrepaidCredential.from_dict(cred_dict)
        if cred.seller_address == seller_address and cred.is_valid():
            return cred
    return None


def deduct_call(seller_address: str) -> tuple[bool, Optional[PrepaidCredential]]:
    """Deduct one call from valid credential. Returns (success, updated_credential)."""
    credentials = _load_credentials()
    for i, cred_dict in enumerate(credentials):
        cred = PrepaidCredential.from_dict(cred_dict)
        if cred.seller_address == seller_address and cred.is_valid():
            # Deduct call
            cred.remaining_calls -= 1
            credentials[i] = cred.to_dict()
            _save_credentials(credentials)
            return True, cred
    return False, None


def get_all_credentials() -> list[PrepaidCredential]:
    """Get all credentials (including expired/invalid)."""
    credentials = _load_credentials()
    return [PrepaidCredential.from_dict(c) for c in credentials]


def remove_credential(buyer_address: str, seller_address: str) -> bool:
    """Remove credential for a buyer-seller pair."""
    credentials = _load_credentials()
    new_creds = [c for c in credentials 
                 if not (c['buyer_address'] == buyer_address and 
                         c['seller_address'] == seller_address)]
    if len(new_creds) < len(credentials):
        _save_credentials(new_creds)
        return True
    return False


def check_and_deduct(seller_address: str) -> tuple[bool, Optional[PrepaidCredential]]:
    """Check if valid credential exists and deduct call. For use before API calls."""
    return deduct_call(seller_address)


def fallback_to_standard_payment(seller_address: str) -> dict:
    """Return info needed for standard 402 payment when prepaid unavailable."""
    return {
        "fallback": True,
        "reason": "no_valid_prepaid_credential",
        "seller_address": seller_address,
    }
```

### Integration with skill.py

MODIFY skill.py cmd_pay():
- Import prepaid_client
- Before making payment, call prepaid_client.check_and_deduct()
- If successful, include credential in request headers
- If failed, proceed with standard 402 payment

### Tasks

```yaml
Task 1:
CREATE prepaid_client.py:
  - Define CREDENTIALS_FILE path
  - Implement _load_credentials, _save_credentials
  - Implement add_credential, get_valid_credential, deduct_call
  - Implement get_all_credentials, remove_credential
  - Implement check_and_deduct and fallback_to_standard_payment

Task 2:
MODIFY skill.py:
  - Import prepaid_client
  - In cmd_pay(), add prepaid check before payment
  - Add X-Prepaid-Credential header if credential available

Task 3:
CREATE tests/test_prepaid_client.py:
  - Test add_credential and get_valid_credential
  - Test deduct_call decrements count
  - Test expiry handling
```

## Validation Loop

### Level 1: Syntax
```bash
cd /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill
python3 -c "from prepaid_client import add_credential, get_valid_credential, deduct_call; print('Import OK')"
```

### Level 2: Functional Test
```bash
python3 -c "
from prepaid_client import add_credential, get_valid_credential, deduct_call, check_and_deduct
from prepaid_models import PrepaidCredential
from datetime import datetime, timedelta

# Add test credential
cred = PrepaidCredential(
    buyer_address='test_buyer',
    packaged_1000_id='p30',
    remaining_calls=5,
    expires_at=datetime.now() + timedelta(days=30),
    signature='test_sig',
    seller_address='test_seller',
    created_at=datetime.now()
)
add_credential(cred)
print('Added credential')

# Check valid
valid = get_valid_credential('test_seller')
print('Valid credential:', valid.remaining_calls if valid else None)

# Deduct
success, updated = deduct_call('test_seller')
print('Deduct success:', success, 'Remaining:', updated.remaining_calls if updated else None)

# Check after deduction
valid2 = get_valid_credential('test_seller')
print('After deduct:', valid2.remaining_calls if valid2 else None)

print('Client tests passed')
"
```

## Final Validation Checklist
- [ ] prepaid_client.py created with all functions
- [ ] Credentials persist to ~/.ag402/prepaid_credentials.json
- [ ] get_valid_credential finds valid (not expired, has calls) credential
- [ ] deduct_call atomically decrements remaining_calls
- [ ] check_and_deduct returns (bool, credential) tuple
- [ ] fallback_to_standard_payment returns fallback info dict
- [ ] Import test passes

## Anti-Patterns to Avoid
- Don't implement payment processing - just credential management
- Don't add seller verification logic (that's prepaid_server.py)
- Don't use different storage location
