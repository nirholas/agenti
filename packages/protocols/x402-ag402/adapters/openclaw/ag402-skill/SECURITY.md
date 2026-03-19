# ag402-skill Security

## Security Features

This document describes the security features implemented in ag402-skill.

### Authentication

The skill uses API key authentication to protect sensitive commands:

- **Protected commands**: `wallet deposit`, `gateway start`, `gateway stop`
- **Public commands**: `wallet status`, `wallet history`, `doctor`

Set the API key via environment variable:
```bash
export AG402_API_KEY=your-secret-key
```

### SSRF Protection

The `pay` command implements comprehensive SSRF protection:

| Protection | Description |
|------------|-------------|
| HTTPS Only | Blocks HTTP protocol |
| Localhost Block | 127.0.0.1, ::1 |
| Private IP Block | 10.x, 172.16-31.x, 192.168.x |
| IPv6 Block | [::ffff:127.0.0.1], etc |
| Decimal IP Block | 2130706433 (=127.0.0.1) |
| Hex IP Block | 0x7F000001 |
| DNS Rebinding | Validates resolved IP |

### Input Validation

- Amount must be positive (> 0)
- Amount must be a valid number
- Maximum amount: 1,000,000

### File Locking

Concurrent operations are protected using `fcntl.flock` to prevent race conditions during balance updates.

### Header Filtering

Only safe headers are allowed. Dangerous headers are blocked:
- Authorization, Cookie, X-Api-Key
- Host, Referer, X-Forwarded-For

## Reporting Security Issues

Please report security vulnerabilities to: **aethercore.dev@proton.me**

Do NOT report via GitHub issues.

## Version History

| Version | Date | Security Changes |
|---------|------|------------------|
| v0.1.18 | 2026-03-17 | 3-round multi-expert audit — 30 fixes: fail-closed DB paths, X402_MODE explicit, signing key ≥32 chars, header injection, SSRF, replay auto-cleanup, 10 MB body cap, SQLite PRAGMA |
| v0.1.12 | 2026-03-06 | Full security audit fixes: SSRF, auth, race condition, input validation, header whitelist |
| v0.1.11 | Earlier | Initial release |
