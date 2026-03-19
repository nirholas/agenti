# Faremeter: Frictionless Agentic Payments

Faremeter is a collection of libraries, tools, and applications designed to allow agents and other utilities to transparently make web3 payments using web2 infrastructure. By leveraging existing and emerging standards, you can use Faremeter to attach new and legacy client SDKs and API services to blockchain payments, without extensive rewrites.

Under the hood, Faremeter is built around:

- Using HTTP and the existing `402 Payment Required` concepts.
- A plugin system that's standard, wallet, and blockchain agnostic.
- Wrappers, middleware, and proxies that let you easily integrate into your existing codebase.

For more information on our approach, take a look at our [architecture document](./ARCHITECTURE.md).

The implication of this is:

- New payment strategies (e.g. [x402 Schemes](https://github.com/coinbase/x402?tab=readme-ov-file#schemes)) can be developed outside of the core Faremeter project.
- Blockchains with specific behaviors and needs can be supported without forcing a one-size-fits-all approach.
- Wallets and other infrastructure can be connected to Faremeter without "official" support.

To get started with the tooling, take a look at the [quickstart guide](./QUICKSTART.md). To start developing, take a look at the [developer notes](./DEV.md).

## Roadmap

Faremeter aims to be compatible with the emerging industry standards:

- Coinbase's x402 - https://github.com/coinbase/x402
- Cloudflare's Pay-Per-Crawl - https://www.cloudflare.com/paypercrawl-signup/
- L402 - https://www.l402.org

Please see our [compatibility document](./COMPATIBILITY.md) for more information.

We've started development, primarily focusing on x402 and supporting both the Solana and EVM ecosystems. We're currently under active development, producing:

- A pluggable [client library](./packages/fetch)
- A configurable [middleware](./packages/middleware).
- Support for various wallet SDKs (Solana, EVM).
- A payment facilitator and legacy service proxy.
- EIP-3009 gasless USDC transfers on Base Sepolia for EVM chains.

## Sponsorship

Faremeter is sponsored and built by the engineers at [ABK Labs](https://abklabs.com) along with other open-source contributors.
