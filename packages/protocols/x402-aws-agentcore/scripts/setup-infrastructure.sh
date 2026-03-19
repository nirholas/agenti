#!/bin/bash
# x402 AWS Enterprise Demo - Infrastructure Setup Script
# Sets up both payer and seller CDK infrastructure projects

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${BLUE}Setting up Infrastructure Projects...${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is required but not installed"
    echo "Install from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_warning "Node.js 18+ recommended (found v$NODE_VERSION)"
fi

print_success "Node.js $(node --version) found"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is required but not installed"
    exit 1
fi

print_success "npm $(npm --version) found"

# Setup Seller Infrastructure
setup_seller() {
    print_status "Setting up Seller Infrastructure..."
    cd "$PROJECT_ROOT/seller-infrastructure"
    
    npm install --silent
    
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Created seller-infrastructure/.env from .env.example"
    fi
    
    npm run build
    print_success "Seller Infrastructure ready"
}

# Setup Payer Infrastructure
setup_payer() {
    print_status "Setting up Payer Infrastructure..."
    cd "$PROJECT_ROOT/payer-infrastructure"
    
    npm install --silent
    npm run build
    print_success "Payer Infrastructure ready"
}

# Setup Web UI
setup_webui() {
    print_status "Setting up Web UI..."
    cd "$PROJECT_ROOT/web-ui"
    
    npm install --silent
    
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Created web-ui/.env from .env.example"
    fi
    
    npm run build
    print_success "Web UI ready"
}

# Main
setup_seller
echo ""
setup_payer
echo ""
setup_webui

echo ""
print_success "Infrastructure setup complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure seller-infrastructure/.env with your AWS account ID"
echo ""
echo "2. Bootstrap CDK (first time only):"
echo "   cd seller-infrastructure && npx cdk bootstrap"
echo ""
echo "3. Deploy seller infrastructure:"
echo "   cd seller-infrastructure && npm run deploy"
echo ""
echo "4. Deploy payer infrastructure:"
echo "   cd payer-infrastructure && npm run deploy"
echo ""
echo "5. Run the Web UI locally:"
echo "   cd web-ui && npm run dev"
