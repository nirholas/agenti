#!/usr/bin/env bash
#
# Clodds Installation Script
# Usage: curl -fsSL https://clodds.com/install.sh | bash
#

set -e

CLODDS_VERSION="${CLODDS_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.clodds}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# Detect OS
detect_os() {
  case "$(uname -s)" in
    Linux*)  OS=linux;;
    Darwin*) OS=darwin;;
    MINGW*|MSYS*|CYGWIN*) OS=windows;;
    *) error "Unsupported operating system";;
  esac
}

# Detect architecture
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) ARCH=amd64;;
    arm64|aarch64) ARCH=arm64;;
    *) error "Unsupported architecture: $(uname -m)";;
  esac
}

# Check dependencies
check_deps() {
  info "Checking dependencies..."

  if ! command -v node &> /dev/null; then
    error "Node.js is required. Install from https://nodejs.org/"
  fi

  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 18+ is required. Current version: $(node -v)"
  fi

  success "Node.js $(node -v)"
}

# Create directories
create_dirs() {
  info "Creating directories..."
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$BIN_DIR"
  success "Created $INSTALL_DIR"
}

# Install Clodds
install_clodds() {
  info "Installing Clodds..."

  cd "$INSTALL_DIR"

  if [ "$CLODDS_VERSION" = "latest" ]; then
    npm init -y > /dev/null 2>&1 || true
    npm install clodds@latest
  else
    npm init -y > /dev/null 2>&1 || true
    npm install "clodds@$CLODDS_VERSION"
  fi

  # Create symlink
  ln -sf "$INSTALL_DIR/node_modules/.bin/clodds" "$BIN_DIR/clodds"

  success "Installed Clodds"
}

# Add to PATH
setup_path() {
  info "Setting up PATH..."

  SHELL_RC=""
  case "$SHELL" in
    */zsh) SHELL_RC="$HOME/.zshrc";;
    */bash) SHELL_RC="$HOME/.bashrc";;
    *) SHELL_RC="$HOME/.profile";;
  esac

  if [ -f "$SHELL_RC" ]; then
    if ! grep -q "$BIN_DIR" "$SHELL_RC"; then
      echo "" >> "$SHELL_RC"
      echo "# Clodds" >> "$SHELL_RC"
      echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$SHELL_RC"
      success "Added $BIN_DIR to PATH in $SHELL_RC"
    fi
  fi
}

# Print success message
print_success() {
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  Clodds installed successfully! 🎉${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "To get started:"
  echo ""
  echo "  1. Start a new shell or run:"
  echo "     source $SHELL_RC"
  echo ""
  echo "  2. Run the setup wizard:"
  echo "     clodds onboard"
  echo ""
  echo "  3. Start Clodds:"
  echo "     clodds start"
  echo ""
  echo "Documentation: https://clodds.com/docs"
  echo "Discord: https://discord.gg/clodds"
  echo ""
}

# Main
main() {
  echo ""
  echo -e "${BLUE}Clodds Installer${NC}"
  echo "================"
  echo ""

  detect_os
  detect_arch
  check_deps
  create_dirs
  install_clodds
  setup_path
  print_success
}

main "$@"
