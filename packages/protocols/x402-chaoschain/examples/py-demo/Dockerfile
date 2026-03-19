# syntax=docker/dockerfile:1

FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt ./

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Run the demo
CMD ["python", "demo.py"]

