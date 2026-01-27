#!/bin/bash
# Add x402 payment integration to a package
# Usage: ./scripts/add-x402-integration.sh <package-path>
#
# This script:
# 1. Adds x402 dependencies to package.json
# 2. Creates x402 middleware wrapper
# 3. Updates tools to support optional payment gating

set -e

PACKAGE_PATH=$1

if [ -z "$PACKAGE_PATH" ]; then
  echo "Usage: $0 <package-path>"
  echo "Example: $0 packages/exchanges/binance-mcp"
  exit 1
fi

if [ ! -d "$PACKAGE_PATH" ]; then
  echo "Error: Package not found at $PACKAGE_PATH"
  exit 1
fi

echo "🔗 Adding x402 integration to $PACKAGE_PATH"
echo ""

# ============================================================
# Step 1: Add x402 dependency reference
# ============================================================
echo "📦 Step 1: Updating package.json..."

PACKAGE_JSON="$PACKAGE_PATH/package.json"
if [ -f "$PACKAGE_JSON" ]; then
  # Check if x402 is already a dependency
  if ! grep -q '"@x402' "$PACKAGE_JSON"; then
    # Add x402 to dependencies using node
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('$PACKAGE_JSON', 'utf8'));
      pkg.dependencies = pkg.dependencies || {};
      pkg.dependencies['@x402/client'] = 'workspace:*';
      pkg.peerDependencies = pkg.peerDependencies || {};
      pkg.peerDependencies['@nirholas/agenti'] = '>= 0.1.0';
      fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
    " 2>/dev/null || echo "  - Could not auto-update package.json (update manually)"
  else
    echo "  - x402 dependency already present"
  fi
fi

# ============================================================
# Step 2: Create x402 middleware
# ============================================================
echo ""
echo "🛡️ Step 2: Creating x402 middleware..."

X402_DIR="$PACKAGE_PATH/src/x402"
mkdir -p "$X402_DIR"

cat > "$X402_DIR/middleware.ts" << 'EOF'
/**
 * x402 Payment Middleware
 * @description Wraps MCP tools with optional x402 payment gating
 * 
 * @example
 * ```typescript
 * import { withX402 } from "./x402/middleware.js"
 * 
 * server.tool(
 *   "premium_analysis",
 *   "AI market analysis (0.01 USDC)",
 *   { symbol: z.string() },
 *   withX402(
 *     async ({ symbol }) => {
 *       // Your tool logic
 *       return { content: [{ type: "text", text: result }] }
 *     },
 *     { price: "0.01", token: "USDC", chain: "base" }
 *   )
 * )
 * ```
 */

export interface X402PaymentConfig {
  /** Price in token units (e.g., "0.01" for 1 cent) */
  price: string
  /** Token symbol: USDC, USDs, etc. */
  token: string
  /** Chain: base, arbitrum, ethereum */
  chain?: string
  /** Recipient address (defaults to env TOOL_PAYMENT_ADDRESS) */
  recipient?: string
  /** Enable free tier for certain conditions */
  freeTier?: (args: any) => boolean
}

type ToolHandler<T> = (args: T) => Promise<{ content: Array<{ type: string; text: string }> }>

/**
 * Wrap a tool handler with x402 payment verification
 */
export function withX402<T>(
  handler: ToolHandler<T>,
  config: X402PaymentConfig
): ToolHandler<T> {
  return async (args: T) => {
    // Check free tier
    if (config.freeTier && config.freeTier(args)) {
      return handler(args)
    }

    // Check if x402 is enabled
    const x402Enabled = process.env.X402_ENABLED === "true"
    if (!x402Enabled) {
      // Passthrough if x402 not configured
      return handler(args)
    }

    // TODO: Implement actual x402 payment verification
    // For now, this is a placeholder that shows the pricing
    console.log(`[x402] Tool requires payment: ${config.price} ${config.token}`)
    
    // Execute the actual handler
    return handler(args)
  }
}

/**
 * Create pricing info for tool description
 */
export function pricingInfo(config: X402PaymentConfig): string {
  return `💰 ${config.price} ${config.token} per call`
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(address: string): Promise<boolean> {
  // TODO: Implement subscription checking via x402
  return false
}

export default withX402
EOF

echo "  - Created $X402_DIR/middleware.ts"

# ============================================================
# Step 3: Create x402 index export
# ============================================================
cat > "$X402_DIR/index.ts" << 'EOF'
/**
 * x402 Integration Exports
 */
export { withX402, pricingInfo, hasActiveSubscription } from "./middleware.js"
export type { X402PaymentConfig } from "./middleware.js"
EOF

echo "  - Created $X402_DIR/index.ts"

# ============================================================
# Step 4: Create example usage
# ============================================================
echo ""
echo "📝 Step 3: Creating example..."

cat > "$X402_DIR/example.ts" << 'EOF'
/**
 * Example: Adding x402 payments to existing tools
 * 
 * Before:
 * ```typescript
 * server.tool("get_price", "Get token price", { symbol }, async ({ symbol }) => {
 *   const price = await fetchPrice(symbol)
 *   return { content: [{ type: "text", text: price }] }
 * })
 * ```
 * 
 * After (with x402):
 * ```typescript
 * import { withX402, pricingInfo } from "./x402/index.js"
 * 
 * server.tool(
 *   "get_price_premium",
 *   `Get token price with advanced analytics. ${pricingInfo({ price: "0.001", token: "USDC" })}`,
 *   { symbol },
 *   withX402(
 *     async ({ symbol }) => {
 *       const price = await fetchPrice(symbol)
 *       const analysis = await getAdvancedAnalysis(symbol)
 *       return { content: [{ type: "text", text: JSON.stringify({ price, analysis }) }] }
 *     },
 *     { 
 *       price: "0.001", 
 *       token: "USDC",
 *       // Free for basic tokens
 *       freeTier: ({ symbol }) => ["BTC", "ETH"].includes(symbol)
 *     }
 *   )
 * )
 * ```
 */
export {}
EOF

echo "  - Created $X402_DIR/example.ts"

echo ""
echo "✅ x402 integration added to $PACKAGE_PATH"
echo ""
echo "Next steps:"
echo "  1. Import { withX402 } from './x402/index.js' in your tools"
echo "  2. Wrap premium tools with withX402(handler, { price, token })"
echo "  3. Update tool descriptions with pricingInfo()"
echo ""
