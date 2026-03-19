"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";
import { signTransactionForFeePayer } from "x402a/client";

export function PaymentDemo() {
  const wallet = useWallet();
  const { account, connected } = wallet;
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [initializingRegistry, setInitializingRegistry] = useState(false);

  const initializeRegistry = async () => {
    if (!account || !wallet.signAndSubmitTransaction) return;

    setInitializingRegistry(true);
    setError(null);

    try {
      const contractAddress =
        process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
        "0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36";

      await wallet.signAndSubmitTransaction({
        data: {
          function: `${contractAddress}::x402_transfer::initialize_registry`,
          functionArguments: [],
        },
      });

      setError("Registry initialized successfully! You can now make payments.");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (err: any) {
      setError(`Failed to initialize registry: ${err.message}`);
    } finally {
      setInitializingRegistry(false);
    }
  };

  const makePayment = async () => {
    if (!account || !connected) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setTxHash(null);

    try {
      // Payment configuration
      const payTo =
        process.env.NEXT_PUBLIC_FACILITATOR_ADDRESS ||
        "0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36";
      const amount = "10000000"; // 0.1 APT

      // Format addresses (ensure 64-character hex with 0x prefix)
      const fromAddress = account.address.toString();
      const paddedFromAddress = fromAddress.startsWith("0x")
        ? `0x${fromAddress.slice(2).padStart(64, "0")}`
        : `0x${fromAddress.padStart(64, "0")}`;

      const paddedToAddress = payTo.startsWith("0x")
        ? `0x${payTo.slice(2).padStart(64, "0")}`
        : `0x${payTo.padStart(64, "0")}`;

      console.log("[PaymentDemo] Step 1: Building transaction with facilitator...", {
        from: paddedFromAddress,
        to: paddedToAddress,
        amount: `${Number(amount) / 100000000} APT`,
      });

      // Step 1: Build transaction via facilitator
      const buildRes = await fetch("/api/facilitator/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: paddedFromAddress,
          to: paddedToAddress,
          amount,
        }),
      });

      if (!buildRes.ok) {
        const buildError = await buildRes.json();
        throw new Error(buildError.error || "Failed to build transaction");
      }

      const buildData = await buildRes.json();
      const transactionPayload = buildData.transactionPayload;

      console.log("[PaymentDemo] Step 2: Signing transaction (user signs, doesn't pay gas)...");

      // Step 2: Sign the transaction (user signs but doesn't submit)
      const sigResult = await signTransactionForFeePayer(wallet, transactionPayload);

      console.log("[PaymentDemo] Step 3: Sending signature to facilitator for submission...");

      // Step 3: Send signature to facilitator to submit with fee payer
      const verifyRes = await fetch("/api/facilitator/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment: {
            x402Version: 1,
            scheme: "exact",
            network: "testnet",
            payload: {
              from: paddedFromAddress,
              to: paddedToAddress,
              amount,
              nonce: transactionPayload.nonce,
              authenticator: sigResult.authenticator,
              validUntil: transactionPayload.validUntil,
              chainId: transactionPayload.chainId,
              transactionHex: transactionPayload.transaction, // Include the transaction hex
            },
          },
          requirements: {
            x402Version: 1,
            scheme: "exact",
            network: "testnet",
            maxAmountRequired: amount,
            resource: "/api/protected",
            payTo: paddedToAddress,
          },
        }),
      });

      if (!verifyRes.ok) {
        const verifyError = await verifyRes.json();
        throw new Error(verifyError.error || "Payment verification failed");
      }

      const verifyData = await verifyRes.json();

      console.log("[PaymentDemo] Payment successful! Facilitator submitted transaction:", {
        txHash: verifyData.txHash,
      });

      setTxHash(verifyData.txHash);
      setResponse({
        success: true,
        message: "Payment successful!",
        txHash: verifyData.txHash,
        payer: account.address.toString(),
        amount: `${Number(amount) / 100000000} APT`,
      });
      setError(null);
    } catch (err: any) {
      console.error("[PaymentDemo] Payment error:", err);
      setError(`Payment failed: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Connection Status */}
      {!connected && (
        <div className="bg-amber-950/20 border border-amber-800/30 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"
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
            <div>
              <p className="text-sm text-amber-400 font-medium">Connect wallet to make a payment</p>
              <p className="text-xs text-amber-500/70 mt-1">You'll need testnet APT to pay</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        {connected && (
          <button
            onClick={initializeRegistry}
            disabled={initializingRegistry || loading}
            className="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 disabled:bg-stone-900 disabled:opacity-50 text-stone-200 font-medium rounded-lg transition-colors text-sm border border-stone-600"
          >
            {initializingRegistry ? "Initializing..." : "1. Initialize Registry"}
          </button>
        )}

        <button
          onClick={makePayment}
          disabled={!connected || loading}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm shadow-lg disabled:shadow-none"
        >
          {loading ? "Processing..." : "2. Pay 0.1 APT"}
        </button>
      </div>

      {/* Info box */}
      {connected && !response && !error && (
        <div className="bg-blue-950/20 border border-blue-800/30 p-4 rounded-lg">
          <div className="space-y-2">
            <p className="text-sm text-blue-400">
              <span className="font-medium">How x402a works:</span>
            </p>
            <ol className="text-xs text-blue-300 space-y-1 pl-4">
              <li>1. You request a protected resource (e.g., premium audio stream)</li>
              <li>
                2. Server responds with{" "}
                <code className="bg-blue-900/50 px-1 py-0.5 rounded">
                  HTTP 402 Payment Required
                </code>
              </li>
              <li>3. You sign a payment transaction</li>
              <li>4. Server grants access after verifying payment</li>
            </ol>
            <p className="text-xs text-blue-400/70 mt-2">
              <span className="font-medium">First time?</span> Click "Initialize Registry" first
              (one-time setup)
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !response && (
        <div className="bg-stone-800/50 border border-stone-700 p-4 rounded-lg">
          <h3 className="font-semibold mb-2 text-sm text-stone-300">Error</h3>
          <pre className="text-sm text-red-400 whitespace-pre-wrap leading-relaxed">{error}</pre>
        </div>
      )}

      {/* Success */}
      {response && (
        <div className="bg-emerald-950/30 border border-emerald-800/50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3 text-sm text-emerald-300 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Payment Successful!
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-400">Amount:</span>
              <span className="text-emerald-400 font-mono">{response.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">From:</span>
              <span className="text-stone-300 font-mono text-xs">
                {response.payer?.slice(0, 10)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Contract:</span>
              <span className="text-stone-300 font-mono text-xs">x402a::x402_transfer</span>
            </div>
          </div>

          {txHash && (
            <div className="mt-3 pt-3 border-t border-emerald-900/50">
              <a
                href={`https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline text-xs break-all transition-colors inline-flex items-center gap-1"
              >
                View on Explorer
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}

          {/* What happened explanation */}
          <div className="mt-4 pt-3 border-t border-emerald-900/50">
            <p className="text-xs text-emerald-400/90 font-medium mb-2">What just happened:</p>
            <ul className="text-xs text-emerald-300/70 space-y-1.5 pl-4">
              <li>✓ Your wallet signed the payment transaction</li>
              <li>✓ Transaction submitted to Aptos blockchain</li>
              <li>✓ Smart contract verified and executed transfer</li>
              <li>✓ You now have access to premium content!</li>
            </ul>
            <p className="text-xs text-emerald-400/60 mt-3">
              <span className="font-medium">Unlike Web2:</span> No credit card, no signup, no KYC.
              Just connect wallet & pay.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
