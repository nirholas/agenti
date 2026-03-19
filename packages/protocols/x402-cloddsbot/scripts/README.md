# Clodds Scripts

Build, deployment, and utility scripts.

## Scripts

### Installation
- `install.sh` - One-liner installation script
- `setup.sh` - Post-install setup wizard

### Building
- `build.sh` - Build all packages
- `build-desktop.sh` - Build desktop app
- `build-mobile.sh` - Build mobile apps

### Development
- `dev.sh` - Start development environment
- `test.sh` - Run all tests
- `lint.sh` - Run linters

### Deployment
- `deploy.sh` - Deploy to production
- `docker-build.sh` - Build Docker image
- `release.sh` - Create new release

### Utilities
- `db-migrate.sh` - Run database migrations
- `db-backup.sh` - Backup database
- `logs.sh` - View logs

## Usage

```bash
# Install
curl -fsSL https://clodds.com/install.sh | bash

# Development
./scripts/dev.sh

# Build
./scripts/build.sh

# Test
./scripts/test.sh
```
