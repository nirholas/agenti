//! [`AmountValue`] represents a monetary amount in the X402 protocol.
//!
//! This module holds its type definition and implementations.

use std::fmt::Display;

use serde::{Deserialize, Serialize};

/// Represents a monetary amount in the X402 protocol.
///
/// Uses a `u128` internally to support large values.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AmountValue(pub u128);

impl From<u8> for AmountValue {
    fn from(value: u8) -> Self {
        AmountValue(value as u128)
    }
}

impl From<u16> for AmountValue {
    fn from(value: u16) -> Self {
        AmountValue(value as u128)
    }
}

impl From<u32> for AmountValue {
    fn from(value: u32) -> Self {
        AmountValue(value as u128)
    }
}

impl From<u64> for AmountValue {
    fn from(value: u64) -> Self {
        AmountValue(value as u128)
    }
}

impl From<u128> for AmountValue {
    fn from(value: u128) -> Self {
        AmountValue(value)
    }
}

impl Display for AmountValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Serialize for AmountValue {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for AmountValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let value = s.parse::<u128>().map_err(serde::de::Error::custom)?;
        Ok(AmountValue(value))
    }
}
