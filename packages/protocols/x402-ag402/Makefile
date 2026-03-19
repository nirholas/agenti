.PHONY: install install-crypto test lint build clean coverage test-devnet test-localnet test-full test-perf

install:
	pip install -e protocol/ -e "core/[dev]" -e "adapters/mcp/[dev]" -e "adapters/client_mcp/[dev]"

install-crypto:
	pip install -e "core/[crypto,dev]"

test:
	cd protocol && pytest tests/ -v -m "not devnet"
	cd core && pytest tests/ -v -m "not devnet and not localnet"
	cd adapters/mcp && pytest tests/ -v
	cd adapters/client_mcp && pytest tests/ -v

test-devnet:
	cd core && pytest tests/ -m devnet -v -s --timeout=180

test-localnet:
	cd core && pytest tests/ -m localnet -v -s --timeout=120

test-full:
	./scripts/run-full-test.sh

test-perf:
	cd core && pytest tests/ -m devnet -v -s --timeout=180 --perf-compare

lint:
	ruff check protocol/ core/ adapters/ examples/

build:
	cd protocol && python -m build
	cd core && python -m build
	cd adapters/mcp && python -m build
	cd adapters/client_mcp && python -m build

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true

coverage:
	cd protocol && pytest tests/ --cov=open402 --cov-report=term-missing
	cd core && pytest tests/ -m "not devnet and not localnet" --cov=ag402_core --cov-report=term-missing
	cd adapters/mcp && pytest tests/ --cov=ag402_mcp --cov-report=term-missing
	cd adapters/client_mcp && pytest tests/ --cov=ag402_client_mcp --cov-report=term-missing
