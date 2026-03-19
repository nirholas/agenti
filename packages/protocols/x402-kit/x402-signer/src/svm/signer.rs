use std::str::FromStr;

use base64::{Engine, prelude::BASE64_STANDARD};
use serde::Deserialize;
use solana_pubkey::Pubkey;

use x402_core::{
    transport::{PaymentPayload, PaymentRequirements, PaymentResource},
    types::{Extension, Record, X402V2},
};
use x402_networks::svm::SvmAddress;

use crate::signer::PaymentSigner;

use super::{
    rpc::SvmRpc,
    transaction::{self, TransactionParams},
    wallet::SvmWalletSigner,
};

/// High-level SVM payment signer implementing `PaymentSigner`.
pub struct SvmPaymentSigner<S, R> {
    wallet: S,
    rpc: R,
}

impl<S: SvmWalletSigner, R: SvmRpc> SvmPaymentSigner<S, R> {
    pub fn new(wallet: S, rpc: R) -> Self {
        Self { wallet, rpc }
    }
}

/// SVM-specific signing errors.
#[derive(Debug, thiserror::Error)]
pub enum SvmSigningError {
    #[error("wallet error: {0}")]
    Wallet(String),

    #[error("RPC error: {0}")]
    Rpc(String),

    #[error("cannot parse address '{0}': {1}")]
    AddressParse(String, String),

    #[error("feePayer missing from requirements extra")]
    MissingFeePayer,

    #[error("payload serialization: {0}")]
    Serialization(String),
}

#[derive(Deserialize)]
struct SvmExtra {
    #[serde(rename = "feePayer")]
    fee_payer: Option<String>,
}

impl<S, R> PaymentSigner for SvmPaymentSigner<S, R>
where
    S: SvmWalletSigner + Sync,
    R: SvmRpc + Sync,
{
    type Error = SvmSigningError;

    fn matches(&self, requirements: &PaymentRequirements) -> bool {
        requirements.scheme == "exact" && requirements.network.starts_with("solana:")
    }

    async fn sign_payment(
        &self,
        requirements: &PaymentRequirements,
        resource: &PaymentResource,
        extensions: &Record<Extension>,
    ) -> Result<PaymentPayload, SvmSigningError> {
        // Extract feePayer from extra
        let extra: SvmExtra = requirements
            .extra
            .as_ref()
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(SvmExtra { fee_payer: None });

        let fee_payer_str = extra.fee_payer.ok_or(SvmSigningError::MissingFeePayer)?;
        let fee_payer = parse_pubkey(&fee_payer_str)?;

        let mint = parse_pubkey(&requirements.asset)?;
        let destination_owner = parse_pubkey(&requirements.pay_to)?;
        let payer = self.wallet.pubkey().0;
        let amount = requirements.amount.0 as u64;

        // Fetch mint info from RPC
        let mint_info = self
            .rpc
            .fetch_mint_info(SvmAddress(mint))
            .await
            .map_err(|e| SvmSigningError::Rpc(e.to_string()))?;

        // Fetch latest blockhash
        let recent_blockhash = self
            .rpc
            .get_latest_blockhash()
            .await
            .map_err(|e| SvmSigningError::Rpc(e.to_string()))?;

        // Build unsigned transaction
        let mut tx = transaction::build_exact_svm_transaction(&TransactionParams {
            fee_payer,
            payer,
            mint,
            destination_owner,
            amount,
            decimals: mint_info.decimals,
            token_program: mint_info.program_address.0,
            recent_blockhash,
        });

        // Partially sign with the buyer's wallet
        let message_bytes = tx.message_data();
        let signature = self
            .wallet
            .sign_message(&message_bytes)
            .await
            .map_err(|e| SvmSigningError::Wallet(e.to_string()))?;

        // Place signature at the correct index
        let signer_index = tx
            .message
            .account_keys
            .iter()
            .position(|k| k == &payer)
            .ok_or_else(|| {
                SvmSigningError::Serialization("signer not found in account keys".into())
            })?;
        tx.signatures[signer_index] = signature.0;

        // Serialize transaction to base64
        let tx_bytes = bincode::serde::encode_to_vec(&tx, bincode::config::legacy())
            .map_err(|e| SvmSigningError::Serialization(e.to_string()))?;
        let transaction_b64 = BASE64_STANDARD.encode(&tx_bytes);

        let payload_json = serde_json::to_value(x402_networks::svm::exact::ExplicitSvmPayload {
            transaction: transaction_b64,
        })
        .map_err(|e| SvmSigningError::Serialization(e.to_string()))?;

        Ok(PaymentPayload {
            x402_version: X402V2,
            resource: resource.clone(),
            accepted: requirements.clone(),
            payload: payload_json,
            extensions: extensions.clone(),
        })
    }
}

fn parse_pubkey(s: &str) -> Result<Pubkey, SvmSigningError> {
    Pubkey::from_str(s).map_err(|e| SvmSigningError::AddressParse(s.to_string(), e.to_string()))
}
