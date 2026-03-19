#!/bin/sh
set -e

# Directory for certificates
CERT_DIR="/etc/nginx/certs"
mkdir -p "$CERT_DIR"

# Check if this is the first run
if [ ! -f "$CERT_DIR/.initialized" ]; then
    # Generate self-signed certificate if not exists
    if [ ! -f "$CERT_DIR/server.crt" ] || [ ! -f "$CERT_DIR/server.key" ]; then
        echo "Generating self-signed certificate in $CERT_DIR..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$CERT_DIR/server.key" \
            -out "$CERT_DIR/server.crt" \
            -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=localhost"
    fi
    touch "$CERT_DIR/.initialized"
fi

# Execute the CMD
exec "$@"

