# MCP Notify Makefile

# Variables
BINARY_NAME=mcp-notify
CLI_NAME=mcp-notify-cli
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
LDFLAGS=-ldflags "-w -s -X main.Version=$(VERSION) -X main.Commit=$(COMMIT) -X main.BuildDate=$(BUILD_DATE)"

# Go settings
GOCMD=go
GOBUILD=$(GOCMD) build
GOTEST=$(GOCMD) test
GOVET=$(GOCMD) vet
GOMOD=$(GOCMD) mod
GOFMT=gofmt

# Directories
BIN_DIR=./bin
CMD_DIR=./cmd

.PHONY: all build build-server build-cli clean test test-coverage lint fmt vet deps dev dev-services docker docker-build docker-push help

# Default target
all: clean deps lint test build

## Build targets

build: build-server build-cli ## Build all binaries
	@echo "Build complete"

build-server: ## Build the server binary
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BIN_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BIN_DIR)/$(BINARY_NAME) $(CMD_DIR)/mcp-notify

build-cli: ## Build the CLI binary
	@echo "Building $(CLI_NAME)..."
	@mkdir -p $(BIN_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BIN_DIR)/$(CLI_NAME) $(CMD_DIR)/mcp-notify-cli

build-linux: ## Build for Linux (amd64)
	@echo "Building for Linux..."
	@mkdir -p $(BIN_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BIN_DIR)/$(BINARY_NAME)-linux-amd64 $(CMD_DIR)/mcp-notify
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BIN_DIR)/$(CLI_NAME)-linux-amd64 $(CMD_DIR)/mcp-notify-cli

build-darwin: ## Build for macOS (amd64 and arm64)
	@echo "Building for macOS..."
	@mkdir -p $(BIN_DIR)
	GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BIN_DIR)/$(BINARY_NAME)-darwin-amd64 $(CMD_DIR)/mcp-notify
	GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BIN_DIR)/$(BINARY_NAME)-darwin-arm64 $(CMD_DIR)/mcp-notify

## Development targets

dev: ## Run in development mode with hot reload
	@echo "Starting development server..."
	@go run $(CMD_DIR)/mcp-notify/main.go --config config.yaml

dev-services: ## Start development services (postgres, redis)
	@echo "Starting development services..."
	docker compose up -d postgres redis
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo "Services ready!"

dev-down: ## Stop development services
	docker compose down

## Testing targets

test: ## Run unit tests
	@echo "Running tests..."
	$(GOTEST) -v -race -short ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	$(GOTEST) -v -race -coverprofile=coverage.out -covermode=atomic ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

test-integration: ## Run integration tests (requires Docker)
	@echo "Running integration tests..."
	docker compose -f docker-compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests
	docker compose -f docker-compose.test.yaml down -v

test-e2e: ## Run end-to-end tests
	@echo "Running e2e tests..."
	$(GOTEST) -v -tags=e2e ./test/e2e/...

## Code quality targets

lint: ## Run linters
	@echo "Running linters..."
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint not installed, running basic checks..."; \
		$(GOVET) ./...; \
	fi

fmt: ## Format code
	@echo "Formatting code..."
	$(GOFMT) -s -w .

vet: ## Run go vet
	@echo "Running go vet..."
	$(GOVET) ./...

check: fmt vet lint ## Run all code quality checks

## Dependency management

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	$(GOMOD) download
	$(GOMOD) tidy

deps-update: ## Update dependencies
	@echo "Updating dependencies..."
	$(GOMOD) tidy
	$(GOCMD) get -u ./...
	$(GOMOD) tidy

## Code generation

generate: ## Generate code (mocks, API clients, etc.)
	@echo "Generating code..."
	$(GOCMD) generate ./...

swagger: ## Generate Swagger/OpenAPI documentation
	@echo "Generating API documentation..."
	@if command -v swag >/dev/null 2>&1; then \
		swag init -g cmd/mcp-notify/main.go -o api; \
	else \
		echo "swag not installed: go install github.com/swaggo/swag/cmd/swag@latest"; \
	fi

## Docker targets

docker: docker-build ## Build Docker image

docker-build: ## Build Docker image
	@echo "Building Docker image..."
	docker build \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg BUILD_DATE=$(BUILD_DATE) \
		-t mcp-notify:$(VERSION) \
		-t mcp-notify:latest \
		.

docker-push: ## Push Docker image to registry
	@echo "Pushing Docker image..."
	docker push ghcr.io/nirholas/mcp-notify:$(VERSION)
	docker push ghcr.io/nirholas/mcp-notify:latest

docker-up: ## Start all services with Docker Compose
	docker compose up -d

docker-down: ## Stop all services
	docker compose down

docker-logs: ## View service logs
	docker compose logs -f mcp-notify

## Database targets

migrate: ## Run database migrations
	@echo "Running migrations..."
	$(GOCMD) run $(CMD_DIR)/mcp-notify/main.go migrate up

migrate-down: ## Rollback last migration
	@echo "Rolling back migration..."
	$(GOCMD) run $(CMD_DIR)/mcp-notify/main.go migrate down

migrate-create: ## Create a new migration (usage: make migrate-create name=migration_name)
	@echo "Creating migration: $(name)"
	goose -dir internal/db/migrations create $(name) sql

## Utility targets

clean: ## Clean build artifacts
	@echo "Cleaning..."
	rm -rf $(BIN_DIR)
	rm -f coverage.out coverage.html

install: build ## Install binaries to GOPATH/bin
	@echo "Installing binaries..."
	cp $(BIN_DIR)/$(BINARY_NAME) $(GOPATH)/bin/
	cp $(BIN_DIR)/$(CLI_NAME) $(GOPATH)/bin/

version: ## Print version information
	@echo "Version: $(VERSION)"
	@echo "Commit: $(COMMIT)"
	@echo "Build Date: $(BUILD_DATE)"

## Help

help: ## Show this help
	@echo "MCP Notify - Makefile targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
