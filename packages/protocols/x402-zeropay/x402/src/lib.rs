mod scheme;
pub use scheme::evm::{Evm8004Registry, EvmAsset, EvmScheme};
pub use scheme::sol::SolScheme;

pub mod client;
pub mod facilitator;
pub use facilitator::Facilitator;

use async_trait::async_trait;
use eip8004::FeedbackAuth;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const X402_VERSION: i32 = 1;
pub const SCHEME: &str = "exact";

/// When a resource server requires payment, it responds with a payment required signal and a JSON payload containing payment requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequirementsResponse {
    /// Protocol version identifier
    pub x402_version: i32,
    /// Human-readable error message explaining why payment is required
    pub error: String,
    /// Array of payment requirement objects defining acceptable payment methods
    pub accepts: Vec<PaymentRequirements>,
}

/// Payment requirement objects defining acceptable payment methods
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequirements {
    /// Payment scheme identifier (e.g., "exact")
    pub scheme: String,
    /// Blockchain network identifier (e.g., "base-sepolia", "ethereum-mainnet")
    pub network: String,
    /// Required payment amount in atomic token units
    pub max_amount_required: String,
    /// Token contract address
    pub asset: String,
    /// Recipient wallet address for the payment
    pub pay_to: String,
    /// URL of the protected resource
    pub resource: String,
    /// Human-readable description of the resource
    pub description: String,
    /// MIME type of the expected response
    pub mime_type: Option<String>,
    /// JSON schema describing the response format
    pub output_schema: Option<Value>,
    /// Maximum time allowed for payment completion
    pub max_timeout_seconds: i32,
    /// Scheme-specific additional information
    pub extra: Option<Value>,
}

/// The client includes payment authorization as JSON in the payment payload field
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentPayload {
    /// Protocol version identifier (must be 1)
    pub x402_version: i32,
    /// Payment scheme identifier (e.g., "exact")
    pub scheme: String,
    /// Blockchain network identifier (e.g., "base-sepolia", "ethereum-mainnet")
    pub network: String,
    /// Payment data object
    pub payload: SchemePayload,
}

/// Payment authorization scheme-specific data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemePayload {
    /// EIP-712 signature for authorization
    pub signature: String,
    /// EIP-3009 authorization parameters
    pub authorization: Authorization,
    /// The index in client feedback for 8004 Reputation,
    /// If has this field, and service has register agent info,
    /// The `SettlementResponse` will has `feedback_auth` field.
    pub feedback_index: Option<u64>,
}

/// EIP-3009 authorization parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Authorization {
    /// Payer's wallet address
    pub from: String,
    /// Recipient's wallet address
    pub to: String,
    /// Payment amount in atomic units
    pub value: String,
    /// Unix timestamp when authorization becomes valid
    pub valid_after: String,
    /// Unix timestamp when authorization expires
    pub valid_before: String,
    /// 32-byte random nonce to prevent replay attacks
    pub nonce: String,
}

/// The request of verify and settle payment by scheme
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyRequest {
    /// The payload information
    pub payment_payload: PaymentPayload,
    /// The payment requirement
    pub payment_requirements: PaymentRequirements,
}

/// The response of verify payment
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResponse {
    /// Whether the payment verify was successful
    pub is_valid: bool,
    /// Address of the payer's wallet
    pub payer: String,
    /// Error reason if verify failed (omitted if successful)
    pub invalid_reason: Option<String>,
}

impl VerifyResponse {
    /// convert verify response to settle
    pub fn to_settle(self, network: &str, tx: &str) -> SettlementResponse {
        SettlementResponse {
            success: self.is_valid,
            error_reason: self.invalid_reason,
            transaction: tx.to_owned(),
            network: network.to_owned(),
            payer: self.payer,
            feedback_auth: None,
        }
    }
}

