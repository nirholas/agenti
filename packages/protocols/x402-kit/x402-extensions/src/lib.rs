//! # X402 Extensions
//!
//! This crate provides concrete extension type implementations for the X402 protocol.
//!
//! Extensions enable modular optional functionality beyond core payment mechanics.
//! Servers advertise supported extensions in `PaymentRequired`, and clients echo them
//! in `PaymentPayload`.
//!
//! ## Available Extensions
//!
//! - [`bazaar`]: Resource discovery and cataloging for x402-enabled endpoints and MCP tools
//! - [`sign_in_with_x`]: Authenticated sign-in alongside payment
//!
//! ## Defining Custom Extensions
//!
//! You can define your own extensions by implementing the [`ExtensionInfo`](x402_core::types::ExtensionInfo)
//! trait from `x402-core`:
//!
//! ```
//! use serde::{Serialize, Deserialize};
//! use x402_core::types::{Extension, ExtensionInfo, AnyJson};
//! use serde_json::json;
//!
//! #[derive(Debug, Clone, Serialize, Deserialize)]
//! pub struct MyExtensionInfo {
//!     pub custom_field: String,
//! }
//!
//! impl ExtensionInfo for MyExtensionInfo {
//!     const ID: &'static str = "my-custom-extension";
//!     fn schema() -> AnyJson {
//!         json!({
//!             "type": "object",
//!             "properties": {
//!                 "custom_field": { "type": "string" }
//!             },
//!             "required": ["custom_field"]
//!         })
//!     }
//! }
//!
//! let ext = Extension::typed(MyExtensionInfo {
//!     custom_field: "hello".to_string(),
//! });
//! let (key, transport) = ext.into_pair();
//! assert_eq!(key, "my-custom-extension");
//! ```

/// The `bazaar` extension for resource discovery and cataloging.
pub mod bazaar;

/// The `sign-in-with-x` extension for authenticated access.
pub mod sign_in_with_x;
