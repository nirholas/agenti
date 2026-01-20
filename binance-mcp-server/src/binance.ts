// src/binance.ts
// Central registration file for all Binance modules

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Import module registration functions
import { registerSpot } from "./modules/spot/index.js"
import { registerAlgo } from "./modules/algo/index.js"
import { registerSimpleEarn } from "./modules/simple-earn/index.js"
import { registerC2C } from "./modules/c2c/index.js"
import { registerConvert } from "./modules/convert/index.js"
import { registerWallet } from "./modules/wallet/index.js"
import { registerCopyTrading } from "./modules/copy-trading/index.js"
import { registerFiat } from "./modules/fiat/index.js"
import { registerNFT } from "./modules/nft/index.js"
import { registerPay } from "./modules/pay/index.js"
import { registerRebate } from "./modules/rebate/index.js"
import { registerDualInvestment } from "./modules/dual-investment/index.js"
import { registerMining } from "./modules/mining/index.js"
import { registerVipLoan } from "./modules/vip-loan/index.js"
import { registerStaking } from "./modules/staking/index.js"

/**
 * Register all Binance modules with the MCP server
 */
export function registerBinance(server: McpServer) {
  // Core trading modules
  registerSpot(server)
  registerAlgo(server)
  
  // Earn & Investment modules
  registerSimpleEarn(server)
  registerDualInvestment(server)
  registerStaking(server)
  
  // Trading modules
  registerC2C(server)
  registerConvert(server)
  registerCopyTrading(server)
  
  // Wallet & Finance modules
  registerWallet(server)
  registerFiat(server)
  registerVipLoan(server)
  
  // Other modules
  registerNFT(server)
  registerPay(server)
  registerRebate(server)
  registerMining(server)
}
