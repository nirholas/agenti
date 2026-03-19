# Build stage
FROM rust:slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace files
COPY Cargo.toml ./
COPY api ./api
COPY scanner ./scanner

# Build the application in release mode
RUN cargo build --release --bin api

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary from builder
COPY --from=builder /app/target/release/api /app/api

# Copy configuration template
COPY config.toml /app/config.toml

# Expose the default port
EXPOSE 9000

# Run the application
CMD ["/app/api"]
