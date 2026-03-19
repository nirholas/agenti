# x402 Ecosystem Attribution

This directory contains code from multiple x402 ecosystem projects, integrated into the Agenti monorepo.
All original licenses are preserved in each package directory.

---

## Tier 1 — Core Protocol & Implementations

### x402-coinbase
- **Source:** https://github.com/coinbase/x402
- **Author:** Coinbase
- **License:** Apache-2.0
- **Description:** The canonical x402 payment protocol implementation. Multi-language SDKs (TypeScript, Python, Go, Java), smart contracts, specs, and examples.

### x402-rust
- **Source:** https://github.com/x402-rs/x402-rs
- **Author:** x402-rs contributors
- **License:** Apache-2.0
- **Description:** Full Rust implementation of x402 — verify, settle, and monitor payments over HTTP 402 flows. Includes `x402-types`, `x402-axum`, `x402-reqwest`, `x402-facilitator-local`, and chain crates.

### x402-a2a-google
- **Source:** https://github.com/google-agentic-commerce/a2a-x402
- **Author:** Google (Agentic Commerce)
- **License:** Apache-2.0
- **Description:** Official Google extension bringing x402 payments to the Agent-to-Agent (A2A) protocol. Python `x402_a2a` library enabling agents to monetize services through on-chain payments.

### x402-mcp-go
- **Source:** https://github.com/mark3labs/mcp-go-x402
- **Author:** Mark3 Labs
- **License:** MIT
- **Description:** x402 payment protocol transport layer for MCP-Go clients and servers. Includes Solana signer support.

---

## Tier 2 — Ecosystem Extensions

### x402-a2a-typescript
- **Source:** https://github.com/dabit3/a2a-x402-typescript
- **Author:** Nader Dabit
- **License:** No license specified (pending clarification)
- **Description:** Complete TypeScript implementation of A2A x402 payment protocol for agent-to-agent communication. Contains client-agent, merchant-agent, and `x402_a2a` library.
- **Note:** No license file found in the original repository. Usage should be clarified with the author before production deployment.

### x402-dotnet
- **Source:** https://github.com/michielpost/x402-dotnet
- **Author:** Michiel Post
- **License:** MIT
- **Description:** .NET implementation of x402 with Core, Client (EVM + Solana), Facilitator (EVM + Solana), Coinbase integration, Blazor sample, and comprehensive tests.

### x402-aptos
- **Source:** https://github.com/raintree-technology/x402a
- **Author:** Raintree Technology
- **License:** MIT
- **Description:** Experimental x402-style micropayment protocol for the Aptos blockchain. Implements x402 principles in Move with non-EVM primitives. Monorepo with `x402a`, `x402a-contract`, `x402a-next`, `x402a-tools`, and `x402s` packages.

### x402-chainlink
- **Source:** https://github.com/smartcontractkit/x402-cre-price-alerts
- **Author:** SmartContract Inc. (Chainlink)
- **License:** MIT
- **Description:** Crypto price alert system demonstrating x402 micropayments + Chainlink CRE (Composable Reference Engine) workflows + AI-powered natural language interfaces.

---

## Previously Integrated

### x402-stablecoin
- **Description:** Agenti's reference x402 implementation with Sperax USDs stablecoin integration.

### x402-ecosystem
- **Description:** Agenti's shared x402 utilities, marketplace, and premium tier support.

---

## License Summary

| Package | License | Commercial Use | Modification | Distribution |
|---------|---------|---------------|-------------|-------------|
| x402-coinbase | Apache-2.0 | Yes | Yes | Yes (with notice) |
| x402-rust | Apache-2.0 | Yes | Yes | Yes (with notice) |
| x402-a2a-google | Apache-2.0 | Yes | Yes | Yes (with notice) |
| x402-mcp-go | MIT | Yes | Yes | Yes |
| x402-a2a-typescript | None | Pending | Pending | Pending |
| x402-dotnet | MIT | Yes | Yes | Yes |
| x402-aptos | MIT | Yes | Yes | Yes |
| x402-chainlink | MIT | Yes | Yes | Yes |
