use alloy_primitives::B256;
use alloy_signer::{Error as AlloySignerError, Signer as AlloySigner};

use x402_networks::evm::{EvmAddress, EvmSignature};

/// Abstraction over an EVM wallet capable of signing EIP-712 hashes.
pub trait EvmWalletSigner {
    type Error: std::error::Error + Send + Sync;

    /// The signer's address.
    fn address(&self) -> EvmAddress;

    /// Sign a pre-computed EIP-712 hash.
    fn sign_hash(
        &self,
        hash: &B256,
    ) -> impl Future<Output = Result<EvmSignature, Self::Error>> + Send;
}

impl<T: AlloySigner + Sync> EvmWalletSigner for T {
    type Error = AlloySignerError;

    fn address(&self) -> EvmAddress {
        EvmAddress(AlloySigner::address(self))
    }

    async fn sign_hash(&self, hash: &B256) -> Result<EvmSignature, Self::Error> {
        let sig = AlloySigner::sign_hash(self, hash).await?;
        Ok(EvmSignature(sig))
    }
}
