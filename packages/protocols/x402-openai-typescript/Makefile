.DEFAULT_GOAL := all

.PHONY: help install lint format typecheck test check clean all

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	bun install

lint: ## Run Biome linter
	bunx @biomejs/biome check src/ tests/ examples/

format: ## Run Biome formatter (auto-fix)
	bunx @biomejs/biome check --write src/ tests/ examples/

typecheck: ## Run TypeScript type checker
	bun run typecheck

test: ## Run bun tests
	bun test

check: lint typecheck ## Run all static checks (lint + typecheck)

clean: ## Remove build artifacts and caches
	rm -rf dist/ node_modules/.cache

all: check test ## Run all checks + tests
