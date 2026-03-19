import {
  createLedgerEvmWallet,
  selectLedgerAccount,
  createReadlineInterface,
} from "@faremeter/wallet-ledger";
import { createPaymentHandler } from "@faremeter/payment-evm/exact";
import { wrap as wrapFetch } from "@faremeter/fetch";
import type { TypedDataDefinition } from "viem";
import { baseSepolia } from "viem/chains";

// Parse command line arguments
const args = process.argv.slice(2);
const port = args[0] ?? "4021";
const endpoint = args[1] ?? "weather";
const url = `http://localhost:${port}/${endpoint}`;

const ui = await createReadlineInterface(process);

ui.message("Connecting to Ledger for Base Sepolia payments...");
ui.message("\nRequired Ledger Settings:");
ui.message("1. Enable 'Blind signing' in Ethereum app settings");
ui.message("2. When prompted, approve the EIP-712 message on your Ledger");

const selected = await selectLedgerAccount(ui, "evm", 5);

if (!selected) {
  process.exit(0);
}

ui.message(`\nUsing account: ${selected.address}`);

const ledgerWallet = await createLedgerEvmWallet(
  ui,
  baseSepolia,
  selected.path,
);

const walletForPayment = {
  chain: ledgerWallet.chain,
  address: ledgerWallet.address,
  account: {
    signTypedData: async (params: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) => {
      return await ledgerWallet.signTypedData(params as TypedDataDefinition);
    },
  },
};

const fetchWithPayer = wrapFetch(fetch, {
  handlers: [createPaymentHandler(walletForPayment)],
});

ui.message(`\nMaking payment request to ${url}...`);
ui.message("When prompted, confirm the transaction on your Ledger...");

const req = await fetchWithPayer(url);
ui.message(`Status: req.status`);
ui.message(`Headers: ${JSON.stringify(Object.fromEntries(req.headers))}`);
const response = await req.json();
ui.message(`Response: ${JSON.stringify(response)}`);

await ledgerWallet.disconnect();
ui.message("\nSuccess! Ledger payment completed.");
await ui.close();
