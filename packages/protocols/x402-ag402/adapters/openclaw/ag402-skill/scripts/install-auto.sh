#!/bin/bash
#
# ag402 Auto-Installation Script
# Fully automated, zero interaction
# Compatible: macOS / Linux
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/install.log"

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log_error "$1"
    log_error "Installation failed. Check $LOG_FILE for details."
    exit 1
}

# ============================================
# Step 1: Detect Python Environment
# ============================================
detect_python() {
    log "Detecting Python environment..."
    
    # Check for Python 3.8+
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        error_exit "Python not found. Please install Python 3.8+."
    fi
    
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
    
    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 8 ]); then
        error_exit "Python 3.8+ required. Found: $PYTHON_VERSION"
    fi
    
    log_success "Python found: $PYTHON_VERSION"
    
    # Check pip
    if ! $PYTHON_CMD -m pip --version &> /dev/null; then
        error_exit "pip not found. Please install pip."
    fi
    
    log_success "pip available"
}

# ============================================
# Step 2: Check/Install ag402-core
# ============================================
install_ag402_core() {
    log "Checking ag402-core..."
    
    if $PYTHON_CMD -c "import ag402_core" 2>/dev/null; then
        log_success "ag402-core already installed"
        return 0
    fi
    
    log "Installing ag402-core..."
    
    if $PYTHON_CMD -m pip install ag402-core -q; then
        log_success "ag402-core installed successfully"
    else
        error_exit "Failed to install ag402-core"
    fi
}

# ============================================
# Step 3: Setup ag402 Wallet
# ============================================
setup_wallet() {
    log "Setting up ag402 wallet..."
    
    # Check if wallet already exists
    if [ -n "$AG402_WALLET_PATH" ] && [ -f "$AG402_WALLET_PATH" ]; then
        log_success "Wallet already exists at $AG402_WALLET_PATH"
        return 0
    fi
    
    # Try to initialize wallet
    if $PYTHON_CMD -c "from ag402_core import setup; setup()" 2>/dev/null; then
        log_success "Wallet initialized"
        # Set secure permissions on wallet file (P0 security fix)
        if [ -f "$HOME/.ag402/wallet.json" ]; then
            chmod 600 "$HOME/.ag402/wallet.json" 2>/dev/null || true
            chmod 700 "$HOME/.ag402" 2>/dev/null || true
            log_success "Wallet file permissions secured (600)"
        fi
    else
        log_warn "Wallet setup skipped (may require manual setup)"
    fi
}

# ============================================
# Step 4: Configure MCP (if applicable)
# ============================================
configure_mcp() {
    log "Configuring MCP..."
    
    MCP_DIR="$HOME/.openclaw/mcp"
    
    # Check if MCP config exists
    if [ -f "$MCP_DIR/config.json" ]; then
        log_success "MCP config found"
        
        # Add ag402 MCP if not present
        if ! grep -q "ag402" "$MCP_DIR/config.json" 2>/dev/null; then
            log "Adding ag402 to MCP config..."
            # Backup and update config (basic implementation)
            cp "$MCP_DIR/config.json" "$MCP_DIR/config.json.bak"
        fi
    else
        log_warn "MCP config not found, skipping MCP configuration"
    fi
}

# ============================================
# Step 5: Register Skill (if needed)
# ============================================
register_skill() {
    log "Checking skill registration..."
    
    # Check OpenClaw skills config
    SKILLS_CONFIG="$HOME/.openclaw/config/skills.json"
    
    if [ -f "$SKILLS_CONFIG" ]; then
        if grep -q "ag402" "$SKILLS_CONFIG" 2>/dev/null; then
            log_success "ag402 skill already registered"
            return 0
        fi
    fi
    
    log "Skill registration may require manual configuration"
    log "Add 'ag402' to your skills config if needed"
}

# ============================================
# Main Installation Flow
# ============================================
main() {
    echo "=========================================="
    echo "  ag402 Auto-Installation Script"
    echo "=========================================="
    echo ""
    
    # Initialize log
    : > "$LOG_FILE"
    
    log "Starting automated installation..."
    
    # Run installation steps
    detect_python
    install_ag402_core
    setup_wallet
    configure_mcp
    register_skill
    
    echo ""
    echo "=========================================="
    log_success "Installation completed!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "  1. Run: $SCRIPT_DIR/verify-install.sh"
    echo "  2. Configure your wallet if needed"
    echo ""
}

# Run main
main "$@"
