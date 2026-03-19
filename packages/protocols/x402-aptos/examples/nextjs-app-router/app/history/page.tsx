"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

export default function TransactionHistoryPage() {
  const { account, connected } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!account) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/transactions?address=${account.address}`);
      const data = await res.json();

      if (data.success) {
        setTransactions(data.transactions);
      } else {
        setError(data.error || "Failed to fetch transactions");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (connected && account) {
      fetchTransactions();
    } else {
      setTransactions([]);
    }
  }, [connected, account, fetchTransactions]);

  const formatAmount = (amount: string | string[]): string => {
    if (Array.isArray(amount)) {
      const total = amount.reduce((sum, a) => sum + Number(a), 0);
      return `${(total / 100000000).toFixed(4)} APT`;
    }
    return `${(Number(amount) / 100000000).toFixed(4)} APT`;
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAddress = (address: string | string[]): string => {
    if (Array.isArray(address)) {
      return `${address.length} recipients`;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-stone-100">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-2">Transaction History</h1>
          <p className="text-stone-400">View your x402a payment transactions</p>
        </div>

        {/* Connection Status */}
        {!connected && (
          <div className="bg-amber-950/20 border border-amber-800/30 p-6 rounded-lg text-center">
            <svg
              className="w-12 h-12 text-amber-500 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-amber-400 font-medium">
              Connect your wallet to view transaction history
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-stone-800/50 border border-stone-700 p-8 rounded-lg text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-stone-400">Loading transactions...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-950/20 border border-red-800/30 p-6 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Transactions List */}
        {connected && !loading && !error && (
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <div className="bg-stone-800/50 border border-stone-700 p-8 rounded-lg text-center">
                <svg
                  className="w-16 h-16 text-stone-600 mx-auto mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-stone-400 font-medium">No transactions yet</p>
                <p className="text-stone-500 text-sm mt-2">
                  Make your first x402a payment to see it here
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-stone-400 text-sm">
                    {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} found
                  </p>
                  <button
                    onClick={fetchTransactions}
                    className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Refresh
                  </button>
                </div>

                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.txHash}
                      className="bg-stone-800/50 border border-stone-700 p-5 rounded-lg hover:border-stone-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {/* Status Icon */}
                          <div
                            className={`p-2 rounded-lg ${tx.success ? "bg-emerald-900/30" : "bg-red-900/30"}`}
                          >
                            {tx.success ? (
                              <svg
                                className="w-5 h-5 text-emerald-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-5 h-5 text-red-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            )}
                          </div>

                          {/* Transaction Info */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-stone-300 font-medium">
                                {formatAmount(tx.amount)}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  tx.type === "split"
                                    ? "bg-blue-900/30 text-blue-400"
                                    : "bg-stone-700 text-stone-400"
                                }`}
                              >
                                {tx.type === "split" ? "Split Payment" : "Single Payment"}
                              </span>
                              {!tx.success && (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400">
                                  Failed
                                </span>
                              )}
                            </div>
                            <p className="text-stone-400 text-sm">To: {formatAddress(tx.to)}</p>
                            <p className="text-stone-500 text-xs mt-1">
                              {formatTimestamp(tx.timestamp)}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1"
                        >
                          <span>View</span>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </div>

                      {/* Transaction Hash */}
                      <div className="border-t border-stone-700 pt-3 mt-3">
                        <p className="text-stone-500 text-xs">
                          <span className="text-stone-600">TX:</span>{" "}
                          <span className="font-mono">{tx.txHash}</span>
                        </p>
                      </div>

                      {/* Split Details */}
                      {tx.type === "split" && Array.isArray(tx.to) && Array.isArray(tx.amount) && (
                        <div className="border-t border-stone-700 pt-3 mt-3">
                          <p className="text-stone-500 text-xs mb-2">Recipients:</p>
                          <div className="space-y-1">
                            {tx.to.map((recipient, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-stone-400 font-mono">
                                  {recipient.slice(0, 10)}...{recipient.slice(-6)}
                                </span>
                                <span className="text-emerald-400">
                                  {(Number(tx.amount[idx]) / 100000000).toFixed(4)} APT
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Info Box */}
        {connected && transactions.length > 0 && (
          <div className="mt-8 bg-blue-950/20 border border-blue-800/30 p-4 rounded-lg">
            <p className="text-blue-400 text-sm">
              <span className="font-medium">On-chain verification:</span> All transactions are
              recorded on the Aptos blockchain and can be independently verified on the explorer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
