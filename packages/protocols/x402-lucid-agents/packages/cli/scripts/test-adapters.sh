#!/bin/bash
# Test all adapters using the playbook
# This script generates projects for each adapter and tests them

set -e

MONOREPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMP_DIR="${TEMP_DIR:-/tmp}"
CLI_PATH="$MONOREPO_ROOT/packages/cli/dist/index.js"
TEMPLATE="${TEMPLATE:-blank}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Adapters to test
ADAPTERS=("hono" "express" "tanstack-ui" "tanstack-headless" "next")

echo -e "${YELLOW}Building monorepo packages...${NC}"
cd "$MONOREPO_ROOT"
bun run build || {
  echo -e "${RED}Failed to build monorepo packages${NC}"
  exit 1
}

echo -e "${YELLOW}Building CLI...${NC}"
cd "$MONOREPO_ROOT/packages/cli"
bun run build || {
  echo -e "${RED}Failed to build CLI${NC}"
  exit 1
}

# Function to copy packages to node_modules
copy_packages() {
  local TEST_PROJECT=$1
  local PACKAGES=("types" "wallet" "payments" "identity" "core" "http" "hono" "express" "tanstack")

  echo -e "${YELLOW}Copying packages to $TEST_PROJECT/node_modules/@lucid-agents/...${NC}"
  mkdir -p "$TEST_PROJECT/node_modules/@lucid-agents"

  for pkg in "${PACKAGES[@]}"; do
    if [ -d "$MONOREPO_ROOT/packages/$pkg/dist" ]; then
      mkdir -p "$TEST_PROJECT/node_modules/@lucid-agents/$pkg"
      cp -r "$MONOREPO_ROOT/packages/$pkg/dist" "$TEST_PROJECT/node_modules/@lucid-agents/$pkg/"
      cp "$MONOREPO_ROOT/packages/$pkg/package.json" "$TEST_PROJECT/node_modules/@lucid-agents/$pkg/"
      echo "  ✓ Copied $pkg"
    fi
  done
}

# Function to fix package.json files
fix_package_jsons() {
  local TEST_PROJECT=$1

  echo -e "${YELLOW}Fixing package.json files in node_modules...${NC}"

  node <<EOF
const fs = require('fs');
const path = require('path');

const packages = [
  'types', 'wallet', 'payments', 'identity', 'core', 'http',
  'hono', 'express', 'tanstack'
];

const testProject = '$TEST_PROJECT';

packages.forEach(pkg => {
  const pkgPath = path.join(testProject, 'node_modules', '@lucid-agents', pkg, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Remove devDependencies
  delete pkgJson.devDependencies;

  // Fix dependencies
  if (pkgJson.dependencies) {
    Object.keys(pkgJson.dependencies).forEach(dep => {
      if (pkgJson.dependencies[dep] === 'workspace:*') {
        // Find the package name
        const depPkg = dep.replace('@lucid-agents/', '');
        pkgJson.dependencies[dep] = \`file:../\${depPkg}\`;
      } else if (pkgJson.dependencies[dep]?.startsWith('catalog:')) {
        // Replace catalog: with a version (use 1.0.0 as placeholder)
        pkgJson.dependencies[dep] = '1.0.0';
      }
    });
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
  console.log('  ✓ Fixed', pkg);
});
EOF
}

# Function to test an adapter
test_adapter() {
  local adapter=$1
  local project_name="test-${adapter}-${TEMPLATE}"
  local test_project="$TEMP_DIR/$project_name"

  echo -e "\n${GREEN}=== Testing $adapter adapter ===${NC}"

  # Clean up if exists
  if [ -d "$test_project" ]; then
    echo -e "${YELLOW}Cleaning up existing project...${NC}"
    rm -rf "$test_project"
  fi

  # Generate project
  echo -e "${YELLOW}Generating project...${NC}"
  cd "$TEMP_DIR"
  bunx "$CLI_PATH" "$project_name" \
    --adapter="$adapter" \
    --template="$TEMPLATE" \
    --non-interactive \
    --AGENT_NAME="$project_name" \
    --AGENT_VERSION="0.1.0" \
    --AGENT_DESCRIPTION="Test agent for $adapter adapter" || {
    echo -e "${RED}Failed to generate project${NC}"
    return 1
  }

  cd "$test_project"

  # Copy packages
  copy_packages "$test_project"

  # Fix package.json files
  fix_package_jsons "$test_project"

  # Install dependencies
  echo -e "${YELLOW}Installing dependencies...${NC}"
  bun install || {
    echo -e "${RED}Failed to install dependencies${NC}"
    return 1
  }

  # Type check
  echo -e "${YELLOW}Type checking...${NC}"
  bunx tsc --noEmit || {
    echo -e "${RED}Type check failed${NC}"
    return 1
  }

  echo -e "${GREEN}✓ $adapter adapter test passed!${NC}"
  return 0
}

# Test all adapters
FAILED=0
PASSED=0

for adapter in "${ADAPTERS[@]}"; do
  if test_adapter "$adapter"; then
    ((PASSED++))
  else
    ((FAILED++))
  fi
done

echo -e "\n${GREEN}=== Summary ===${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
  exit 1
fi

