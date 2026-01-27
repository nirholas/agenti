# Contributing to MCP Notify

Thank you for your interest in contributing to MCP Notify! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the maintainers.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Environment details** (OS, Go version, Docker version, etc.)
- **Logs or error messages**

### Suggesting Features

Feature requests are welcome! Please:

- Check existing issues and discussions first
- Describe the problem the feature would solve
- Explain your proposed solution
- Consider alternatives you've thought about

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding style** (run `make lint`)
3. **Add tests** for new functionality
4. **Update documentation** as needed
5. **Ensure all tests pass** (`make test`)
6. **Write clear commit messages**

## Development Setup

### Prerequisites

- Go 1.22+
- Docker and Docker Compose
- Node.js 18+ (for dashboard)
- Make

### Getting Started

```bash
# Clone your fork
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify

# Install dependencies
make deps

# Start development services
make dev-services

# Run in development mode
make dev
```

### Running Tests

```bash
# Unit tests
make test

# Integration tests (requires Docker)
make test-integration

# All tests with coverage
make test-coverage
```

### Code Style

We use:
- `gofmt` for formatting
- `golangci-lint` for linting
- Conventional commit messages

Run before committing:
```bash
make fmt
make lint
```

## Project Structure

```
├── cmd/                    # Application entry points
│   ├── mcp-notify/         # Server binary
│   └── mcp-notify-cli/     # CLI binary
├── internal/              # Private application code
│   ├── api/              # HTTP API handlers
│   ├── config/           # Configuration loading
│   ├── db/               # Database layer
│   ├── diff/             # Change detection
│   ├── notifier/         # Notification channels
│   ├── poller/           # Registry polling
│   └── scheduler/        # Background tasks
├── pkg/                   # Public library code
│   ├── client/           # Go client library
│   └── types/            # Shared types
├── web/dashboard/         # React dashboard
├── api/                   # OpenAPI specifications
├── deploy/               # Deployment configurations
├── docs/                 # Documentation
└── test/                 # Test fixtures and helpers
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Telegram notification channel
fix: handle rate limiting in Discord sender
docs: update API documentation
test: add integration tests for poller
chore: update dependencies
```

## Review Process

1. All PRs require at least one approval
2. CI must pass (tests, lint, build)
3. Documentation must be updated
4. Breaking changes require discussion

## Getting Help

- **GitHub Discussions** for questions
- **GitHub Issues** for bugs and features
- **Discord** (MCP community) for real-time chat

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- GitHub contributors page

Thank you for contributing! 🎉
