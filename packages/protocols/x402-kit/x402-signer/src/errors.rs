use x402_core::transport::PaymentRequirements;

/// Errors that can occur during payment signing.
#[derive(Debug, thiserror::Error)]
pub enum SigningError {
    #[error("no matching payment requirements found for any configured signer")]
    NoMatchingRequirements,

    #[error("payload serialization failed: {0}")]
    PayloadSerialization(#[from] serde_json::Error),

    #[error("address parse error: {0}")]
    AddressParse(String),

    #[error("unsupported scheme '{scheme}' on network '{network}'")]
    SchemeNotSupported { scheme: String, network: String },

    #[error("signer error: {0}")]
    Signer(String),

    #[cfg(feature = "evm")]
    #[error("EVM signing error: {0}")]
    Evm(#[from] crate::evm::EvmSigningError),

    #[cfg(feature = "svm")]
    #[error("SVM signing error: {0}")]
    Svm(#[from] crate::svm::SvmSigningError),
}

/// Convenience type alias for signing results.
pub type SigningResult<T> = Result<T, SigningError>;

/// Determines which `PaymentRequirements` entry was selected.
pub struct SelectedRequirements<'a> {
    pub requirements: &'a PaymentRequirements,
    pub index: usize,
}
