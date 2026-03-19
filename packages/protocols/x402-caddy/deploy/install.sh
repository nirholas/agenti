#!/usr/bin/env bash
set -euo pipefail

BINARY="caddy-x402"
REMOTE_HOST="debian@83.228.212.237"
SSH_KEY="$HOME/.ssh/id_infomaniak"
REMOTE_CADDY="/usr/bin/caddy"

echo "==> Building with xcaddy..."
cd "$(dirname "$0")/.."
xcaddy build --with github.com/paolobietolini/caddy-x402=./ --output "./$BINARY"

echo "==> Uploading to VPS..."
scp -i "$SSH_KEY" "./$BINARY" "$REMOTE_HOST:/tmp/$BINARY"

echo "==> Deploying..."
ssh -i "$SSH_KEY" "$REMOTE_HOST" bash -s <<'EOF'
sudo systemctl stop caddy
sudo cp "$REMOTE_CADDY" "$REMOTE_CADDY.backup"
sudo cp "/tmp/caddy-x402" "$REMOTE_CADDY"
sudo chmod +x "$REMOTE_CADDY"
sudo systemctl start caddy
echo "Caddy restarted. Verifying..."
sleep 2
sudo systemctl status caddy --no-pager
EOF

echo "==> Done!"
