"use client";

import { useState } from "react";

const examples = [
  {
    id: "curl",
    label: "cURL",
    language: "bash",
    code: `# Request a protected endpoint
curl http://localhost:3001/api/stream \\
  -H "X-Payment: <base64-encoded-payment>"

# Response: 402 Payment Required
# {
#   "requirements": {
#     "scheme": "aptos",
#     "network": "testnet",
#     "payTo": "0xc7e1ae...",
#     "maxAmountRequired": "10000"
#   }
# }`,
  },
  {
    id: "react",
    label: "React Hook",
    language: "typescript",
    code: `import { useX402Payment } from 'x402a';

function MyComponent() {
  const { executePayment, loading, error } = useX402Payment({
    onSuccess: (data) => console.log('Success:', data),
    onError: (err) => console.error('Error:', err),
  });

  return (
    <button
      onClick={() => executePayment('/api/stream')}
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Make Payment'}
    </button>
  );
}`,
  },
  {
    id: "nextjs",
    label: "Next.js API",
    language: "typescript",
    code: `import { createX402Middleware } from 'x402a-next';

const x402 = createX402Middleware({
  facilitatorPrivateKey: process.env.FACILITATOR_PRIVATE_KEY!,
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
  network: 'testnet',
});

export async function GET(request: Request) {
  const verification = await x402.verify(request);

  if (!verification.authorized) {
    return verification.response; // 402 Payment Required
  }

  return Response.json({
    message: 'Access granted!',
    payment: verification.payment
  });
}`,
  },
  {
    id: "sign",
    label: "Fee Payer Transaction",
    language: "typescript",
    code: `import { signTransactionForFeePayer } from 'x402a';

// 1. Build transaction from facilitator
const buildRes = await fetch('/api/facilitator/build', {
  method: 'POST',
  body: JSON.stringify({ from, to, amount }),
});
const { transactionPayload } = await buildRes.json();

// 2. Sign transaction
const { authenticator, publicKey } = await signTransactionForFeePayer(
  wallet,
  transactionPayload
);

// 3. Create payment payload
const paymentPayload = {
  x402Version: 1,
  scheme: 'exact',
  network: 'aptos-testnet',
  payload: {
    from, to, amount,
    nonce: transactionPayload.nonce,
    authenticator,
    publicKey,
    validUntil: transactionPayload.validUntil,
    chainId: transactionPayload.chainId,
  },
};`,
  },
];

export function CodeExamples() {
  const [activeTab, setActiveTab] = useState(examples[0].id);
  const [copied, setCopied] = useState(false);

  const activeExample = examples.find((ex) => ex.id === activeTab) || examples[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeExample.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-stone-800 bg-stone-900/50 p-7 rounded-lg">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-stone-100">Examples</h2>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg transition-colors group"
        >
          {copied ? (
            <>
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
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-200"
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
              <span className="text-stone-400 group-hover:text-stone-200 font-medium">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {examples.map((example) => (
          <button
            key={example.id}
            onClick={() => setActiveTab(example.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === example.id
                ? "bg-stone-700 text-stone-100 border border-stone-600"
                : "bg-stone-800/50 text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700"
            }`}
          >
            {example.label}
          </button>
        ))}
      </div>

      {/* Code Display */}
      <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 overflow-auto">
        <pre className="text-xs text-stone-300 leading-relaxed font-mono">
          <code>{activeExample.code}</code>
        </pre>
      </div>
    </div>
  );
}
