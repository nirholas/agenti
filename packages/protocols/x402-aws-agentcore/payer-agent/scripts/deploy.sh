#!/bin/bash
# Deploy x402 Payer Agent to Bedrock AgentCore Runtime
#
# This script orchestrates the complete deployment process:
# 1. Validates prerequisites
# 2. Deploys CDK infrastructure (if needed)
# 3. Packages the agent code
# 4. Provides deployment instructions
#
# Usage:
#   ./scripts/deploy.sh [--skip-cdk] [--dry-run] [--region REGION]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SKIP_CDK=false
DRY_RUN=false
REGION="${AWS_REGION:-us-west-2}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-cdk)
            SKIP_CDK=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$(dirname "$PROJECT_ROOT")/payer-infrastructure"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}x402 Payer Agent - Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Region: $REGION"
echo "Project Root: $PROJECT_ROOT"
echo "Infrastructure Dir: $INFRA_DIR"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 is required${NC}"
        exit 1
    fi
    echo "  ✓ Python 3 found"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI is required${NC}"
        exit 1
    fi
    echo "  ✓ AWS CLI found"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}Error: AWS credentials not configured${NC}"
        exit 1
    fi
    echo "  ✓ AWS credentials configured"
    
    # Check Node.js (for CDK)
    if ! command -v node &> /dev/null; then
        echo -e "${YELLOW}Warning: Node.js not found. CDK deployment may fail.${NC}"
    else
        echo "  ✓ Node.js found"
    fi
    
    # Check CDK
    if ! command -v cdk &> /dev/null; then
        echo -e "${YELLOW}Warning: CDK CLI not found. Install with: npm install -g aws-cdk${NC}"
    else
        echo "  ✓ CDK CLI found"
    fi
    
    echo ""
}

# Function to deploy CDK infrastructure
deploy_cdk() {
    echo -e "${YELLOW}Deploying CDK infrastructure...${NC}"
    
    if [ ! -d "$INFRA_DIR" ]; then
        echo -e "${RED}Error: Infrastructure directory not found: $INFRA_DIR${NC}"
        exit 1
    fi
    
    cd "$INFRA_DIR"
    
    # Install dependencies
    if [ -f "package.json" ]; then
        echo "  Installing CDK dependencies..."
        npm install --silent
    fi
    
    # Deploy stack
    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY RUN] Would run: cdk deploy --require-approval never"
        cdk synth
    else
        echo "  Deploying X402PayerAgentStack..."
        cdk deploy --require-approval never
    fi
    
    cd "$PROJECT_ROOT"
    echo -e "${GREEN}  ✓ CDK infrastructure deployed${NC}"
    echo ""
}

# Function to get stack outputs
get_stack_outputs() {
    echo -e "${YELLOW}Fetching stack outputs...${NC}"
    
    RUNTIME_ROLE_ARN=$(aws cloudformation describe-stacks \
        --stack-name X402PayerAgentStack \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='AgentRuntimeRoleArn'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    CDP_SECRET_ARN=$(aws cloudformation describe-stacks \
        --stack-name X402PayerAgentStack \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='CdpSecretArn'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$RUNTIME_ROLE_ARN" ]; then
        echo "  Runtime Role ARN: $RUNTIME_ROLE_ARN"
        export X402_PAYER_AGENT_RUNTIME_ROLE_ARN="$RUNTIME_ROLE_ARN"
    else
        echo -e "${YELLOW}  Warning: Could not fetch Runtime Role ARN${NC}"
    fi
    
    if [ -n "$CDP_SECRET_ARN" ]; then
        echo "  CDP Secret ARN: $CDP_SECRET_ARN"
        export X402_PAYER_AGENT_CDP_SECRET_ARN="$CDP_SECRET_ARN"
    else
        echo -e "${YELLOW}  Warning: Could not fetch CDP Secret ARN${NC}"
    fi
    
    echo ""
}

# Function to package and prepare deployment
package_agent() {
    echo -e "${YELLOW}Packaging agent for deployment...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Create virtual environment if needed
    if [ ! -d ".venv" ]; then
        echo "  Creating virtual environment..."
        python3 -m venv .venv
    fi
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Install dependencies
    echo "  Installing dependencies..."
    pip install -q -e ".[dev]"
    pip install -q pyyaml
    
    # Run deployment script
    if [ "$DRY_RUN" = true ]; then
        python scripts/deploy_to_agentcore.py --dry-run --region "$REGION"
    else
        python scripts/deploy_to_agentcore.py --region "$REGION"
    fi
    
    deactivate
    
    echo -e "${GREEN}  ✓ Agent packaged${NC}"
    echo ""
}

# Function to run local tests
run_local_tests() {
    echo -e "${YELLOW}Running local agent tests...${NC}"
    
    cd "$PROJECT_ROOT"
    source .venv/bin/activate
    
    # Run unit tests
    echo "  Running unit tests..."
    if python -m pytest tests/ -v --tb=short 2>/dev/null; then
        echo -e "${GREEN}  ✓ Unit tests passed${NC}"
    else
        echo -e "${YELLOW}  Warning: Some tests failed or no tests found${NC}"
    fi
    
    deactivate
    echo ""
}

# Main deployment flow
main() {
    check_prerequisites
    
    if [ "$SKIP_CDK" = false ]; then
        deploy_cdk
    else
        echo -e "${YELLOW}Skipping CDK deployment (--skip-cdk)${NC}"
        echo ""
    fi
    
    get_stack_outputs
    package_agent
    run_local_tests
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment Preparation Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Update CDP credentials in Secrets Manager:"
    echo "     aws secretsmanager put-secret-value \\"
    echo "       --secret-id x402-payer-agent/cdp-credentials \\"
    echo "       --secret-string '{\"CDP_API_KEY_NAME\":\"your-key\",\"CDP_API_KEY_PRIVATE_KEY\":\"your-private-key\"}'"
    echo ""
    echo "  2. Deploy to AgentCore Runtime using AWS Console or CLI"
    echo "     (See deployment instructions in dist/deployment_info.json)"
    echo ""
    echo "  3. Test the agent:"
    echo "     python scripts/test_agent_invocation.py --local"
    echo ""
}

main
