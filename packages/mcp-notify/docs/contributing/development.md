---
title: Development Guide
description: Set up your development environment for MCP Notify
icon: material/code-braces
---

# Development Guide

Set up your local development environment.

## Prerequisites

- **Go 1.24+**: [Install Go](https://go.dev/dl/)
- **Docker**: [Install Docker](https://docs.docker.com/get-docker/)
- **Make**: Usually pre-installed on macOS/Linux

## Setup

### 1. Clone Repository

```bash
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify
```

### 2. Install Dependencies

```bash
make setup
```

This installs:

- Go module dependencies
- Development tools (golangci-lint, etc.)
- Git hooks

### 3. Start Services

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Or start everything including the app
make dev
```

### 4. Run the Application

```bash
# With hot reload
make dev

# Without hot reload
go run ./cmd/mcp-notify
```

## Project Structure

```
.
├── api/                 # OpenAPI specification
├── cmd/                 # Application entrypoints
│   ├── mcp-notify/       # Main server
│   ├── mcp-notify-cli/   # CLI tool
│   └── mcp-notify-mcp/  # MCP server
├── internal/            # Private packages
│   ├── api/             # HTTP server
│   ├── config/          # Configuration
│   ├── db/              # Database layer
│   ├── diff/            # Diff engine
│   ├── notifier/        # Notification senders
│   ├── poller/          # Registry poller
│   └── subscription/    # Subscription manager
├── pkg/                 # Public packages
│   ├── client/          # Go SDK
│   └── types/           # Shared types
├── web/                 # Frontend dashboard
└── docs/                # Documentation
```

## Make Commands

| Command | Description |
|---------|-------------|
| `make build` | Build all binaries |
| `make test` | Run tests |
| `make lint` | Run linters |
| `make dev` | Start development server |
| `make docker` | Build Docker image |
| `make docs` | Serve documentation locally |
| `make clean` | Clean build artifacts |

## Configuration

Copy the example config:

```bash
cp config.example.yaml config.yaml
```

Key settings for development:

```yaml
server:
  port: 8080
  
database:
  url: postgres://postgres:postgres@localhost:5432/mcp_notify?sslmode=disable
  
redis:
  url: redis://localhost:6379
  
log:
  level: debug
  format: text
```

## Database

### Migrations

```bash
# Run migrations
make migrate-up

# Rollback
make migrate-down

# Create new migration
make migrate-create name=add_new_table
```

### Reset Database

```bash
docker compose down -v
docker compose up -d postgres
make migrate-up
```

## Testing

### Unit Tests

```bash
make test

# With coverage
make test-coverage
```

### Integration Tests

```bash
# Requires running services
make test-integration
```

### E2E Tests

```bash
# Start services first
make dev

# In another terminal
make test-e2e
```

## Debugging

### VS Code

Launch configuration is provided in `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Server",
      "type": "go",
      "request": "launch",
      "mode": "debug",
      "program": "${workspaceFolder}/cmd/mcp-notify"
    }
  ]
}
```

### Delve

```bash
dlv debug ./cmd/mcp-notify
```

## Documentation

### Serve Locally

```bash
# Install mkdocs
pip install mkdocs-material

# Serve
mkdocs serve
```

### Build

```bash
mkdocs build
```

## Git Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add telegram notification channel
fix: resolve race condition in poller
docs: update installation guide
refactor: simplify diff engine logic
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run `make lint test`
4. Push and create PR
5. Wait for CI and review
6. Squash and merge
