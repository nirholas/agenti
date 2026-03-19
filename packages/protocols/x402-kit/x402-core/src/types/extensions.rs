//! This module defines types related to X402 protocol extensions.
//!
//! Extensions enable modular optional functionality beyond core payment mechanics.
//! Servers advertise supported extensions in `PaymentRequired`, and clients echo them
//! in `PaymentPayload`.
//!
//! # Extension Type
//!
//! [`Extension`] is a generic type parameterized by the info type `T`.
//! When used in transport types (e.g., `PaymentRequired`, `PaymentPayload`),
//! the default `T = AnyJson` provides type-erased JSON storage.
//!
//! For typed extension construction, use a concrete info type `T` that implements
//! [`ExtensionInfo`]. This enables compile-time schema generation and type-safe
//! extension handling.
//!
//! # Example
//!
//! ```
//! use x402_core::types::{Extension, AnyJson, Record};
//! use serde_json::json;
//!
//! // Type-erased extension (transport form)
//! let ext = Extension::new(
//!     json!({"key": "value"}),
//!     json!({"type": "object"}),
//! );
//!
//! // With extra fields
//! let ext = Extension::new(
//!     json!({"key": "value"}),
//!     json!({"type": "object"}),
//! ).with_extra("supportedChains", json!([{"chainId": "eip155:8453"}]));
//!
//! // Serializes to: {"info": {...}, "schema": {...}, "supportedChains": [...]}
//! let json = serde_json::to_value(&ext).unwrap();
//! assert!(json.get("supportedChains").is_some());
//! ```

use std::fmt::Display;

use serde::{Deserialize, Serialize, ser::SerializeMap};

use crate::types::{AnyJson, Record};

/// Represents an extension in the X402 protocol.
///
/// An extension has:
/// - `info`: Extension-specific data provided by the server
/// - `schema`: JSON Schema defining the expected structure of `info`
/// - `extra`: Additional extension-specific fields (flattened during serialization)
///
/// The generic parameter `T` defaults to [`AnyJson`] for transport/type-erased use.
/// Use a concrete type implementing [`ExtensionInfo`] for typed extension construction.
#[derive(Debug, Clone)]
pub struct Extension<T = AnyJson> {
    /// The information about the extension.
    pub info: T,
    /// The schema defining the extension's structure.
    pub schema: AnyJson,
    /// Additional extension-specific fields, flattened during serialization.
    pub extra: Record<AnyJson>,
}

impl Extension {
    /// Create a new type-erased extension.
    pub fn new(info: AnyJson, schema: AnyJson) -> Self {
        Extension {
            info,
            schema,
            extra: Record::new(),
        }
    }

    /// Convert a type-erased extension into a typed extension.
    ///
    /// This deserializes the `info` field from JSON into the concrete type `T`.
    pub fn into_typed<T: serde::de::DeserializeOwned>(
        self,
    ) -> Result<Extension<T>, serde_json::Error> {
        let info: T = serde_json::from_value(self.info)?;
        Ok(Extension {
            info,
            schema: self.schema,
            extra: self.extra,
        })
    }
}

impl<T> Extension<T> {
    /// Add an extra field to the extension.
    ///
    /// Extra fields are flattened alongside `info` and `schema` during serialization.
    pub fn with_extra(mut self, key: impl Into<String>, value: impl Into<AnyJson>) -> Self {
        self.extra.insert(key.into(), value.into());
        self
    }
}

impl<T: ExtensionInfo> Extension<T> {
    /// Create a typed extension with auto-generated schema from `T`'s [`ExtensionInfo`] implementation.
    pub fn typed(info: T) -> Self {
        Extension {
            info,
            schema: T::schema(),
            extra: Record::new(),
        }
    }

    /// Convert this typed extension into a key-value pair for insertion into `Record<Extension>`.
    ///
    /// The key is `T::ID` and the value is the type-erased [`Extension`].
    pub fn into_pair(self) -> (String, Extension)
    where
        T: Serialize,
    {
        (
            T::ID.to_string(),
            Extension {
                info: serde_json::to_value(&self.info).unwrap_or_else(|e| {
                    panic!("Failed to serialize extension '{}' info: {e}", T::ID)
                }),
                schema: self.schema,
                extra: self.extra,
            },
        )
    }
}

/// Trait for typed extension info with compile-time schema generation.
///
/// Implement this trait for your extension's info type to enable:
/// - Type-safe extension construction via [`Extension::typed`]
/// - Automatic schema generation via [`ExtensionInfo::schema`]
/// - Automatic key assignment via [`ExtensionInfo::ID`]
///
/// # Example
///
/// ```
/// use serde::{Serialize, Deserialize};
/// use x402_core::types::{ExtensionInfo, AnyJson};
/// use serde_json::json;
///
/// #[derive(Debug, Clone, Serialize, Deserialize)]
/// struct MyInfo {
///     pub value: String,
/// }
///
/// impl ExtensionInfo for MyInfo {
///     const ID: &'static str = "my-extension";
///     fn schema() -> AnyJson {
///         json!({
///             "type": "object",
///             "properties": {
///                 "value": { "type": "string" }
///             },
///             "required": ["value"]
///         })
///     }
/// }
/// ```
pub trait ExtensionInfo: Clone + 'static {
    /// The extension identifier, used as the key in the `extensions` map.
    const ID: &'static str;

    /// Generate a JSON Schema for this extension's info type.
    fn schema() -> AnyJson;
}

