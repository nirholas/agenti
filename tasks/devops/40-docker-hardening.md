# Task: Harden Docker Configuration

## Priority: MEDIUM

## Context
Dockerfile uses `--legacy-peer-deps`, default Grafana password is `admin`, Redis has no authentication, and health checks use HTTP.

## Requirements
1. **Dockerfile improvements**:
   - Remove `--legacy-peer-deps` (fix peer dependency issues properly)
   - Add `--ignore-scripts` to npm install (prevent arbitrary code execution)
   - Pin base image to specific digest (not just tag)
   - Add `.dockerignore` excluding: `.git`, `tests/`, `*.md`, `.env*`, `node_modules/`
   - Run as non-root user (already done, verify)
   - Set `NODE_ENV=production` explicitly
   - Add `HEALTHCHECK` using the `/health` endpoint over HTTPS
2. **Docker Compose improvements**:
   - Remove default Grafana password (`admin`) — require explicit setting
   - Add Redis authentication (`--requirepass` from env var)
   - Add network isolation (separate networks for app, monitoring, data)
   - Add resource limits (memory, CPU) for all services
   - Use Docker secrets instead of environment variables for sensitive data
   - Add restart policies
3. **Security scanning**:
   - Add Trivy or Snyk container scanning to CI
   - Scan for OS-level vulnerabilities in base image
   - Block deployment if CRITICAL vulnerabilities found

## Acceptance Criteria
- [ ] No `--legacy-peer-deps` in Dockerfile
- [ ] Base image pinned to digest
- [ ] Redis authenticated
- [ ] Network isolation configured
- [ ] Container scanning in CI
