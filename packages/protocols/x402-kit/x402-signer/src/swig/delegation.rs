use bitrouter_swig_sdk::pda;
use solana_pubkey::Pubkey;

use x402_core::transport::{PaymentPayload, PaymentRequirements, PaymentResource};
use x402_core::types::{Extension, Record};

use crate::signer::PaymentSigner;
use crate::svm::wallet::SvmWalletSigner;

use super::transaction::{SwigAccount, SwigRpc, SwigSigningError, sign_swig_payment};

/// Signing error type for [`SwigDelegationSigner`].
pub type SwigDelegationSigningError = SwigSigningError;

/// SWIG delegation x402 payment signer.
///
/// A **delegated authority** signs x402 payment transactions using assets
/// held in someone else's embedded wallet (the `swig_wallet_address` PDA).
///
/// The delegatee must hold a role on the SWIG account with sufficient
/// token-transfer permissions.
pub struct SwigDelegationSigner<W, R> {
    swig_account: Pubkey,
    swig_wallet_address: Pubkey,
    authority: W,
    role_id: u32,
    rpc: R,
}

impl<W: SvmWalletSigner, R: SwigRpc> SwigDelegationSigner<W, R> {
    pub fn new(swig_account: Pubkey, authority: W, role_id: u32, rpc: R) -> Self {
        let (swig_wallet_address, _bump) = pda::swig_wallet_address(&swig_account);
        Self {
            swig_account,
            swig_wallet_address,
            authority,
            role_id,
            rpc,
        }
    }
}

impl<W, R> PaymentSigner for SwigDelegationSigner<W, R>
where
    W: SvmWalletSigner + Sync,
    R: SwigRpc + Sync,
{
    type Error = SwigDelegationSigningError;

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
                authority_pubkey: self.authority.pubkey().0,
                role_id: self.role_id,
            },
            &self.authority,
            &self.rpc,
            requirements,
            resource,
            extensions,
            false, // delegate is pre-approved by the owner at setup time
        )
        .await
    }
}
