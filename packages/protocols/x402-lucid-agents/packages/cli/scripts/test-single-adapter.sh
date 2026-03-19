#!/bin/bash
# Test a single adapter using the playbook
# Usage: ./test-single-adapter.sh <adapter> [template]

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <adapter> [template]"
  echo "Adapters: hono, express, tanstack-ui, tanstack-headless, next"
  exit 1
fi

ADAPTER=$1
TEMPLATE=${2:-blank}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Script is in packages/cli/scripts/, so go up 2 levels to get monorepo root
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEMP_DIR="${TEMP_DIR:-/tmp}"
CLI_PATH="$MONOREPO_ROOT/packages/cli/dist/index.js"
PROJECT_NAME="test-${ADAPTER}-${TEMPLATE}"
TEST_PROJECT="$TEMP_DIR/$PROJECT_NAME"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing $ADAPTER adapter with $TEMPLATE template...${NC}"

# Build CLI if needed
if [ ! -f "$CLI_PATH" ]; then
  echo -e "${YELLOW}Building CLI...${NC}"
  cd "$MONOREPO_ROOT/packages/cli"
  bun run build || {
    echo -e "${RED}Failed to build CLI${NC}"
    exit 1
  }
fi

# Clean up if exists
if [ -d "$TEST_PROJECT" ]; then
  echo -e "${YELLOW}Cleaning up existing project...${NC}"
  rm -rf "$TEST_PROJECT"
fi

# Generate project
echo -e "${YELLOW}Generating project...${NC}"
cd "$TEMP_DIR"
bun "$CLI_PATH" "$PROJECT_NAME" \
  --adapter="$ADAPTER" \
  --template="$TEMPLATE" \
  --non-interactive \
  --AGENT_NAME="$PROJECT_NAME" \
  --AGENT_VERSION="0.1.0" \
  --AGENT_DESCRIPTION="Test agent for $ADAPTER adapter" || {
  echo -e "${RED}Failed to generate project${NC}"
  exit 1
}

cd "$TEST_PROJECT"

# Copy packages
echo -e "${YELLOW}Copying packages...${NC}"
mkdir -p node_modules/@lucid-agents

PACKAGES=("types" "wallet" "payments" "identity" "core" "http" "hono" "express" "tanstack")

for pkg in "${PACKAGES[@]}"; do
  if [ -d "$MONOREPO_ROOT/packages/$pkg/dist" ]; then
    mkdir -p "node_modules/@lucid-agents/$pkg"
    cp -r "$MONOREPO_ROOT/packages/$pkg/dist" "node_modules/@lucid-agents/$pkg/"
    cp "$MONOREPO_ROOT/packages/$pkg/package.json" "node_modules/@lucid-agents/$pkg/"
    echo "  ✓ Copied $pkg"
  fi
done

# Fix package.json files
echo -e "${YELLOW}Fixing package.json files...${NC}"
node <<EOF
const fs = require('fs');
const path = require('path');

const packages = ['types', 'wallet', 'payments', 'identity', 'core', 'http', 'hono', 'express', 'tanstack'];
const testProject = '$TEST_PROJECT';

packages.forEach(pkg => {
  const pkgPath = path.join(testProject, 'node_modules', '@lucid-agents', pkg, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  delete pkgJson.devDependencies;

  if (pkgJson.dependencies) {
    Object.keys(pkgJson.dependencies).forEach(dep => {
      if (pkgJson.dependencies[dep] === 'workspace:*') {
        const depPkg = dep.replace('@lucid-agents/', '');
        pkgJson.dependencies[dep] = \`file:../\${depPkg}\`;
      } else if (pkgJson.dependencies[dep]?.startsWith('catalog:')) {
        pkgJson.dependencies[dep] = '1.0.0';
      }
    });
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
  console.log('  ✓ Fixed', pkg);
});
EOF

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
bun install || {
  echo -e "${RED}Failed to install dependencies${NC}"
  exit 1
}

# Type check
echo -e "${YELLOW}Type checking...${NC}"
bunx tsc --noEmit || {
  echo -e "${RED}Type check failed${NC}"
  exit 1
}

echo -e "${GREEN}✓ $ADAPTER adapter test passed!${NC}"
echo -e "${GREEN}Project location: $TEST_PROJECT${NC}"

