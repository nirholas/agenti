use std::str::FromStr;

use base64::{Engine, prelude::BASE64_STANDARD};
use bitrouter_swig_sdk::auth::ClientRole;
use bitrouter_swig_sdk::auth::ed25519::Ed25519ClientRole;
use serde::Deserialize;
use solana_instruction::{AccountMeta, Instruction};
use solana_message::Message;
use solana_pubkey::Pubkey;
use solana_transaction::Transaction;

use x402_core::transport::{PaymentPayload, PaymentRequirements, PaymentResource};
use x402_core::types::{Extension, Record, X402V2};
use x402_networks::svm::SvmAddress;
use x402_networks::svm::exact::ExplicitSvmPayload;

use crate::svm::constants::*;
use crate::svm::rpc::SvmRpc;
use crate::svm::transaction::{
    build_memo_instruction, build_set_compute_unit_limit, build_set_compute_unit_price,
    build_transfer_checked, derive_ata,
};
use crate::svm::wallet::SvmWalletSigner;

/// Extended RPC operations needed for SWIG-based payment signing.
///
/// SWIG payments require sending a pre-approval transaction on-chain before
/// building the x402 payment. This trait extends [`SvmRpc`] with the ability
/// to send and confirm transactions.
pub trait SwigRpc: SvmRpc {
    /// Send a transaction and wait for confirmation.
    fn send_and_confirm_transaction(
        &self,
        transaction: &Transaction,
    ) -> impl Future<Output = Result<solana_signature::Signature, Self::Error>> + Send;
}

/// SWIG-specific signing errors.
#[derive(Debug, thiserror::Error)]
pub enum SwigSigningError {
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

    #[error("swig SDK error: {0}")]
    Swig(String),
}

#[derive(Deserialize)]
pub(super) struct SvmExtra {
    #[serde(rename = "feePayer")]
    pub fee_payer: Option<String>,
}

pub(super) fn parse_pubkey(s: &str) -> Result<Pubkey, SwigSigningError> {
    Pubkey::from_str(s).map_err(|e| SwigSigningError::AddressParse(s.to_string(), e.to_string()))
}

/// SWIG account parameters needed for payment signing.
pub(super) struct SwigAccount {
    pub swig_account: Pubkey,
    pub swig_wallet_address: Pubkey,
    pub authority_pubkey: Pubkey,
    pub role_id: u32,
}

/// SPL Token: ApproveChecked instruction.
///
/// Approves a delegate to transfer up to `amount` tokens from `source`.
fn build_approve_checked(
    source: &Pubkey,
    mint: &Pubkey,
    delegate: &Pubkey,
    owner: &Pubkey,
    amount: u64,
    decimals: u8,
    token_program: &Pubkey,
) -> Instruction {
    // Discriminator 13 + u64 LE amount + u8 decimals = 10 bytes
    let mut data = Vec::with_capacity(10);
    data.push(13u8);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);

    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*source, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(*delegate, false),
            AccountMeta::new_readonly(*owner, true),
        ],
        data,
    }
}

