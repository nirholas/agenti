# Task: Implement Data Privacy and Retention Policies

## Priority: MEDIUM

## Context
Enterprise deployments must comply with data privacy regulations (GDPR, CCPA). The system processes wallet addresses, transaction data, and potentially PII through API keys.

## Requirements
1. **Data classification**: Categorize all stored data:
   - PII: API keys, wallet addresses (if linkable to identity), IP addresses
   - Financial: transaction hashes, amounts, balances
   - Operational: logs, metrics, traces
2. **Data retention policies**:
   - Audit logs: 1 year (configurable)
   - Payment history: 7 years (financial compliance)
   - Request logs: 90 days
   - Metrics: 1 year
   - Session data: 24 hours after last activity
3. **Data deletion**:
   - Implement `DELETE /api/user-data` endpoint for data subject requests
   - Automatic purge of expired data (daily cron job)
   - Cryptographic erasure for encrypted data (destroy key)
4. **Data minimization**:
   - Log only necessary fields
   - Truncate IP addresses in logs (last octet zeroed)
   - Hash wallet addresses in analytics (if not needed for operations)
5. Add privacy policy endpoint: `GET /privacy`
6. Document data flows in a Data Processing Agreement template

## Acceptance Criteria
- [ ] Data classification documented
- [ ] Retention policies enforced automatically
- [ ] Data deletion API implemented
- [ ] IP addresses truncated in logs
- [ ] Privacy policy endpoint serving
