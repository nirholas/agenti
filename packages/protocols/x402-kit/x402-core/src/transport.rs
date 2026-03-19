//! X402 transport types and serialization.

use std::fmt::Debug;

use base64::{Engine, prelude::BASE64_STANDARD};
use serde::{Deserialize, Serialize};
use url::Url;

use crate::{
    core::{Address, NetworkFamily, Payment, Resource, Scheme},
    types::{AmountValue, AnyJson, Base64EncodedHeader, Extension, Record, X402V2},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequirements {
    pub scheme: String,
    pub network: String,
    pub amount: AmountValue,
    pub asset: String,
    pub pay_to: String,
    pub max_timeout_seconds: u64,
    pub extra: Option<AnyJson>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentResource {
    pub url: Url,
    pub description: String,
    pub mime_type: String,
}

impl From<Resource> for PaymentResource {
    fn from(resource: Resource) -> Self {
        PaymentResource {
            url: resource.url,
            description: resource.description,
            mime_type: resource.mime_type,
        }
    }
}

#[derive(Clone, Default)]
pub struct Accepts(Vec<PaymentRequirements>);

impl AsRef<[PaymentRequirements]> for Accepts {
    fn as_ref(&self) -> &[PaymentRequirements] {
        &self.0
    }
}

impl<T> From<T> for Accepts
where
    T: Into<PaymentRequirements>,
{
    fn from(value: T) -> Self {
        Accepts(vec![value.into()])
    }
}

impl From<Vec<PaymentRequirements>> for Accepts {
    fn from(value: Vec<PaymentRequirements>) -> Self {
        Accepts(value)
    }
}

impl IntoIterator for Accepts {
    type Item = PaymentRequirements;
    type IntoIter = std::vec::IntoIter<PaymentRequirements>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}

impl<'a> IntoIterator for &'a Accepts {
    type Item = &'a PaymentRequirements;
    type IntoIter = std::slice::Iter<'a, PaymentRequirements>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.iter()
    }
}

impl FromIterator<PaymentRequirements> for Accepts {
    fn from_iter<T: IntoIterator<Item = PaymentRequirements>>(iter: T) -> Self {
        let vec: Vec<PaymentRequirements> = iter.into_iter().collect();
        Accepts(vec)
    }
}

impl Serialize for Accepts {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        self.0.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for Accepts {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let vec = Vec::<PaymentRequirements>::deserialize(deserializer)?;
        Ok(Accepts(vec))
    }
}

impl Debug for Accepts {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        format!("{:?}", self.0).fmt(f)
    }
}

impl Accepts {
    pub fn push(mut self, payment: impl Into<PaymentRequirements>) -> Self {
        self.0.push(payment.into());
        self
    }

    pub fn new() -> Self {
        Accepts(Vec::new())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequired {
    pub x402_version: X402V2,
    pub error: String,
    pub resource: PaymentResource,
    pub accepts: Accepts,
    pub extensions: Record<Extension>,
}

impl TryFrom<PaymentRequired> for Base64EncodedHeader {
    type Error = crate::errors::Error;

    /// Serialize PaymentRequired into `PAYMENT-REQUIRED` header format
    fn try_from(value: PaymentRequired) -> Result<Self, Self::Error> {
        let json = serde_json::to_string(&value)?;
        let encoded = BASE64_STANDARD.encode(json);
        Ok(Base64EncodedHeader(encoded))
    }
}

impl TryFrom<Base64EncodedHeader> for PaymentRequired {
    type Error = crate::errors::Error;

    /// Deserialize `PAYMENT-REQUIRED` header into PaymentRequired
    fn try_from(value: Base64EncodedHeader) -> Result<Self, Self::Error> {
        let decoded = BASE64_STANDARD.decode(&value.0)?;
        let json_str = String::from_utf8(decoded)?;
        let payment_required: PaymentRequired = serde_json::from_str(&json_str)?;
        Ok(payment_required)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentPayload {
    pub x402_version: X402V2,
    pub resource: PaymentResource,
    pub accepted: PaymentRequirements,
    pub payload: AnyJson,
    pub extensions: Record<Extension>,
}

impl TryFrom<PaymentPayload> for Base64EncodedHeader {
    type Error = crate::errors::Error;

    /// Serialize PaymentPayload into `PAYMENT-SIGNATURE` header format
    fn try_from(value: PaymentPayload) -> Result<Self, Self::Error> {
        let json = serde_json::to_string(&value)?;
        let encoded = BASE64_STANDARD.encode(json);
        Ok(Base64EncodedHeader(encoded))
    }
}

impl TryFrom<Base64EncodedHeader> for PaymentPayload {
    type Error = crate::errors::Error;

    /// Deserialize `PAYMENT-SIGNATURE` header into PaymentPayload
    fn try_from(value: Base64EncodedHeader) -> Result<Self, Self::Error> {
        let decoded_bytes = BASE64_STANDARD.decode(&value.0)?;
        let json_str = String::from_utf8(decoded_bytes)?;
        let payload = serde_json::from_str(&json_str)?;
        Ok(payload)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementResponse {
    pub success: bool,
    pub transaction: String,
    pub network: String,
    pub payer: String,
}

impl TryFrom<SettlementResponse> for Base64EncodedHeader {
    type Error = crate::errors::Error;

    /// Serialize SettlementResponse into `PAYMENT-RESPONSE` header format
    fn try_from(value: SettlementResponse) -> Result<Self, Self::Error> {
        let json = serde_json::to_string(&value)?;
        let encoded = BASE64_STANDARD.encode(json);
        Ok(Base64EncodedHeader(encoded))
    }
}

impl TryFrom<Base64EncodedHeader> for SettlementResponse {
    type Error = crate::errors::Error;

    /// Deserialize `PAYMENT-RESPONSE` header into SettlementResponse
    fn try_from(value: Base64EncodedHeader) -> Result<Self, Self::Error> {
        let decoded_bytes = BASE64_STANDARD.decode(&value.0)?;
        let json_str = String::from_utf8(decoded_bytes)?;
        let response = serde_json::from_str(&json_str)?;
        Ok(response)
    }
}

impl<S, A> From<Payment<S, A>> for PaymentRequirements
where
    S: Scheme,
    A: Address<Network = S::Network>,
{
    fn from(payment: Payment<S, A>) -> Self {
        PaymentRequirements {
            scheme: S::SCHEME_NAME.to_string(),
            network: payment.scheme.network().network_id().to_string(),
            amount: payment.amount,
            asset: payment.asset.address.to_string(),
            pay_to: payment.pay_to.to_string(),
            max_timeout_seconds: payment.max_timeout_seconds,
            extra: payment.extra,
        }
    }
}