/// Convenience trait for inserting typed extensions into a `Record<Extension>`.
pub trait ExtensionMapInsert {
    /// Insert a typed extension, using its [`ExtensionInfo::ID`] as the key.
    fn insert_typed<T: ExtensionInfo + Serialize>(&mut self, ext: Extension<T>);
}

impl ExtensionMapInsert for Record<Extension> {
    fn insert_typed<T: ExtensionInfo + Serialize>(&mut self, ext: Extension<T>) {
        let (key, value) = ext.into_pair();
        self.insert(key, value);
    }
}

// Custom Serialize: output info, schema, and flatten extra fields
impl<T: Serialize> Serialize for Extension<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut map = serializer.serialize_map(Some(2 + self.extra.len()))?;
        map.serialize_entry("info", &self.info)?;
        map.serialize_entry("schema", &self.schema)?;
        for (k, v) in &self.extra {
            map.serialize_entry(k, v)?;
        }
        map.end()
    }
}

// Custom Deserialize: extract info and schema, collect remaining into extra
impl<'de, T> Deserialize<'de> for Extension<T>
where
    T: serde::de::DeserializeOwned,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let mut map: Record<AnyJson> = Record::deserialize(deserializer)?;
        let info_val = map
            .remove("info")
            .ok_or_else(|| serde::de::Error::missing_field("info"))?;
        let schema = map
            .remove("schema")
            .ok_or_else(|| serde::de::Error::missing_field("schema"))?;
        let info: T = serde_json::from_value(info_val).map_err(serde::de::Error::custom)?;

        Ok(Extension {
            info,
            schema,
            extra: map,
        })
    }
}

/// Represents the identifier for an extension in the X402 protocol.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionIdentifier(pub String);

impl Display for ExtensionIdentifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn serialize_extension_without_extra() {
        let ext = Extension::new(json!({"domain": "example.com"}), json!({"type": "object"}));

        let json = serde_json::to_value(&ext).unwrap();
        assert_eq!(json.get("info").unwrap(), &json!({"domain": "example.com"}));
        assert_eq!(json.get("schema").unwrap(), &json!({"type": "object"}));
        // No extra fields
        assert_eq!(json.as_object().unwrap().len(), 2);
    }

    #[test]
    fn serialize_extension_with_extra() {
        let ext = Extension::new(json!({"domain": "example.com"}), json!({"type": "object"}))
            .with_extra(
                "supportedChains",
                json!([{"chainId": "eip155:8453", "type": "eip191"}]),
            );

        let json = serde_json::to_value(&ext).unwrap();
        assert_eq!(json.get("info").unwrap(), &json!({"domain": "example.com"}));
        assert_eq!(json.get("schema").unwrap(), &json!({"type": "object"}));
        assert!(json.get("supportedChains").is_some());
        assert_eq!(json.as_object().unwrap().len(), 3);
    }

    #[test]
    fn deserialize_extension_without_extra() {
        let json = json!({
            "info": {"domain": "example.com"},
            "schema": {"type": "object"}
        });

        let ext: Extension = serde_json::from_value(json).unwrap();
        assert_eq!(ext.info, json!({"domain": "example.com"}));
        assert_eq!(ext.schema, json!({"type": "object"}));
        assert!(ext.extra.is_empty());
    }

    #[test]
    fn deserialize_extension_with_extra() {
        let json = json!({
            "info": {"domain": "example.com"},
            "schema": {"type": "object"},
            "supportedChains": [{"chainId": "eip155:8453"}]
        });

        let ext: Extension = serde_json::from_value(json).unwrap();
        assert_eq!(ext.info, json!({"domain": "example.com"}));
        assert_eq!(ext.schema, json!({"type": "object"}));
        assert_eq!(
            ext.extra.get("supportedChains").unwrap(),
            &json!([{"chainId": "eip155:8453"}])
        );
    }

    #[test]
    fn roundtrip_extension_with_extra() {
        let ext = Extension::new(json!({"domain": "example.com"}), json!({"type": "object"}))
            .with_extra("customField", json!("custom_value"));

        let serialized = serde_json::to_value(&ext).unwrap();
        let deserialized: Extension = serde_json::from_value(serialized.clone()).unwrap();

        let re_serialized = serde_json::to_value(&deserialized).unwrap();
        assert_eq!(serialized, re_serialized);
    }

    #[test]
    fn typed_extension_into_pair() {
        #[derive(Debug, Clone, Serialize)]
        struct TestInfo {
            pub value: String,
        }

        impl ExtensionInfo for TestInfo {
            const ID: &'static str = "test-ext";
            fn schema() -> AnyJson {
                json!({"type": "object", "properties": {"value": {"type": "string"}}})
            }
        }

        let ext = Extension::typed(TestInfo {
            value: "hello".to_string(),
        });

        let (key, transport_ext) = ext.into_pair();
        assert_eq!(key, "test-ext");
        assert_eq!(transport_ext.info, json!({"value": "hello"}));
        assert_eq!(
            transport_ext.schema,
            json!({"type": "object", "properties": {"value": {"type": "string"}}})
        );
    }

    #[test]
    fn extension_map_insert_typed() {
        #[derive(Debug, Clone, Serialize)]
        struct TestInfo {
            pub data: i32,
        }

        impl ExtensionInfo for TestInfo {
            const ID: &'static str = "test";
            fn schema() -> AnyJson {
                json!({"type": "object"})
            }
        }

        let mut extensions: Record<Extension> = Record::new();
        extensions.insert_typed(Extension::typed(TestInfo { data: 42 }));

        assert!(extensions.contains_key("test"));
        assert_eq!(extensions["test"].info, json!({"data": 42}));
    }
}
