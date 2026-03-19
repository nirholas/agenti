#!/usr/bin/env bash
set -e

# === Configuration ===
CERT_DIR="${1:-./certs}"
CERT_NAME="localhost"
DAYS_VALID=825

mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

echo "📁 Generating certificate in: $(pwd)"

# === Step 1: Create OpenSSL config for SAN ===
cat > "${CERT_NAME}.cnf" <<EOF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
x509_extensions    = v3_req
distinguished_name = dn

[dn]
C = US
ST = California
L = Menlo Park
O = Localhost Dev
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
EOF

# === Step 2: Generate key and self-signed certificate ===
echo "🔐 Generating key and certificate..."
openssl req -x509 -nodes -days "$DAYS_VALID" \
  -newkey rsa:2048 \
  -keyout "${CERT_NAME}.key" \
  -out "${CERT_NAME}.crt" \
  -config "${CERT_NAME}.cnf"

# === Step 3: Verify SAN entries ===
echo "✅ Verifying certificate..."
openssl x509 -in "${CERT_NAME}.crt" -text -noout | grep -A 1 "Subject Alternative Name" || true

# === Step 4: Output summary ===
echo ""
echo "🎉 Done!"
echo "Certificate: $(realpath ${CERT_NAME}.crt)"
echo "Private key: $(realpath ${CERT_NAME}.key)"
echo ""
echo "Use these in your Wangle/Traefik config:"
echo "  sslCfg.addCertificate(\"$(realpath ${CERT_NAME}.crt)\","
echo "                        \"$(realpath ${CERT_NAME}.key)\", \"\");"
echo ""
echo "To trust locally (optional):"
echo "  macOS: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${CERT_NAME}.crt"
echo "  Linux: sudo cp ${CERT_NAME}.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates"
echo "  Windows: import ${CERT_NAME}.crt into 'Trusted Root Certification Authorities'"
