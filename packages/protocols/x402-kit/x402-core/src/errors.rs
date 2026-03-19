/// Error types for X402 core operations.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// JSON serialization/deserialization errors.
    #[error("Serde JSON error: {0}")]
    SerdeJsonError(#[from] serde_json::Error),

    /// Base64 encoding/decoding errors.
    #[error("Base64 decode error: {0}")]
    Base64DecodeError(#[from] base64::DecodeError),

    /// UTF-8 decoding errors.
    #[error("UTF-8 decode error: {0}")]
    Utf8DecodeError(#[from] std::string::FromUtf8Error),
}

/// A specialized `Result` type for X402 core operations.
pub type Result<T> = std::result::Result<T, Error>;
