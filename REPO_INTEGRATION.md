# Repo Integration Guide

How to bring external repos into this x402-powered monorepo.

## Architecture Overview

```
universal-crypto-mcp/
├── src/
│   ├── modules/          ← MCP tool modules (API integrations)
│   │   ├── coingecko/
│   │   ├── defi/
│   │   └── your-module/
│   ├── evm/              ← Core EVM functionality
│   ├── x402/             ← x402 payment protocol
│   └── server/           ← MCP server implementations
├── packages/             ← Standalone packages (full repos with own package.json)
│   ├── binance-mcp-server/
│   ├── x402-ecosystem/
│   └── your-package/
├── plugins/              ← Plugin.delivery plugins (embeddable UIs)
│   ├── crypto-market-data/   ← React frontend → standalone plugin
│   ├── portfolio-tracker/
│   └── your-plugin/
└── x402/                 ← Upstream x402 protocol (subtree)
```

---

## Three Integration Patterns

### Pattern 1: Module (MCP Tools)
**For:** API wrappers, data providers, backend logic

### Pattern 2: Package (Full Repo)  
**For:** Complex projects with own dependencies

### Pattern 3: Plugin (Embeddable UI) ⭐ NEW
**For:** React/HTML frontends that render inside chat via function calls

## Two Integration Patterns

### Pattern 1: Module (Simple API Integration)

Best for: Single-purpose tools, API wrappers, data providers

**Structure:**
```
src/modules/your-module/
├── index.ts    ← Exports registerYourModule(server)
└── tools.ts    ← MCP tool definitions
```

**Template `index.ts`:**
```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerYourModuleTools } from "./tools.js"

export function registerYourModule(server: McpServer) {
  registerYourModuleTools(server)
}
```

**Template `tools.ts`:**
```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerYourModuleTools(server: McpServer) {
  server.tool(
    "your_tool_name",
    "Description of what this tool does",
    {
      param1: z.string().describe("Parameter description")
    },
    async ({ param1 }) => {
      // Implementation
      return {
        content: [{ type: "text", text: "Result" }]
      }
    }
  )
}
```

### Pattern 2: Package (Full Repo)

Best for: Complex projects, repos with their own dependencies, standalone servers

**Structure:**
```
packages/your-package/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    └── index.ts
```

---

## Automation Script

Save as `scripts/import-repo.sh`:

```bash
#!/bin/bash
set -e

# Usage: ./scripts/import-repo.sh <repo-url> <module-name> [--package]
# 
# Examples:
#   ./scripts/import-repo.sh https://github.com/user/crypto-alerts alerts
#   ./scripts/import-repo.sh https://github.com/user/trading-bot trading-bot --package

REPO_URL=$1
MODULE_NAME=$2
IS_PACKAGE=${3:-""}

if [ -z "$REPO_URL" ] || [ -z "$MODULE_NAME" ]; then
  echo "Usage: $0 <repo-url> <module-name> [--package]"
  exit 1
fi

TEMP_DIR=$(mktemp -d)
echo "📦 Cloning $REPO_URL..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR"

if [ "$IS_PACKAGE" == "--package" ]; then
  # Full package integration
  TARGET_DIR="packages/$MODULE_NAME"
  echo "📁 Creating package at $TARGET_DIR"
  
  mkdir -p "$TARGET_DIR"
  
  # Copy everything except .git
  rsync -av --exclude='.git' "$TEMP_DIR/" "$TARGET_DIR/"
  
  echo "✅ Package created at $TARGET_DIR"
  echo ""
  echo "Next steps:"
  echo "  1. Update $TARGET_DIR/package.json name to @nirholas/$MODULE_NAME"
  echo "  2. Add to root package.json workspaces if needed"
  echo "  3. Run: npm install"
  
else
  # Module integration
  TARGET_DIR="src/modules/$MODULE_NAME"
  echo "📁 Creating module at $TARGET_DIR"
  
  mkdir -p "$TARGET_DIR"
  
  # Look for source files
  if [ -d "$TEMP_DIR/src" ]; then
    cp -r "$TEMP_DIR/src/"* "$TARGET_DIR/"
  elif [ -f "$TEMP_DIR/index.ts" ]; then
    cp "$TEMP_DIR/"*.ts "$TARGET_DIR/"
  else
    # Copy all TypeScript files
    find "$TEMP_DIR" -name "*.ts" -exec cp {} "$TARGET_DIR/" \;
  fi
  
  # Create index.ts if missing
  if [ ! -f "$TARGET_DIR/index.ts" ]; then
    MODULE_PASCAL=$(echo "$MODULE_NAME" | sed -r 's/(^|-)(\w)/\U\2/g')
    cat > "$TARGET_DIR/index.ts" << EOF
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { register${MODULE_PASCAL}Tools } from "./tools.js"

export function register${MODULE_PASCAL}(server: McpServer) {
  register${MODULE_PASCAL}Tools(server)
}
EOF
  fi
  
  # Create tools.ts if missing
  if [ ! -f "$TARGET_DIR/tools.ts" ]; then
    MODULE_PASCAL=$(echo "$MODULE_NAME" | sed -r 's/(^|-)(\w)/\U\2/g')
    cat > "$TARGET_DIR/tools.ts" << EOF
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function register${MODULE_PASCAL}Tools(server: McpServer) {
  // TODO: Add your tools here
  server.tool(
    "${MODULE_NAME}_example",
    "Example tool - replace with actual implementation",
    {
      input: z.string().describe("Input parameter")
    },
    async ({ input }) => {
      return {
        content: [{ type: "text", text: \`Received: \${input}\` }]
      }
    }
  )
}
EOF
  fi
  
  echo "✅ Module created at $TARGET_DIR"
  echo ""
  echo "Next steps:"
  echo "  1. Edit $TARGET_DIR/tools.ts to define MCP tools"
  echo "  2. Register in src/server/base.ts:"
  echo "     import { register${MODULE_PASCAL} } from \"@/modules/$MODULE_NAME/index.js\""
  echo "     register${MODULE_PASCAL}(server)"
fi

# Cleanup
rm -rf "$TEMP_DIR"
echo ""
echo "🎉 Done! Don't forget to:"
echo "  - Add file headers with @author nich"
echo "  - Update imports to use @/ path aliases"
echo "  - Test with: npm run dev"
```

