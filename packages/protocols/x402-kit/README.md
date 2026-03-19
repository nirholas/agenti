# X402 Kit

[![Build status](https://github.com/AIMOverse/x402-kit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AIMOverse/x402-kit/actions)
[![Crates.io](https://img.shields.io/crates/v/x402-kit)](https://crates.io/crates/x402-kit)
[![Documentation](https://docs.rs/x402-kit/badge.svg)](https://docs.rs/x402-kit)
[![Twitter Follow](https://img.shields.io/twitter/follow/AiMoNetwork?style=social)](https://x.com/AiMoNetwork)
[![Discord](https://img.shields.io/badge/Discord-Join%20AiMoNetwork-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/G3zVrZDa5C)

A fully modular, framework-agnostic, easy-to-extend SDK for building complex X402 payment integrations.

## 📦 Crates

| Crate                                                   | Description                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`x402-kit`](https://crates.io/crates/x402-kit)         | Main SDK with network definitions, payment schemes, and facilitator client |
| [`x402-signer`](https://crates.io/crates/x402-signer)   | Buyer-side signing SDK with reqwest middleware for automatic x402 payments |
| [`x402-core`](https://crates.io/crates/x402-core)       | Core traits, types, and transport mechanisms for the X402 protocol         |
| [`x402-paywall`](https://crates.io/crates/x402-paywall) | Framework-agnostic HTTP paywall middleware                                 |

## 📚 Developer Docs

Docs are available at [docs.rs](https://docs.rs/x402-kit/latest/x402_kit/)

## 💡 Core Pain Points Solved

X402-kit is **not a facilitator** — it's a composable SDK for buyers (signers) and sellers (servers) to build custom business logic. Future support for modular facilitator components is planned.

### Beyond Static Pricing and Payment Gateway Middlewares

Existing X402 SDKs only support static prices per API route. X402-kit's fully modular architecture enables complex, dynamic pricing logic while maximizing code reuse.

### Complete Modularity

All internal fields and methods are public by design. Compose and extend functionality freely without fighting the framework.

### Layered Type Safety

- **Transport Layer**: Uses generalized `String` types to prevent serialization failures and ensure service availability
- **Network + Scheme Layer**: Leverages traits and generics for compile-time type checking without runtime overhead

### Ship New Networks Without PRs

Implement a new asset, network, or scheme entirely in your codebase and plug it into the SDK immediately—no upstream pull request or waiting period required thanks to trait-driven extension points.

However, we still recommend contributing back any useful implementations to the main repository to help grow the ecosystem!

### Production-Ready Design

Minimize runtime errors through compile-time guarantees while maintaining the flexibility needed for real-world business logic.

## 🧪 Usage Examples

### Using `x402-paywall` with Axum

The `x402-paywall` crate (re-exported via `x402-kit`) provides a composable `PayWall` that handles the complete X402 payment flow. Run the example:

```bash
FACILITATOR_URL=https://your-facilitator.example \
  cargo run -p x402-kit --example axum_seller
```

#### Standard Payment Flow

The `handle_payment` method provides a complete flow: update accepts from facilitator, verify payment, run handler, and settle on success.

```rust
use alloy::primitives::address;
use axum::{extract::{Request, State}, middleware::Next, response::{IntoResponse, Response}};
use url_macro::url;
use x402_kit::{
    core::Resource,
    facilitator_client::FacilitatorClient,
    networks::evm::assets::UsdcBaseSepolia,
    paywall::paywall::PayWall,
    schemes::exact_evm::ExactEvm,
};

async fn paywall_middleware(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let paywall = PayWall::builder()
        .facilitator(state.facilitator)
        .accepts(
            ExactEvm::builder()
                .amount(1000)
                .asset(UsdcBaseSepolia)
                .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
                .build(),
        )
        .resource(
            Resource::builder()
                .url(url!("https://example.com/resource"))
                .description("X402 payment protected resource")
                .mime_type("application/json")
                .build(),
        )
        .build();

    paywall
        .handle_payment(req, |req| next.run(req))
        .await
        .unwrap_or_else(|err| err.into_response())
}
```

#### Multiple Payment Options

Accept payments on multiple networks (EVM and SVM):

```rust
use x402_kit::{
    networks::{evm::assets::UsdcBaseSepolia, svm::assets::UsdcSolanaDevnet},
    schemes::{exact_evm::ExactEvm, exact_svm::ExactSvm},
    transport::Accepts,
};

let paywall = PayWall::builder()
    .facilitator(facilitator)
    .accepts(
        Accepts::new()
            .push(
                ExactEvm::builder()
                    .amount(1000)
                    .asset(UsdcBaseSepolia)
                    .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
                    .build(),
            )
            .push(
                ExactSvm::builder()
                    .amount(1000)
                    .asset(UsdcSolanaDevnet)
                    .pay_to(pubkey!("Ge3jkza5KRfXvaq3GELNLh6V1pjjdEKNpEdGXJgjjKUR"))
                    .build(),
            ),
    )
    .resource(/* ... */)
    .build();
```

#### Custom Payment Flow

For fine-grained control, use the step-by-step API:

```rust
// Skip verification, settle before running handler
let response = paywall
    .process_request(req)?
    .settle()
    .await?
    .run_handler(|req| next.run(req))
    .await?
    .response();
```

#### Access Payment State in Handlers

The `PayWall` injects `PaymentState` into request extensions:

```rust
use axum::{Extension, Json};
use x402_kit::paywall::processor::PaymentState;

async fn handler(Extension(payment_state): Extension<PaymentState>) -> Json<Value> {
    Json(json!({
        "message": "Premium content accessed!",
        "payer": payment_state.verified.map(|v| v.payer),
        "transaction": payment_state.settled.map(|s| s.transaction),
    }))
}
```

### Custom Facilitator Client

Customize request/response types for your facilitator.

> **Note:** The default facilitator client uses `Url::join("verify")` etc. to construct endpoint URLs from the base URL. This means **trailing slashes matter**. For example, when using the Coinbase facilitator:
>
> ```bash
> export FACILITATOR_URL=https://www.x402.org/facilitator/
> ```

```rust
use x402_kit::facilitator_client::{FacilitatorClient, IntoVerifyResponse, IntoSettleResponse};

#[derive(Serialize, Deserialize)]
struct CustomSettleRequest { /* ... */ }

#[derive(Deserialize)]
struct CustomSettleResponse { /* ... */ }

impl IntoSettleResponse for CustomSettleResponse {
    fn into_settle_response(self) -> SettleResult { /* ... */ }
}

let facilitator = FacilitatorClient::from_url(facilitator_url)
    .with_settle_request_type::<CustomSettleRequest>()
    .with_settle_response_type::<CustomSettleResponse>();
```

### Buyer-Side Signing with `x402-signer`

The `x402-signer` crate provides a reqwest middleware that automatically handles the x402 payment flow: intercept HTTP 402 → sign payment → retry with payment header.

You need some testnet USDC on Solana devnet or Base Sepolia to run signer examples. You can get some at [Circle testnet faucet](https://faucet.circle.com/)

#### EVM Client

```bash
EVM_PRIVATE_KEY=0x... RESOURCE_URL=http://localhost:3000/resource/standard \
  cargo run -p x402-signer --example evm_client
```

```rust
use alloy::signers::local::PrivateKeySigner;
use reqwest_middleware::ClientBuilder;
use x402_signer::{X402Client, evm::EvmPaymentSigner, middleware::X402PaymentMiddleware};

let wallet: PrivateKeySigner = "0x...".parse().unwrap();
let signer = EvmPaymentSigner::new(wallet);
let middleware = X402PaymentMiddleware::new(X402Client::new(signer));

let client = ClientBuilder::new(reqwest::Client::new())
    .with(middleware)
    .build();

// Any 402 response is automatically signed and retried
let response = client.post("http://localhost:3000/resource/standard").send().await?;
```

#### SVM Client

```bash
SOLANA_PRIVATE_KEY=<base58> SOLANA_RPC_URL=https://api.devnet.solana.com \
  RESOURCE_URL=http://localhost:3000/resource/multi_payments \
  cargo run -p x402-signer --example svm_client
```

```rust
use solana_keypair::Keypair;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use reqwest_middleware::ClientBuilder;
use x402_signer::{X402Client, svm::SvmPaymentSigner, middleware::X402PaymentMiddleware};

let keypair = Keypair::from_base58_string("<base58-private-key>");
let rpc = RpcClient::new("https://api.devnet.solana.com".to_string());
let signer = SvmPaymentSigner::new(keypair, rpc);
let middleware = X402PaymentMiddleware::new(X402Client::new(signer));

let client = ClientBuilder::new(reqwest::Client::new())
    .with(middleware)
    .build();

let response = client.post("http://localhost:3000/resource/multi_payments").send().await?;
```

## 🚀 Next Steps

- More networks / assets / schemes
- MCP / A2A transport support
- Facilitator components support

## 🤝 Contributing

We welcome all contributions to x402-kit! Here's how you can get involved:

- ⭐ **Star** this repository
- 🐛 **Open issues** to report bugs or suggest features
- 🔧 **Submit PRs** to improve the codebase

Contributors will receive **priority access** and **rewards** at AIMO Network's Beta launch (coming soon)!
