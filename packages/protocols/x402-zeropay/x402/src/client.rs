use crate::{
    Authorization, PaymentPayload, PaymentRequirements, SCHEME, SchemePayload, X402_VERSION,
    scheme::evm::{Eip712Domain, create_eip712_domain, sign_authorization},
};
use alloy::{
    primitives::{Address, keccak256},
    providers::{Provider, ProviderBuilder},
    signers::local::PrivateKeySigner,
    transports::http::reqwest::Url,
};
use anyhow::Result;
use std::collections::HashMap;

/// Payment method, support evm and sol
pub enum PaymentMethod {
    /// rpc endpoint, wallet, token addresses (address, name, version)
    Evm(PrivateKeySigner, Url, Vec<(Address, String, String)>),
}

/// Inner evm payment information
struct EvmPaymentInfo {
    signer: PrivateKeySigner,
    _rpc: Url,
    domains: HashMap<Address, Eip712Domain>,
}

/// Inner payment information, support evm and sol
enum PaymentInfo {
    Evm(EvmPaymentInfo),
}

/// Main client facilitator used to sign and build payment payload
pub struct ClientFacilitator {
    infos: HashMap<String, PaymentInfo>,
}

impl Default for ClientFacilitator {
    fn default() -> Self {
        Self::new()
    }
}

impl ClientFacilitator {
    /// Create new facilitator
    pub fn new() -> Self {
        Self {
            infos: HashMap::new(),
        }
    }

    /// Register new payment scheme to it
    ///
    /// # Arguments
    /// * `scheme` - Payment scheme (e.g., "exact")
    /// * `network` - Network name (e.g., "base-sepolia")
    /// * `method` - Payment method containing signer and token info
    pub async fn register(
        &mut self,
        scheme: &str,
        network: &str,
        method: PaymentMethod,
    ) -> Result<()> {
        let identity = format!("{}-{}", scheme, network);

        // Build PaymentInfo with cached domains from PaymentMethod
        let info = match method {
            PaymentMethod::Evm(signer, rpc, tokens) => {
                // Get chain ID from network
                let provider = ProviderBuilder::new().connect_http(rpc.clone());
                let chain_id = provider.get_chain_id().await?;

                // Build domain cache for all tokens
                let mut domains = HashMap::new();
                for (token_address, name, version) in tokens {
                    let domain = create_eip712_domain(
                        name.clone(),
                        version.clone(),
                        chain_id,
                        token_address,
                    );
                    domains.insert(token_address, domain);
                }

                PaymentInfo::Evm(EvmPaymentInfo {
                    signer,
                    _rpc: rpc,
                    domains,
                })
            }
        };

        self.infos.insert(identity, info);
        Ok(())
    }

    /// Build the payment payload by first matched paymentRequirements
    pub fn build<'a>(
        &self,
        prs: &'a [PaymentRequirements],
        feedback_index: Option<u64>,
    ) -> Result<(PaymentPayload, &'a PaymentRequirements)> {
        for pr in prs.iter() {
            let identity = format!("{}-{}", pr.scheme, pr.network);
            if self.infos.contains_key(&identity) {
                let payload = self.build_with_scheme(pr, feedback_index)?;
                return Ok((payload, pr));
            }
        }

        Err(anyhow::anyhow!("No matched scheme and network"))
    }

    /// Build the payment payload by a paymentRequirements
    pub fn build_with_scheme(
        &self,
        pr: &PaymentRequirements,
        feedback_index: Option<u64>,
    ) -> Result<PaymentPayload> {
        let identity = format!("{}-{}", pr.scheme, pr.network);

        if let Some(info) = self.infos.get(&identity) {
            let (signature, authorization) = match info {
                PaymentInfo::Evm(einfo) => Self::build_evm_authorization(pr, einfo)?,
            };

            Ok(PaymentPayload {
                x402_version: X402_VERSION,
                scheme: SCHEME.to_owned(),
                network: pr.network.clone(),
                payload: SchemePayload {
                    signature,
                    authorization,
                    feedback_index,
                },
            })
        } else {
            Err(anyhow::anyhow!(
                "No registered scheme and network: {}-{}",
                pr.scheme,
                pr.network
            ))
        }
    }

    /// Build EVM authorization with EIP-712 signature using cached domain
    ///
    /// # Arguments
    /// * `signer` - The private key signer
    /// * `pr` - Payment requirements
    /// * `domain` - Pre-built EIP-712 domain (cached)
    fn build_evm_authorization(
        pr: &PaymentRequirements,
        info: &EvmPaymentInfo,
    ) -> Result<(String, Authorization)> {
        let token: Address = pr.asset.parse()?;
        let from = info.signer.address().to_checksum(None);

        // Check if we have a cached domain for this token
        if let Some(domain) = info.domains.get(&token) {
            // Generate a nonce for replay protection
            // Use combination of timestamp and signer address for uniqueness
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            let nonce_data = format!("{}{}{}", from, now, pr.pay_to);
            let nonce = keccak256(nonce_data.as_bytes());

            // Set time validity
            // validAfter: current time (can make payment immediately)
            // validBefore: current time + timeout (from max_timeout_seconds)
            let valid_after = "0".to_owned(); // Can be used immediately
            let valid_before = (now + pr.max_timeout_seconds as u64).to_string();

            // Build the authorization
            let auth = Authorization {
                from,
                to: pr.pay_to.clone(),
                value: pr.max_amount_required.clone(),
                valid_after,
                valid_before,
                nonce: format!("{:?}", nonce),
            };

            // Sign the authorization with EIP-712 using the cached domain
            let sign = sign_authorization(domain, &auth, &info.signer)?;
            Ok((sign.to_string(), auth))
        } else {
            Err(anyhow::anyhow!("Token not registered: {}", token))
        }
    }
}
