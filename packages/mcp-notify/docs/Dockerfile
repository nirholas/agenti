# Dockerfile for MkDocs documentation site
# Deploy to Railway or any container platform
# IMPORTANT: Must be built with repo root as context (not /docs)
FROM python:3.11-slim AS builder

WORKDIR /build

# Install MkDocs and plugins
RUN pip install --no-cache-dir \
    mkdocs-material \
    mkdocs-minify-plugin \
    mkdocs-git-revision-date-localized-plugin \
    mkdocs-glightbox

# Copy docs source (context is repo root)
COPY mkdocs.yml /build/
COPY docs/ /build/docs/

# Build static site
RUN mkdocs build

# Production image with nginx
FROM nginx:alpine

# Copy built site
COPY --from=builder /build/site /usr/share/nginx/html

# Custom nginx config for SPA routing
RUN echo 'server { \
    listen 8080; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ $uri.html /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
