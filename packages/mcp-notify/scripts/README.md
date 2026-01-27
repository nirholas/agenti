# Scripts

Utility scripts for development and operations.

## Available Scripts

### Development

```bash
# Run locally with hot reload
make dev

# Run tests
make test

# Run linter
make lint
```

### Database

```bash
# Run migrations
make migrate-up

# Rollback migrations
make migrate-down

# Create new migration
make migrate-create name=add_new_table
```

### Build

```bash
# Build all binaries
make build

# Build Docker image
make docker-build

# Build for all platforms
make build-all
```

See the [Makefile](../Makefile) for all available commands.
