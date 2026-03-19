#!/bin/bash
# x402 AWS Enterprise Demo - Main Setup Script
# This script sets up all components of the demo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       x402 AWS Enterprise Demo - Setup Script              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print status messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    # Check Node.js
    if check_command node; then
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -ge 18 ]; then
            print_success "Node.js $(node --version) found"
        else
            print_warning "Node.js version 18+ recommended (found $(node --version))"
        fi
    else
        missing_deps+=("node")
    fi
    
    # Check npm
    if check_command npm; then
        print_success "npm $(npm --version) found"
    else
        missing_deps+=("npm")
    fi
    
    # Check Python
    if check_command python3; then
        local python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
        print_success "Python $(python3 --version | cut -d' ' -f2) found"
    else
        missing_deps+=("python3")
    fi
    
    # Check pip
    if check_command pip3 || check_command pip; then
        print_success "pip found"
    else
        missing_deps+=("pip")
    fi
    
    # Check AWS CLI
    if check_command aws; then
        print_success "AWS CLI $(aws --version | cut -d' ' -f1 | cut -d'/' -f2) found"
    else
        print_warning "AWS CLI not found - required for deployment"
    fi
    
    # Check CDK
    if check_command cdk; then
        print_success "AWS CDK $(cdk --version | cut -d' ' -f1) found"
    else
        print_warning "AWS CDK not found - will be installed locally"
    fi
    
    # Check Docker
    if check_command docker; then
        print_success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') found"
    else
        print_warning "Docker not found - required for agent deployment to AgentCore"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install the missing dependencies:"
        echo "  - Node.js 18+: https://nodejs.org/"
        echo "  - Python 3.10+: https://www.python.org/"
        echo "  - AWS CLI: https://aws.amazon.com/cli/"
        exit 1
    fi
    
    echo ""
}

# Setup payer agent (Python)
setup_payer_agent() {
    print_status "Setting up Payer Agent (Python)..."
    
    cd "$PROJECT_ROOT/payer-agent"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d ".venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv .venv
    fi
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install dependencies
    print_status "Installing Python dependencies..."
    pip install -e ".[dev]"
    
    # Create .env from example if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Created .env from .env.example - please update with your values"
        fi
    fi
    
    deactivate
    print_success "Payer Agent setup complete"
    echo ""
}

# Setup payer infrastructure (CDK)
setup_payer_infrastructure() {
    print_status "Setting up Payer Infrastructure (CDK)..."
    
    cd "$PROJECT_ROOT/payer-infrastructure"
    
    # Install npm dependencies
    print_status "Installing npm dependencies..."
    npm install
    
    # Build TypeScript
    print_status "Building TypeScript..."
    npm run build
    
    print_success "Payer Infrastructure setup complete"
    echo ""
}

# Setup seller infrastructure (CDK)
setup_seller_infrastructure() {
    print_status "Setting up Seller Infrastructure (CDK)..."
    
    cd "$PROJECT_ROOT/seller-infrastructure"
    
    # Install npm dependencies
    print_status "Installing npm dependencies..."
    npm install
    
    # Create .env from example if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Created .env from .env.example - please update with your values"
        fi
    fi
    
    # Build TypeScript
    print_status "Building TypeScript..."
    npm run build
    
    print_success "Seller Infrastructure setup complete"
    echo ""
}

# Setup web UI (React)
setup_web_ui() {
    print_status "Setting up Web UI (React)..."
    
    cd "$PROJECT_ROOT/web-ui"
    
    # Install npm dependencies
    print_status "Installing npm dependencies..."
    npm install
    
    # Create .env from example if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Created .env from .env.example - please update with your values"
        fi
    fi
    
    # Build
    print_status "Building Web UI..."
    npm run build
    
    print_success "Web UI setup complete"
    echo ""
}

# Verify AWS credentials
verify_aws_credentials() {
    print_status "Verifying AWS credentials..."
    
    if aws sts get-caller-identity &> /dev/null; then
        local account_id=$(aws sts get-caller-identity --query Account --output text)
        local user_arn=$(aws sts get-caller-identity --query Arn --output text)
        print_success "AWS credentials valid"
        echo "  Account: $account_id"
        echo "  Identity: $user_arn"
    else
        print_warning "AWS credentials not configured or invalid"
        echo "  Run 'aws configure' to set up credentials"
    fi
    echo ""
}

# Print next steps
print_next_steps() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                      Next Steps                            ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "1. Configure environment variables:"
    echo "   - Edit payer-agent/.env with your CDP credentials"
    echo "   - Edit seller-infrastructure/.env with your AWS account ID"
    echo "   - Edit web-ui/.env.local with your Gateway endpoint (optional)"
    echo ""
    echo "2. Configure AWS credentials (if not already done):"
    echo "   aws configure"
    echo ""
    echo "3. Bootstrap CDK (first time only):"
    echo "   cd seller-infrastructure && npx cdk bootstrap"
    echo "   cd payer-infrastructure && npx cdk bootstrap"
    echo ""
    echo "4. Deploy seller infrastructure:"
    echo "   cd seller-infrastructure && npm run deploy"
    echo ""
    echo "5. Deploy payer infrastructure:"
    echo "   cd payer-infrastructure && npm run deploy"
    echo ""
    echo "6. Run the payer agent locally:"
    echo "   cd payer-agent && source .venv/bin/activate && python -m agent.api_server"
    echo ""
    echo "7. Run the Web UI locally:"
    echo "   cd web-ui && npm run dev"
    echo ""
    echo -e "${GREEN}Setup complete!${NC}"
}

# Main execution
main() {
    check_prerequisites
    verify_aws_credentials
    setup_payer_agent
    setup_payer_infrastructure
    setup_seller_infrastructure
    setup_web_ui
    print_next_steps
}

# Run main function
main "$@"
