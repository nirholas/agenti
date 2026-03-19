use x402_networks::svm::{SvmAddress, SvmSignature};

/// Abstraction over a Solana wallet capable of signing transaction messages.
pub trait SvmWalletSigner {
    type Error: std::error::Error + Send + Sync;

    /// The signer's public key.
    fn pubkey(&self) -> SvmAddress;

    /// Sign the serialized transaction message bytes.
    fn sign_message(
        &self,
        message: &[u8],
    ) -> impl Future<Output = Result<SvmSignature, Self::Error>> + Send;
}

/// Blanket impl for any `solana_signer::Signer`.
impl<T: solana_signer::Signer + Sync> SvmWalletSigner for T {
    type Error = solana_signer::SignerError;

    fn pubkey(&self) -> SvmAddress {
        SvmAddress(solana_signer::Signer::pubkey(self))
    }

    async fn sign_message(&self, message: &[u8]) -> Result<SvmSignature, Self::Error> {
        let sig = solana_signer::Signer::try_sign_message(self, message)?;
        Ok(SvmSignature(sig))
    }
}
