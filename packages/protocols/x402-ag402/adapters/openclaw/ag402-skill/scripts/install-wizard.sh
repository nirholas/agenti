#!/bin/bash
#
# ag402 Interactive Installation Wizard
# Step-by-step guided installation
# Compatible: macOS / Linux
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/install-wizard.log"

# Progress tracking
STEP=0
TOTAL_STEPS=5

# ============================================
# UI Functions
# ============================================
print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}     ag402 Installation Wizard        ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    STEP=$((STEP + 1))
    echo -e "${BLUE}[$STEP/$TOTAL_STEPS]${NC} $1"
}

print_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}  ✗ $1${NC}"
}

print_info() {
    echo -e "  $1"
}

ask_yes_no() {
    local prompt="$1"
    local response
    
    while true; do
        echo -en "${CYAN}$prompt [Y/n]: ${NC}"
        read -r response
        
        case "$response" in
            [Yy]|"")
                return 0
                ;;
            [Nn])
                return 1
                ;;
            *)
                print_error "Please enter Y or N"
                ;;
        esac
    done
}

ask_input() {
    local prompt="$1"
    local default="$2"
    local response
    
    while true; do
        if [ -n "$default" ]; then
            echo -en "${CYAN}$prompt [$default]: ${NC}"
        else
            echo -en "${CYAN}$prompt: ${NC}"
        fi
        read -r response
        
        if [ -n "$response" ] || [ -n "$default" ]; then
            echo "${response:-$default}"
            return 0
        fi
        
        print_error "Input required"
    done
}

press_enter() {
    echo ""
    echo -en "${YELLOW}Press Enter to continue...${NC}"
    read -r
}

cancel_check() {
    if ! ask_yes_no "Continue with installation?"; then
        echo ""
        print_warning "Installation cancelled by user"
        exit 0
    fi
}

# ============================================
# Step 1: Detect Python Environment
# ============================================
step_detect_python() {
    print_step "Detecting Python Environment"
    echo ""
    
    # Check for Python 3.8+
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        print_error "Python not found!"
        echo ""
        print_info "Please install Python 3.8 or later from:"
        print_info "  - macOS: brew install python3"
        print_info "  - Linux: sudo apt install python3"
        echo ""
        
        if ! ask_yes_no "Try to continue anyway?"; then
            exit 1
        fi
        return 1
    fi
    
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
    
    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 8 ]); then
        print_error "Python 3.8+ required. Found: $PYTHON_VERSION"
        if ! ask_yes_no "Try to continue anyway?"; then
            exit 1
        fi
        return 1
    fi
    
    print_success "Python found: $PYTHON_VERSION"
    
    # Check pip
    if ! $PYTHON_CMD -m pip --version &> /dev/null; then
        print_error "pip not found!"
        print_info "Please install pip: python3 -m ensurepip"
        
        if ! ask_yes_no "Try to continue anyway?"; then
            exit 1
        fi
        return 1
    fi
    
    print_success "pip available"
    echo ""
    
    # Export for later steps
    export PYTHON_CMD
    return 0
}

# ============================================
# Step 2: Install ag402-core
# ============================================
step_install_core() {
    print_step "Installing ag402-core"
    echo ""
    
    # Check if already installed
    if $PYTHON_CMD -c "import ag402_core" 2>/dev/null; then
        print_success "ag402-core already installed"
        return 0
    fi
    
    print_info "Installing ag402-core package..."
    echo ""
    
    if $PYTHON_CMD -m pip install ag402-core; then
        print_success "ag402-core installed successfully"
    else
        print_error "Failed to install ag402-core"
        
        if ask_yes_no "Try alternative installation method?"; then
            print_info "Trying: pip install --user ag402-core"
            if $PYTHON_CMD -m pip install --user ag402-core; then
                print_success "Installed with --user flag"
            else
                print_error "Installation failed"
                exit 1
            fi
        else
            exit 1
        fi
    fi
    
    echo ""
    return 0
}