/// After payment settlement, the server includes transaction details in the payment response field as JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementResponse {
    /// Indicates whether the payment settlement was successful
    pub success: bool,
    /// Error reason if settlement failed (omitted if successful)
    pub error_reason: Option<String>,
    /// Blockchain transaction hash (empty string if settlement failed)
    pub transaction: String,
    /// Blockchain network identifier
    pub network: String,
    /// Address of the payer's wallet
    pub payer: String,
    /// The feedback authorized signature for 8004 Reputation
    pub feedback_auth: Option<FeedbackAuth>,
}

/// List supported payment schemes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedResponse {
    /// The items of the schemes
    pub kinds: Vec<SupportedScheme>,
}

/// The supported scheme
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportedScheme {
    /// Protocol version supported by the resource
    pub x402_version: i32,
    /// Payment scheme identifier (e.g., "exact")
    pub scheme: String,
    /// Blockchain network identifier (e.g., "base-sepolia", "ethereum-mainnet")
    pub network: String,
}

/// List discoverable x402 resources from the Bazaar.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryRequest {
    /// Filter by resource type (e.g., "http"), default is none
    #[serde(rename = "type")]
    pub r#type: Option<String>,
    /// Maximum number of results to return (1-100), default is 20
    pub limit: Option<i32>,
    /// Number of results to skip for pagination, default is 0
    pub offset: Option<i32>,
}

/// The response of discoverable resources
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResponse {
    /// Protocol version supported by the resource
    pub x402_version: i32,
    /// The list of supported resources item
    pub items: Vec<DiscoveryItem>,
    /// Pagination
    pub pagination: Pagination,
}

/// Discoverable resources item
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryItem {
    /// The resource URL or identifier being monetized
    pub resource: String,
    /// Resource type (currently "http" for HTTP endpoints)
    #[serde(rename = "type")]
    pub r#type: String,
    /// Protocol version supported by the resource
    pub x402_version: i32,
    /// Array of PaymentRequirements objects specifying payment methods
    pub accepts: Vec<PaymentRequirements>,
    /// Unix timestamp of when the resource was last updated
    pub last_updated: i64,
    /// Additional metadata (category, provider, etc.)
    pub metadata: Option<Value>,
}

/// Pagination for discovery
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pagination {
    /// The number of items in a response
    pub limit: i32,
    /// The start point of this query
    pub offset: i32,
    /// The total number of all items
    pub total: i32,
}

/// The error
pub enum Error {
    /// Client does not have enough tokens to complete the payment
    InsufficientFunds,
    /// Payment authorization is not yet valid (before validAfter timestamp)
    InvalidExactEvmPayloadAuthorizationValidAfter,
    /// Payment authorization has expired (after validBefore timestamp)
    InvalidExactEvmPayloadAuthorizationValidBefore,
    /// Payment amount is insufficient for the required payment
    InvalidExactEvmPayloadAuthorizationValue,
    /// Payment authorization signature is invalid or improperly signed
    InvalidExactEvmPayloadSignature,
    /// Recipient address does not match payment requirements
    InvalidExactEvmPayloadRecipientMismatch,
    /// Specified blockchain network is not supported
    InvalidNetwork,
    /// Payment payload is malformed or contains invalid data
    InvalidPayload,
    /// Payment requirements object is invalid or malformed
    InvalidPaymentRequirements,
    /// Specified payment scheme is not supported
    InvalidScheme,
    /// Payment scheme is not supported by the facilitator
    UnsupportedScheme,
    /// Protocol version is not supported
    InvalidX402Version,
    /// Blockchain transaction failed or was rejected
    InvalidTransactionState,
    /// Unexpected error occurred during payment verification
    UnexpectedVerifyError,
    /// Unexpected error occurred during payment settlement
    UnexpectedSettleError,
}

