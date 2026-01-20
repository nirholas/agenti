import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Register all Binance.US Credit Line tools
 *
 * ⚠️ IMPORTANT: These APIs require a Credit Line API key type and an institutional
 * credit line agreement with Binance.US. These are NOT available to retail users.
 *
 * Credit Line allows institutional clients to:
 * - Borrow assets against collateral
 * - Trade with borrowed funds
 * - Manage margin call and liquidation thresholds
 *
 * Key metrics:
 * - LTV (Loan-to-Value): Current loan amount / collateral value
 * - Margin Call LTV: Threshold that triggers margin call alerts
 * - Liquidation LTV: Threshold that triggers automatic liquidation
 */
export declare function registerCreditLineTools(server: McpServer): void;
//# sourceMappingURL=index.d.ts.map