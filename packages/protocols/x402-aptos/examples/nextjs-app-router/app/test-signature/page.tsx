"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";

export default function TestSignaturePage() {
  const wallet = useWallet();
  const [results, setResults] = useState<any[]>([]);

  async function testSignature(nonceValue: any) {
    if (!wallet.signMessage) {
      alert("Wallet does not support signMessage");
      return;
    }

    const testMessage = "0x48656c6c6f20576f726c64"; // "Hello World" in hex

    console.log("Testing with nonce:", nonceValue);

    try {
      const response = await wallet.signMessage({
        message: testMessage,
        nonce: nonceValue,
      });

      const result = {
        nonce: nonceValue,
        response: response,
        fullMessage: (response as any).fullMessage,
        message: (response as any).message,
        signature: typeof response === "object" ? (response as any).signature : response,
      };

      console.log("Result:", result);
      setResults((prev) => [...prev, result]);
    } catch (error) {
      console.error("Error:", error);
      setResults((prev) => [...prev, { nonce: nonceValue, error: String(error) }]);
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Petra Signature Test</h1>

        {!wallet.connected ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="mb-4">Please connect your Petra wallet first</p>
            <button
              onClick={() => wallet.connect}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Test Different Nonce Values</h2>
              <p className="text-sm text-gray-600 mb-4">
                Message being signed: "Hello World" (0x48656c6c6f20576f726c64)
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => testSignature(undefined)}
                  className="block w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Test with nonce = undefined
                </button>

                <button
                  onClick={() => testSignature("undefined")}
                  className="block w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Test with nonce = "undefined" (string)
                </button>

                <button
                  onClick={() => testSignature("123456")}
                  className="block w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Test with nonce = "123456"
                </button>

                <button
                  onClick={() => testSignature(Date.now().toString())}
                  className="block w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Test with nonce = Date.now().toString()
                </button>

                <button
                  onClick={() => testSignature(null)}
                  className="block w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Test with nonce = null
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Results</h2>
              {results.length === 0 ? (
                <p className="text-gray-500">No tests run yet</p>
              ) : (
                <div className="space-y-4">
                  {results.map((result, i) => (
                    <div key={i} className="border p-4 rounded">
                      <div className="font-mono text-sm">
                        <div className="mb-2">
                          <strong>Test {i + 1}: nonce = </strong>
                          <code className="bg-gray-100 px-2 py-1 rounded">
                            {JSON.stringify(result.nonce)}
                          </code>
                        </div>

                        {result.error ? (
                          <div className="text-red-600">Error: {result.error}</div>
                        ) : (
                          <>
                            {result.fullMessage && (
                              <div className="mb-2">
                                <strong>Full Message:</strong>
                                <pre className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto text-xs">
                                  {result.fullMessage}
                                </pre>
                              </div>
                            )}

                            {result.message && (
                              <div className="mb-2">
                                <strong>Message:</strong>
                                <pre className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto text-xs">
                                  {result.message}
                                </pre>
                              </div>
                            )}

                            <div className="mb-2">
                              <strong>Signature:</strong>
                              <pre className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto text-xs break-all">
                                {typeof result.signature === "string"
                                  ? result.signature
                                  : JSON.stringify(result.signature, null, 2)}
                              </pre>
                            </div>

                            <div className="mb-2">
                              <strong>Full Response:</strong>
                              <pre className="bg-gray-100 p-2 rounded mt-1 overflow-x-auto text-xs">
                                {JSON.stringify(result.response, null, 2)}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
