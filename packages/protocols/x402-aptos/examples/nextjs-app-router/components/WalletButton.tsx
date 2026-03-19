"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";

export function WalletButton() {
  const { connect, disconnect, account, connected, wallets } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleConnect = async () => {
    const petraWallet = wallets?.[0];
    if (petraWallet) {
      await connect(petraWallet.name);
    }
  };

  const handleCopyAddress = async () => {
    if (account) {
      await navigator.clipboard.writeText(account.address.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (connected && account) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 border border-emerald-800/50 bg-emerald-950/30 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Connected</span>
          </div>
          <div className="w-px h-4 bg-stone-700" />
          <button
            onClick={handleCopyAddress}
            className="group flex items-center gap-2 text-sm text-stone-300 hover:text-stone-100 transition-colors"
            title="Click to copy address"
          >
            <span className="font-mono">
              {account.address.toString().slice(0, 6)}...{account.address.toString().slice(-4)}
            </span>
            {copied ? (
              <svg
                className="w-3.5 h-3.5 text-emerald-400"
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
                className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </div>
        <button
          onClick={disconnect}
          className="px-4 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 font-medium text-sm rounded-lg transition-colors text-stone-200"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-2 border border-stone-700 bg-stone-800/50 rounded-lg">
        <div className="w-2 h-2 bg-stone-600 rounded-full" />
        <span className="text-xs font-medium text-stone-500">Not Connected</span>
      </div>
      <button
        onClick={handleConnect}
        className="px-4 py-2 bg-stone-200 hover:bg-stone-100 text-stone-900 font-medium text-sm rounded-lg transition-colors"
      >
        Connect Wallet
      </button>
    </div>
  );
}
