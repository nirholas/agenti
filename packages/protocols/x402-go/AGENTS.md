# Agent Development Guidelines for x402-go

## Build & Test Commands
- **Build**: `go build ./...` - Builds all packages
- **Test All**: `go test -race ./...` - Runs all tests with race detection
- **Test Single**: `go test -race -run TestName ./path/to/package` - Run specific test with race detection
- **Test Coverage**: `go test -race -cover ./...` - Run tests with coverage and race detection
- **Format**: `go fmt ./...` - Format all Go files
- **Lint (Go)**: `go vet ./...` - Run Go static analysis
- **Lint (Full)**: `golangci-lint run` - Run comprehensive linting

## Code Style & Conventions
- **Package Structure**: Use `cmd/` for executables, `internal/` for private packages, `pkg/` for public libraries
- **Imports**: Group as stdlib, external deps, then internal packages with blank lines between
- **Naming**: Use camelCase for variables/functions, PascalCase for exported items, avoid abbreviations
- **Error Handling**: Always check errors; wrap with context using `fmt.Errorf("context: %w", err)`
- **Comments**: Start with function name for exported functions; use `//` for inline, `/* */` for blocks
- **Testing**: Test files end with `_test.go`; use table-driven tests; mock external dependencies
- **Concurrency**: Prefer channels over mutexes; always handle goroutine lifecycles properly
- **Dependencies**: Use go.mod; run `go mod tidy` after adding/removing deps
- **Project Scripts**: Use `.specify/scripts/bash/` for automation scripts (check-prerequisites.sh, create-new-feature.sh, etc.)

## Module: github.com/mark3labs/x402-go | Go Version: 1.25.1

## Active Technologies
- Go 1.25.1 + Go standard library (net/http, encoding/json, encoding/base64, context) (001-x402-payment-middleware)
- N/A (stateless middleware, nonce tracking delegated to facilitator) (001-x402-payment-middleware)
- File-based persistence for budget tracking (JSON files in user config directory) (002-x402-client)
- Go 1.25.1 + Go standard library (strconv, fmt, encoding/json) (003-helpers-constants)
- N/A (constants and pure functions) (003-helpers-constants)
- Go 1.25.1 + Gin framework (github.com/gin-gonic/gin), existing x402-go core package (004-gin-middleware)
- N/A (stateless middleware, payment tracking delegated to facilitator) (004-gin-middleware)
- Go 1.25.1 + Gin (github.com/gin-gonic/gin), existing x402-go core package (004-gin-middleware)
- Go 1.25.1 + PocketBase framework (github.com/pocketbase/pocketbase/core), existing x402-go core package (005-pocketbase-middleware)
- N/A (stateless middleware, payment tracking delegated to facilitator) (005-pocketbase-middleware)
- N/A (stateless signer, CDP manages wallet state) (006-cdp-signer)
- Go 1.25.1 + github.com/mark3labs/mcp-go (latest stable release - MCP protocol), existing x402-go components (007-mcp-integration)
- N/A (stateless middleware and transport) (007-mcp-integration)

## Recent Changes
- 005-pocketbase-middleware: Added PocketBase middleware adapter for x402 payment gating
- 001-x402-payment-middleware: Added Go 1.25.1 + Go standard library (net/http, encoding/json, encoding/base64, context)
