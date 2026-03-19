# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy the entire workspace for proper dependency resolution
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile

# Build core package first (required by facilitator-server)
RUN cd packages/core && bun run build

# Build facilitator-server
RUN cd examples/facilitator-server && bun run build

# Production stage
FROM oven/bun:1-slim
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy built artifacts and dependencies
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/examples/facilitator-server/dist examples/facilitator-server/dist
COPY --from=builder /app/examples/facilitator-server/package.json examples/facilitator-server/
COPY --from=builder /app/examples/facilitator-server/public examples/facilitator-server/public
COPY --from=builder /app/examples/facilitator-server/drizzle examples/facilitator-server/drizzle

WORKDIR /app/examples/facilitator-server

# Default environment
ENV PORT=8090
ENV NODE_ENV=production

EXPOSE 8090

# Health check using /supported endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8090/supported || exit 1

CMD ["bun", "run", "start"]