# ============================================
# Step 3: Setup Wallet
# ============================================
step_setup_wallet() {
    print_step "Setting up ag402 Wallet"
    echo ""
    
    # Check if wallet already exists
    if [ -n "$AG402_WALLET_PATH" ] && [ -f "$AG402_WALLET_PATH" ]; then
        print_success "Wallet already exists at $AG402_WALLET_PATH"
        return 0
    fi
    
    # Check for existing wallet in default location
    DEFAULT_WALLET="$HOME/.ag402/wallet.json"
    if [ -f "$DEFAULT_WALLET" ]; then
        print_success "Found existing wallet at $DEFAULT_WALLET"
        return 0
    fi
    
    print_info "You need a wallet to make payments."
    echo ""
    
    if ask_yes_no "Initialize new wallet now?"; then
        print_info "Setting up wallet..."
        
        # Try to run setup
        if $PYTHON_CMD -c "from ag402_core import setup; setup()" 2>/dev/null; then
            print_success "Wallet initialized"
        else
            print_warning "Could not auto-setup wallet"
            print_info "Run 'ag402 setup' manually after installation"
        fi
    else
        print_warning "Skipping wallet setup"
        print_info "You can set it up later with: ag402 setup"
    fi
    
    echo ""
    return 0
}

# ============================================
# Step 4: Configure MCP
# ============================================
step_configure_mcp() {
    print_step "Configuring MCP Server"
    echo ""
    
    MCP_DIR="$HOME/.openclaw/mcp"
    
    # Check if MCP config exists
    if [ -f "$MCP_DIR/config.json" ]; then
        print_success "Found MCP config at $MCP_DIR/config.json"
        
        # Check if ag402 is already configured
        if grep -q "ag402" "$MCP_DIR/config.json" 2>/dev/null; then
            print_success "ag402 MCP already configured"
            return 0
        fi
        
        echo ""
        print_info "To add ag402 to MCP, add this to your config:"
        echo ""
        echo '  {'
        echo '    "mcpServers": {'
        echo '      "ag402": {'
        echo '        "command": "ag402-mcp"'
        echo '      }'
        echo '    }'
        echo '  }'
        echo ""
        
        if ask_yes_no "Update MCP config now?"; then
            # Backup
            cp "$MCP_DIR/config.json" "$MCP_DIR/config.json.bak"
            print_success "Backed up existing config"
            # Note: Full update would require jq or python json manipulation
            print_info "Manual update required - see configuration above"
        fi
    else
        print_warning "MCP config not found"
        print_info "MCP configuration is optional"
        print_info "You can configure it later in $MCP_DIR/config.json"
    fi
    
    echo ""
    return 0
}

# ============================================
# Step 5: Verify & Summary
# ============================================
step_verify() {
    print_step "Verifying Installation"
    echo ""
    
    # Run verification
    VERIFY_SCRIPT="$SCRIPT_DIR/verify-install.sh"
    
    if [ -f "$VERIFY_SCRIPT" ]; then
        if ask_yes_no "Run verification script now?"; then
            echo ""
            chmod +x "$VERIFY_SCRIPT"
            "$VERIFY_SCRIPT"
        fi
    else
        # Manual verification
        print_info "Checking Python package..."
        if $PYTHON_CMD -c "import ag402_core" 2>/dev/null; then
            print_success "ag402-core: OK"
        else
            print_error "ag402-core: NOT FOUND"
        fi
        
        echo ""
        print_info "Checking wallet..."
        if [ -f "$HOME/.ag402/wallet.json" ]; then
            print_success "Wallet: OK"
        else
            print_warning "Wallet: Not found"
        fi
    fi
    
    echo ""
    return 0
}

# ============================================
# Main Installation Flow
# ============================================
main() {
    print_header
    
    echo "This wizard will guide you through ag402 installation."
    echo ""
    
    if ! ask_yes_no "Begin installation?"; then
        print_warning "Installation cancelled"
        exit 0
    fi
    
    # Initialize log
    : > "$LOG_FILE"
    
    # Run installation steps
    step_detect_python || cancel_check
    press_enter
    
    step_install_core || cancel_check
    press_enter
    
    step_setup_wallet || cancel_check
    press_enter
    
    step_configure_mcp || cancel_check
    press_enter
    
    step_verify
    
    # Summary
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}     Installation Complete! 🎉        ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review $LOG_FILE for details"
    echo "  2. Configure your wallet if needed"
    echo "  3. Add ag402 skill to OpenClaw"
    echo ""
}

# Run main
main "$@"
