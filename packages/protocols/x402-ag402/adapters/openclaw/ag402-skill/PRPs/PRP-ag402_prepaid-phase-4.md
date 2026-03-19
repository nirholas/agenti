# PRP: ag402 Prepaid System - Phase 4

## Goal
Final integration testing and fallback mechanism - ensure prepaid system works end-to-end and falls back to standard 402 when prepaid is exhausted.

## Why
This phase ensures the complete prepaid flow works: buyer purchases → stores credential → uses for API calls → system falls back to standard payment when prepaid runs out.

## What
- End-to-end integration test
- Fallback to standard 402 when prepaid exhausted
- Error handling for edge cases
- Documentation updates

### Success Criteria
- [ ] End-to-end flow: buy → store → use → deduct works
- [ ] Fallback to standard 402 when no prepaid available
- [ ] Proper error messages
- [ ] All modules import correctly together
- [ ] Documentation complete

## All Needed Context

### Documentation & References
```yaml
- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/prepaid_models.py
- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/prepaid_client.py
- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/prepaid_server.py
- file: /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill/skill.py (modified)
```

### Environment Check
```yaml
model: minimax/MiniMax-M2.5
project_type: Python/OpenClaw Skill
```

## Implementation Tasks

### Task 1: Verify all imports work together
```python
# Test all modules import together
from prepaid_models import PrepaidPackage, PrepaidCredential, PACKAGES
from prepaid_client import add_credential, get_valid_credential, deduct_call, check_and_deduct
from prepaid_server import PrepaidServer, process_prepaid_request

print("All imports OK")
```

### Task 2: End-to-End Flow Test
```python
# Simulate complete flow:
# 1. Buyer purchases package → gets credential
# 2. Credential stored locally
# 3. Buyer makes API call → deduct from prepaid
# 4. Seller verifies credential → processes call
# 5. Prepaid exhausted → fallback to 402

from prepaid_client import create_credential_for_purchase, get_valid_credential
from prepaid_server import PrepaidServer
from prepaid_models import PrepaidCredential

# 1. Purchase
buyer_addr = "buyer_test"
seller_addr = "api_provider_1"
cred = create_credential_for_purchase(buyer_addr, "p7d_500", seller_addr, "seller_signature")
print(f"Purchased: {cred.remaining_calls} calls")

# 2. Check valid
valid = get_valid_credential(seller_addr)
print(f"Valid credential: {valid is not None}")

# 3. Make call (deduct)
success, updated = deduct_call(seller_addr)
print(f"After call: {updated.remaining_calls} remaining")

# 4. Seller verify
server = PrepaidServer()
server.set_seller_address(seller_addr)
status, body = server.verify_and_process(updated.to_header_value())
print(f"Seller verification: {status}")

# 5. Fallback test - no credential
from prepaid_client import fallback_to_standard_payment
fallback = fallback_to_standard_payment("unknown_seller")
print(f"Fallback: {fallback}")
```

### Task 3: Error Handling Test
- Test with invalid package ID
- Test with malformed credential header
- Test with missing required fields

### Task 4: Update SKILL.md with prepaid commands

## Validation

```bash
cd /Users/allenenli/Documents/ag402/adapters/openclaw/ag402-skill
python3 -c "
# Full integration test
print('=== Integration Test ===')
"

# Test fallback when prepaid exhausted
python3 -c "
from prepaid_client import deduct_call, check_and_deduct
from prepaid_models import PrepaidCredential
from datetime import datetime, timedelta

# Add credential with 1 call
cred = PrepaidCredential(
    buyer_address='test_fallback',
    package_id='p3d_100',
    remaining_calls=1,
    expires_at=datetime.now() + timedelta(days=30),
    signature='sig',
    seller_address='fallback_test_seller',
    created_at=datetime.now()
)
add_credential(cred)

# First call succeeds
success, _ = deduct_call('fallback_test_seller')
print(f'First call: success={success}')

# Second call should fail (no valid credential)
success2, _ = deduct_call('fallback_test_seller')
print(f'Second call: success={success2} (should be False)')

# Fallback should be triggered
from prepaid_client import fallback_to_standard_payment
fb = fallback_to_standard_payment('fallback_test_seller')
print(f'Fallback: {fb}')
"
```

## Final Validation Checklist
- [ ] All 4 modules import without errors
- [ ] End-to-end flow works: purchase → store → use → verify
- [ ] Fallback returns correct error when no prepaid
- [ ] Error handling for invalid inputs
- [ ] skill.py prepaid commands work
- [ ] Documentation updated

## Anti-Patterns to Avoid
- Don't skip any validation steps
- Don't break existing functionality
- Don't add untested code
