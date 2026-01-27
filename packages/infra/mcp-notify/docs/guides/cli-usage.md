# CLI Usage Guide

Master the `mcp-notify-cli` command-line tool for power users.

## Installation

### Using Go

```bash
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-cli@latest
```

### Download Binary

```bash
# Linux (amd64)
curl -L https://github.com/nirholas/mcp-notify/releases/latest/download/mcp-notify-cli-linux-amd64 -o mcp-notify-cli

# macOS (arm64)
curl -L https://github.com/nirholas/mcp-notify/releases/latest/download/mcp-notify-cli-darwin-arm64 -o mcp-notify-cli

# Windows
curl -L https://github.com/nirholas/mcp-notify/releases/latest/download/mcp-notify-cli-windows-amd64.exe -o mcp-notify-cli.exe

chmod +x mcp-notify-cli
```

### Verify Installation

```bash
mcp-notify-cli version
```

---

## Configuration

### Set API Key

```bash
# Set for current session
export MCP_WATCH_API_KEY="your-api-key"

# Or use config file
mcp-notify-cli config set api-key your-api-key
```

### Set API URL (Self-Hosted)

```bash
export MCP_WATCH_API_URL="https://your-instance.com/api/v1"
# Or
mcp-notify-cli config set api-url https://your-instance.com/api/v1
```

### View Config

```bash
mcp-notify-cli config show
```

---

## Commands Overview

```
mcp-notify-cli
├── changes      # Query registry changes
├── subscriptions # Manage subscriptions
├── servers      # Browse tracked servers
├── config       # CLI configuration
└── version      # Show version info
```

---

## Changes Commands

### List Recent Changes

```bash
# Default: last 50 changes
mcp-notify-cli changes list

# With filters
mcp-notify-cli changes list --limit 10 --type new
mcp-notify-cli changes list --since 24h
mcp-notify-cli changes list --namespace @anthropic
```

### Output Formats

```bash
# Table (default)
mcp-notify-cli changes list

# JSON
mcp-notify-cli changes list --output json

# YAML
mcp-notify-cli changes list --output yaml

# Quiet (IDs only)
mcp-notify-cli changes list --output quiet
```

### Get Change Details

```bash
mcp-notify-cli changes get chg_abc123
```

### Watch Mode

```bash
# Poll for new changes every 30 seconds
mcp-notify-cli changes watch --interval 30s
```

### Statistics

```bash
mcp-notify-cli changes stats --period 7d
```

---

## Subscription Commands

### List Subscriptions

```bash
mcp-notify-cli subscriptions list
mcp-notify-cli subscriptions list --status active
```

### Create Subscription

```bash
# Interactive mode
mcp-notify-cli subscriptions create -i

# With flags
mcp-notify-cli subscriptions create \
  --name "My Alerts" \
  --keywords "ai,ml" \
  --change-types "new,updated" \
  --discord-webhook "https://discord.com/api/webhooks/..."
```

### Get Subscription Details

```bash
mcp-notify-cli subscriptions get sub_xyz789
```

### Update Subscription

```bash
mcp-notify-cli subscriptions update sub_xyz789 \
  --name "Updated Name" \
  --add-keyword "new-keyword"
```

### Pause/Resume

```bash
mcp-notify-cli subscriptions pause sub_xyz789
mcp-notify-cli subscriptions resume sub_xyz789
```

### Test Notification

```bash
mcp-notify-cli subscriptions test sub_xyz789
```

### Delete

```bash
mcp-notify-cli subscriptions delete sub_xyz789
mcp-notify-cli subscriptions delete sub_xyz789 --force  # No confirmation
```

---

## Server Commands

### List Servers

```bash
mcp-notify-cli servers list
mcp-notify-cli servers list --namespace @anthropic
mcp-notify-cli servers list --sort updated --order desc
```

### Search Servers

```bash
mcp-notify-cli servers search "claude"
mcp-notify-cli servers search "database sql"
```

### Get Server Details

```bash
mcp-notify-cli servers get @anthropic/claude-mcp
```

---

## Scripting Examples

### Daily Report Script

```bash
#!/bin/bash
# daily-mcp-report.sh

echo "=== MCP Registry Daily Report ==="
echo "Generated: $(date)"
echo ""

echo "## New Servers (Last 24h)"
mcp-notify-cli changes list --type new --since 24h --output json | jq -r '.changes[].server_name'

echo ""
echo "## Updated Servers (Last 24h)"
mcp-notify-cli changes list --type updated --since 24h --output json | jq -r '.changes[].server_name'

echo ""
echo "## Statistics"
mcp-notify-cli changes stats --period 24h --output json | jq '.summary'
```

### Monitor and Alert

```bash
#!/bin/bash
# monitor-namespace.sh

NAMESPACE="@myorg"
WEBHOOK="https://discord.com/api/webhooks/..."

while true; do
  NEW_CHANGES=$(mcp-notify-cli changes list --namespace "$NAMESPACE" --since 5m --output json | jq '.total')
  
  if [ "$NEW_CHANGES" -gt 0 ]; then
    echo "Found $NEW_CHANGES new changes!"
    # Could trigger additional alerts here
  fi
  
  sleep 300  # Check every 5 minutes
done
```

### Export Changes to CSV

```bash
mcp-notify-cli changes list --since 7d --output json | \
  jq -r '.changes[] | [.detected_at, .change_type, .server_name, .new_version] | @csv' > changes.csv
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MCP_WATCH_API_KEY` | API key for authentication |
| `MCP_WATCH_API_URL` | API base URL |
| `MCP_WATCH_OUTPUT` | Default output format |
| `MCP_WATCH_NO_COLOR` | Disable colored output |

---

## Tips & Tricks

### Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias mcpw="mcp-notify-cli"
alias mcpw-new="mcp-notify-cli changes list --type new --since 24h"
alias mcpw-watch="mcp-notify-cli changes watch --interval 60s"
```

### Completion

```bash
# Bash
mcp-notify-cli completion bash > /etc/bash_completion.d/mcp-notify-cli

# Zsh
mcp-notify-cli completion zsh > "${fpath[1]}/_mcp-notify-cli"

# Fish
mcp-notify-cli completion fish > ~/.config/fish/completions/mcp-notify-cli.fish
```

### Quiet Mode for Scripts

```bash
# Only output IDs for piping
mcp-notify-cli changes list --output quiet | while read id; do
  mcp-notify-cli changes get "$id" --output json >> all-changes.json
done
```

---

## Troubleshooting

### "API key not configured"

```bash
mcp-notify-cli config set api-key your-api-key
# Or
export MCP_WATCH_API_KEY="your-api-key"
```

### "Connection refused"

Check your API URL:
```bash
mcp-notify-cli config show
curl -v $(mcp-notify-cli config get api-url)/health
```

### Verbose Mode

```bash
mcp-notify-cli --verbose changes list
```
