#!/bin/bash

# ✨ built by nich
# 🌐 GitHub: github.com/nirholas
# 💫 The web is your canvas, code is your brush ��️


# Lyra Web3 Playground - Quick Deployment Script
# This script helps you deploy the platform quickly

set -e  # Exit on error

echo "🚀 Lyra Web3 Playground Deployment Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

print_success "Node.js is installed: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "npm is installed: $(npm --version)"

echo ""
echo "Select deployment option:"
echo "1) Local development server"
echo "2) Build for production"
echo "3) Deploy to Vercel"
echo "4) Deploy with Docker"
echo "5) Preview production build"
echo ""
read -p "Enter option (1-5): " option

case $option in
    1)
        print_info "Starting local development server..."
        npm install
        print_success "Dependencies installed"
        npm run dev
        ;;
    2)
        print_info "Building for production..."
        npm install
        npm run build
        print_success "Production build complete! Check the 'dist' folder."
        echo ""
        print_info "To test the build locally, run: npm run preview"
        ;;
    3)
        print_info "Deploying to Vercel..."
        if ! command -v vercel &> /dev/null; then
            print_info "Vercel CLI not found. Installing..."
            print_info "You may need sudo privileges for global installation"
            npm install -g vercel || {
                print_error "Failed to install Vercel CLI globally."
                print_info "Try: sudo npm install -g vercel"
                print_info "Or use npx: npx vercel --prod"
                exit 1
            }
        fi
        print_success "Vercel CLI ready"
        
        print_info "Building project..."
        npm install
        npm run build
        
        print_info "Deploying to Vercel..."
        vercel --prod
        print_success "Deployment complete! Check the URL above."
        ;;
    4)
        print_info "Deploying with Docker..."
        if ! command -v docker &> /dev/null; then
            print_error "Docker is not installed. Please install Docker first."
            exit 1
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            print_error "Docker Compose is not installed. Please install Docker Compose first."
            exit 1
        fi
        
        print_success "Docker is installed"
        
        print_info "Building Docker image..."
        docker-compose build
        
        print_info "Starting container..."
        docker-compose up -d
        
        print_success "Deployment complete!"
        echo ""
        print_info "Access your site at: http://localhost:3000"
        echo ""
        echo "To stop: docker-compose down"
        echo "To view logs: docker-compose logs -f"
        ;;
    5)
        print_info "Building and previewing production build..."
        npm install
        npm run build
        print_success "Build complete!"
        echo ""
        print_info "Starting preview server..."
        npm run preview
        ;;
    *)
        print_error "Invalid option. Please run the script again."
        exit 1
        ;;
esac

echo ""
print_success "Done! 🎉"