---

## Manual Integration Checklist

### For Modules:

- [ ] Create folder: `src/modules/<name>/`
- [ ] Create `index.ts` with `register<Name>(server)` export
- [ ] Create `tools.ts` with `register<Name>Tools(server)` export
- [ ] Add file headers:
  ```typescript
  /**
   * @author nich
   * @website x.com/nichxbt
   * @github github.com/nirholas
   * @license Apache-2.0
   */
  ```
- [ ] Update imports to use `@/` aliases
- [ ] Register in `src/server/base.ts`
- [ ] Export from `src/lib.ts` if public API

### For Packages:

- [ ] Create folder: `packages/<name>/`
- [ ] Copy `package.json`, update name to `@nirholas/<name>`
- [ ] Copy `tsconfig.json`, update paths
- [ ] Copy `src/` folder
- [ ] Update any hardcoded paths
- [ ] Add to workspace if using npm workspaces

---

## Naming Conventions

| Type | Location | Naming |
|------|----------|--------|
| Module folder | `src/modules/` | `kebab-case` |
| Module function | `index.ts` | `registerPascalCase` |
| Tool names | `tools.ts` | `snake_case` with prefix |
| Package folder | `packages/` | `kebab-case` |
| Package name | `package.json` | `@nirholas/kebab-case` |

**Tool naming examples:**
- `coingecko_search`
- `defi_get_tvl`
- `alerts_create`
- `x402_pay`

---

## x402 Monetization

To add x402 payment gating to any tool:

```typescript
import { withX402Payment } from "@/x402/middleware.js"

server.tool(
  "premium_analysis",
  "AI-powered market analysis (0.01 USDC per call)",
  { symbol: z.string() },
  withX402Payment(
    async ({ symbol }) => {
      // Your premium logic
      return { content: [{ type: "text", text: "Analysis result" }] }
    },
    { price: "0.01", token: "USDC" }
  )
)
```

---

## Quick Commands

```bash
# Import as module
./scripts/import-repo.sh https://github.com/user/repo module-name

# Import as package  
./scripts/import-repo.sh https://github.com/user/repo package-name --package

# Test after import
npm run dev

# Build
npm run build

# Lint
npm run lint
```

---

## Your 20 Repos

List your repos here and mark integration type:

| Repo | Type | Status |
|------|------|--------|
| `repo-1` | module | ⬜ |
| `repo-2` | package | ⬜ |
| ... | ... | ... |

---

## Questions?

- **Simple API wrapper?** → Module
- **Has own package.json with deps?** → Package
- **Needs x402 payments?** → Add middleware
- **Standalone server?** → Package with own entry point
