//! Miscellaneous common types used throughout the X402 codebase.

use std::fmt::{Debug, Display};

use serde::{Deserialize, Serialize};

/// Represents an key-value pair in the X402 protocol. The key is a `String`.
pub type Record<V> = std::collections::HashMap<String, V>;

/// Represents any JSON value. Used for serializing/deserializing arbitrary JSON data.
pub type AnyJson = serde_json::Value;

/// Represents the X402 protocol version 1. Any type's specific to version 1 can use this struct for its `x402Version` field.
///
/// ```
/// use serde::{Serialize, Deserialize};
/// use x402_core::types::X402V1;
///
/// #[derive(Debug, Clone, Serialize, Deserialize)]
/// #[serde(rename_all = "camelCase")]
/// struct ExampleV1 {
///     x402_version: X402V1,
///     // other fields...
/// }
///
/// let example: ExampleV1 = serde_json::from_value(serde_json::json!({
///     "x402Version": 1,
///     // other fields...
/// })).unwrap();
///
/// assert_eq!(example.x402_version, X402V1);
///
/// let json = serde_json::to_value(&example).unwrap();
/// assert_eq!(json.get("x402Version").unwrap(), &serde_json::json!(1));
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct X402V1;

/// Represents the X402 protocol version 2.
///
/// Any type's specific to version 2 can use this struct for its `x402Version` field.
///
/// ```
/// use serde::{Serialize, Deserialize};
/// use x402_core::types::X402V2;
///
/// #[derive(Debug, Clone, Serialize, Deserialize)]
/// #[serde(rename_all = "camelCase")]
/// struct ExampleV2 {
///     x402_version: X402V2,
///     // other fields...
/// }
///
/// let example: ExampleV2 = serde_json::from_value(serde_json::json!({
///     "x402Version": 2,
///     // other fields...
/// })).unwrap();
///
/// assert_eq!(example.x402_version, X402V2);
///
/// let json = serde_json::to_value(&example).unwrap();
/// assert_eq!(json.get("x402Version").unwrap(), &serde_json::json!(2));
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct X402V2;

impl Serialize for X402V1 {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_i8(1)
    }
}

impl<'de> Deserialize<'de> for X402V1 {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let v = i8::deserialize(deserializer)?;
        match v {
            1 => Ok(X402V1),
            _ => Err(serde::de::Error::custom(format!(
                "Unsupported X402 version {}; expected 1",
                v
            ))),
        }
    }
}

impl Display for X402V1 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "1")
    }
}

impl Serialize for X402V2 {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_i8(2)
    }
}

impl<'de> Deserialize<'de> for X402V2 {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let v = i8::deserialize(deserializer)?;
        match v {
            2 => Ok(X402V2),
            _ => Err(serde::de::Error::custom(format!(
                "Unsupported X402 version {}; expected 2",
                v
            ))),
        }
    }
}

impl Display for X402V2 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "2")
    }
}

/// Represents the X402 protocol version, either v1 or v2.
///
/// ```
/// use serde::{Serialize, Deserialize};
/// use x402_core::types::{X402Version, X402V1, X402V2};
/// #[derive(Debug, Clone, Serialize, Deserialize)]
/// #[serde(rename_all = "camelCase")]
/// struct Example {
///     x402_version: X402Version,
///     // other fields...
/// }
/// let example_v1: Example = serde_json::from_value(serde_json::json!({
///     "x402Version": 1,
///     // other fields...
/// })).unwrap();
/// assert!(example_v1.x402_version.as_v1().is_some());
///
/// let json_v1 = serde_json::to_value(&example_v1).unwrap();
/// assert_eq!(json_v1.get("x402Version").unwrap(), &serde_json::json!(1));
///
/// let example_v2: Example = serde_json::from_value(serde_json::json!({
///     "x402Version": 2,
///     // other fields...
/// })).unwrap();
/// assert!(example_v2.x402_version.as_v2().is_some());
///
/// let json_v2 = serde_json::to_value(&example_v2).unwrap();
/// assert_eq!(json_v2.get("x402Version").unwrap(), &serde_json::json!(2));
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum X402Version {
    /// Version 1 of the X402 protocol: `"x402Version": 1`.
    V1(X402V1),
    /// Version 2 of the X402 protocol. `"x402Version": 2`.
    V2(X402V2),
}

impl Serialize for X402Version {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            X402Version::V1(v) => v.serialize(serializer),
            X402Version::V2(v) => v.serialize(serializer),
        }
    }
}

impl<'de> Deserialize<'de> for X402Version {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let v = i8::deserialize(deserializer)?;
        match v {
            1 => Ok(X402Version::V1(X402V1)),
            2 => Ok(X402Version::V2(X402V2)),
            _ => Err(serde::de::Error::custom(format!(
                "Unsupported X402 version {}; expected 1 or 2",
                v
            ))),
        }
    }
}

impl Display for X402Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            X402Version::V1(v) => write!(f, "{}", v),
            X402Version::V2(v) => write!(f, "{}", v),
        }
    }
}

impl X402Version {
    pub fn as_v1(&self) -> Option<X402V1> {
        match self {
            X402Version::V1(v) => Some(*v),
            _ => None,
        }
    }

    pub fn as_v2(&self) -> Option<X402V2> {
        match self {
            X402Version::V2(v) => Some(*v),
            _ => None,
        }
    }
}

/// Represents a base64-encoded header value for X402 protocol headers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Base64EncodedHeader(pub String);

impl Serialize for Base64EncodedHeader {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for Base64EncodedHeader {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(Base64EncodedHeader(s))
    }
}

impl Display for Base64EncodedHeader {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
