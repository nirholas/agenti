//! The `sign-in-with-x` extension for authenticated access.
//!
//! The `sign-in-with-x` extension enables resource servers to require
//! authenticated sign-in alongside payment. The server provides sign-in
//! parameters and supported chains, and the client echoes back the extension
//! with a signature.
//!
//! # Example
//!
//! ```
//! use x402_extensions::sign_in_with_x::*;
//! use x402_core::types::Extension;
//! use serde_json::json;
//!
//! let info = SignInWithXInfo::builder()
//!     .domain("api.example.com")
//!     .uri("https://api.example.com/premium-data")
//!     .version("1")
//!     .nonce("a1b2c3d4e5f67890a1b2c3d4e5f67890")
//!     .issued_at("2024-01-15T10:30:00.000Z")
//!     .statement("Sign in to access premium data")
//!     .build();
//!
//! let ext = Extension::typed(info)
//!     .with_extra("supportedChains", json!([
//!         {"chainId": "eip155:8453", "type": "eip191"}
//!     ]));
//!
//! let (key, transport) = ext.into_pair();
//! assert_eq!(key, "sign-in-with-x");
//!
//! // Extra fields are flattened in serialization
//! let json = serde_json::to_value(&transport).unwrap();
//! assert!(json.get("supportedChains").is_some());
//! ```

use bon::Builder;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use x402_core::types::{AnyJson, ExtensionInfo};

/// Sign-in info for the `sign-in-with-x` extension.
///
/// Contains parameters for authenticated sign-in that the server provides.
/// Clients echo this back with additional fields (e.g., `address`, `signature`).
#[derive(Builder, Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SignInWithXInfo {
    /// The domain requesting the sign-in.
    #[builder(into)]
    pub domain: String,

    /// The URI of the resource being accessed.
    #[builder(into)]
    pub uri: String,

    /// The sign-in message version.
    #[builder(into)]
    pub version: String,

    /// A unique nonce to prevent replay attacks.
    #[builder(into)]
    pub nonce: String,

    /// The timestamp when this sign-in request was issued (ISO 8601).
    #[builder(into)]
    pub issued_at: String,

    /// When the sign-in request expires (ISO 8601).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(into)]
    pub expiration_time: Option<String>,

    /// Human-readable statement for the sign-in.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[builder(into)]
    pub statement: Option<String>,

    /// Resources associated with this sign-in.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<Vec<String>>,
}

impl ExtensionInfo for SignInWithXInfo {
    const ID: &'static str = "sign-in-with-x";

    fn schema() -> AnyJson {
        let schema = schemars::schema_for!(SignInWithXInfo);
        serde_json::to_value(&schema).expect("SignInWithXInfo schema generation should not fail")
    }
}

