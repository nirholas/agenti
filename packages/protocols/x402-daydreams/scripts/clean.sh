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
DRY_RUN=false
CLEAN_DEPS=true
CLEAN_BUILDS=true

print_usage() {
  echo -e "${BLUE}Usage:${NC} $0 [OPTIONS]"
  echo -e "Options:"
  echo -e "  --dry-run       Show what would be deleted without actually deleting"
  echo -e "  --deps-only     Only clean node_modules directories"
  echo -e "  --builds-only   Only clean build output directories"
  echo -e "  --help          Show this help message"
  exit 1
}

for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --deps-only)
      CLEAN_DEPS=true
      CLEAN_BUILDS=false
      shift
      ;;
    --builds-only)
      CLEAN_DEPS=false
      CLEAN_BUILDS=true
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

# Function to format size in human-readable format
format_size() {
  local size=$1
  if [ $size -ge 1073741824 ]; then
    echo "$(awk "BEGIN {printf \"%.2f\", $size/1073741824}") GB"
  elif [ $size -ge 1048576 ]; then
    echo "$(awk "BEGIN {printf \"%.2f\", $size/1048576}") MB"
  elif [ $size -ge 1024 ]; then
    echo "$(awk "BEGIN {printf \"%.2f\", $size/1024}") KB"
  else
    echo "$size bytes"
  fi
}

# Function to calculate directory size
get_dir_size() {
  local dir=$1
  if [[ -d "$dir" ]]; then
    # Use -k instead of -sb for macOS compatibility
    # -k returns size in kilobytes, multiply by 1024 to get bytes
    size_kb=$(du -sk "$dir" | cut -f1)
    echo $((size_kb * 1024))
  else
    echo "0"
  fi
}

# Function to delete directories
delete_dirs() {
  local pattern=$1
  local type_name=$2
  local total_size=0
  local count=0
  
  echo -e "${BLUE}Finding $type_name directories...${NC}"
  
  # Find all matching directories
  dirs=$(find . -type d -name "$pattern" -not -path "*/node_modules/*" -not -path "*/.git/*" | sort)
  
  if [ -z "$dirs" ]; then
    echo -e "${YELLOW}No $type_name directories found.${NC}"
    return
  fi
  
  # Calculate total size and count
  for dir in $dirs; do
    size=$(get_dir_size "$dir")
    total_size=$((total_size + size))
    count=$((count + 1))
    
    if [ "$DRY_RUN" = true ]; then
      human_size=$(format_size $size)
      echo -e "${YELLOW}Would delete:${NC} $dir ${BLUE}($human_size)${NC}"
    fi
  done
  
  human_total_size=$(format_size $total_size)
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Would delete $count $type_name directories, freeing ${human_total_size}${NC}"
  else
    echo -e "${BLUE}Deleting $count $type_name directories (${human_total_size})...${NC}"
    for dir in $dirs; do
      echo -e "${YELLOW}Deleting:${NC} $dir"
      rm -rf "$dir"
    done
    echo -e "${GREEN}Successfully deleted $count $type_name directories, freed ${human_total_size}${NC}"
  fi
}

echo -e "${BLUE}Starting cleanup process...${NC}"

# Clean node_modules directories
if [ "$CLEAN_DEPS" = true ]; then
  delete_dirs "node_modules" "dependency"
fi

# Clean build output directories
if [ "$CLEAN_BUILDS" = true ]; then
  delete_dirs "dist" "build output"
  delete_dirs "build" "build output"
  delete_dirs ".next" "Next.js build"
  delete_dirs ".turbo" "Turbo cache"
  delete_dirs ".cache" "cache"
fi

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Dry run completed. No files were actually deleted.${NC}"
  echo -e "${YELLOW}Run without --dry-run to actually delete the files.${NC}"
else
  echo -e "${GREEN}Cleanup completed successfully!${NC}"
fi 