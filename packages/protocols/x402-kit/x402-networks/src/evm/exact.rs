use bon::Builder;
use serde::{Deserialize, Serialize};

use x402_core::{
    core::{Payment, Scheme},
    transport::PaymentRequirements,
    types::{AmountValue, AnyJson},
};

use crate::evm::{EvmAddress, EvmNetwork, EvmSignature, ExplicitEvmAsset, ExplicitEvmNetwork};

use std::{
    fmt::{Debug, Display},
    str::FromStr,
};

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct Nonce(pub [u8; 32]);

impl Debug for Nonce {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Nonce(0x{})", hex::encode(self.0))
    }
}

impl Display for Nonce {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "0x{}", hex::encode(self.0))
    }
}

impl FromStr for Nonce {
    type Err = hex::FromHexError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.strip_prefix("0x").unwrap_or(s);
        let bytes = hex::decode(s)?;
        if bytes.len() != 32 {
            return Err(hex::FromHexError::InvalidStringLength);
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Nonce(arr))
    }
}

impl Serialize for Nonce {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for Nonce {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let nonce = Nonce::from_str(&s).map_err(serde::de::Error::custom)?;
        Ok(nonce)
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct TimestampSeconds(pub u64);

impl Display for TimestampSeconds {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Debug for TimestampSeconds {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "TimeSeconds({})", self.0)
    }
}

impl Serialize for TimestampSeconds {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for TimestampSeconds {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let seconds = s.parse::<u64>().map_err(serde::de::Error::custom)?;
        Ok(TimestampSeconds(seconds))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExactEvmPayload {
    pub signature: EvmSignature,
    pub authorization: ExactEvmAuthorization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExactEvmAuthorization {
    pub from: EvmAddress,
    pub to: EvmAddress,
    pub value: AmountValue,
    pub valid_after: TimestampSeconds,
    pub valid_before: TimestampSeconds,
    pub nonce: Nonce,
}

/// Exact EVM Scheme information holder
pub struct ExactEvmScheme(pub EvmNetwork);

impl Scheme for ExactEvmScheme {
    type Network = EvmNetwork;
    type Payload = ExactEvmPayload;
    const SCHEME_NAME: &'static str = "exact";

    fn network(&self) -> &Self::Network {
        &self.0
    }
}

#[derive(Builder, Debug, Clone)]
pub struct ExactEvm<A: ExplicitEvmAsset> {
    pub asset: A,
    #[builder(into)]
    pub pay_to: EvmAddress,
    pub amount: u64,
    pub max_timeout_seconds_override: Option<u64>,
    pub extra_override: Option<AnyJson>,
}

impl<A: ExplicitEvmAsset> From<ExactEvm<A>> for Payment<ExactEvmScheme, EvmAddress> {
    fn from(scheme: ExactEvm<A>) -> Self {
        Payment {
            scheme: ExactEvmScheme(A::Network::NETWORK),
            pay_to: scheme.pay_to,
            asset: A::ASSET,
            amount: scheme.amount.into(),
            max_timeout_seconds: scheme.max_timeout_seconds_override.unwrap_or(300),
            extra: scheme
                .extra_override
                .or(A::EIP712_DOMAIN.and_then(|v| serde_json::to_value(v).ok())),
        }
    }
}

impl<A: ExplicitEvmAsset> From<ExactEvm<A>> for PaymentRequirements {
    fn from(scheme: ExactEvm<A>) -> Self {
        PaymentRequirements::from(Payment::from(scheme))
    }
}

#[cfg(test)]
mod tests {
    use alloy_primitives::address;
    use serde_json::json;

    use crate::evm::assets::UsdcBaseSepolia;

    use super::*;

    #[test]
    fn test_build_payment_requirements() {
        let scheme = ExactEvm::builder()
            .asset(UsdcBaseSepolia)
            .amount(1000)
            .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
            .build();
        let payment_requirements: PaymentRequirements = scheme.into();

        assert_eq!(payment_requirements.scheme, "exact");
        assert_eq!(
            payment_requirements.asset,
            UsdcBaseSepolia::ASSET.address.to_string()
        );
        assert_eq!(payment_requirements.amount, 1000u64.into());
    }

    #[test]
    fn test_extra_override() {
        let pr: PaymentRequirements = ExactEvm::builder()
            .asset(UsdcBaseSepolia)
            .amount(1000)
            .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
            .build()
            .into();

        assert!(pr.extra.is_some());
        assert_eq!(
            pr.extra,
            serde_json::to_value(UsdcBaseSepolia::EIP712_DOMAIN).ok()
        );

        let pr: PaymentRequirements = ExactEvm::builder()
            .asset(UsdcBaseSepolia)
            .amount(1000)
            .pay_to(address!("0x3CB9B3bBfde8501f411bB69Ad3DC07908ED0dE20"))
            .extra_override(json!({"foo": "bar"}))
            .build()
            .into();

        assert_eq!(pr.extra, Some(json!({"foo": "bar"})));
    }
}
