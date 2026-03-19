#!/bin/bash
# x402 AWS Enterprise Demo - Setup Verification Script
# Verifies that all components are properly set up

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_status() { echo -e "${BLUE}[CHECK]${NC} $1"; }
print_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[FAIL]${NC} $1"; }

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           x402 Demo - Setup Verification                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Check Payer Agent
check_payer_agent() {
    print_status "Checking Payer Agent..."
    
    if [ -d "$PROJECT_ROOT/payer-agent/.venv" ]; then
        print_success "Python virtual environment exists"
    else
        print_error "Python virtual environment not found"
        ((ERRORS++))
    fi
    
    if [ -f "$PROJECT_ROOT/payer-agent/.env" ]; then
        # Check if env vars are set (not just example values)
        if grep -q "your_cdp" "$PROJECT_ROOT/payer-agent/.env" 2>/dev/null; then
            print_warning ".env contains placeholder values - update with real credentials"
            ((WARNINGS++))
        else
            print_success ".env file configured"
        fi
    else
        print_error ".env file not found"
        ((ERRORS++))
    fi
    
    # Check if dependencies are installed
    if [ -d "$PROJECT_ROOT/payer-agent/.venv" ]; then
        source "$PROJECT_ROOT/payer-agent/.venv/bin/activate" 2>/dev/null
        if python -c "import strands" 2>/dev/null; then
            print_success "strands-agents installed"
        else
            print_error "strands-agents not installed"
            ((ERRORS++))
        fi
        deactivate 2>/dev/null || true
    fi
    echo ""
}

# Check Seller Infrastructure
check_seller_infrastructure() {
    print_status "Checking Seller Infrastructure..."
    
    if [ -d "$PROJECT_ROOT/seller-infrastructure/node_modules" ]; then
        print_success "npm dependencies installed"
    else
        print_error "npm dependencies not installed"
        ((ERRORS++))
    fi
    
    if [ -f "$PROJECT_ROOT/seller-infrastructure/.env" ]; then
        if grep -q "your_aws" "$PROJECT_ROOT/seller-infrastructure/.env" 2>/dev/null; then
            print_warning ".env contains placeholder values"
            ((WARNINGS++))
        else
            print_success ".env file configured"
        fi
    else
        print_warning ".env file not found"
        ((WARNINGS++))
    fi
    
    # Check if TypeScript compiles
    if [ -d "$PROJECT_ROOT/seller-infrastructure/lib" ]; then
        cd "$PROJECT_ROOT/seller-infrastructure"
        if npm run build &>/dev/null; then
            print_success "TypeScript compiles successfully"
        else
            print_error "TypeScript compilation failed"
            ((ERRORS++))
        fi
    fi
    echo ""
}

# Check Payer Infrastructure
check_payer_infrastructure() {
    print_status "Checking Payer Infrastructure..."
    
    if [ -d "$PROJECT_ROOT/payer-infrastructure/node_modules" ]; then
        print_success "npm dependencies installed"
    else
        print_error "npm dependencies not installed"
        ((ERRORS++))
    fi
    
    # Check if TypeScript compiles
    if [ -d "$PROJECT_ROOT/payer-infrastructure/lib" ]; then
        cd "$PROJECT_ROOT/payer-infrastructure"
        if npm run build &>/dev/null; then
            print_success "TypeScript compiles successfully"
        else
            print_error "TypeScript compilation failed"
            ((ERRORS++))
        fi
    fi
    echo ""
}

# Check Web UI
check_web_ui() {
    print_status "Checking Web UI..."
    
    if [ -d "$PROJECT_ROOT/web-ui/node_modules" ]; then
        print_success "npm dependencies installed"
    else
        print_error "npm dependencies not installed"
        ((ERRORS++))
    fi
    
    if [ -f "$PROJECT_ROOT/web-ui/.env" ]; then
        print_success ".env file exists"
    else
        print_warning ".env file not found"
        ((WARNINGS++))
    fi
    
    # Check if build works
    cd "$PROJECT_ROOT/web-ui"
    if npm run build &>/dev/null; then
        print_success "Build compiles successfully"
    else
        print_error "Build failed"
        ((ERRORS++))
    fi
    echo ""
}

# Check AWS Configuration
check_aws() {
    print_status "Checking AWS Configuration..."
    
    if command -v aws &> /dev/null; then
        print_success "AWS CLI installed"
        
        if aws sts get-caller-identity &>/dev/null; then
            ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
            print_success "AWS credentials valid (Account: $ACCOUNT)"
        else
            print_warning "AWS credentials not configured"
            ((WARNINGS++))
        fi
    else
        print_warning "AWS CLI not installed"
        ((WARNINGS++))
    fi
    
    if command -v cdk &> /dev/null; then
        print_success "AWS CDK installed globally"
    else
        print_warning "AWS CDK not installed globally (will use npx)"
        ((WARNINGS++))
    fi
    echo ""
}

# Check cloned repositories
check_repos() {
    print_status "Checking cloned repositories..."
    
    if [ -d "$PROJECT_ROOT/x402" ]; then
        print_success "x402 repository present"
    else
        print_error "x402 repository not found"
        ((ERRORS++))
    fi
    
    if [ -d "$PROJECT_ROOT/agentkit" ]; then
        print_success "agentkit repository present"
    else
        print_error "agentkit repository not found"
        ((ERRORS++))
    fi
    echo ""
}

# Summary
print_summary() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                       Summary                              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        print_success "All checks passed! Setup is complete."
    elif [ $ERRORS -eq 0 ]; then
        print_warning "$WARNINGS warning(s) found - setup mostly complete"
        echo "Review warnings above and address if needed."
    else
        print_error "$ERRORS error(s) and $WARNINGS warning(s) found"
        echo "Run ./scripts/setup.sh to fix errors."
    fi
}

# Main
check_repos
check_payer_agent
check_seller_infrastructure
check_payer_infrastructure
check_web_ui
check_aws
print_summary

exit $ERRORS
