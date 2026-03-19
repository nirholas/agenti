# syntax=docker/dockerfile:1

FROM oven/bun:1.2.21-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Run the demo
CMD ["bun", "run", "dev"]

