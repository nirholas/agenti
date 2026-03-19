set shell := ['bash', '-uc']
set dotenv-load := true

# Colours
RED:= '\033[31m'
GREEN:= '\033[32m'
YELLOW:= '\033[33m'
BLUE:= '\033[34m'
MAGENTA:= '\033[35m'
CYAN:= '\033[36m'
WHITE:= '\033[37m'
BOLD:= '\033[1m'
UNDERLINE:= '\033[4m'
INVERTED_COLOURS:= '\033[7m'
RESET := '\033[0m'
NEWLINE := '\n'

# Default: show available recipes
default:
    @just --list --unsorted --list-heading $'{{BOLD}}{{GREEN}}Available commands:{{NEWLINE}}{{RESET}}'

# ===== Installation & Build =====

# Install dependencies
install:
    @echo -e $'{{BOLD}}{{CYAN}}Installing dependencies...{{RESET}}'
    bun install
    @echo -e $'{{BOLD}}{{GREEN}}Dependencies installed!{{RESET}}'

# Build core package
build:
    @echo -e $'{{BOLD}}{{CYAN}}Building core package...{{RESET}}'
    cd packages/core && bun run build
    @echo -e $'{{BOLD}}{{GREEN}}Core package built successfully!{{RESET}}'

# Build all packages
build-all:
    @echo -e $'{{BOLD}}{{CYAN}}Building all packages...{{RESET}}'
    bun run build
    @echo -e $'{{BOLD}}{{GREEN}}All packages built successfully!{{RESET}}'

# Clean build artifacts
clean:
    @echo -e $'{{BOLD}}{{CYAN}}Cleaning build artifacts...{{RESET}}'
    rm -rf packages/core/dist
    rm -rf examples/facilitator-server/dist
    @echo -e $'{{BOLD}}{{GREEN}}Build artifacts cleaned!{{RESET}}'

# Clean and rebuild
build-clean: clean build
    @echo -e $'{{BOLD}}{{GREEN}}Clean build completed!{{RESET}}'

# ===== Code Quality =====

# Run all checks (lint + format + typecheck)
check-all: lint typecheck
    @echo -e $'{{BOLD}}{{GREEN}}All checks passed!{{RESET}}'

# Fix all issues (lint + format)
fix-all: lint-fix format
    @echo -e $'{{BOLD}}{{GREEN}}All issues fixed!{{RESET}}'

# Check linting
lint:
    @echo -e $'{{BOLD}}{{CYAN}}Running linting...{{RESET}}'
    cd packages/core && bun run lint
    @echo -e $'{{BOLD}}{{GREEN}}Linting check passed!{{RESET}}'

# Fix linting issues
lint-fix:
    @echo -e $'{{BOLD}}{{CYAN}}Fixing linting issues...{{RESET}}'
    cd packages/core && bun run lint --fix
    @echo -e $'{{BOLD}}{{GREEN}}Linting issues fixed!{{RESET}}'

# Format code
format:
    @echo -e $'{{BOLD}}{{CYAN}}Formatting code...{{RESET}}'
    cd packages/core && bun run format
    @echo -e $'{{BOLD}}{{GREEN}}Code formatted!{{RESET}}'

# Typecheck core package
typecheck:
    @echo -e $'{{BOLD}}{{CYAN}}Running typecheck...{{RESET}}'
    cd packages/core && bun run typecheck
    @echo -e $'{{BOLD}}{{GREEN}}Typecheck passed!{{RESET}}'

# Typecheck all (core + examples)
typecheck-all:
    @echo -e $'{{BOLD}}{{CYAN}}Running typecheck on all packages...{{RESET}}'
    bun run typecheck
    cd examples && npx tsc --noEmit
    @echo -e $'{{BOLD}}{{GREEN}}All typechecks passed!{{RESET}}'

# ===== Testing =====

# Run all tests
test:
    @echo -e $'{{BOLD}}{{CYAN}}Running tests...{{RESET}}'
    cd packages/core && bun test
    @echo -e $'{{BOLD}}{{GREEN}}All tests passed!{{RESET}}'

# Run tests in watch mode
test-watch:
    @echo -e $'{{BOLD}}{{CYAN}}Running tests in watch mode...{{RESET}}'
    cd packages/core && bun test --watch

# Run a specific test file
test-file FILE:
    @echo -e $'{{BOLD}}{{CYAN}}Running test: {{FILE}}{{RESET}}'
    cd packages/core && bun test {{FILE}}

# Run tests with coverage
test-coverage:
    @echo -e $'{{BOLD}}{{CYAN}}Running tests with coverage...{{RESET}}'
    cd packages/core && bun test --coverage
    @echo -e $'{{BOLD}}{{GREEN}}Coverage report generated!{{RESET}}'

# ===== Server =====

# Start facilitator server (dev mode)
start:
    @echo -e $'{{BOLD}}{{CYAN}}Starting facilitator server (dev)...{{RESET}}'
    cd examples/facilitator-server && bun run dev

# Start facilitator server (production)
server:
    @echo -e $'{{BOLD}}{{CYAN}}Starting facilitator server...{{RESET}}'
    cd examples/facilitator-server && bun run start

