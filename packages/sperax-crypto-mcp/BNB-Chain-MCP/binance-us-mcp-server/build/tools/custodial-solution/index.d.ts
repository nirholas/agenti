import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Register all Binance.US Custodial Solution tools
 *
 * ⚠️ IMPORTANT: These endpoints require a Custodial Solution API Key
 * Regular Exchange API Keys will NOT work with these endpoints.
 *
 * Custodial Solution API is for institutional users who have entered into
 * a Custody Exchange Network agreement with a participating custody partner.
 *
 * Categories:
 * - User Account Data (balance, supported assets)
 * - Transfer (wallet transfer, custodian transfer, undo transfer)
 * - Settlement (to custodial partner)
 */
export declare function registerCustodialSolutionTools(server: McpServer): void;
//# sourceMappingURL=index.d.ts.map