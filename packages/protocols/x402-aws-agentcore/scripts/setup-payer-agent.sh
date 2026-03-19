#!/bin/bash
# x402 AWS Enterprise Demo - Payer Agent Setup Script
# Sets up the Python environment for the Strands-based payer agent

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PAYER_AGENT_DIR="$PROJECT_ROOT/payer-agent"

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${BLUE}Setting up Payer Agent...${NC}"
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    print_error "Python 3.10+ is required (found $PYTHON_VERSION)"
    exit 1
fi

print_success "Python $PYTHON_VERSION found"

cd "$PAYER_AGENT_DIR"

# Create virtual environment
if [ ! -d ".venv" ]; then
    print_status "Creating virtual environment..."
    python3 -m venv .venv
    print_success "Virtual environment created"
else
    print_status "Virtual environment already exists"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source .venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip --quiet

# Install dependencies
print_status "Installing dependencies..."
pip install -e ".[dev]" --quiet

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Created .env from .env.example"
        echo ""
        echo "Please update .env with your credentials:"
        echo "  - CDP_API_KEY_NAME: Your Coinbase Developer Platform API key name"
        echo "  - CDP_API_KEY_PRIVATE_KEY: Your CDP private key"
        echo "  - SELLER_API_URL: CloudFront distribution URL (after deployment)"
    fi
else
    print_status ".env file already exists"
fi

deactivate

echo ""
print_success "Payer Agent setup complete!"
echo ""
echo "To activate the environment:"
echo "  cd payer-agent && source .venv/bin/activate"
echo ""
echo "To run the agent:"
echo "  python -m agent.main"
