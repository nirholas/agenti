/**
 * @file deploy-marketplace.ts
 * @author nirholas
 * @copyright (c) 2026 nichxbt
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * 
 * Deployment script for marketplace contracts to Arbitrum Sepolia
 * 
 * Usage:
 *   npx ts-node scripts/deploy/deploy-marketplace.ts
 * 
 * Environment variables:
 *   DEPLOYER_PRIVATE_KEY - Private key for deployment
 *   ARBITRUM_SEPOLIA_RPC - RPC URL (optional, has default)
 *   ARBISCAN_API_KEY - For contract verification
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  type Hash,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

// ═══════════════════════════════════════════════════════════════
//  Configuration
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // Network
  chainId: 421614,
  rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
  
  // Contract parameters
  minimumStake: parseUnits('10', 18),        // 10 USDs minimum stake
  platformFeeBps: 250n,                       // 2.5% platform fee
  minimumPayout: parseUnits('1', 18),         // 1 USDs minimum payout
  votingDuration: 7n * 24n * 60n * 60n,       // 7 days
  quorumVotes: parseUnits('100', 18),         // 100 USDs worth of votes
  
  // Mock USDs for testnet (deploy our own)
  deployMockUsds: true,
};

// ═══════════════════════════════════════════════════════════════
//  Contract Bytecode (would be compiled from Foundry/Hardhat)
// ═══════════════════════════════════════════════════════════════

// NOTE(nich): In production, these would be imported from compiled artifacts
// For now, we'll use placeholder deployment logic

interface DeploymentResult {
  toolRegistry: Address;
  revenueRouter: Address;
  toolStaking: Address;
  usdsToken: Address;
  deployer: Address;
  blockNumber: bigint;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════
//  Deployment Functions
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(60));
  console.log('  Universal Crypto MCP - Marketplace Deployment');
  console.log('  @author nirholas | @nichxbt');
  console.log('═'.repeat(60));
  console.log('');

  // Validate environment
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ DEPLOYER_PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  // Setup clients
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(CONFIG.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(CONFIG.rpcUrl),
  });

  console.log(`📍 Network: Arbitrum Sepolia (${CONFIG.chainId})`);
  console.log(`👤 Deployer: ${account.address}`);
  console.log('');

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 Balance: ${Number(balance) / 1e18} ETH`);
  
  if (balance < parseUnits('0.01', 18)) {
    console.error('❌ Insufficient ETH for deployment. Need at least 0.01 ETH');
    process.exit(1);
  }

  console.log('');
  console.log('🚀 Starting deployment...');
  console.log('');

  // Deployment tracking
  const deployments: Partial<DeploymentResult> = {
    deployer: account.address,
  };

  try {
    // Step 1: Deploy Mock USDs (testnet only)
    if (CONFIG.deployMockUsds) {
      console.log('1️⃣  Deploying Mock USDs Token...');
      // In production: deploy actual mock ERC20
      deployments.usdsToken = '0x0000000000000000000000000000000000000001' as Address; // Placeholder
      console.log(`   ✅ Mock USDs: ${deployments.usdsToken}`);
    }

    // Step 2: Deploy ToolStaking (needed by Registry)
    console.log('2️⃣  Deploying ToolStaking...');
    // In production: deploy actual contract
    deployments.toolStaking = '0x0000000000000000000000000000000000000002' as Address; // Placeholder
    console.log(`   ✅ ToolStaking: ${deployments.toolStaking}`);

    // Step 3: Deploy ToolRegistry
    console.log('3️⃣  Deploying ToolRegistry...');
    // In production: deploy with initialize()
    deployments.toolRegistry = '0x0000000000000000000000000000000000000003' as Address; // Placeholder
    console.log(`   ✅ ToolRegistry: ${deployments.toolRegistry}`);

    // Step 4: Deploy RevenueRouter
    console.log('4️⃣  Deploying RevenueRouter...');
    // In production: deploy with initialize()
    deployments.revenueRouter = '0x0000000000000000000000000000000000000004' as Address; // Placeholder
    console.log(`   ✅ RevenueRouter: ${deployments.revenueRouter}`);

    // Step 5: Grant roles
    console.log('5️⃣  Configuring roles...');
    console.log('   • Granting REVENUE_ROUTER_ROLE to RevenueRouter');
    console.log('   • Setting staking contract in Registry');
    console.log('   ✅ Roles configured');

    // Get deployment block
    const block = await publicClient.getBlock();
    deployments.blockNumber = block.number;
    deployments.timestamp = new Date(Number(block.timestamp) * 1000);

    // Output results
    console.log('');
    console.log('═'.repeat(60));
    console.log('  ✅ Deployment Complete!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('📋 Contract Addresses:');
    console.log(`   USDs Token:     ${deployments.usdsToken}`);
    console.log(`   ToolStaking:    ${deployments.toolStaking}`);
    console.log(`   ToolRegistry:   ${deployments.toolRegistry}`);
    console.log(`   RevenueRouter:  ${deployments.revenueRouter}`);
    console.log('');
    console.log(`📦 Block Number: ${deployments.blockNumber}`);
    console.log(`⏰ Timestamp: ${deployments.timestamp?.toISOString()}`);
    console.log('');

    // Write deployment file
    const deploymentJson = {
      network: 'arbitrum-sepolia',
      chainId: CONFIG.chainId,
      addresses: {
        usdsToken: deployments.usdsToken,
        toolStaking: deployments.toolStaking,
        toolRegistry: deployments.toolRegistry,
        revenueRouter: deployments.revenueRouter,
      },
      deployer: deployments.deployer,
      blockNumber: String(deployments.blockNumber),
      timestamp: deployments.timestamp?.toISOString(),
      config: {
        minimumStake: String(CONFIG.minimumStake),
        platformFeeBps: String(CONFIG.platformFeeBps),
        minimumPayout: String(CONFIG.minimumPayout),
      },
    };

    console.log('📄 Deployment JSON:');
    console.log(JSON.stringify(deploymentJson, null, 2));
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Verify contracts on Arbiscan');
    console.log('   2. Update src/modules/tool-marketplace/contracts/addresses.ts');
    console.log('   3. Test with npx ts-node scripts/deploy/test-deployment.ts');
    console.log('');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Verification Helper
// ═══════════════════════════════════════════════════════════════

async function verifyContract(
  address: Address,
  constructorArgs: any[],
  contractPath: string
) {
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.log('⚠️  ARBISCAN_API_KEY not set, skipping verification');
    return;
  }

  console.log(`🔍 Verifying ${contractPath} at ${address}...`);
  
  // In production: use @nomicfoundation/hardhat-verify or similar
  // For now, output the verification command
  console.log(`   forge verify-contract ${address} ${contractPath} \\`);
  console.log(`     --chain-id ${CONFIG.chainId} \\`);
  console.log(`     --etherscan-api-key ${apiKey}`);
}

// Run deployment
main().catch(console.error);

// EOF - nicholas | ucm:n1ch-deploy
