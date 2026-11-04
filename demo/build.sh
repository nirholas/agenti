#!/usr/bin/env bash
# Assembles ./public (site + vendored wallet kit + bundled agent signer) and vendors the @agenti/market tool catalog into src/market.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"
mkdir -p src/market
cp ../packages/market/src/tools.ts ../packages/market/src/api.ts src/market/
rm -rf public
cp -r site public
mkdir -p public/kit
cp kit/kit.js kit/kit.css public/kit/
[ -e node_modules ] || npm install --no-audit --no-fund
node_modules/.bin/esbuild client/agent.ts --bundle --format=esm --minify --target=es2022 --outfile=public/app/agent.js --log-level=warning
echo "Built $(find public -type f | wc -l) files into $here/public"
