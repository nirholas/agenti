# Task: Add Persistent Database Layer

## Priority: MEDIUM

## Context
Enterprise deployments need durable storage for audit logs, payment history, API key management, and usage analytics. Currently everything is in-memory or lost on restart.

## Requirements
1. Add a database abstraction layer supporting:
   - SQLite (default, zero-config for single-instance)
   - PostgreSQL (for production multi-instance)
2. Use a migration framework (e.g., `drizzle-orm` or `kysely`) for schema management
3. Initial tables:
   - `api_keys`: id, key_hash, permissions, created_at, last_used, revoked_at
   - `audit_log`: id, trace_id, action, actor, details, timestamp
   - `payment_history`: id, service, amount, currency, status, timestamp
   - `daily_limits`: date, total_spent, payment_count
4. Add connection pooling (e.g., 10 connections)
5. Add health check query to `/health` endpoint
6. Implement data retention policies (configurable, default 90 days)
7. Add database backup CLI command

## Acceptance Criteria
- [ ] SQLite works out of the box
- [ ] PostgreSQL supported for production
- [ ] Migrations run automatically on startup
- [ ] Connection pooling configured
- [ ] Data retention policy enforced