/// Build a SWIG-authorized x402 payment.
///
/// This function works in two phases:
///
/// 1. **Pre-approve** (when `self_approve` is `true`): sends a SWIG
///    `sign_v2(ApproveChecked)` transaction on-chain so the authority keypair
///    becomes an approved SPL Token delegate on the SWIG wallet's ATA.
///    This only works for roles with broad permissions (e.g. owner with
///    `Permission::All`). Delegation roles with narrow permissions (e.g.
///    `Permission::Token`) should set this to `false` — the owner must
///    pre-approve the delegate at setup time instead.
///
/// 2. **Build standard x402 tx**: constructs a payment transaction with the
///    strict layout the facilitator expects:
///    - `[0]` SetComputeUnitLimit
///    - `[1]` SetComputeUnitPrice
///    - `[2]` TransferChecked (authority as approved delegate)
///    - `[3]` Memo (random nonce)
///
/// Shared by both [`SwigEmbeddedSigner`](super::SwigEmbeddedSigner) and
/// [`SwigDelegationSigner`](super::SwigDelegationSigner).
pub(super) async fn sign_swig_payment<W, R>(
    swig: &SwigAccount,
    wallet: &W,
    rpc: &R,
    requirements: &PaymentRequirements,
    resource: &PaymentResource,
    extensions: &Record<Extension>,
    self_approve: bool,
) -> Result<PaymentPayload, SwigSigningError>
where
    W: SvmWalletSigner + Sync,
    R: SwigRpc + Sync,
{
    // 1. Parse requirements.
    let extra: SvmExtra = requirements
        .extra
        .as_ref()
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or(SvmExtra { fee_payer: None });

    let fee_payer = parse_pubkey(&extra.fee_payer.ok_or(SwigSigningError::MissingFeePayer)?)?;
    let mint = parse_pubkey(&requirements.asset)?;
    let destination_owner = parse_pubkey(&requirements.pay_to)?;
    let amount = requirements.amount.0 as u64;

    // 2. Fetch mint info.
    let mint_info = rpc
        .fetch_mint_info(SvmAddress(mint))
        .await
        .map_err(|e| SwigSigningError::Rpc(e.to_string()))?;

    let token_program = mint_info.program_address.0;

    // 3. Derive ATAs.
    let source_ata = derive_ata(&swig.swig_wallet_address, &mint, &token_program);
    let destination_ata = derive_ata(&destination_owner, &mint, &token_program);

    // ── Phase 1: Pre-approve authority as delegate on the SWIG wallet's ATA ──
    // Only needed for roles with broad permissions (owner). Delegation roles
    // must be pre-approved by the owner at setup time.

    if self_approve {
        let approve_ix = build_approve_checked(
            &source_ata,
            &mint,
            &swig.authority_pubkey,
            &swig.swig_wallet_address,
            amount,
            mint_info.decimals,
            &token_program,
        );

        let client_role = Ed25519ClientRole::new(swig.authority_pubkey);
        let swig_approve_instructions = client_role
            .sign_v2(
                swig.swig_account,
                swig.swig_wallet_address,
                swig.role_id,
                vec![approve_ix],
                None,
                &[], // authority is already a signer in sign_v2
            )
            .map_err(|e| SwigSigningError::Swig(e.to_string()))?;

        let approve_blockhash = rpc
            .get_latest_blockhash()
            .await
            .map_err(|e| SwigSigningError::Rpc(e.to_string()))?;

        let approve_message = Message::new_with_blockhash(
            &swig_approve_instructions,
            Some(&swig.authority_pubkey), // authority pays gas for the approval
            &approve_blockhash,
        );
        let mut approve_tx = Transaction::new_unsigned(approve_message);

        let approve_msg_bytes = approve_tx.message_data();
        let approve_sig = wallet
            .sign_message(&approve_msg_bytes)
            .await
            .map_err(|e| SwigSigningError::Wallet(e.to_string()))?;
        approve_tx.signatures[0] = approve_sig.0; // fee_payer is always index 0

        rpc.send_and_confirm_transaction(&approve_tx)
            .await
            .map_err(|e| SwigSigningError::Rpc(e.to_string()))?;
    }

    // ── Phase 2: Build standard x402 payment transaction ──

    let recent_blockhash = rpc
        .get_latest_blockhash()
        .await
        .map_err(|e| SwigSigningError::Rpc(e.to_string()))?;

    let transfer_ix = build_transfer_checked(
        &source_ata,
        &mint,
        &destination_ata,
        &swig.authority_pubkey, // approved delegate
        amount,
        mint_info.decimals,
        &token_program,
    );

    let instructions = vec![
        build_set_compute_unit_limit(DEFAULT_COMPUTE_UNIT_LIMIT),
        build_set_compute_unit_price(DEFAULT_COMPUTE_UNIT_PRICE),
        transfer_ix,
        build_memo_instruction(),
    ];

    let message = Message::new_with_blockhash(&instructions, Some(&fee_payer), &recent_blockhash);
    let mut tx = Transaction::new_unsigned(message);

    let message_bytes = tx.message_data();
    let signature = wallet
        .sign_message(&message_bytes)
        .await
        .map_err(|e| SwigSigningError::Wallet(e.to_string()))?;

    // Place signature at the authority's index; fee_payer slot stays empty.
    let signer_index = tx
        .message
        .account_keys
        .iter()
        .position(|k| k == &swig.authority_pubkey)
        .ok_or_else(|| {
            SwigSigningError::Serialization("authority not found in account keys".into())
        })?;
    tx.signatures[signer_index] = signature.0;

    // 7. Serialize to base64.
    let tx_bytes = bincode::serde::encode_to_vec(&tx, bincode::config::legacy())
        .map_err(|e| SwigSigningError::Serialization(e.to_string()))?;

    let payload_json = serde_json::to_value(ExplicitSvmPayload {
        transaction: BASE64_STANDARD.encode(&tx_bytes),
    })
    .map_err(|e| SwigSigningError::Serialization(e.to_string()))?;

    Ok(PaymentPayload {
        x402_version: X402V2,
        resource: resource.clone(),
        accepted: requirements.clone(),
        payload: payload_json,
        extensions: extensions.clone(),
    })
}
