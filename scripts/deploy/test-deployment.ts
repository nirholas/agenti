/**
 * @file test-deployment.ts
 * @author nirholas
 * @copyright (c) 2026 nichxbt
 * @repository universal-crypto-mcp
 * 
 * Test script to verify deployed marketplace contracts
 * 
 * Usage:
 *   npx ts-node scripts/deploy/test-deployment.ts
 */

import { createOnChainRegistry, type ChainId } from '../../src/modules/tool-marketplace/contracts';

const CHAIN_ID: ChainId = 421614; // Arbitrum Sepolia

async function main() {
  console.log('═'.repeat(60));
  console.log('  Marketplace Contract Test Suite');
  console.log('  @author nirholas | @nichxbt');
  console.log('═'.repeat(60));
  console.log('');

  const registry = createOnChainRegistry(CHAIN_ID);

  console.log('📋 Contract Addresses:');
  const addresses = registry.getAddresses();
  console.log(`   ToolRegistry:   ${addresses.toolRegistry}`);
  console.log(`   RevenueRouter:  ${addresses.revenueRouter}`);
  console.log(`   ToolStaking:    ${addresses.toolStaking}`);
  console.log(`   USDs Token:     ${addresses.usdsToken}`);
  console.log('');

  // Skip tests if contracts not deployed
  if (addresses.toolRegistry === '0x0000000000000000000000000000000000000000') {
    console.log('⚠️  Contracts not yet deployed. Run deploy-marketplace.ts first.');
    return;
  }

  console.log('🧪 Running tests...');
  console.log('');

  // Test 1: Get total tools
  try {
    console.log('Test 1: Get total tools');
    const total = await registry.getTotalTools();
    console.log(`   ✅ Total tools: ${total}`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test 2: Get platform fee
  try {
    console.log('Test 2: Get platform fee');
    const fee = await registry.getPlatformFee();
    console.log(`   ✅ Platform fee: ${fee}%`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test 3: Get minimum stake
  try {
    console.log('Test 3: Get minimum stake');
    const stake = await registry.getMinimumStake();
    console.log(`   ✅ Minimum stake: ${stake.formatted} USDs`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test 4: Compute tool ID
  try {
    console.log('Test 4: Compute tool ID');
    const toolId = registry.computeToolId(
      'test-tool',
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0dA81'
    );
    console.log(`   ✅ Tool ID: ${toolId}`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test 5: Check non-existent tool
  try {
    console.log('Test 5: Check non-existent tool');
    const exists = await registry.toolExists(
      '0x0000000000000000000000000000000000000000000000000000000000000001'
    );
    console.log(`   ✅ Tool exists: ${exists}`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('  Tests complete!');
  console.log('═'.repeat(60));
}

main().catch(console.error);

// EOF - nich | ucm:n1ch-test
