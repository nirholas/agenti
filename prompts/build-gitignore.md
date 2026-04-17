# Build: .gitignore and Project Hygiene

status: pending

## Goal
Create a proper `.gitignore` and ensure no sensitive files can be accidentally committed to the public agenti repo.

## Output: `.gitignore`
```gitignore
# Build outputs
dist/
*.tsbuildinfo

# Dependencies
node_modules/
.pnpm-store/

# Environment (NEVER commit)
.env
.env.*
!.env.example

# Private keys (NEVER commit)
*.pem
*.key
keystore/
wallet.json

# Cloned private repos (NEVER commit)
/tmp/
private/
_private/

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/
*.swp

# Test coverage
coverage/
.nyc_output/

# Logs
*.log
npm-debug.log*

# Misc
.turbo/
.cache/
```

## Also create `.env.example`
```bash
# Agenti configuration — copy to .env and fill in
AGENTI_EVM_PRIVATE_KEY=0x...
AGENTI_SOLANA_PRIVATE_KEY=...
AGENTI_FACILITATOR_URL=https://facilitator.agenti.cash

# Optional: RPC overrides
AGENTI_BASE_RPC_URL=
AGENTI_SOLANA_RPC_URL=

# For running examples
EVM_KEY=0x...
```

## Verify
After creating `.gitignore`, run:
```
git status
```
Confirm that `node_modules/`, `dist/`, and any `.env` files are not shown as tracked.

Mark this file's status as `complete` when done.
