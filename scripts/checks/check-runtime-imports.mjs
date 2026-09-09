#!/usr/bin/env node
/**
 * Imports every published entry point of every package, for real.
 *
 * Typechecking and unit tests both miss this class of failure: the tests import
 * source modules directly, and tsc never resolves a dependency's runtime
 * exports map. So a transitive version conflict can make `import '@agenti/sdk'`
 * throw while the whole gate stays green. That is exactly what six copies of
 * @solana/web3.js did, the oldest of which reached for an rpc-websockets
 * subpath that rpc-websockets 9 had removed.
 *
 * Run it after a build. It loads each entry and checks that the exports the
 * READMEs promise are actually there.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Entry points to load, with the exports each one must provide. */
const ENTRIES = [
  ['@agenti/core', ['generateWallet', 'walletFromMnemonic', 'generateMnemonic']],
  ['@agenti/sdk', ['agenti', 'getBalances', 'withPaymentExpress', 'USDC_MAINNET']],
  ['@agenti/sdk/serve', ['withPaymentExpress', 'withPaymentHono', 'withPayment']],
  ['@agenti/sdk/events', ['onAgentiEvent', 'emitEvent', 'agentiEvents']],
  ['@agenti/sdk/langchain', ['agentiLangChainTools']],
  ['@agenti/sdk/vercel-ai', ['agentiTools']],
  ['@agenti/sdk/eliza', ['agentiPlugin']],
  ['@agenti/facilitator', ['createFacilitator', 'verifyPayment', 'settlePayment', 'CHAINS']],
  ['@agenti/a2a', ['merchantMiddleware', 'MerchantAgent', 'A2AClient', 'ErrorCode']],
  ['@agenti/mcp', ['createServer']],
  ['@agenti/mcp-binance', ['createBinanceMcpServer', 'BinanceClient', 'createClient']],
  ['@agenti/simstudio', ['createSimStudioBridge']],
]

let failed = 0

for (const [entry, expected] of ENTRIES) {
  try {
    const loaded = await import(entry)
    const missing = expected.filter((name) => loaded[name] === undefined)
    if (missing.length > 0) {
      console.error(`  FAIL  ${entry}: missing export(s) ${missing.join(', ')}`)
      failed += 1
      continue
    }
    console.log(`  ok    ${entry}`)
  } catch (err) {
    console.error(`  FAIL  ${entry}: ${String(err.message).split('\n')[0]}`)
    failed += 1
  }
}

if (failed > 0) {
  console.error(`\n${failed} entry point(s) do not load. Build the workspace first, then check for`)
  console.error('a transitive version conflict: pnpm why <package> shows who pulled the old copy.')
  process.exit(1)
}

console.log(`\nAll ${ENTRIES.length} entry points load with the exports they document.`)
