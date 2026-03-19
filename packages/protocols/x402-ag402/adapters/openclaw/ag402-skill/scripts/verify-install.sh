#!/bin/bash
#
# ag402 Installation Verification Script
# Checks dependencies, configuration, and wallet
# Compatible: macOS / Linux
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Report data
declare -a PASSED_TESTS=()
declare -a FAILED_TESTS=()
declare -a WARNINGS=()

# ============================================
# UI Functions
# ============================================
print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}   ag402 Installation Verification         ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    PASSED_TESTS+=("$1")
}

fail() {
    echo -e "  ${RED}✗${NC} $1"
    FAILED_TESTS+=("$1")
}

warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    WARNINGS+=("$1")
}

info() {
    echo -e "  ${CYAN}›${NC} $1"
}

# ============================================
# Check: Python Environment
# ============================================
check_python() {
    print_section "Python Environment"
    
    # Check Python command
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        fail "Python not found"
        return 1
    fi
    
    pass "Python command available"
    
    # Check version
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
    
    if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 8 ]; then
        pass "Python version: $PYTHON_VERSION (>= 3.8)"
    else
        fail "Python version: $PYTHON_VERSION (requires >= 3.8)"
    fi
    
    # Check pip
    if $PYTHON_CMD -m pip --version &> /dev/null; then
        pass "pip available"
    else
        fail "pip not available"
    fi
    
    export PYTHON_CMD
    return 0
}

# ============================================
# Check: Dependencies
# ============================================
check_dependencies() {
    print_section "Dependencies"
    
    # Check ag402-core
    if $PYTHON_CMD -c "import ag402_core" 2>/dev/null; then
        pass "ag402-core installed"
        
        # Get version
        AG402_VERSION=$($PYTHON_CMD -c "import ag402_core; print(ag402_core.__version__)" 2>/dev/null || echo "unknown")
        info "Version: $AG402_VERSION"
    else
        fail "ag402-core not installed"
    fi
    
    # Check solana (optional)
    if $PYTHON_CMD -c "import solana" 2>/dev/null; then
        pass "solana library installed (optional)"
    else
        warn "solana library not installed (optional)"
    fi
    
    # Check httpx/requests
    if $PYTHON_CMD -c "import httpx" 2>/dev/null || $PYTHON_CMD -c "import requests" 2>/dev/null; then
        pass "HTTP client available"
    else
        warn "No HTTP client found (httpx/requests)"
    fi
}

# ============================================
# Check: Configuration
# ============================================
check_config() {
    print_section "Configuration"
    
    # Check AG402 directories
    AG402_DIR="$HOME/.ag402"
    
    if [ -d "$AG402_DIR" ]; then
        pass "ag402 config directory exists: $AG402_DIR"
    else
        warn "ag402 config directory not found: $AG402_DIR"
    fi
    
    # Check environment variables
    if [ -n "$AG402_WALLET_PATH" ]; then
        pass "AG402_WALLET_PATH set: $AG402_WALLET_PATH"
    else
        info "AG402_WALLET_PATH not set (using default)"
    fi
    
    if [ -n "$AG402_RPC_URL" ]; then
        pass "AG402_RPC_URL set: $AG402_RPC_URL"
    else
        info "AG402_RPC_URL not set (using default)"
    fi
    
    # Check OpenClaw config
    OPENCLAW_CONFIG="$HOME/.openclaw/config/skills.json"
    if [ -f "$OPENCLAW_CONFIG" ]; then
        if grep -q "ag402" "$OPENCLAW_CONFIG" 2>/dev/null; then
            pass "ag402 skill registered in OpenClaw"
        else
            warn "ag402 skill not found in OpenClaw config"
        fi
    else
        info "OpenClaw skills config not found"
    fi
}

# ============================================
# Check: Wallet
# ============================================
check_wallet() {
    print_section "Wallet"
    
    # Try to find wallet
    WALLET_PATH=""
    
    if [ -n "$AG402_WALLET_PATH" ] && [ -f "$AG402_WALLET_PATH" ]; then
        WALLET_PATH="$AG402_WALLET_PATH"
    elif [ -f "$HOME/.ag402/wallet.json" ]; then
        WALLET_PATH="$HOME/.ag402/wallet.json"
    fi
    
    if [ -n "$WALLET_PATH" ] && [ -f "$WALLET_PATH" ]; then
        pass "Wallet file found: $WALLET_PATH"
        
        # Try to check balance
        if $PYTHON_CMD -c "from ag402_core import bridge; b = bridge.AG402Bridge(); print(b.check_balance())" 2>/dev/null; then
            BALANCE=$($PYTHON_CMD -c "from ag402_core import bridge; b = bridge.AG402Bridge(); print(b.check_balance())" 2>/dev/null)
            pass "Wallet balance check: $BALANCE"
        else
            warn "Could not check wallet balance (may need RPC)"
        fi
    else
        warn "Wallet file not found"
        info "Run 'ag402 setup' to create a wallet"
    fi
}

