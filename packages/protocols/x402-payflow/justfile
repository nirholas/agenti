default:
    just --list

# Format all packages in the workspace
format:
    pnpm -r run format

# Build all packages in the workspace
build:
    pnpm -r run build

# Publish all packages in the workspace
publish:
    pnpm -r run format
    pnpm -r run build 
    pnpm -r publish --access public