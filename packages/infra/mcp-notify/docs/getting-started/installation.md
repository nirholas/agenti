---
title: Installation
description: Install MCP Notify CLI, server, or deploy to cloud
icon: material/download
---

# Installation

Choose your preferred installation method based on your use case.

## CLI Tool

### Using Go

If you have Go 1.24+ installed:

```bash
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-cli@latest
```

Verify the installation:

```bash
mcp-notify-cli --version
```

### Pre-built Binaries

Download pre-built binaries from the [GitHub Releases](https://github.com/nirholas/mcp-notify/releases) page.

=== ":material-apple: macOS"

    ```bash
    # Intel
    curl -L https://github.com/nirholas/mcp-notify/releases/latest/download/mcp-notify-cli-darwin-amd64.tar.gz | tar xz
    sudo mv mcp-notify-cli /usr/local/bin/

    # Apple Silicon
    curl -L https://github.com/nirholas/mcp-notify/releases/latest/download/mcp-notify-cli-darwin-arm64.tar.gz | tar xz
    sudo mv mcp-notify-cli /usr/local/bin/
    ```

=== ":material-linux: Linux"

    ```bash
    curl -L https://github.com/nirholas/mcp-notify/releases/latest/download/mcp-notify-cli-linux-amd64.tar.gz | tar xz
    sudo mv mcp-notify-cli /usr/local/bin/
    ```

=== ":material-microsoft-windows: Windows"

    ```powershell
    # Download from releases page and add to PATH
    Invoke-WebRequest -Uri "https://github.com/nirholas/mcp-notify/releases/latest/download/mcp-notify-cli-windows-amd64.zip" -OutFile "mcp-notify-cli.zip"
    Expand-Archive -Path "mcp-notify-cli.zip" -DestinationPath "$env:USERPROFILE\bin"
    ```

## Server

### Docker (Recommended)

The fastest way to run the full stack:

```bash
# Clone the repository
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify

# Start all services (app, PostgreSQL, Redis)
docker compose up -d

# View logs
docker compose logs -f mcp-notify
```

The server will be available at `http://localhost:8080`.

### Railway (One-Click Deploy)

Deploy to Railway with PostgreSQL and Redis included:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/nirholas/mcp-notify)

### From Source

```bash
# Clone and build
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify
go build -o mcp-notify ./cmd/mcp-notify

# Run (requires PostgreSQL and Redis)
export DATABASE_URL="postgres://user:pass@localhost:5432/mcpwatch"
export REDIS_URL="redis://localhost:6379/0"
./mcp-notify
```

## MCP Server (for AI Assistants)

Install the MCP server for Claude Desktop or other MCP-compatible AI assistants:

```bash
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-mcp@latest
```

Configure in Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcp-notify": {
      "command": "mcp-notify-mcp"
    }
  }
}
```

## Go SDK

Add to your Go project:

```bash
go get github.com/nirholas/mcp-notify@latest
```

```go
import "github.com/nirholas/mcp-notify/pkg/client"

func main() {
    c := client.New("http://localhost:8080")
    
    servers, _ := c.ListServers(context.Background())
    fmt.Printf("Found %d servers\n", len(servers.Servers))
}
```

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Go | 1.24+ | Latest |
| PostgreSQL | 14+ | 15+ |
| Redis | 6+ | 7+ |
| Docker | 20.10+ | Latest |
| Memory | 256MB | 512MB+ |

## Next Steps

- [Quick Start →](quickstart.md)
- [Create your first subscription →](first-subscription.md)
- [Configuration options →](configuration.md)
