#!/usr/bin/env bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Adding prepublishOnly hooks to all packages...${NC}"

# Get all package directories
PACKAGES=$(find packages -maxdepth 1 -mindepth 1 -type d | sort)

# Process each package
for package in $PACKAGES; do
  package_name=$(basename "$package")
  package_json="$package/package.json"
  
  if [ -f "$package_json" ]; then
    echo -e "${GREEN}Processing $package_name...${NC}"
    
    # Check if prepublishOnly already exists
    if grep -q '"prepublishOnly"' "$package_json"; then
      echo "  prepublishOnly hook already exists"
    else
      # Add prepublishOnly hook using jq
      jq '.scripts.prepublishOnly = "pnpm run build"' "$package_json" > "$package_json.tmp" && mv "$package_json.tmp" "$package_json"
      echo "  Added prepublishOnly hook"
    fi
  fi
done

echo -e "${GREEN}Done!${NC}" 