# Build facilitator server
server-build:
    @echo -e $'{{BOLD}}{{CYAN}}Building facilitator server...{{RESET}}'
    cd examples/facilitator-server && bun run build
    @echo -e $'{{BOLD}}{{GREEN}}Server built successfully!{{RESET}}'

# ===== Examples =====

# Run auth example
example-auth:
    @echo -e $'{{BOLD}}{{CYAN}}Running auth example...{{RESET}}'
    cd examples && bun run auth

# Run Hono example
example-hono:
    @echo -e $'{{BOLD}}{{CYAN}}Running Hono example...{{RESET}}'
    cd examples && bun run hono

# Run paid API example (Elysia)
example-paid-api:
    @echo -e $'{{BOLD}}{{CYAN}}Running paid API example...{{RESET}}'
    cd examples && bun run paid-api

# Run paid API example (Express)
example-paid-api-express:
    @echo -e $'{{BOLD}}{{CYAN}}Running paid API Express example...{{RESET}}'
    cd examples && bun run paid-api:express

# Run paid API example (Hono)
example-paid-api-hono:
    @echo -e $'{{BOLD}}{{CYAN}}Running paid API Hono example...{{RESET}}'
    cd examples && bun run paid-api:hono

# Run Starknet API example
example-starknet:
    @echo -e $'{{BOLD}}{{CYAN}}Running Starknet API example...{{RESET}}'
    cd examples && bun run starknet:api

# Run upto module example
example-upto:
    @echo -e $'{{BOLD}}{{CYAN}}Running upto module example...{{RESET}}'
    cd examples && bun run upto

# ===== Release =====

# Create a changeset
changeset:
    @echo -e $'{{BOLD}}{{CYAN}}Creating changeset...{{RESET}}'
    bun run changeset

# Version packages
release-version:
    @echo -e $'{{BOLD}}{{CYAN}}Versioning packages...{{RESET}}'
    bun run release:version
    @echo -e $'{{BOLD}}{{GREEN}}Packages versioned!{{RESET}}'

# Publish packages
release-publish:
    @echo -e $'{{BOLD}}{{CYAN}}Publishing packages...{{RESET}}'
    bun run release:publish
    @echo -e $'{{BOLD}}{{GREEN}}Packages published!{{RESET}}'

# Full release flow
release:
    @echo -e $'{{BOLD}}{{CYAN}}Running full release flow...{{RESET}}'
    bun run release
    @echo -e $'{{BOLD}}{{GREEN}}Release completed!{{RESET}}'

# ===== Help =====

# Show help
help:
    @echo -e $'{{BOLD}}{{GREEN}}x402 Facilitator Development Commands{{RESET}}'
    @echo -e $''
    @echo -e $'{{BOLD}}{{CYAN}}Quick Start:{{RESET}}'
    @echo -e $'  just install     # Install dependencies'
    @echo -e $'  just build       # Build core package'
    @echo -e $'  just server-dev  # Start facilitator server'
    @echo -e $''
    @echo -e $'{{BOLD}}{{CYAN}}Code Quality:{{RESET}}'
    @echo -e $'  just check-all   # Run all checks (lint + typecheck)'
    @echo -e $'  just fix-all     # Fix all issues (lint + format)'
    @echo -e $'  just lint        # Check linting'
    @echo -e $'  just lint-fix    # Fix linting issues'
    @echo -e $'  just format      # Format code'
    @echo -e $'  just typecheck   # Typecheck core package'
    @echo -e $''
    @echo -e $'{{BOLD}}{{CYAN}}Testing:{{RESET}}'
    @echo -e $'  just test            # Run all tests'
    @echo -e $'  just test-watch      # Run tests in watch mode'
    @echo -e $'  just test-file FILE  # Run specific test file'
    @echo -e $'  just test-coverage   # Run tests with coverage'
    @echo -e $''
    @echo -e $'{{BOLD}}{{CYAN}}Server:{{RESET}}'
    @echo -e $'  just server-dev   # Start server (dev mode)'
    @echo -e $'  just server       # Start server (production)'
    @echo -e $'  just server-build # Build server'
    @echo -e $''
    @echo -e $'{{BOLD}}{{CYAN}}Examples:{{RESET}}'
    @echo -e $'  just example-auth            # Auth example'
    @echo -e $'  just example-hono            # Hono example'
    @echo -e $'  just example-paid-api        # Paid API (Elysia)'
    @echo -e $'  just example-paid-api-express # Paid API (Express)'
    @echo -e $'  just example-paid-api-hono   # Paid API (Hono)'
    @echo -e $'  just example-starknet        # Starknet example'
    @echo -e $'  just example-upto            # Upto module example'
    @echo -e $''
    @echo -e $'{{BOLD}}{{CYAN}}Release:{{RESET}}'
    @echo -e $'  just changeset       # Create a changeset'
    @echo -e $'  just release         # Full release flow'
    @echo -e $'  just release-version # Version packages'
    @echo -e $'  just release-publish # Publish packages'
