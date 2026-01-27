# Security Policy

## Overview

GitHub to MCP takes security seriously. This document outlines our security policies, procedures for reporting vulnerabilities, and the measures we take to protect users.

## Supported Versions

| Version | Supported          | End of Life |
| ------- | ------------------ | ----------- |
| 1.x     | :white_check_mark: | TBD         |

We provide security updates for the latest major version. Users are encouraged to upgrade to the latest version to receive security patches.

## Reporting a Vulnerability

### Process

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: **security@github-to-mcp.dev**
3. Include the following information:
   - Type of vulnerability
   - Full path to the affected file(s)
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Action | Timeline |
|--------|----------|
| Initial acknowledgment | 24 hours |
| Preliminary assessment | 72 hours |
| Resolution target | 30 days (critical), 90 days (other) |
| Public disclosure | After fix is released |

### Recognition

We recognize security researchers who responsibly disclose vulnerabilities:
- Credit in release notes
- Addition to SECURITY_ACKNOWLEDGMENTS.md
- Bug bounty consideration (for critical vulnerabilities)

## Security Measures

### Application Security

#### Input Validation
- All GitHub URLs are validated before processing
- Repository paths are sanitized to prevent path traversal
- User input is escaped before rendering

#### Rate Limiting
- API endpoints implement rate limiting
- GitHub API requests use exponential backoff
- Abuse detection for automated requests

#### Authentication
- GitHub token (optional) uses secure environment variables
- Tokens are never logged or exposed in errors
- Session tokens use secure, httpOnly cookies

### Data Handling

#### Data Collection
We collect only:
- GitHub repository URLs submitted for conversion
- Anonymous usage analytics (can be disabled)
- Error logs for debugging (no PII)

#### Data Storage
- No persistent storage of repository content
- Conversion results are ephemeral (not stored)
- Optional local storage in browser (user-controlled)

#### Data Transmission
- All communications use TLS 1.3
- API responses include security headers
- No data shared with third parties

### Infrastructure Security

#### Deployment
- Automated security scanning in CI/CD
- Dependency vulnerability monitoring (Dependabot)
- Container image scanning (if deployed via Docker)

#### Access Control
- Principle of least privilege
- Regular access audits
- Multi-factor authentication for maintainers

### Code Security

#### Dependency Management
```bash
# Regular security audits
pnpm audit

# Update vulnerable dependencies
pnpm update --latest
```

#### Static Analysis
- TypeScript strict mode enabled
- ESLint security rules
- Automated code scanning via GitHub Advanced Security

### API Security

#### Headers
All responses include:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

#### CORS
- Strict origin validation
- Credentials only for same-origin
- Preflight caching

## Security Configuration

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GITHUB_TOKEN` | GitHub API access | Optional |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | Optional |
| `RATE_LIMIT_MAX` | Max requests per window | Optional |

### Secure Defaults

The application ships with secure defaults:
- Rate limiting enabled
- Security headers enabled
- Error messages sanitized
- Debug mode disabled in production

## Audit Log

### What We Log
- API request timestamps
- Error events (sanitized)
- Rate limit events
- Security-relevant events

### What We DON'T Log
- Full request bodies
- GitHub tokens
- IP addresses (hashed only)
- Personal information

### Log Retention
- Production logs: 30 days
- Security events: 1 year
- Audit logs: 7 years (compliance)

## Compliance

### Standards
- OWASP Top 10 aware
- SOC 2 Type II aligned (roadmap)
- GDPR compliant (EU data handling)

### Certifications
- Planned: SOC 2 Type II
- Planned: ISO 27001

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 - Critical | Active exploitation, data breach | Immediate |
| P2 - High | Vulnerability with exploit potential | 24 hours |
| P3 - Medium | Limited impact vulnerability | 7 days |
| P4 - Low | Hardening improvement | 30 days |

### Response Process

1. **Detection**: Automated monitoring or user report
2. **Triage**: Assess severity and impact
3. **Containment**: Limit exposure if active threat
4. **Remediation**: Develop and test fix
5. **Recovery**: Deploy fix and verify
6. **Post-mortem**: Document lessons learned

## Security Checklist for Contributors

Before submitting code:

- [ ] No hardcoded secrets or credentials
- [ ] User input is validated and sanitized
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies are from trusted sources
- [ ] No use of `eval()` or similar
- [ ] SQL/NoSQL injection prevented (if applicable)
- [ ] CSRF protection in place (if applicable)
- [ ] File uploads validated (if applicable)

## Security Tools

### Recommended for Development

```bash
# Install security linting
pnpm add -D eslint-plugin-security

# Run security audit
pnpm audit

# Check for secrets
npx secretlint .
```

### CI/CD Integration

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run security audit
        run: pnpm audit --audit-level moderate
      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v2
```

## Contact

- **Security Email**: security@github-to-mcp.dev
- **PGP Key**: [Available on request]
- **Response Hours**: 24/7 for P1/P2

---

Last Updated: January 2026
Version: 1.0
