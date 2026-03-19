# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
# Copy package.json and lockfile
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose the port
EXPOSE 3000

# Start the server
CMD ["bun", "run", "src/index.ts"]
