//! X402 payment facilitator interface and types.

use serde::{Deserialize, Serialize};

use crate::{
    transport::{PaymentPayload, PaymentRequirements, SettlementResponse},
    types::{AnyJson, ExtensionIdentifier, Record, X402Version},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentRequest {
    pub payment_payload: PaymentPayload,
    pub payment_requirements: PaymentRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerifyResult {
    Valid(VerifyValid),
    Invalid(VerifyInvalid),
}

impl VerifyResult {
    pub fn is_valid(&self) -> bool {
        matches!(self, VerifyResult::Valid(_))
    }

    pub fn valid(valid: VerifyValid) -> Self {
        VerifyResult::Valid(valid)
    }

    pub fn invalid(invalid: VerifyInvalid) -> Self {
        VerifyResult::Invalid(invalid)
    }

    pub fn as_valid(&self) -> Option<&VerifyValid> {
        match self {
            VerifyResult::Valid(v) => Some(v),
            _ => None,
        }
    }

    pub fn as_invalid(&self) -> Option<&VerifyInvalid> {
        match self {
            VerifyResult::Invalid(v) => Some(v),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyValid {
    pub payer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyInvalid {
    pub invalid_reason: String,
    pub payer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SettleResult {
    Success(SettleSuccess),
    Failed(SettleFailed),
}

impl SettleResult {
    pub fn is_success(&self) -> bool {
        matches!(self, SettleResult::Success(_))
    }

    pub fn success(success: SettleSuccess) -> Self {
        SettleResult::Success(success)
    }

    pub fn failed(failed: SettleFailed) -> Self {
        SettleResult::Failed(failed)
    }

    pub fn as_success(&self) -> Option<&SettleSuccess> {
        match self {
            SettleResult::Success(v) => Some(v),
            _ => None,
        }
    }

    pub fn as_failed(&self) -> Option<&SettleFailed> {
        match self {
            SettleResult::Failed(v) => Some(v),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettleSuccess {
    pub payer: String,
    pub transaction: String,
    pub network: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettleFailed {
    pub error_reason: String,
    pub payer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedKinds {
    pub x402_version: X402Version,
    pub scheme: String,
    pub network: String,
    pub extra: Option<AnyJson>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedResponse {
    pub kinds: Vec<SupportedKinds>,

    // TODO: implement stronger typings for extensions
    /// Array of extension identifiers the facilitator has implemented
    pub extensions: Vec<ExtensionIdentifier>,
    /// Map of CAIP-2 patterns (e.g., eip155:*) to public signer addresses
    pub signers: Record<Vec<String>>,
}

impl From<SettleSuccess> for SettlementResponse {
    fn from(success: SettleSuccess) -> Self {
        SettlementResponse {
            success: true,
            transaction: success.transaction,
            network: success.network,
            payer: success.payer,
        }
    }
}

/// X402 facilitator interface.
pub trait Facilitator {
    type Error: std::error::Error;

    fn supported(&self) -> impl Future<Output = Result<SupportedResponse, Self::Error>>;

    fn verify(
        &self,
        request: PaymentRequest,
    ) -> impl Future<Output = Result<VerifyResult, Self::Error>>;

    fn settle(
        &self,
        request: PaymentRequest,
    ) -> impl Future<Output = Result<SettleResult, Self::Error>>;
}
