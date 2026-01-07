import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Import all module registration functions
import { registerBlocks } from "./modules/blocks/index.js"
import { registerBridge } from "./modules/bridge/index.js"
import { registerContracts } from "./modules/contracts/index.js"
import { registerDomains } from "./modules/domains/index.js"
import { registerEvents } from "./modules/events/index.js"
import { registerGas } from "./modules/gas/index.js"
import { registerGovernance } from "./modules/governance/index.js"
import { registerLending } from "./modules/lending/index.js"
import { registerMulticall } from "./modules/multicall/index.js"
import { registerNetwork } from "./modules/network/index.js"
import { registerNews } from "./modules/news/index.js"
import { registerNFT } from "./modules/nft/index.js"
import { registerPortfolio } from "./modules/portfolio/index.js"
import { registerPriceFeeds } from "./modules/price-feeds/index.js"
import { registerSecurity } from "./modules/security/index.js"
import { registerSignatures } from "./modules/signatures/index.js"
import { registerStaking } from "./modules/staking/index.js"
import { registerSwap } from "./modules/swap/index.js"
import { registerTokens } from "./modules/tokens/index.js"
import { registerTransactions } from "./modules/transactions/index.js"
import { registerUtils } from "./modules/utils/index.js"
import { registerWallet } from "./modules/wallet/index.js"

/**
 * Register all EVM modules with the MCP server
 */
export function registerEVM(server: McpServer) {
  // Core modules
  registerNetwork(server)
  registerBlocks(server)
  registerTransactions(server)
  registerContracts(server)

  // Token modules
  registerTokens(server)
  registerNFT(server)

  // DeFi modules
  registerSwap(server)
  registerStaking(server)
  registerLending(server)
  registerBridge(server)
  registerGovernance(server)

  // Utility modules
  registerGas(server)
  registerEvents(server)
  registerMulticall(server)
  registerSignatures(server)
  registerDomains(server)
  registerWallet(server)
  registerPortfolio(server)
  registerUtils(server)

  // Data modules
  registerPriceFeeds(server)
  registerSecurity(server)

  // News module
  registerNews(server)
}
