#!/usr/bin/env bash

# Exit on error
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse command line arguments
VERSION_TYPE="patch"
DRY_RUN=false

print_usage() {
  echo -e "${BLUE}Usage:${NC} $0 [OPTIONS]"
  echo -e "Options:"
  echo -e "  --major         Bump major version (x.0.0)"
  echo -e "  --minor         Bump minor version (0.x.0)"
  echo -e "  --patch         Bump patch version (0.0.x) [default]"
  echo -e "  --dry-run       Run without making any changes"
  echo -e "  --help          Show this help message"
  exit 1
}

for arg in "$@"; do
  case $arg in
    --major)
      VERSION_TYPE="major"
      shift
      ;;
    --minor)
      VERSION_TYPE="minor"
      shift
      ;;
    --patch)
      VERSION_TYPE="patch"
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      print_usage
      ;;
    *)
      # Unknown option
      echo -e "${RED}Unknown option: $arg${NC}"
      print_usage
      ;;
  esac
done

# Check if git working directory is clean
if [[ -n $(git status --porcelain) ]]; then
  echo -e "${RED}Error: Git working directory is not clean.${NC}"
  echo -e "${YELLOW}Please commit or stash your changes before releasing.${NC}"
  exit 1
fi

echo -e "${BLUE}Starting release process...${NC}"

# Build all packages
echo -e "${BLUE}Building all packages...${NC}"
./scripts/build.sh

# Run tests if they exist
echo -e "${BLUE}Running tests...${NC}"
if pnpm run test; then
  echo -e "${GREEN}Tests passed!${NC}"
else
  echo -e "${RED}Tests failed! Aborting release.${NC}"
  exit 1
fi

# Version packages with lerna
echo -e "${BLUE}Versioning packages with lerna...${NC}"
VERSION_CMD="npx lerna version $VERSION_TYPE --no-private --no-push"
if [ "$DRY_RUN" = true ]; then
  VERSION_CMD="$VERSION_CMD --no-git-tag-version"
  echo -e "${YELLOW}DRY RUN: No git tags will be created${NC}"
fi

echo -e "${YELLOW}Running: $VERSION_CMD${NC}"
eval "$VERSION_CMD --yes"

# Publish packages using pnpm to properly resolve catalog references
echo -e "${BLUE}Publishing packages with pnpm...${NC}"

# Get all package directories
PACKAGES=$(find packages -maxdepth 1 -mindepth 1 -type d | sort)

# Publish each package
for package in $PACKAGES; do
  package_name=$(basename "$package")
  
  # Check if package.json exists and is not private
  if [ -f "$package/package.json" ]; then
    IS_PRIVATE=$(cat "$package/package.json" | grep -o '"private":\s*true' || true)
    
    if [ -z "$IS_PRIVATE" ]; then
      echo -e "${GREEN}Publishing $package_name...${NC}"
      
      if [ "$DRY_RUN" = true ]; then
        (cd "$package" && pnpm publish --dry-run --no-git-checks)
      else
        (cd "$package" && pnpm publish --no-git-checks)
      fi
    else
      echo -e "${YELLOW}Skipping private package: $package_name${NC}"
    fi
  fi
done

# Push tags if not dry run
if [ "$DRY_RUN" = false ]; then
  echo -e "${BLUE}Pushing git tags...${NC}"
  git push --follow-tags
fi

echo -e "${GREEN}Release process completed!${NC}" 