/// A supported chain entry for the `sign-in-with-x` extension.
///
/// Used in the `supportedChains` extra field.
#[derive(Builder, Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SupportedChain {
    /// The chain identifier in CAIP-2 format (e.g., `"eip155:8453"`).
    #[builder(into)]
    pub chain_id: String,

    /// The signature type (e.g., `"eip191"`).
    #[serde(rename = "type")]
    #[builder(into)]
    pub chain_type: String,
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use x402_core::types::{Extension, ExtensionMapInsert, Record};

    use super::*;

    #[test]
    fn sign_in_with_x_basic() {
        let info = SignInWithXInfo::builder()
            .domain("api.example.com")
            .uri("https://api.example.com/premium-data")
            .version("1")
            .nonce("a1b2c3d4e5f67890a1b2c3d4e5f67890")
            .issued_at("2024-01-15T10:30:00.000Z")
            .build();

        let ext = Extension::typed(info);
        let (key, transport_ext) = ext.into_pair();

        assert_eq!(key, "sign-in-with-x");
        assert_eq!(transport_ext.info["domain"], "api.example.com");
        assert_eq!(transport_ext.info["version"], "1");
    }

    #[test]
    fn sign_in_with_x_with_optional_fields() {
        let info = SignInWithXInfo::builder()
            .domain("api.example.com")
            .uri("https://api.example.com/premium-data")
            .version("1")
            .nonce("a1b2c3d4e5f67890a1b2c3d4e5f67890")
            .issued_at("2024-01-15T10:30:00.000Z")
            .expiration_time("2024-01-15T10:35:00.000Z")
            .statement("Sign in to access premium data")
            .resources(vec!["https://api.example.com/premium-data".to_string()])
            .build();

        let (_, ext) = Extension::typed(info).into_pair();

        assert_eq!(ext.info["statement"], "Sign in to access premium data");
        assert_eq!(ext.info["expirationTime"], "2024-01-15T10:35:00.000Z");
        assert!(ext.info["resources"].is_array());
    }

    #[test]
    fn sign_in_with_x_with_supported_chains() {
        let info = SignInWithXInfo::builder()
            .domain("api.example.com")
            .uri("https://api.example.com/premium-data")
            .version("1")
            .nonce("a1b2c3d4e5f67890")
            .issued_at("2024-01-15T10:30:00.000Z")
            .build();

        let chains = vec![
            SupportedChain::builder()
                .chain_id("eip155:8453")
                .chain_type("eip191")
                .build(),
        ];

        let ext = Extension::typed(info)
            .with_extra("supportedChains", serde_json::to_value(&chains).unwrap());

        let (key, transport_ext) = ext.into_pair();
        assert_eq!(key, "sign-in-with-x");

        // Serialize and check extra fields are flattened
        let json = serde_json::to_value(&transport_ext).unwrap();
        assert!(json.get("supportedChains").is_some());
        assert_eq!(json["supportedChains"][0]["chainId"], "eip155:8453");
        assert_eq!(json["supportedChains"][0]["type"], "eip191");
    }

    #[test]
    fn sign_in_with_x_schema_is_generated() {
        let schema = <SignInWithXInfo as ExtensionInfo>::schema();
        assert!(schema.is_object());
    }

    #[test]
    fn sign_in_with_x_insert_into_map() {
        let mut extensions: Record<Extension> = Record::new();

        let info = SignInWithXInfo::builder()
            .domain("example.com")
            .uri("https://example.com")
            .version("1")
            .nonce("test_nonce")
            .issued_at("2024-01-01T00:00:00.000Z")
            .build();

        extensions.insert_typed(Extension::typed(info));

        assert!(extensions.contains_key("sign-in-with-x"));
        assert_eq!(extensions["sign-in-with-x"].info["domain"], "example.com");
    }

    #[test]
    fn sign_in_with_x_roundtrip() {
        let info = SignInWithXInfo::builder()
            .domain("api.example.com")
            .uri("https://api.example.com/resource")
            .version("1")
            .nonce("nonce123")
            .issued_at("2024-01-15T10:30:00.000Z")
            .expiration_time("2024-01-15T10:35:00.000Z")
            .statement("Test statement")
            .build();

        let json = serde_json::to_value(&info).unwrap();
        let deserialized: SignInWithXInfo = serde_json::from_value(json.clone()).unwrap();
        let re_serialized = serde_json::to_value(&deserialized).unwrap();

        assert_eq!(json, re_serialized);
    }

    #[test]
    fn sign_in_with_x_transport_roundtrip_with_extra() {
        let info = SignInWithXInfo::builder()
            .domain("api.example.com")
            .uri("https://api.example.com/resource")
            .version("1")
            .nonce("nonce123")
            .issued_at("2024-01-15T10:30:00.000Z")
            .build();

        let ext = Extension::typed(info).with_extra(
            "supportedChains",
            json!([{"chainId": "eip155:8453", "type": "eip191"}]),
        );

        let (_, transport_ext) = ext.into_pair();

        // Serialize
        let json = serde_json::to_value(&transport_ext).unwrap();

        // Deserialize back
        let deserialized: Extension = serde_json::from_value(json.clone()).unwrap();

        // Verify roundtrip
        assert_eq!(transport_ext.info, deserialized.info);
        assert_eq!(transport_ext.schema, deserialized.schema);
        assert_eq!(
            deserialized.extra.get("supportedChains").unwrap(),
            &json!([{"chainId": "eip155:8453", "type": "eip191"}])
        );
    }

    #[test]
    fn sign_in_with_x_full_spec_example() {
        // Test against the full example from the x402 spec
        let json = json!({
            "info": {
                "domain": "api.example.com",
                "uri": "https://api.example.com/premium-data",
                "version": "1",
                "nonce": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
                "issuedAt": "2024-01-15T10:30:00.000Z",
                "expirationTime": "2024-01-15T10:35:00.000Z",
                "statement": "Sign in to access premium data",
                "resources": ["https://api.example.com/premium-data"]
            },
            "supportedChains": [
                {
                    "chainId": "eip155:8453",
                    "type": "eip191"
                }
            ],
            "schema": {}
        });

        let ext: Extension = serde_json::from_value(json).unwrap();
        assert_eq!(ext.info["domain"], "api.example.com");
        assert!(ext.extra.contains_key("supportedChains"));

        // Convert to typed
        let typed_ext: Extension<SignInWithXInfo> = ext.into_typed().unwrap();
        assert_eq!(typed_ext.info.domain, "api.example.com");
        assert_eq!(typed_ext.info.version, "1");
        assert_eq!(
            typed_ext.info.statement.as_deref(),
            Some("Sign in to access premium data")
        );
    }
}
