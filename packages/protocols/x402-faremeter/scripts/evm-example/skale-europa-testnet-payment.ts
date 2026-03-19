import "dotenv/config";
import { logger, logResponse } from "../logger";
import { createLocalWallet } from "@faremeter/wallet-evm";
import { createPaymentHandler } from "@faremeter/payment-evm/exact";
import { wrap as wrapFetch } from "@faremeter/fetch";
import {
  erc20Abi,
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  getAddress,
  isHex,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { skaleEuropaTestnet } from "viem/chains";
import { lookupKnownAsset } from "@faremeter/info/evm";

const EIP3009_FORWARDER = getAddress(
  "0x7779B0d1766e6305E5f8081E3C0CDF58FcA24330",
); // SKALE Europa Testnet, USDC, https://github.com/thegreataxios/eip3009-forwarder

const { EVM_PRIVATE_KEY } = process.env;

if (!EVM_PRIVATE_KEY) {
  throw new Error("EVM_PRIVATE_KEY must be set in your environment");
}

if (!isHex(EVM_PRIVATE_KEY)) {
  throw new Error("Private Key is Not hex value. Must start with 0x");
}

// Extra Setup for Forwarding Approval Reqs.
const publicClient = createPublicClient({
  chain: skaleEuropaTestnet,
  transport: http(),
});

const walletClient = createWalletClient({
  chain: skaleEuropaTestnet,
  transport: http(),
  account: privateKeyToAccount(EVM_PRIVATE_KEY),
});

const token = lookupKnownAsset("skale-europa-testnet", "USDC");

if (!token) {
  throw new Error("Invalid or Missing Token Address in @faremeter/info/evm");
}

const contract = getContract({
  abi: erc20Abi,
  address: getAddress(token?.address),
  client: {
    account: walletClient,
    public: publicClient,
  },
});

const allowance = await contract.read.allowance([
  getAddress(walletClient.account.address),
  EIP3009_FORWARDER,
]);
if (allowance < parseUnits("0.01", 6)) {
  // Approve 1 USDC to enable 100 micro txs without re-up
  const simulateApproval = await contract.simulate.approve(
    [EIP3009_FORWARDER, parseUnits("1", 6)],
    {
      account: walletClient.account,
    },
  );
  const txHash = await walletClient.writeContract(simulateApproval.request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  logger.info(`Approval for 1 ${token.name} Completed`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const port = args[0] ?? "4021";
const endpoint = args[1] ?? "weather";
const url = `http://localhost:${port}/${endpoint}`;

logger.info("Creating wallet for Base Sepolia USDC payments...");
const wallet = await createLocalWallet(skaleEuropaTestnet, EVM_PRIVATE_KEY);
logger.info(`Wallet address: ${wallet.address}`);

const fetchWithPayer = wrapFetch(fetch, {
  handlers: [createPaymentHandler(wallet)],
});

logger.info(`Making payment request to ${url}...`);
const req = await fetchWithPayer(url);
await logResponse(req);