impl Error {
    pub fn to_code(&self) -> (&'static str, &'static str) {
        match self {
            Error::InsufficientFunds => (
                "insufficient_funds",
                "Client does not have enough tokens to complete the payment",
            ),
            Error::InvalidExactEvmPayloadAuthorizationValidAfter => (
                "invalid_exact_evm_payload_authorization_valid_after",
                "Payment authorization is not yet valid (before validAfter timestamp)",
            ),
            Error::InvalidExactEvmPayloadAuthorizationValidBefore => (
                "invalid_exact_evm_payload_authorization_valid_before",
                "Payment authorization has expired (after validBefore timestamp)",
            ),
            Error::InvalidExactEvmPayloadAuthorizationValue => (
                "invalid_exact_evm_payload_authorization_value",
                "Payment amount is insufficient for the required payment",
            ),
            Error::InvalidExactEvmPayloadSignature => (
                "invalid_exact_evm_payload_signature",
                "Payment authorization signature is invalid or improperly signed",
            ),
            Error::InvalidExactEvmPayloadRecipientMismatch => (
                "invalid_exact_evm_payload_recipient_mismatch",
                "Recipient address does not match payment requirements",
            ),
            Error::InvalidNetwork => (
                "invalid_network",
                "Specified blockchain network is not supported",
            ),
            Error::InvalidPayload => (
                "invalid_payload",
                "Payment payload is malformed or contains invalid data",
            ),
            Error::InvalidPaymentRequirements => (
                "invalid_payment_requirements",
                "Payment requirements object is invalid or malformed",
            ),
            Error::InvalidScheme => (
                "invalid_scheme",
                "Specified payment scheme is not supported",
            ),
            Error::UnsupportedScheme => (
                "unsupported_scheme",
                "Payment scheme is not supported by the facilitator",
            ),
            Error::InvalidX402Version => {
                ("invalid_x402_version", "Protocol version is not supported")
            }
            Error::InvalidTransactionState => (
                "invalid_transaction_state",
                "Blockchain transaction failed or was rejected",
            ),
            Error::UnexpectedVerifyError => (
                "unexpected_verify_error",
                "Unexpected error occurred during payment verification",
            ),
            Error::UnexpectedSettleError => (
                "unexpected_settle_error",
                "Unexpected error occurred during payment settlement",
            ),
        }
    }

    /// Helper build a verify error
    pub fn verify(&self, req: &PaymentPayload) -> VerifyResponse {
        VerifyResponse {
            is_valid: false,
            payer: req.payload.authorization.from.clone(),
            invalid_reason: Some(self.to_code().0.to_owned()),
        }
    }

    /// Helper build a settle error
    pub fn settle(&self, req: &PaymentPayload) -> SettlementResponse {
        SettlementResponse {
            success: false,
            error_reason: Some(self.to_code().0.to_owned()),
            transaction: "".to_owned(),
            network: req.network.clone(),
            payer: req.payload.authorization.from.clone(),
            feedback_auth: None,
        }
    }
}

/// Main Payee type, support evm-based and solana-based
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payee {
    /// evm-based account
    pub evm: Option<String>,
    /// solana-based account
    pub sol: Option<String>,
}

/// The payment scheme interface
#[async_trait]
pub trait PaymentScheme: Send + Sync {
    /// Get the scheme identifier, now we use scheme + network
    fn identity(&self) -> String {
        format!("{}-{}", self.scheme(), self.network())
    }

    /// The scheme of this payment scheme
    fn scheme(&self) -> &str;

    /// The network of this payment scheme
    fn network(&self) -> &str;

    /// Create a payment for the client
    fn create(&self, price: &str, payee: Payee) -> Vec<PaymentRequirements>;

    /// The facilitator performs the following verification steps:
    /// 1. Signature Validation: Verify the EIP-712 signature is valid and properly signed by the payer
    /// 2. Balance Verification: Confirm the payer has sufficient token balance for the transfer
    /// 3. Amount Validation: Ensure the payment amount meets or exceeds the required amount
    /// 4. Time Window Check: Verify the authorization is within its valid time range
    /// 5. Parameter Matching: Confirm authorization parameters match the original payment requirements
    /// 6. Transaction Simulation: Simulate the transferWithAuthorization transaction to ensure it would succeed
    async fn verify(&self, req: &VerifyRequest) -> VerifyResponse;

    /// Settlement is performed by calling the transferWithAuthorization
    /// function on the ERC-20 contract with the signature and authorization
    /// parameters provided in the payment payload.
    async fn settle(&self, req: &VerifyRequest) -> SettlementResponse;
}
