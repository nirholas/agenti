# Lyra Intel - Intelligence Infrastructure Engine
# Multi-stage build for production deployment

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY pyproject.toml ./

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir build && \
    pip install --no-cache-dir -e .

# Copy source code
COPY src/ ./src/
COPY cli.py ./

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM python:3.11-slim as production

LABEL maintainer="Lyra Intel Team"
LABEL description="Intelligence Infrastructure Engine for codebase analysis"
LABEL version="0.3.0"

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r lyra && useradd -r -g lyra lyra

# Copy from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /app /app

# Create directories
RUN mkdir -p /app/data /app/output /app/plugins && \
    chown -R lyra:lyra /app

# Switch to non-root user
USER lyra

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LYRA_DATA_DIR=/app/data \
    LYRA_OUTPUT_DIR=/app/output \
    LYRA_PLUGINS_DIR=/app/plugins

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Default command
ENTRYPOINT ["python", "cli.py"]
CMD ["serve", "--port", "8000", "--host", "0.0.0.0"]

# =============================================================================
# Stage 3: Development
# =============================================================================
FROM python:3.11-slim as development

WORKDIR /app

# Install all dependencies including dev
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e ".[dev]" || pip install --no-cache-dir -e .

COPY . .

ENV PYTHONUNBUFFERED=1 \
    LYRA_ENV=development

EXPOSE 8000 3000

CMD ["python", "cli.py", "status"]