# ============================================
# Check: MCP Configuration
# ============================================
check_mcp() {
    print_section "MCP Configuration"
    
    MCP_DIR="$HOME/.openclaw/mcp"
    MCP_CONFIG="$MCP_DIR/config.json"
    
    if [ -f "$MCP_CONFIG" ]; then
        pass "MCP config exists: $MCP_CONFIG"
        
        # Check for ag402
        if grep -q "ag402" "$MCP_CONFIG" 2>/dev/null; then
            pass "ag402 MCP server configured"
        else
            warn "ag402 not in MCP config (optional)"
        fi
    else
        warn "MCP config not found (optional)"
    fi
}

# ============================================
# Network Check
# ============================================
check_network() {
    print_section "Network Connectivity"
    
    # Check internet
    if ping -c 1 8.8.8.8 &> /dev/null || curl -s --max-time 5 https://google.com &> /dev/null; then
        pass "Internet connectivity"
    else
        warn "No internet connectivity detected"
    fi
    
    # Check Solana RPC (optional)
    if [ -n "$AG402_RPC_URL" ]; then
        if curl -s --max-time 5 "$AG402_RPC_URL" &> /dev/null; then
            pass "Solana RPC reachable"
        else
            warn "Solana RPC not reachable"
        fi
    else
        info "Using default Solana RPC (devnet)"
    fi
}

# ============================================
# Summary Report
# ============================================
print_summary() {
    print_section "Summary Report"
    
    local total=${#PASSED_TESTS[@]}
    local failed=${#FAILED_TESTS[@]}
    local warnings=${#WARNINGS[@]}
    
    echo ""
    echo -e "  ${GREEN}Passed:${NC} $total"
    
    if [ $failed -gt 0 ]; then
        echo -e "  ${RED}Failed:${NC} $failed"
    fi
    
    if [ $warnings -gt 0 ]; then
        echo -e "  ${YELLOW}Warnings:${NC} $warnings"
    fi
    
    echo ""
    
    # Overall status
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║${NC}  ✓ Installation verification passed! ${GREEN}║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
        
        if [ $warnings -gt 0 ]; then
            echo ""
            echo "Note: $warnings warning(s) - see above for details"
        fi
    else
        echo -e "${RED}╔════════════════════════════════════════╗${NC}"
        echo -e "${RED}║${NC}  ✗ Installation has issues            ${RED}║${NC}"
        echo -e "${RED}╚════════════════════════════════════════╝${NC}"
        echo ""
        echo "Please resolve the failed checks before using ag402."
    fi
    
    echo ""
    echo "Diagnostic commands:"
    echo "  Check package:  pip show ag402-core"
    echo "  Check wallet:   ag402 wallet status"
    echo "  Get help:      ag402 --help"
    echo ""
}

# ============================================
# Export Report
# ============================================
export_report() {
    local report_file="$1"
    
    {
        echo "ag402 Installation Diagnostic Report"
        echo "Generated: $(date)"
        echo "======================================"
        echo ""
        echo "PASSED TESTS (${#PASSED_TESTS[@]}):"
        printf '  - %s\n' "${PASSED_TESTS[@]}"
        echo ""
        echo "FAILED TESTS (${#FAILED_TESTS[@]}):"
        printf '  - %s\n' "${FAILED_TESTS[@]}"
        echo ""
        echo "WARNINGS (${#WARNINGS[@]}):"
        printf '  - %s\n' "${WARNINGS[@]}"
    } > "$report_file"
    
    info "Report saved to: $report_file"
}

# ============================================
# Main
# ============================================
main() {
    print_header
    
    # Run all checks
    check_python
    check_dependencies
    check_config
    check_wallet
    check_mcp
    check_network
    
    # Summary
    print_summary
    
    # Export report if requested
    if [ "$1" == "--export" ] || [ "$1" == "-e" ]; then
        REPORT_FILE="${2:-ag402-diagnostic-$(date +%Y%m%d-%H%M%S).txt}"
        export_report "$REPORT_FILE"
    fi
    
    # Exit code
    if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
        exit 1
    fi
    exit 0
}

# Run main
main "$@"
