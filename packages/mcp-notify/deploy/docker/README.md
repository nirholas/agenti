# Docker Deployment

For Docker deployment, use the `docker-compose.yaml` in the project root.

## Quick Start

```bash
# Development
docker compose up -d

# Production (with external database)
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d
```

## Build Only

```bash
# Build the image
docker build -t mcp-notify:latest .

# Run standalone
docker run -d \
  -p 8080:8080 \
  -e DATABASE_URL=postgres://user:pass@host:5432/db \
  -e REDIS_URL=redis://host:6379/0 \
  mcp-notify:latest
```

See [DEPLOYMENT.md](../../docs/DEPLOYMENT.md) for full Docker deployment instructions.
