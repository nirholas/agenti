//! # X402 Kit
//!
//! X402 Kit is a fully modular, framework-agnostic, easy-to-extend SDK for building seller-side X402 payment integrations.
//!
//! X402-kit is **not a facilitator** — it's a composable SDK for sellers (servers) to build custom payment-gated business logic.
//! For buyer-side signing, use the [`x402-signer`](https://docs.rs/x402-signer) crate.
//! Future support for modular facilitator components is planned.
//!
//! ## Related Crates
//!
//! - **[`x402_core`]**: Core traits, types, and transport mechanisms
//!   for the X402 protocol. This crate provides the foundational building blocks that `x402-kit` builds upon.
//! - **[`x402_paywall`]**: A framework-agnostic HTTP paywall middleware
//!   built on top of `x402-kit`. Use it to protect HTTP resources with X402 payments.
//! - **[`x402-signer`](https://docs.rs/x402-signer)**: Buyer-side signing SDK for the x402 payment protocol.
//!
//! ## Quick Start
//!
//! ```
//! use alloy_primitives::address;
//! use axum::{
//!     extract::{Request, State},
//!     middleware::{from_fn_with_state, Next},
//!     response::{IntoResponse, Response},
//!     routing::post,
//!     Router,
//! };
//! use url_macro::url;
//! use x402_kit::{
//!     core::Resource,
//!     facilitator_client::{FacilitatorClient, StandardFacilitatorClient},
//!     networks::evm::assets::UsdcBaseSepolia,
//!     paywall::paywall::PayWall,
//!     schemes::exact_evm::ExactEvm,
//! };
//!
//!
//! #[derive(Clone)]
//! struct PayWallState {
//!     facilitator: StandardFacilitatorClient,
//! }
//!
//! let facilitator = FacilitatorClient::from_url(url!("https://facilitator.example.com"));
//!
//! async fn paywall_middleware(State(state): State<PayWallState>, req: Request, next: Next) -> Response {
//!     let paywall = PayWall::builder()
//!         .facilitator(state.facilitator)
//!         .accepts(
//!             ExactEvm::builder()
//!                 .amount(1000)
//!                 .asset(UsdcBaseSepolia)
//!                 .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
//!                 .build(),
//!         )
//!         .resource(
//!             Resource::builder()
//!                 .url(url!("https://example.com/resource"))
//!                 .description("Protected resource")
//!                 .mime_type("application/json")
//!                 .build(),
//!         )
//!         .build();
//!
//!     paywall
//!         .handle_payment(req, |req| next.run(req))
//!         .await
//!         .unwrap_or_else(|err| err.into_response())
//! }
//! ```
//!
//! See [`examples/axum_seller.rs`](https://github.com/AIMOverse/x402-kit/blob/main/x402-kit/examples/axum_seller.rs)
//! for a complete working example.
//!
//! ## Accepting Multiple Payment Methods
//!
//! You can accept payments from multiple networks (e.g., EVM and SVM) using [`transport::Accepts`]:
//!
//! ```
//! use alloy_primitives::address;
//! use solana_pubkey::pubkey;
//! use x402_kit::{
//!     networks::{evm::assets::UsdcBaseSepolia, svm::assets::UsdcSolanaDevnet},
//!     schemes::{exact_evm::ExactEvm, exact_svm::ExactSvm},
//!     transport::Accepts,
//! };
//!
//! let accepts = Accepts::new()
//!     .push(
//!         ExactEvm::builder()
//!             .amount(1000)
//!             .asset(UsdcBaseSepolia)
//!             .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
//!             .build(),
//!     )
//!     .push(
//!         ExactSvm::builder()
//!             .amount(1000)
//!             .asset(UsdcSolanaDevnet)
//!             .pay_to(pubkey!("Ge3jkza5KRfXvaq3GELNLh6V1pjjdEKNpEdGXJgjjKUR"))
//!             .build(),
//!     );
//! ```
//!
//! ## Core Components Overview
//!
//! ### For the X402 Protocol
//!
//! - **[`core`]**: Core traits and types used across the X402 Kit, including resource configuration.
//! - **[`transport`]**: Types and traits for defining X402 transport mechanisms and facilitator interactions.
//! - **[`types`]**: Common re-usable types for defining the X402 protocol.
//!
//! ### For Network-Specific Implementations
//!
//! - **[`networks`]**: Network-specific implementations, e.g., EVM / SVM assets and addresses.
//! - **[`schemes`]**: Payment scheme implementations, e.g., Exact EVM / Exact SVM, and their signer logic.
//!
//! ### Facilitator Utilities
//!
//! - **[`facilitator`]**: Traits and types for building X402 facilitators.
//! - **[`facilitator_client`]**: Utilities for building X402 facilitator clients.
//!
//! ## Extend X402 Kit As You Like
//!
//! The main idea is you don't need to wait for the upstream library to support the network or asset in your case.
//! Adding a new network, asset, or scheme is as simple as implementing a few traits.
//!
//! However, we still recommend contributing back any useful implementations to the main repository to help grow the ecosystem!
//!
//! ### New Networks
//!
//! If you want support for new EVM / SVM networks or assets, just "declare" them anywhere in your codebase:
//!
//! #### Custom EVM Network
//!
//! ```
//! use x402_kit::networks::evm::{ExplicitEvmNetwork, EvmNetwork};
//!
//! struct MyCustomEvmNetwork;
//!
//! impl ExplicitEvmNetwork for MyCustomEvmNetwork {
//!     const NETWORK: EvmNetwork = EvmNetwork {
//!         name: "my-custom-evm-network",
//!         chain_id: 12345,
//!         network_id: "eip155:12345",
//!     };
//! }
//!
//! // Now you can use MyCustomEvmNetwork with any scheme that supports EVM
//! ```
//!
//! #### Custom SVM Network
//!
//! ```
//! use x402_kit::networks::svm::{ExplicitSvmNetwork, SvmNetwork};
//!
//! struct MyCustomSvmNetwork;
//!
//! impl ExplicitSvmNetwork for MyCustomSvmNetwork {
//!     const NETWORK: SvmNetwork = SvmNetwork {
//!         name: "my-custom-svm-network",
//!         caip_2_id: "solana:BASE58_GENESIS_HASH",
//!     };
//! }
//!
//! // Now you can use MyCustomSvmNetwork with any scheme that supports SVM
//! ```
//!
//! ### New Assets
//!
//! Similarly, you can define custom assets for your networks:
//!
//! #### Custom EVM Asset
//!
//! ```
//! use alloy_primitives::address;
//! use x402_kit::networks::evm::{
//!     ExplicitEvmAsset, ExplicitEvmNetwork, EvmNetwork, EvmAsset, EvmAddress, Eip712Domain
//! };
//!
//! struct MyCustomNetwork;
//! impl ExplicitEvmNetwork for MyCustomNetwork {
//!     const NETWORK: EvmNetwork = EvmNetwork {
//!         name: "my-network",
//!         chain_id: 12345,
//!         network_id: "eip155:12345",
//!     };
//! }
//!
//! struct MyCustomToken;
//! impl ExplicitEvmAsset for MyCustomToken {
//!     type Network = MyCustomNetwork;
//!
//!     const ASSET: EvmAsset = EvmAsset {
//!         address: EvmAddress(address!("0x1234567890123456789012345678901234567890")),
//!         decimals: 18,
//!         name: "My Custom Token",
//!         symbol: "MCT",
//!     };
//!
//!     const EIP712_DOMAIN: Option<Eip712Domain> = Some(Eip712Domain {
//!         name: "My Custom Token",
//!         version: "1",
//!     });
//! }
//!
//! // Now you can use MyCustomToken with ExactEvm or other EVM schemes
//! ```
//!
//! #### Custom SVM Asset
//!
//! ```
//! use solana_pubkey::pubkey;
//! use x402_kit::networks::svm::{
//!     ExplicitSvmAsset, ExplicitSvmNetwork, SvmNetwork, SvmAsset, SvmAddress
//! };
//!
//! struct MyCustomSvmNetwork;
//! impl ExplicitSvmNetwork for MyCustomSvmNetwork {
//!     const NETWORK: SvmNetwork = SvmNetwork {
//!         name: "my-svm-network",
//!         caip_2_id: "solana:custom",
//!     };
//! }
//!
//! struct MyCustomSvmToken;
//! impl ExplicitSvmAsset for MyCustomSvmToken {
//!     type Network = MyCustomSvmNetwork;
//!
//!     const ASSET: SvmAsset = SvmAsset {
//!         address: SvmAddress(pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")),
//!         decimals: 9,
//!         name: "My Custom SVM Token",
//!         symbol: "MCST",
//!     };
//! }
//!
//! // Now you can use MyCustomSvmToken with ExactSvm or other SVM schemes
//! ```
//!
//! #### Using Custom Assets with Schemes
//!
//! Once you've defined your custom asset, you can use it with payment schemes just like built-in assets:
//!
//! ```
//! use alloy_primitives::address;
//! use x402_kit::{
//!     networks::evm::{ExplicitEvmAsset, ExplicitEvmNetwork, EvmNetwork, EvmAsset, EvmAddress, Eip712Domain},
//!     schemes::exact_evm::ExactEvm,
//!     transport::PaymentRequirements,
//! };
//!
//! // Define your custom network and asset
//! struct Polygon;
//! impl ExplicitEvmNetwork for Polygon {
//!     const NETWORK: EvmNetwork = EvmNetwork {
//!         name: "polygon",
//!         chain_id: 137,
//!         network_id: "eip155:137",
//!     };
//! }
//!
//! struct UsdcPolygon;
//! impl ExplicitEvmAsset for UsdcPolygon {
//!     type Network = Polygon;
//!     const ASSET: EvmAsset = EvmAsset {
//!         address: EvmAddress(address!("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174")),
//!         decimals: 6,
//!         name: "USD Coin",
//!         symbol: "USDC",
//!     };
//!     const EIP712_DOMAIN: Option<Eip712Domain> = Some(Eip712Domain {
//!         name: "USD Coin",
//!         version: "2",
//!     });
//! }
//!
//! # fn use_custom_asset() {
//! // Use it in payment requirements
//! let payment = ExactEvm::builder()
//!     .asset(UsdcPolygon)
//!     .amount(1000000) // 1 USDC
//!     .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
//!     .build();
//!
//! // Convert to PaymentRequirements for use with facilitator
//! let requirements: PaymentRequirements = payment.into();
//! # }
//! ```
//!
//! ### Defining New Network Families
//!
//! If you want to define an entirely new family of networks (beyond EVM or SVM), you need to implement the core traits under [`core`]:
//!
//! - [`core::NetworkFamily`]: Represents a blockchain network family
//! - [`core::Address`]: Represents an address on that network
//!
//! The `Address` type should also implement `FromStr`, `Display`, `Copy`, `Debug`, `Clone`, `PartialEq`, `Eq`, and `Hash` for proper serialization/deserialization and usage throughout the SDK.
//!
//! Here's a complete example:
//!
//! ```
//! use std::{fmt::Display, str::FromStr};
//! use x402_kit::core::{Address, Asset, NetworkFamily};
//!
//! // Define your network family
//! struct MyNetworkFamily {
//!     network_name: &'static str,
//!     network_id: &'static str,
//! }
//!
//! impl NetworkFamily for MyNetworkFamily {
//!     fn network_name(&self) -> &str {
//!         self.network_name
//!     }
//!     fn network_id(&self) -> &str {
//!         self.network_id
//!     }
//! }
//!
//! // Define an address type for your network
//! #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
//! struct MyAddress(u64);
//!
//! impl FromStr for MyAddress {
//!     type Err = std::num::ParseIntError;
//!
//!     fn from_str(s: &str) -> Result<Self, Self::Err> {
//!         s.parse::<u64>().map(MyAddress)
//!     }
//! }
//!
//! impl Display for MyAddress {
//!     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
//!         write!(f, "{}", self.0)
//!     }
//! }
//!
//! impl Address for MyAddress {
//!     type Network = MyNetworkFamily;
//! }
//!
//! // Define an asset type for your network
//! type MyAsset = Asset<MyAddress>;
//!
//! # fn use_custom_network_family() {
//! // Now you can use your custom network family
//! let network = MyNetworkFamily {
//!     network_name: "my-custom-network",
//!     network_id: "mynet:42",
//! };
//!
//! let address: MyAddress = "12345".parse().unwrap();
//! assert_eq!(address.to_string(), "12345");
//!
//! let asset = MyAsset {
//!     address,
//!     decimals: 18,
//!     name: "My Token",
//!     symbol: "MTK",
//! };
//! # }
//! ```
//!
//! Once you have these core types defined, you can build schemes and payment requirements for your custom network family by implementing the [`core::Scheme`] trait.
//!
//! ### Defining new Schemes
//!
//! To define a new payment scheme, implement the `Scheme` trait from the `core` module. This involves specifying the associated network and payload types.
//!
//! Just take how `ExactSvmScheme` is defined for example:
//!
//! ```
//! use serde::{Deserialize, Serialize};
//! use x402_kit::core::Scheme;
//! use x402_kit::networks::svm::SvmNetwork;
//!
//! pub struct ExactSvmScheme(pub SvmNetwork);
//!
//! #[derive(Debug, Clone, Serialize, Deserialize)]
//! #[serde(rename_all = "camelCase")]
//! pub struct ExplicitSvmPayload {
//!     pub transaction: String,
//! }
//!
//! impl Scheme for ExactSvmScheme {
//!     type Network = SvmNetwork;
//!     type Payload = ExplicitSvmPayload;
//!     const SCHEME_NAME: &'static str = "exact";
//!     fn network(&self) -> &Self::Network {
//!         &self.0
//!     }
//! }
//! ```
//!
//! Then you should make an entrypoint to convert the scheme into `PaymentRequirements`.
//!
//! Note that `Payment` is a type-safe builder for constructing payment configurations from schemes.
//!
//! ```
//! use bon::Builder;
//! use x402_kit::core::Payment;
//! use x402_kit::networks::svm::{ExplicitSvmAsset, ExplicitSvmNetwork, SvmAddress, SvmNetwork};
//! use x402_kit::schemes::exact_svm::ExactSvmScheme;
//! use x402_kit::transport::PaymentRequirements;
//!
//! #[derive(Builder, Debug, Clone)]
//! pub struct ExactSvm<A: ExplicitSvmAsset> {
//!     pub asset: A,
//!     #[builder(into)]
//!     pub pay_to: SvmAddress,
//!     pub amount: u64,
//!     pub max_timeout_seconds_override: Option<u64>,
//! }
//!
//! impl<A: ExplicitSvmAsset> From<ExactSvm<A>> for Payment<ExactSvmScheme, SvmAddress> {
//!     fn from(scheme: ExactSvm<A>) -> Self {
//!         Payment {
//!             scheme: ExactSvmScheme(A::Network::NETWORK),
//!             pay_to: scheme.pay_to,
//!             asset: A::ASSET,
//!             amount: scheme.amount.into(),
//!             max_timeout_seconds: scheme.max_timeout_seconds_override.unwrap_or(300),
//!             extra: None,
//!         }
//!     }
//! }
//!
//! // Then implement From for PaymentRequirements
//! impl<A: ExplicitSvmAsset> From<ExactSvm<A>> for PaymentRequirements {
//!     fn from(scheme: ExactSvm<A>) -> Self {
//!         PaymentRequirements::from(Payment::from(scheme))
//!     }
//! }
//! ```
//!

/// Core components for the X402 protocol.
pub mod core {
    pub use x402_core::core::*;
}

/// Transport mechanisms and facilitator interactions.
pub mod transport {
    pub use x402_core::transport::*;
}

/// Common types used across the X402 protocol.
pub mod types {
    pub use x402_core::types::*;
}

/// Facilitator traits and types.
pub mod facilitator {
    pub use x402_core::facilitator::*;
}

/// Errors used across X402 Kit.
pub mod errors {
    pub use x402_core::errors::*;
}

/// X402 Paywall middleware for protecting HTTP resources.
#[cfg(feature = "paywall")]
pub mod paywall {
    pub use x402_paywall::*;
}

/// X402 protocol extension implementations.
pub mod extensions {
    pub use x402_extensions::*;
}

/// Facilitator client utilities.
#[cfg(feature = "facilitator-client")]
pub mod facilitator_client;
/// Network-specific implementations.
pub mod networks;
/// Payment scheme implementations.
pub mod schemes;
