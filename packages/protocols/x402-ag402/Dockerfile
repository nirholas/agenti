# Builder
FROM python:3.12-slim AS builder
WORKDIR /build
COPY protocol/ protocol/
COPY core/ core/
COPY adapters/mcp/ adapters/mcp/
COPY examples/ examples/
RUN pip install --no-cache-dir ./protocol ./core ./adapters/mcp

# Runtime
FROM python:3.12-slim
RUN groupadd -r ag402 && useradd -r -g ag402 ag402
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/ag402* /usr/local/bin/
COPY --from=builder /build/examples/ /app/examples/
WORKDIR /app
USER ag402
EXPOSE 8000 8001
CMD ["ag402-gateway", "--host", "0.0.0.0", "--port", "8000"]
