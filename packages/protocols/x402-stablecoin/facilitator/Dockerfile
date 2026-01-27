# X402 Payment Facilitator Docker Image
# Multi-stage build for production deployment

# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

# Add labels
LABEL org.opencontainers.image.title="X402 Payment Facilitator"
LABEL org.opencontainers.image.description="Production payment facilitator for X402 protocol on Arbitrum"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/nirholas/x402"

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S facilitator -u 1001

WORKDIR /app

# Copy production files
COPY --from=builder --chown=facilitator:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=facilitator:nodejs /app/dist ./dist
COPY --from=builder --chown=facilitator:nodejs /app/package.json ./

# Create logs directory
RUN mkdir -p logs && chown facilitator:nodejs logs

# Switch to non-root user
USER facilitator

# Environment variables with defaults
ENV NODE_ENV=production
ENV PORT=3002
ENV HOST=0.0.0.0
ENV NETWORK=arbitrum-sepolia
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE 3002

# Start server
CMD ["node", "dist/server.js"]
