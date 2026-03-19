# PRP: ag402 Prepaid System - Phase 1

## Goal
Implement prepaid package data models for the ag402 prepaid system.

## Why
The prepaid system needs structured data models to represent prepaid packages, credentials, and usage logs. These models will be used by both buyer (prepaid_client.py) and seller (prepaid_server.py) components.

## What
Data models for:
- PrepaidPackage: Package definitions with days, calls, price
- PrepaidCredential: Buyer credentials with remaining calls, expiry
- UsageLog: API call logging for billing

### Success Criteria
- [ ] PrepaidPackage dataclass with all required fields
- [ ] PrepaidCredential dataclass with all required fields  
- [ ] UsageLog dataclass with all required fields
- [ ] Package definitions for 5 tiers (3d/7d/30d/365d/730d)
- [ ] JSON serialization/deserialization support
- [ ] Basic validation for model fields

## All Needed Context

### Documentation & References
```yaml
- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/skill.py
  why: Existing data patterns to follow
  sections: lines 40-140 (storage patterns)

- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/PRPs/planning/ag402_prepaid-phase-1_analysis.md
  why: Codebase analysis context
```

### Environment Check
```yaml
model: minimax/MiniMax-M2.5
project_type: Python/OpenClaw Skill
test_command: python -c "import skill; print('OK')"
```

## Implementation Blueprint

### Data Models

CREATE prepaid_models.py:
```python
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional
import json

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
    package_id: str
    name: str
    days: int
    calls: int
    price: float
    created_at: datetime
    
    def to_dict(self) -> dict:
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: dict) -> 'PrepaidPackage':
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)

@dataclass
class PrepaidCredential:
    buyer_address: str
    package_id: str
    remaining_calls: int
    expires_at: datetime
    signature: str
    seller_address: str
    created_at: datetime
    
    def is_valid(self) -> bool:
        return self.remaining_calls > 0 and datetime.now() < self.expires_at
    
    def to_dict(self) -> dict:
        data = asdict(self)
        data['expires_at'] = self.expires_at.isoformat()
        data['created_at'] = self.created_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: dict) -> 'PrepaidCredential':
        data['expires_at'] = datetime.fromisoformat(data['expires_at'])
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)

@dataclass
class UsageLog:
    credential_id: str
    called_at: datetime
    api_endpoint: str
    status: str  # success/failed
    
    def to_dict(self) -> dict:
        data = asdict(self)
        data['called_at'] = self.called_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: dict) -> 'UsageLog':
        data['called_at'] = datetime.fromisoformat(data['called_at'])
        return cls(**data)
```

### Tasks

```yaml
Task 1:
CREATE prepaid_models.py:
  - Define PACKAGES constant with 5 tiers
  - Create PrepaidPackage dataclass
  - Create PrepaidCredential dataclass with is_valid() method
  - Create UsageLog dataclass
  - Add to_dict/from_dict serialization methods

Task 2:
CREATE tests/test_prepaid_models.py:
  - Test PrepaidPackage creation and serialization
  - Test PrepaidCredential.is_valid() for valid/expired/empty
  - Test UsageLog creation
```

## Validation Loop

### Level 1: Syntax
```bash
cd /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill
python -c "from prepaid_models import PrepaidPackage, PrepaidCredential, UsageLog, PACKAGES; print('Import OK')"
```

### Level 2: Unit Tests
```bash
cd /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill
python -m pytest tests/test_prepaid_models.py -v 2>/dev/null || python -c "
from prepaid_models import *
from datetime import datetime, timedelta

# Test PrepaidPackage
pkg = PrepaidPackage('p30d_1000', '30天1000次', 30, 1000, 8.0, datetime.now())
print('Package:', pkg.to_dict())

# Test PrepaidCredential
cred = PrepaidCredential('buyer1', 'p30d_1000', 100, datetime.now() + timedelta(days=30), 'sig', 'seller1', datetime.now())
print('Credential valid:', cred.is_valid())
print('Credential expired:', PrepaidCredential('buyer1', 'p30d_1000', 0, datetime.now() - timedelta(days=1), 'sig', 'seller1', datetime.now()).is_valid())
"
```

## Final Validation Checklist
- [ ] prepaid_models.py created with all 3 dataclasses
- [ ] PACKAGES constant with 5 tiers defined
- [ ] JSON serialization/deserialization works
- [ ] PrepaidCredential.is_valid() correctly checks expiry and remaining calls
- [ ] Import test passes
- [ ] Manual test of model creation works

## Anti-Patterns to Avoid
- Don't add business logic (payment, verification) to models
- Don't use database - use JSON serialization
- Don't create separate files for each model
