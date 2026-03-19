import { CodeExamples } from "../components/CodeExamples";
import { PaymentDemo } from "../components/PaymentDemo";
import { WalletButton } from "../components/WalletButton";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36";
const FACILITATOR_ADDRESS =
  process.env.NEXT_PUBLIC_FACILITATOR_ADDRESS ||
  "0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36";

export default function Home() {
  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-stone-50">x402a</h1>
          <p className="text-base text-stone-400">HTTP 402 on Aptos</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/history"
            className="flex items-center gap-2 px-4 py-2 bg-stone-800/50 hover:bg-stone-800 border border-stone-700 rounded-lg transition-colors text-sm text-stone-300 hover:text-stone-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
          </a>
          <WalletButton />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Info */}
        <div className="space-y-6">
          {/* What is it */}
          <section className="border border-stone-800 bg-stone-900/50 p-7 rounded-lg">
            <h2 className="text-lg font-bold mb-5 text-stone-100">Overview</h2>
            <p className="text-sm text-stone-400 mb-6 leading-relaxed">
              Users sign, facilitator submits. No gas fees for users.
            </p>

            {/* Flow */}
            <div className="bg-stone-950/50 border border-stone-800 p-4 rounded-lg mb-6">
              <div className="flex items-center justify-between text-sm font-mono">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-lg bg-stone-800 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-stone-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs text-stone-500">Request</span>
                </div>
                <svg
                  className="w-4 h-4 text-stone-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-lg bg-amber-900/30 border border-amber-800/50 flex items-center justify-center">
                    <span className="text-amber-400 font-bold text-xs">402</span>
                  </div>
                  <span className="text-xs text-stone-500">Payment</span>
                </div>
                <svg
                  className="w-4 h-4 text-stone-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-lg bg-stone-800 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-stone-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs text-stone-500">Sign</span>
                </div>
                <svg
                  className="w-4 h-4 text-stone-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-900/30 border border-emerald-800/50 flex items-center justify-center">
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <span className="text-xs text-stone-500">Access</span>
                </div>
              </div>
            </div>

            {/* Components */}
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-stone-300 font-medium mb-1">User</div>
                <div className="text-stone-500">Signs messages</div>
              </div>

              <div>
                <div className="text-stone-300 font-medium mb-1">Facilitator</div>
                <div className="text-stone-500 mb-2">Submits transactions</div>
                <code className="text-xs text-stone-600 block font-mono break-all">
                  {FACILITATOR_ADDRESS}
                </code>
              </div>

              <div>
                <div className="text-stone-300 font-medium mb-2">Contract</div>
                <div className="text-stone-500 mb-3">Executes transfers</div>
                <code className="text-xs text-stone-600 block mb-3 break-all font-mono bg-stone-950/50 border border-stone-800 px-2 py-1.5 rounded">
                  {CONTRACT_ADDRESS}
                </code>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <a
                    href={`https://explorer.aptoslabs.com/account/${CONTRACT_ADDRESS}?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-stone-800/50 hover:bg-stone-800 border border-stone-700 rounded-lg transition-colors group"
                  >
                    <svg
                      className="w-4 h-4 text-stone-500 group-hover:text-stone-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span className="text-stone-400 group-hover:text-stone-200">Explorer</span>
                  </a>
                  <a
                    href={`https://explorer.aptoslabs.com/account/${CONTRACT_ADDRESS}/modules/code/x402_transfer?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-stone-800/50 hover:bg-stone-800 border border-stone-700 rounded-lg transition-colors group"
                  >
                    <svg
                      className="w-4 h-4 text-stone-500 group-hover:text-stone-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                    <span className="text-stone-400 group-hover:text-stone-200">Module</span>
                  </a>
                  <a
                    href="https://github.com/raintree-technology/x402a/blob/main/packages/x402a-contract/sources/x402_transfer.move"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-stone-800/50 hover:bg-stone-800 border border-stone-700 rounded-lg transition-colors group"
                  >
                    <svg
                      className="w-4 h-4 text-stone-500 group-hover:text-stone-300"
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
                    <span className="text-stone-400 group-hover:text-stone-200">Contract</span>
                  </a>
                  <a
                    href="https://github.com/raintree-technology/x402a"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-stone-800/50 hover:bg-stone-800 border border-stone-700 rounded-lg transition-colors group"
                  >
                    <svg
                      className="w-4 h-4 text-stone-500 group-hover:text-stone-300"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-stone-400 group-hover:text-stone-200">GitHub</span>
                  </a>
                  <a
                    href="https://aptos.dev/en/network/faucet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-stone-800/50 hover:bg-stone-800 border border-stone-700 rounded-lg transition-colors group col-span-2"
                  >
                    <svg
                      className="w-4 h-4 text-stone-500 group-hover:text-stone-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-stone-400 group-hover:text-stone-200">
                      Get Testnet APT
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Info */}
          <section className="grid grid-cols-3 gap-4">
            <div className="group border border-stone-800 bg-stone-900/50 hover:bg-stone-900 hover:border-stone-700 p-4 rounded-lg text-center transition-all cursor-default">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-stone-500 group-hover:text-stone-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-stone-500 group-hover:text-stone-400">Price</p>
              </div>
              <p className="text-base font-semibold text-stone-200 group-hover:text-stone-100">
                0.01 APT
              </p>
            </div>
            <a
              href="https://aptos.dev/en/network/blockchain/networks#testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="group border border-stone-800 bg-stone-900/50 hover:bg-stone-900 hover:border-emerald-700/50 p-4 rounded-lg text-center transition-all"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-sm text-stone-500 group-hover:text-emerald-400">Network</p>
              </div>
              <p className="text-base font-semibold text-stone-200 group-hover:text-stone-100">
                Testnet
              </p>
            </a>
            <a
              href="https://github.com/raintree-technology/x402a/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="group border border-stone-800 bg-stone-900/50 hover:bg-stone-900 hover:border-stone-700 p-4 rounded-lg text-center transition-all"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-stone-500 group-hover:text-stone-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <p className="text-sm text-stone-500 group-hover:text-stone-400">Version</p>
              </div>
              <p className="text-base font-semibold text-stone-200 group-hover:text-stone-100">
                v0.1.0
              </p>
            </a>
          </section>
        </div>

        {/* Right Column - Demo */}
        <section className="border border-stone-800 bg-stone-900/50 p-7 rounded-lg">
          <h2 className="text-lg font-bold mb-5 text-stone-100">Demo</h2>
          <PaymentDemo />
        </section>
      </div>

      {/* Code Examples Section */}
      <div className="mt-8">
        <CodeExamples />
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-stone-800">
        <div className="flex items-center justify-center gap-2 text-sm text-stone-500">
          <span>Built by</span>
          <a
            href="https://x.com/zacharyr0th"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 hover:text-stone-200 transition-colors font-medium"
          >
            zacharyr0th
          </a>
          <div className="flex items-center gap-2 ml-2">
            <a
              href="https://x.com/zacharyr0th"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 hover:text-stone-300 transition-colors"
              aria-label="X (Twitter)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://github.com/zacharyr0th"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 hover:text-stone-300 transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
