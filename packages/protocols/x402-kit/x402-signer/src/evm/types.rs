use serde::{Deserialize, Serialize};

use x402_core::types::AmountValue;
use x402_networks::evm::{EvmAddress, EvmSignature};

/// Permit2 authorization payload for the x402 protocol.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permit2Payload {
    pub signature: EvmSignature,
    pub permit2_authorization: Permit2Authorization,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permit2Authorization {
    pub from: EvmAddress,
    pub permitted: TokenPermissions,
    pub spender: EvmAddress,
    /// Random nonce as a decimal string (uint256).
    pub nonce: String,
    /// Deadline as a decimal string of unix timestamp (uint256).
    pub deadline: String,
    pub witness: Permit2Witness,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenPermissions {
    pub token: EvmAddress,
    pub amount: AmountValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permit2Witness {
    pub to: EvmAddress,
    /// validAfter as a decimal string of unix timestamp (uint256).
    pub valid_after: String,
}

/// Transfer method detection from `extra.transferMethod`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TransferMethod {
    #[default]
    Eip3009,
    Permit2,
}

/// Parse `transferMethod` from the extra field.
pub fn detect_transfer_method(extra: &Option<serde_json::Value>) -> TransferMethod {
    extra
        .as_ref()
        .and_then(|v| v.get("transferMethod"))
        .and_then(|v| v.as_str())
        .map(|s| match s {
            "permit2" => TransferMethod::Permit2,
            _ => TransferMethod::Eip3009,
        })
        .unwrap_or(TransferMethod::Eip3009)
}
