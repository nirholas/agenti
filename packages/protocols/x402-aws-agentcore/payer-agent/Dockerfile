FROM python:3.11

WORKDIR /app

# Install system dependencies including libsodium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsodium-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    "strands-agents>=0.1.0" \
    "strands-agents-tools>=0.1.0" \
    "coinbase-agentkit>=0.1.0" \
    "boto3>=1.35.0" \
    "httpx>=0.27.0" \
    "pydantic>=2.0.0" \
    "python-dotenv>=1.0.0" \
    "pyyaml>=6.0.0" \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.30.0" \
    "opentelemetry-api>=1.20.0" \
    "opentelemetry-sdk>=1.20.0" \
    "opentelemetry-exporter-otlp>=1.20.0" \
    "opentelemetry-propagator-aws-xray>=1.0.0" \
    "opentelemetry-sdk-extension-aws>=2.0.0" \
    "opentelemetry-instrumentation-httpx>=0.41b0"

# Force reinstall bcl from source to build native extension
RUN pip uninstall -y bcl && pip install --no-cache-dir --no-binary :all: bcl

# Copy application code
COPY agent/ agent/
COPY main.py .

# Expose port
EXPOSE 8080

# Run the application
CMD ["python", "main.py"]
