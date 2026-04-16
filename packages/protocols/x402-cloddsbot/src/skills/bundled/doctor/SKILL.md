---
name: doctor
description: "Run system health diagnostics and troubleshoot issues across system resources, Node.js, network, API keys, database, and channels. Use when checking system health, diagnosing connectivity or API key problems, or verifying service status before deployment."
emoji: "🩺"
---

# Doctor - System Diagnostics

Run system diagnostics, check health status, and troubleshoot issues.

## Commands

| Command | Description |
|---------|-------------|
| `/doctor` | Run all diagnostics |
| `/doctor quick` | Quick check (Node.js version + network only) |
| `/doctor <component>` | Check specific component |
| `/health`, `/status` | Quick health status |
| `/status verbose` | Detailed status |

### Components

| Component | What it Tests |
|-----------|---------------|
| `system` | OS, CPU, memory, disk |
| `node` | Node.js version, heap, memory |
| `network` | Internet, DNS, API endpoints |
| `api` | API key validity and quotas |
| `database` | Connection, latency, schema |
| `channels` | Channel connections, health |
| `mcp` | MCP server connections |
| `dependencies` | npm packages, versions |

## Workflow: Pre-Deployment Health Check

1. Run full diagnostics: `/doctor`
2. Check overall status — `healthy`, `degraded`, or `unhealthy`
3. Review any `warn` or `fail` results
4. Fix issues (see Error Recovery below)
5. Re-run `/doctor <component>` for the fixed component to confirm resolution

## Status Levels

| Overall Status | Meaning |
|----------------|---------|
| `healthy` | All checks pass |
| `degraded` | Some warnings, still functional |
| `unhealthy` | Critical failures, action needed |

| Check Result | Meaning |
|--------------|---------|
| `pass` | Check succeeded |
| `warn` | Warning threshold exceeded |
| `fail` | Critical failure |
| `skip` | Check not applicable |

## CLI Usage

```bash
clodds doctor              # Run all diagnostics
clodds doctor --quick      # Critical checks only
clodds doctor --check system  # Specific component
clodds doctor --json       # JSON output for automation
```

## Error Recovery

| Symptom | Diagnostic | Fix |
|---------|-----------|-----|
| `⚠ Memory: 85% used` | `/doctor system` | Restart service or increase available memory |
| `✗ Anthropic API: Invalid key` | `/doctor api` | Check `ANTHROPIC_API_KEY` in `.env` |
| `✗ Database: Connection refused` | `/doctor database` | Check `DATABASE_URL` and ensure PostgreSQL is running |
| `⚠ Telegram: Disconnected` | `/doctor channels` | Check `TELEGRAM_BOT_TOKEN` and network connectivity |
| `✗ Internet: Disconnected` | `/doctor network` | Check host network; verify DNS resolution |

After fixing any issue, re-run the specific check (e.g., `/doctor api`) to confirm it now passes before proceeding.
