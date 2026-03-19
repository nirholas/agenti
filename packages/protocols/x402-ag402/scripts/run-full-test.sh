#!/usr/bin/env bash
# ============================================================================
# AG402 Full Integration Test Runner
# One-script to run all tests: unit → localnet → devnet → resilience
#
# Usage:
#   ./scripts/run-full-test.sh                    # Run all tests
#   ./scripts/run-full-test.sh --localnet-only     # Only localnet tests
#   ./scripts/run-full-test.sh --devnet-only       # Only devnet tests
#   ./scripts/run-full-test.sh --skip-localnet     # Skip localnet tests
#   ./scripts/run-full-test.sh --skip-devnet       # Skip devnet tests
#
# Prerequisites:
#   pip install -e "core/[crypto,dev]"
#
# For localnet tests:
#   brew install solana   (or: sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)")
#
# For devnet tests, set environment variables:
#   export DEVNET_BUYER_PRIVATE_KEY="<base58 private key from Phantom>"
#   export DEVNET_SELLER_PUBKEY="<seller public key>"
# ============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
RUN_LOCALNET=true
RUN_DEVNET=true
RUN_UNIT=true

for arg in "$@"; do
    case $arg in
        --localnet-only)  RUN_DEVNET=false; RUN_UNIT=false ;;
        --devnet-only)    RUN_LOCALNET=false; RUN_UNIT=false ;;
        --skip-localnet)  RUN_LOCALNET=false ;;
        --skip-devnet)    RUN_DEVNET=false ;;
        --help|-h)
            head -17 "$0" | tail -15
            exit 0
            ;;
    esac
done

PASS=0
FAIL=0
SKIP=0

section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"; }
ok()      { echo -e "${GREEN}✓ $1${NC}"; PASS=$((PASS + 1)); }
fail()    { echo -e "${RED}✗ $1${NC}"; FAIL=$((FAIL + 1)); }
skip()    { echo -e "${YELLOW}⊘ $1${NC}"; SKIP=$((SKIP + 1)); }

# ── 0. Dependency check ────────────────────────────────────────────────────
section "Checking dependencies"

python3 -c "import solana; import solders; import spl.token; print('  crypto deps: OK')" 2>/dev/null \
    || { echo -e "${RED}Missing crypto deps. Run: pip install -e 'core/[crypto,dev]'${NC}"; exit 1; }

python3 -c "import pytest" 2>/dev/null \
    || { echo -e "${RED}Missing pytest. Run: pip install -e 'core/[dev]'${NC}"; exit 1; }

echo -e "  ${GREEN}All Python dependencies OK${NC}"

# ── 1. Unit + Mock tests ──────────────────────────────────────────────────
if $RUN_UNIT; then
    section "Unit & Mock tests (no network required)"
    if cd "$ROOT_DIR/core" && python3 -m pytest tests/ -m "not devnet and not localnet" -v --timeout=60 2>&1; then
        ok "Unit & Mock tests"
    else
        fail "Unit & Mock tests"
    fi
fi

# ── 2. Localnet tests ────────────────────────────────────────────────────
if $RUN_LOCALNET; then
    section "Localnet integration tests"

    # Check solana-test-validator
    if ! command -v solana-test-validator &>/dev/null; then
        skip "Localnet tests (solana-test-validator not found)"
        echo "  Install: brew install solana"
        echo "  Or: sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\""
    else
        # Check if validator is running
        VALIDATOR_STARTED=false
        if ! lsof -i :8899 &>/dev/null; then
            echo "  Starting solana-test-validator..."
            cd /tmp && nohup solana-test-validator --reset --quiet > /tmp/solana-validator.log 2>&1 &
            VALIDATOR_PID=$!
            VALIDATOR_STARTED=true
            sleep 5
            if ! lsof -i :8899 &>/dev/null; then
                fail "Localnet tests (validator failed to start, see /tmp/solana-validator.log)"
            fi
        else
            echo "  solana-test-validator already running on :8899"
        fi

        if lsof -i :8899 &>/dev/null; then
            cd "$ROOT_DIR/core"
            if python3 -m pytest tests/ -m localnet -v --timeout=120 2>&1; then
                ok "Localnet tests (23 tests)"
            else
                fail "Localnet tests"
            fi
        fi

        # Cleanup validator if we started it
        if $VALIDATOR_STARTED && [ -n "${VALIDATOR_PID:-}" ]; then
            echo "  Stopping solana-test-validator (PID $VALIDATOR_PID)..."
            kill "$VALIDATOR_PID" 2>/dev/null || true
        fi
    fi
fi

# ── 3. Devnet tests ──────────────────────────────────────────────────────
if $RUN_DEVNET; then
    section "Devnet integration tests"

    if [ -z "${DEVNET_BUYER_PRIVATE_KEY:-}" ]; then
        skip "Devnet tests (DEVNET_BUYER_PRIVATE_KEY not set)"
        echo ""
        echo "  To run devnet tests, set:"
        echo "    export DEVNET_BUYER_PRIVATE_KEY=\"<base58 from Phantom>\""
        echo "    export DEVNET_SELLER_PUBKEY=\"<seller address>\""
        echo ""
        echo "  The buyer account needs ~0.5 SOL on devnet."
        echo "  Get free SOL: https://faucet.solana.com/"
    else
        cd "$ROOT_DIR/core"
        if python3 -m pytest tests/ -m devnet -v --timeout=180 2>&1; then
            ok "Devnet tests (26 tests)"
        else
            fail "Devnet tests (some may fail due to devnet latency - this is normal)"
        fi
    fi
fi

# ── Summary ───────────────────────────────────────────────────────────────
section "Summary"
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}Skipped: $SKIP${NC}"

if [ "$FAIL" -gt 0 ]; then
    echo -e "\n${RED}Some tests failed. Check output above.${NC}"
    exit 1
else
    echo -e "\n${GREEN}All executed tests passed!${NC}"
fi
