# Task: Implement Comprehensive Audit Trail

## Priority: HIGH

## Context
Enterprise and compliance requirements demand an immutable audit trail of all financial operations, authentication events, and configuration changes.

## Requirements
1. Create an audit logging service that records:
   - **Authentication events**: login, logout, key creation, key revocation
   - **Financial operations**: transfers, swaps, approvals, order placements
   - **Configuration changes**: setting updates, permission changes
   - **Security events**: failed auth attempts, rate limit hits, suspicious activity
2. Audit log entry schema:
   ```typescript
   {
     id: string;
     timestamp: ISO8601;
     traceId: string;
     actor: { type: 'api_key' | 'system'; id: string };
     action: string;
     resource: { type: string; id: string };
     details: Record<string, unknown>;
     result: 'success' | 'failure';
     ip: string;
   }
   ```
3. Audit logs must be:
   - Append-only (no updates or deletes)
   - Tamper-evident (hash chain or signed entries)
   - Queryable by time range, actor, action, and resource
4. Store in database with 1-year retention minimum
5. Support export to SIEM systems (JSON lines format)
6. Add CLI command: `agenti audit query --from 2024-01-01 --action transfer`

## Acceptance Criteria
- [ ] All financial operations logged
- [ ] All auth events logged
- [ ] Append-only, tamper-evident storage
- [ ] Query API and CLI command working
- [ ] SIEM export format supported
