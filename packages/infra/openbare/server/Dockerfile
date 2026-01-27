# ============================================================================
# OpenBare Server Dockerfile
# Multi-stage build for minimal production image
# ============================================================================

# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source files
COPY . .

# ============================================================================

# Stage 2: Production image
FROM node:20-alpine AS production

# Add labels
LABEL org.opencontainers.image.title="OpenBare Server"
LABEL org.opencontainers.image.description="A decentralized, censorship-resistant web proxy server"
LABEL org.opencontainers.image.source="https://github.com/nirholas/openbare"
LABEL org.opencontainers.image.licenses="MIT"

# Create non-root user for security
RUN addgroup -g 1001 -S openbare && \
    adduser -S openbare -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source files from builder
COPY --from=builder /app/*.js ./

# Change ownership to non-root user
RUN chown -R openbare:openbare /app

# Switch to non-root user
USER openbare

# Expose port (default 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Environment variables with defaults
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info

# Start server
CMD ["node", "index.js"]
