use std::str::FromStr;

use serde::Deserialize;

use x402_core::{
    transport::{PaymentPayload, PaymentRequirements, PaymentResource},
    types::{Extension, Record, X402V2},
};
use x402_networks::evm::EvmAddress;

use crate::signer::PaymentSigner;

use super::{
    constants::parse_evm_chain_id,
    eip3009::{self, Eip3009Params},
    permit2::{self, Permit2Params},
    types::{TransferMethod, detect_transfer_method},
    wallet::EvmWalletSigner,
};

/// High-level EVM payment signer implementing `PaymentSigner`.
pub struct EvmPaymentSigner<S> {
    signer: S,
}

impl<S: EvmWalletSigner> EvmPaymentSigner<S> {
    pub fn new(signer: S) -> Self {
        Self { signer }
    }
}

/// EVM-specific signing errors.
#[derive(Debug, thiserror::Error)]
pub enum EvmSigningError {
    #[error("wallet error: {0}")]
    Wallet(String),

    #[error("cannot parse chain ID from network: {0}")]
    InvalidNetwork(String),

    #[error("cannot parse address: {0}")]
    AddressParse(String),

    #[error("EIP-712 domain info missing from requirements extra")]
    MissingEip712Domain,

    #[error("payload serialization: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Deserialize, Default)]
struct Eip712DomainExtra {
    name: Option<String>,
    version: Option<String>,
    #[allow(dead_code)]
    #[serde(rename = "transferMethod")]
    transfer_method: Option<String>,
}

impl<S: EvmWalletSigner + Sync> PaymentSigner for EvmPaymentSigner<S> {
    type Error = EvmSigningError;

    fn matches(&self, requirements: &PaymentRequirements) -> bool {
        requirements.scheme == "exact" && requirements.network.starts_with("eip155:")
    }

    async fn sign_payment(
        &self,
        requirements: &PaymentRequirements,
        resource: &PaymentResource,
        extensions: &Record<Extension>,
    ) -> Result<PaymentPayload, EvmSigningError> {
        let chain_id = parse_evm_chain_id(&requirements.network)
            .ok_or_else(|| EvmSigningError::InvalidNetwork(requirements.network.clone()))?;

        let pay_to = EvmAddress::from_str(&requirements.pay_to)
            .map_err(|e| EvmSigningError::AddressParse(e.to_string()))?;

        let asset_address = alloy_primitives::Address::from_str(&requirements.asset)
            .map_err(|e| EvmSigningError::AddressParse(e.to_string()))?;

        let from = self.signer.address();
        let amount = requirements.amount.0;
        let transfer_method = detect_transfer_method(&requirements.extra);

        let payload_json = match transfer_method {
            TransferMethod::Eip3009 => {
                let domain_extra: Eip712DomainExtra = requirements
                    .extra
                    .as_ref()
                    .and_then(|v| serde_json::from_value(v.clone()).ok())
                    .unwrap_or_default();

                let eip712_name = domain_extra
                    .name
                    .ok_or(EvmSigningError::MissingEip712Domain)?;
                let eip712_version = domain_extra
                    .version
                    .ok_or(EvmSigningError::MissingEip712Domain)?;

                let payload = eip3009::sign_eip3009(
                    &self.signer,
                    Eip3009Params {
                        from,
                        pay_to,
                        amount,
                        max_timeout_seconds: requirements.max_timeout_seconds,
                        chain_id,
                        asset_address,
                        eip712_name,
                        eip712_version,
                    },
                )
                .await
                .map_err(|e| EvmSigningError::Wallet(e.to_string()))?;

                serde_json::to_value(payload)?
            }
            TransferMethod::Permit2 => {
                let payload = permit2::sign_permit2(
                    &self.signer,
                    Permit2Params {
                        from,
                        pay_to,
                        amount,
                        max_timeout_seconds: requirements.max_timeout_seconds,
                        chain_id,
                        asset_address,
                    },
                )
                .await
                .map_err(|e| EvmSigningError::Wallet(e.to_string()))?;

                serde_json::to_value(payload)?
            }
        };

        Ok(PaymentPayload {
            x402_version: X402V2,
            resource: resource.clone(),
            accepted: requirements.clone(),
            payload: payload_json,
            extensions: extensions.clone(),
        })
    }
}
