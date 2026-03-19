# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/ton/package.json packages/ton/
COPY server/package.json server/
RUN npm install --legacy-peer-deps --ignore-scripts
COPY packages/ton/ packages/ton/
COPY server/ server/
RUN npm run build --workspace=packages/ton
RUN npm run build --workspace=server

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/ton/package.json packages/ton/
COPY --from=builder /app/packages/ton/dist/ packages/ton/dist/
COPY --from=builder /app/server/package.json server/
COPY --from=builder /app/server/dist/ server/dist/
COPY --from=builder /app/node_modules/ node_modules/
# Workspace hoists deps to root node_modules — sub-package node_modules are symlinks

USER app
EXPOSE 4020
ENV NODE_ENV=production
CMD ["node", "server/dist/index.js"]
