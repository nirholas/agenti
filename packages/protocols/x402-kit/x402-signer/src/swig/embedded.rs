use bitrouter_swig_sdk::pda;
use solana_pubkey::Pubkey;

use x402_core::transport::{PaymentPayload, PaymentRequirements, PaymentResource};
use x402_core::types::{Extension, Record};

use crate::signer::PaymentSigner;
use crate::svm::wallet::SvmWalletSigner;

use super::transaction::{SwigAccount, SwigRpc, SwigSigningError, sign_swig_payment};

/// Signing error type for [`SwigEmbeddedSigner`].
pub type SwigEmbeddedSigningError = SwigSigningError;

/// SWIG embedded wallet x402 payment signer.
///
/// The **owner** of the SWIG account signs x402 payment transactions using
/// assets held in the embedded wallet (the `swig_wallet_address` PDA).
///
/// Use this when the signing authority is the wallet owner itself.
pub struct SwigEmbeddedSigner<W, R> {
    swig_account: Pubkey,
    swig_wallet_address: Pubkey,
    wallet: W,
    role_id: u32,
    rpc: R,
}

impl<W: SvmWalletSigner, R: SwigRpc> SwigEmbeddedSigner<W, R> {
    pub fn new(swig_account: Pubkey, wallet: W, role_id: u32, rpc: R) -> Self {
        let (swig_wallet_address, _bump) = pda::swig_wallet_address(&swig_account);
        Self {
            swig_account,
            swig_wallet_address,
            wallet,
            role_id,
            rpc,
        }
    }
}

impl<W, R> PaymentSigner for SwigEmbeddedSigner<W, R>
where
    W: SvmWalletSigner + Sync,
    R: SwigRpc + Sync,
{
    type Error = SwigEmbeddedSigningError;

    fn matches(&self, requirements: &PaymentRequirements) -> bool {
        requirements.scheme == "exact" && requirements.network.starts_with("solana:")
    }

    async fn sign_payment(
        &self,
        requirements: &PaymentRequirements,
        resource: &PaymentResource,
        extensions: &Record<Extension>,
    ) -> Result<PaymentPayload, Self::Error> {
        sign_swig_payment(
            &SwigAccount {
                swig_account: self.swig_account,
                swig_wallet_address: self.swig_wallet_address,
                authority_pubkey: self.wallet.pubkey().0,
                role_id: self.role_id,
            },
            &self.wallet,
            &self.rpc,
            requirements,
            resource,
            extensions,
            true, // owner self-approves each payment
        )
        .await
    }
}
