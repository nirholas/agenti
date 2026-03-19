FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY public ./public

RUN groupadd -r gateway && useradd -r -g gateway gateway
RUN chown -R gateway:gateway /app
USER gateway

ENV NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

CMD ["node", "src/index.js"]
