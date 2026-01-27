---
title: Docker Deployment
description: Deploy MCP Notify with Docker
icon: simple/docker
---

# Docker Deployment

Deploy MCP Notify using Docker and Docker Compose.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify

# Copy example config
cp config.example.yaml config.yaml

# Start with Docker Compose
docker compose up -d
```

## Docker Compose

### Full Stack

The included `docker-compose.yaml` runs all services:

```yaml
services:
  mcp-notify:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/mcp_notify?sslmode=disable
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mcp_notify
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f mcp-notify

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Standalone Docker

### Build Image

```bash
docker build -t mcp-notify:latest .
```

### Run Container

```bash
docker run -d \
  --name mcp-notify \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e REDIS_URL="redis://host:6379" \
  -e API_KEY="your-api-key" \
  mcp-notify:latest
```

## Production Configuration

### With External Databases

```yaml
# docker-compose.prod.yaml
services:
  mcp-notify:
    image: ghcr.io/nirholas/mcp-notify:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - API_KEY=${API_KEY}
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### With Traefik

```yaml
services:
  mcp-notify:
    image: ghcr.io/nirholas/mcp-notify:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mcp-notify.rule=Host(`api.example.com`)"
      - "traefik.http.routers.mcp-notify.tls.certresolver=letsencrypt"
    networks:
      - traefik

  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - traefik_certs:/certs
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=you@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/certs/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    networks:
      - traefik

networks:
  traefik:
    external: true

volumes:
  traefik_certs:
```

## Multi-Stage Dockerfile

The included Dockerfile uses multi-stage builds:

```dockerfile
# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o mcp-notify ./cmd/mcp-notify

# Runtime stage
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/mcp-notify /usr/local/bin/
EXPOSE 8080
ENTRYPOINT ["mcp-notify"]
```

## Resource Limits

```yaml
services:
  mcp-notify:
    image: ghcr.io/nirholas/mcp-notify:latest
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
```

## Backups

### PostgreSQL Backup

```bash
# Create backup
docker compose exec postgres pg_dump -U postgres mcp_notify > backup.sql

# Restore backup
docker compose exec -T postgres psql -U postgres mcp_notify < backup.sql
```

### Automated Backups

```yaml
services:
  backup:
    image: prodrigestivill/postgres-backup-local
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=mcp_notify
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - SCHEDULE=@daily
      - BACKUP_KEEP_DAYS=7
    volumes:
      - ./backups:/backups
```
