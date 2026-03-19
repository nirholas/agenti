import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY;
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS;
const NETWORK = process.env.NETWORK || 'base-sepolia';

// Network configurations
const networks = {
  'base-sepolia': {
    rpc: 'https://sepolia.base.org',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    chainId: 84532,
    name: 'Base Sepolia',
    explorer: 'https://sepolia.basescan.org',
    faucets: [
      'https://www.alchemy.com/faucets/base-sepolia',
      'https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet',
    ],
  },
  'base': {
    rpc: 'https://mainnet.base.org',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    chainId: 8453,
    name: 'Base Mainnet',
    explorer: 'https://basescan.org',
  },
};

async function checkWallet() {
  console.log('🔍 Wallet Balance Checker');
  console.log('========================\n');

  if (!CLIENT_PRIVATE_KEY) {
    console.log('❌ CLIENT_PRIVATE_KEY not set in .env');
    console.log('   This is the wallet that will pay for requests');
    return;
  }

  const networkConfig = networks[NETWORK];
  if (!networkConfig) {
    console.log(`❌ Unknown network: ${NETWORK}`);
    return;
  }

  console.log(`📡 Network: ${networkConfig.name}`);
  console.log(`🔗 RPC: ${networkConfig.rpc}\n`);

  try {
    const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
    const clientWallet = new ethers.Wallet(CLIENT_PRIVATE_KEY, provider);

    console.log(`💼 Client Wallet: ${clientWallet.address}`);
    console.log(`💰 Merchant Wallet: ${PAY_TO_ADDRESS}\n`);

    // Check ETH balance
    console.log('=== Client Wallet Balances ===');
    const ethBalance = await provider.getBalance(clientWallet.address);
    const ethFormatted = ethers.formatEther(ethBalance);
    console.log(`ETH: ${ethFormatted}`);

    if (parseFloat(ethFormatted) === 0) {
      console.log('⚠️  No ETH for gas! Get testnet ETH from:');
      networkConfig.faucets?.forEach(f => console.log(`   - ${f}`));
    } else {
      console.log('✅ ETH balance looks good');
    }

    // Check USDC balance
    const usdcContract = new ethers.Contract(
      networkConfig.usdc,
      [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
      ],
      provider
    );

    const usdcBalance = await usdcContract.balanceOf(clientWallet.address);
    const decimals = await usdcContract.decimals();
    const usdcFormatted = ethers.formatUnits(usdcBalance, decimals);
    console.log(`USDC: ${usdcFormatted}`);

    if (parseFloat(usdcFormatted) === 0) {
      console.log('⚠️  No USDC! You need at least $0.10 USDC to test');
      if (networkConfig.faucets) {
        console.log('   Get USDC by:');
        console.log('   1. Get ETH from faucets above');
        console.log('   2. Swap ETH for USDC on a testnet DEX');
      }
    } else {
      const canPay = parseFloat(usdcFormatted) >= 0.10;
      if (canPay) {
        const numTests = Math.floor(parseFloat(usdcFormatted) / 0.10);
        console.log(`✅ USDC balance sufficient! Can run ~${numTests} tests`);
      } else {
        console.log('⚠️  USDC balance too low (need at least $0.10)');
      }
    }

    // Check merchant wallet
    console.log('\n=== Merchant Wallet Balances ===');
    const merchantEthBalance = await provider.getBalance(PAY_TO_ADDRESS);
    const merchantEthFormatted = ethers.formatEther(merchantEthBalance);
    console.log(`ETH: ${merchantEthFormatted}`);

    const merchantUsdcBalance = await usdcContract.balanceOf(PAY_TO_ADDRESS);
    const merchantUsdcFormatted = ethers.formatUnits(merchantUsdcBalance, decimals);
    console.log(`USDC: ${merchantUsdcFormatted}`);

    console.log('\n=== Next Steps ===');
    if (parseFloat(ethFormatted) > 0 && parseFloat(usdcFormatted) >= 0.10) {
      console.log('✅ Your wallet is ready to test!');
      console.log('\nRun the test:');
      console.log('  npm test');
      console.log('\nMonitor transactions:');
      console.log(`  ${networkConfig.explorer}/address/${clientWallet.address}`);
      console.log(`  ${networkConfig.explorer}/address/${PAY_TO_ADDRESS}`);
    } else {
      console.log('📝 To test with real payments, you need:');
      console.log(`1. ETH for gas on ${networkConfig.name}`);
      console.log('2. At least $0.10 USDC');
      console.log('\nWithout these, the test will only demonstrate the payment signing,');
      console.log('but the server will skip submitting the on-chain transfer.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkWallet().catch(console.error);
