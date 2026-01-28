import pkg from "hardhat";
const { ethers } = pkg;

// USDC addresses per chain
const USDC_ADDRESSES: Record<number, string> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// 0x Exchange Proxy addresses
const ZEROX_ADDRESSES: Record<number, string> = {
  1: "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
  10: "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
  137: "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
  42161: "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
  8453: "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const deployerAddress = await deployer.getAddress();
  
  console.log("Deploying PaymentRouter...");
  console.log("Chain ID:", chainId);
  console.log("Deployer:", deployerAddress);

  // Use mainnet USDC for local testing, or chain-specific for real deployments
  const usdc = USDC_ADDRESSES[chainId] || USDC_ADDRESSES[1];
  const zeroX = ZEROX_ADDRESSES[chainId] || ZEROX_ADDRESSES[1];

  if (!usdc || !zeroX) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  // Use deployer as fee recipient if not set or if placeholder value
  const envFeeRecipient = process.env.FEE_RECIPIENT;
  const feeRecipientAddr = (envFeeRecipient && envFeeRecipient.startsWith("0x")) 
    ? envFeeRecipient 
    : deployerAddress;
  const aggregators: string[] = [zeroX];

  console.log("  USDC:", usdc);
  console.log("  Fee Recipient:", feeRecipientAddr);
  console.log("  Aggregators:", aggregators);

  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  
  // Deploy with explicit typed arguments
  const router = await PaymentRouter.deploy(
    usdc,
    feeRecipientAddr,
    aggregators
  );

  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("✅ PaymentRouter deployed to:", routerAddress);
  console.log("");
  console.log("Configuration:");
  console.log("  USDC:", usdc);
  console.log("  Fee Recipient:", feeRecipientAddr);
  console.log("  Approved Aggregators:", [zeroX]);
  console.log("");
  console.log("Next steps:");
  console.log(`1. Verify contract: npx hardhat verify --network <network> ${routerAddress} ${usdc} ${feeRecipientAddr} "[${zeroX}]"`);
  console.log("2. Add more aggregators if needed");
  console.log("3. Update .env with PAYMENT_ROUTER_<CHAIN> address");

  return routerAddress;
}

main()
  .then((address) => {
    console.log("\nDeployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
