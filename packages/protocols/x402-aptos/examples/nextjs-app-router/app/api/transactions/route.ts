/**
 * x402a Transaction History API
 *
 * Fetches transaction history for a user by querying:
 * 1. Account transactions from Aptos indexer
 * 2. Filters for x402_transfer module events
 * 3. Returns formatted transaction list
 */

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { type NextRequest, NextResponse } from "next/server";

interface Transaction {
  txHash: string;
  from: string;
  to: string | string[];
  amount: string | string[];
  timestamp: number;
  type: "single" | "split";
  success: boolean;
  explorerUrl: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Address parameter required" }, { status: 400 });
    }

    // Initialize Aptos client
    const network = (process.env.NEXT_PUBLIC_APTOS_NETWORK || "testnet") as
      | "testnet"
      | "mainnet"
      | "devnet";
    const aptosConfig = new AptosConfig({ network: Network.TESTNET });
    const aptos = new Aptos(aptosConfig);

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) {
      return NextResponse.json({ error: "Contract address not configured" }, { status: 500 });
    }

    // Fetch account transactions
    const transactions = await aptos.getAccountTransactions({
      accountAddress: address,
      options: {
        limit: 100, // Last 100 transactions
      },
    });

    // Filter and format x402a transactions
    const x402aTransactions: Transaction[] = [];

    for (const tx of transactions) {
      // Check if this is a user transaction (not genesis or state checkpoint)
      if (tx.type !== "user_transaction") continue;

      const userTx = tx as any;

      // Check if transaction was successful
      const success = userTx.success === true;

      // Check if this transaction involves our x402_transfer contract
      const payload = userTx.payload;
      if (
        payload?.type === "entry_function_payload" &&
        payload?.function?.includes("::x402_transfer::")
      ) {
        const functionName = payload.function.split("::").pop();
        const isSponsored = functionName?.includes("sponsored");
        const isSplit = functionName?.includes("split");

        // Parse transaction data based on function type
        let to: string | string[];
        let amount: string | string[];

        if (isSplit) {
          // For split transfers, recipients and amounts are arrays
          to = payload.arguments?.[0] || [];
          amount = payload.arguments?.[1] || [];
        } else {
          // For single transfers, to and amount are single values
          to = payload.arguments?.[0] || "";
          amount = payload.arguments?.[1] || "";
        }

        x402aTransactions.push({
          txHash: userTx.hash,
          from: address,
          to,
          amount,
          timestamp: Math.floor(Number(userTx.timestamp) / 1000000), // Convert microseconds to seconds
          type: isSplit ? "split" : "single",
          success,
          explorerUrl: `https://explorer.aptoslabs.com/txn/${userTx.hash}?network=${network}`,
        });
      }
    }

    // Sort by timestamp descending (newest first)
    x402aTransactions.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      success: true,
      transactions: x402aTransactions,
      count: x402aTransactions.length,
    });
  } catch (error: any) {
    console.error("[Transactions API] Error fetching transactions:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch transactions",
      },
      { status: 500 }
    );
  }
}
