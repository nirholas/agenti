use crate::{
    Authorization, Error, Payee, PaymentRequirements, PaymentScheme, SCHEME, SettlementResponse,
    VerifyRequest, VerifyResponse,
};
use alloy::{
    primitives::{Address, B256, Bytes, U256},
    providers::{Provider, ProviderBuilder},
    signers::{Signature, SignerSync, local::PrivateKeySigner},
    sol,
    sol_types::{SolStruct, eip712_domain},
    transports::http::reqwest::Url,
};
use anyhow::Result;
use async_trait::async_trait;
use eip8004::{FeedbackAuth, FeedbackOnchainAuth};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::str::FromStr;

// Re-export Eip712Domain for use in client module
pub use alloy::sol_types::Eip712Domain;

sol!(
    #[allow(missing_docs)]
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    Eip3009Token,
    "EIP3009.json"
);

// EIP-3009 TransferWithAuthorization struct for EIP-712 signing
sol! {
    #[derive(Debug)]
    struct TransferWithAuthorization {
        address from;
        address to;
        uint256 value;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
    }
}

impl TransferWithAuthorization {
    pub fn from(auth: &Authorization) -> Result<TransferWithAuthorization> {
        let from: Address = auth.from.parse()?;
        let to: Address = auth.to.parse()?;
        let value: U256 = auth.value.parse()?;
        let valid_after: U256 = auth.valid_after.parse()?;
        let valid_before: U256 = auth.valid_before.parse()?;
        let nonce: B256 = auth.nonce.parse()?;

        Ok(TransferWithAuthorization {
            from,
            to,
            value,
            validAfter: valid_after,
            validBefore: valid_before,
            nonce,
        })
    }
}

/// EIP-3009 based assets/tokens
pub struct EvmAsset {
    name: String,
    version: String,
    decimal: u8,
    domain: Eip712Domain,
    extra: Value,
}

/// EIP-8004 agent registry infomation
#[derive(Clone, Debug)]
pub struct Evm8004Registry {
    pub agent_id: i64,
    pub identity: String,
}

struct InnerEvm8004Registry {
    pub agent_id: U256,
    pub identity_registry: Address,
}

/// Evm-based scheme
pub struct EvmScheme {
    chain_id: u64,
    scheme: String,
    network: String,
    rpc: Url,
    signer: PrivateKeySigner,
    assets: HashMap<Address, EvmAsset>,
    agent: Option<InnerEvm8004Registry>,
}

impl EvmScheme {
    /// Build the evm scheme with EIP-8004 agent
    pub async fn new(
        url: &str,
        network: &str,
        signer: &str,
        agent: Option<Evm8004Registry>,
    ) -> Result<Self> {
        let rpc: Url = url.parse()?;
        let signer = signer.parse()?;

        let provider = ProviderBuilder::new().connect_http(rpc.clone());
        let chain_id = provider.get_chain_id().await?;

        let agent = if let Some(agent) = agent {
            let identity_registry: Address = agent.identity.parse()?;
            Some(InnerEvm8004Registry {
                agent_id: U256::from(agent.agent_id),
                identity_registry,
            })
        } else {
            None
        };

        Ok(Self {
            chain_id,
            rpc,
            signer,
            agent,
            scheme: SCHEME.to_owned(),
            network: network.to_owned(),
            assets: HashMap::new(),
        })
    }

    /// Add a new EIP-3009 token asset to the scheme
    ///
    /// # Arguments
    /// * `addr` - The token contract address
    ///
    /// # Returns
    /// * `Ok(())` if the token is valid and supports EIP-3009
    /// * `Err` if the token is invalid or doesn't support EIP-3009
    ///
    /// # Note
    /// This function automatically reads the token name and version from the contract
    /// to ensure they match the contract's DOMAIN_SEPARATOR for EIP-712 signing
    pub async fn asset(&mut self, addr: &str) -> Result<()> {
        let token_address: Address = addr.parse()?;

        // Create provider and contract instance
        let provider = ProviderBuilder::new().connect_http(self.rpc.clone());

        // Verify the contract has the required EIP-3009 functions by calling view functions
        let contract = Eip3009Token::new(token_address, &provider);
        let decimal = contract.decimals().call().await?;

        // Verify EIP-3009 support by checking if authorizationState exists
        // We test with a random address and nonce - if the function doesn't exist, it will fail
        contract
            .authorizationState(Address::ZERO, B256::ZERO)
            .call()
            .await?;

        // Read the contract's actual name, version, and DOMAIN_SEPARATOR
        let name = contract.name().call().await?;
        let version = contract.version().call().await?;
        let contract_domain_separator = contract.DOMAIN_SEPARATOR().call().await?;

        // Create EIP-712 domain with contract's actual name/version
        let domain =
            create_eip712_domain(name.clone(), version.clone(), self.chain_id, token_address);
        let computed_domain_separator = domain.hash_struct();

        // Verify the computed domain matches the contract's DOMAIN_SEPARATOR
        if computed_domain_separator != contract_domain_separator {
            return Err(anyhow::anyhow!(
                "Domain separator mismatch! Contract DOMAIN_SEPARATOR doesn't match computed value. \
                 Contract name: '{}', version: '{}', chain ID: {}",
                name,
                version,
                self.chain_id
            ));
        }

        // Create and store the asset with contract's actual parameters
        let extra = json!({
            "name": name,
            "version": version,
            "chainId": self.chain_id,
        });
        let asset = EvmAsset {
            name: name.to_owned(),
            version: version.to_owned(),
            decimal,
            domain,
            extra,
        };

        self.assets.insert(token_address, asset);

        Ok(())
    }

    async fn handle_verify(&self, req: &VerifyRequest) -> Result<(), Error> {
        // 1. signature validation
        let token: Address = req
            .payment_requirements
            .asset
            .parse()
            .map_err(|_| Error::InvalidPaymentRequirements)?;
        let sign: Signature = req
            .payment_payload
            .payload
            .signature
            .parse()
            .map_err(|_| Error::InvalidExactEvmPayloadSignature)?;

        let asset = self
            .assets
            .get(&token)
            .ok_or(Error::InvalidPaymentRequirements)?;

        let auth = &req.payment_payload.payload.authorization;

        // Verify the signature
        if verify_authorization(&asset.domain, auth, &sign).is_err() {
            return Err(Error::InvalidExactEvmPayloadSignature);
        }

        // 2. balance verification
        let from: Address = auth.from.parse().map_err(|_| Error::InvalidPayload)?;

        // Create contract instance for balance check
        let provider = ProviderBuilder::new().connect_http(self.rpc.clone());
        let contract = Eip3009Token::new(token, provider);

        let balance = contract
            .balanceOf(from)
            .call()
            .await
            .map_err(|_| Error::UnexpectedVerifyError)?;

        // 3. amount validation
        let value: U256 = auth.value.parse().map_err(|_| Error::InvalidPayload)?;
        let required_amount: U256 = req
            .payment_requirements
            .max_amount_required
            .parse()
            .map_err(|_| Error::InvalidPaymentRequirements)?;

        if balance < value {
            return Err(Error::InsufficientFunds);
        }

        if value < required_amount {
            return Err(Error::InvalidExactEvmPayloadAuthorizationValue);
        }

        // 4. time window check
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| Error::UnexpectedVerifyError)?
            .as_secs();

        let valid_after: u64 = auth
            .valid_after
            .parse()
            .map_err(|_| Error::InvalidPayload)?;
        let valid_before: u64 = auth
            .valid_before
            .parse()
            .map_err(|_| Error::InvalidPayload)?;

        if now < valid_after {
            return Err(Error::InvalidExactEvmPayloadAuthorizationValidAfter);
        }

        if now > valid_before {
            return Err(Error::InvalidExactEvmPayloadAuthorizationValidBefore);
        }

        // 5. parameter matching
        let to: Address = auth.to.parse().map_err(|_| Error::InvalidPayload)?;
        let expected_to: Address = req
            .payment_requirements
            .pay_to
            .parse()
            .map_err(|_| Error::InvalidPaymentRequirements)?;

        if to != expected_to {
            return Err(Error::InvalidExactEvmPayloadRecipientMismatch);
        }

        // 6. check authorization state (nonce not used)
        let nonce: B256 = auth.nonce.parse().map_err(|_| Error::InvalidPayload)?;

        let is_used = contract
            .authorizationState(from, nonce)
            .call()
            .await
            .map_err(|_| Error::UnexpectedVerifyError)?;

        if is_used {
            return Err(Error::InvalidExactEvmPayloadSignature);
        }

        Ok(())
    }

    async fn handle_settle(
        &self,
        req: &VerifyRequest,
    ) -> Result<(String, Option<FeedbackAuth>), Error> {
        // Get the token address and parse authorization
        let token: Address = req
            .payment_requirements
            .asset
            .parse()
            .map_err(|_| Error::InvalidPaymentRequirements)?;

        // Verify the token is registered
        if !self.assets.contains_key(&token) {
            return Err(Error::InvalidPaymentRequirements);
        }

        let auth = &req.payment_payload.payload.authorization;
        let signature: Signature = req
            .payment_payload
            .payload
            .signature
            .parse()
            .map_err(|_| Error::InvalidExactEvmPayloadSignature)?;

        // Parse all the authorization parameters
        let from: Address = auth.from.parse().map_err(|_| Error::InvalidPayload)?;
        let to: Address = auth.to.parse().map_err(|_| Error::InvalidPayload)?;
        let value: U256 = auth.value.parse().map_err(|_| Error::InvalidPayload)?;
        let valid_after: U256 = auth
            .valid_after
            .parse()
            .map_err(|_| Error::InvalidPayload)?;
        let valid_before: U256 = auth
            .valid_before
            .parse()
            .map_err(|_| Error::InvalidPayload)?;
        let nonce: B256 = auth.nonce.parse().map_err(|_| Error::InvalidPayload)?;

        // Get the signature components (v, r, s)
        let v = if signature.v() { 28u8 } else { 27u8 }; // Convert y_parity to legacy v
        let r: B256 = signature.r().into();
        let s: B256 = signature.s().into();

        // Create contract instance for settlement
        let provider = ProviderBuilder::new()
            .wallet(self.signer.clone())
            .connect_http(self.rpc.clone());
        let contract = Eip3009Token::new(token, provider);

        // Call transferWithAuthorization (using _0 suffix for overloaded function)
        let call = contract.transferWithAuthorization_0(
            from,
            to,
            value,
            valid_after,
            valid_before,
            nonce,
            v,
            r,
            s,
        );

        // Send the transaction
        let pending_tx = call
            .send()
            .await
            .map_err(|_| Error::InvalidTransactionState)?;

        // Wait for the transaction to be confirmed
        let receipt = pending_tx
            .get_receipt()
            .await
            .map_err(|_| Error::InvalidTransactionState)?;

        let feedback_auth = match (&self.agent, req.payment_payload.payload.feedback_index) {
            (Some(agent), Some(index)) => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_err(|_| Error::UnexpectedVerifyError)?
                    .as_secs();
                let expiry = now + 86400; // default is 1 Day

                let mut feedback = FeedbackOnchainAuth {
                    agentId: agent.agent_id,
                    identityRegistry: agent.identity_registry,
                    clientAddress: from,
                    indexLimit: index,
                    expiry: U256::from(expiry),
                    chainId: U256::from(self.chain_id),
                    signerAddress: self.signer.address(),
                    signature: Bytes::default(),
                };
                let _ = feedback.sign(&self.signer).await;

                Some(feedback.to_feedback_auth())
            }
            _ => None,
        };

        // Return the transaction hash
        Ok((format!("{:?}", receipt.transaction_hash), feedback_auth))
    }
}

#[async_trait]
impl PaymentScheme for EvmScheme {
    /// The scheme of this payment scheme
    fn scheme(&self) -> &str {
        &self.scheme
    }

    /// The network of this payment scheme
    fn network(&self) -> &str {
        &self.network
    }

    /// Create payment requirements for all registered assets
    ///
    /// Generates a PaymentRequirements object for each registered EIP-3009 token,
    /// calculating the required amount based on the price and token decimals.
    ///
    /// # Arguments
    /// * `price` - The price in USD (or base currency)
    /// * `payee` - The recipient information containing the EVM address
    ///
    /// # Returns
    /// A vector of PaymentRequirements, one for each registered token
    fn create(&self, price: &str, payee: Payee) -> Vec<PaymentRequirements> {
        let mut requirements = Vec::new();

        // Get the payee address from the Payee struct
        let pay_to = match payee.evm {
            Some(addr) => addr,
            None => return requirements, // No EVM address provided, return empty
        };

        // Generate a PaymentRequirements for each registered asset
        for (token_address, asset) in &self.assets {
            // Calculate the amount in atomic units based on decimals
            let amount = price_to_u256(price, asset.decimal);

            let requirement = PaymentRequirements {
                scheme: self.scheme.clone(),
                network: self.network.clone(),
                max_amount_required: amount.to_string(),
                asset: token_address.to_checksum(None),
                pay_to: pay_to.clone(),
                resource: String::new(), // Will be filled by the server/facilitator
                description: format!(
                    "Payment of {} using {}, version: {}",
                    price, asset.name, asset.version
                ),
                mime_type: None,
                output_schema: None,
                max_timeout_seconds: 300, // 5 minutes default timeout
                extra: Some(asset.extra.clone()),
            };

            requirements.push(requirement);
        }

        requirements
    }

    /// The facilitator performs the following verification steps:
    /// 1. Signature Validation: Verify the EIP-712 signature is valid and properly signed by the payer
    /// 2. Balance Verification: Confirm the payer has sufficient token balance for the transfer
    /// 3. Amount Validation: Ensure the payment amount meets or exceeds the required amount
    /// 4. Time Window Check: Verify the authorization is within its valid time range
    /// 5. Parameter Matching: Confirm authorization parameters match the original payment requirements
    /// 6. Transaction Simulation: Simulate the transferWithAuthorization transaction to ensure it would succeed
    async fn verify(&self, req: &VerifyRequest) -> VerifyResponse {
        match self.handle_verify(req).await {
            Ok(_) => VerifyResponse {
                is_valid: true,
                payer: req.payment_payload.payload.authorization.from.clone(),
                invalid_reason: None,
            },
            Err(error) => error.verify(&req.payment_payload),
        }
    }

    /// Settlement is performed by calling the transferWithAuthorization
    /// function on the ERC-20 contract with the signature and authorization
    /// parameters provided in the payment payload.
    async fn settle(&self, req: &VerifyRequest) -> SettlementResponse {
        match self.handle_settle(req).await {
            Ok((tx_hash, feedback_auth)) => SettlementResponse {
                success: true,
                error_reason: None,
                transaction: tx_hash,
                network: req.payment_payload.network.clone(),
                payer: req.payment_payload.payload.authorization.from.clone(),
                feedback_auth,
            },
            Err(error) => error.settle(&req.payment_payload),
        }
    }
}

/// Use standard EIP712 signature defined in:  https://eips.ethereum.org/EIPS/eip-3009
/// const data = {
///     types: {
///         EIP712Domain: [
///             { name: "name", type: "string" },
///             { name: "version", type: "string" },
///             { name: "chainId", type: "uint256" },
///             { name: "verifyingContract", type: "address" },
///         ],
///         TransferWithAuthorization: [
///            { name: "from", type: "address" },
///             { name: "to", type: "address" },
///             { name: "value", type: "uint256" },
///             { name: "validAfter", type: "uint256" },
///             { name: "validBefore", type: "uint256" },
///             { name: "nonce", type: "bytes32" },
///         ],
///     },
///     domain: {
///         name: tokenName,
///         version: tokenVersion,
///         chainId: selectedChainId,
///         verifyingContract: tokenAddress,
///     },
///     primaryType: "TransferWithAuthorization",
///     message: {
///         from: userAddress,
///         to: recipientAddress,
///         value: amountBN.toString(10),
///         validAfter: 0,
///         validBefore: Math.floor(Date.now() / 1000) + 3600, // Valid for an hour
///         nonce: Web3.utils.randomHex(32),
///     },
/// };
/// Helper function to create EIP712 domain for a token contract
///
/// # Arguments
/// * `token_name` - The name of the token (e.g., "USDC")
/// * `token_version` - The version of the token contract (e.g., "2")
/// * `chain_id` - The chain ID (e.g., 1 for Ethereum mainnet)
/// * `verifying_contract` - The address of the token contract
pub fn create_eip712_domain(
    token_name: String,
    token_version: String,
    chain_id: u64,
    verifying_contract: Address,
) -> Eip712Domain {
    eip712_domain! {
        name: token_name,
        version: token_version,
        chain_id: chain_id,
        verifying_contract: verifying_contract,
    }
}

/// Sign a TransferWithAuthorization message using EIP-712
///
/// # Arguments
/// * `domain` - The EIP712 domain
/// * `transfer` - The TransferWithAuthorization message
/// * `signer` - The private key signer
///
/// # Returns
/// The signature bytes (r, s, v)
pub fn sign_authorization(
    domain: &Eip712Domain,
    auth: &Authorization,
    signer: &PrivateKeySigner,
) -> Result<Signature> {
    let transfer = TransferWithAuthorization::from(auth)?;
    let signing_hash = transfer.eip712_signing_hash(domain);
    let signature = signer.sign_hash_sync(&signing_hash)?;
    Ok(signature)
}

/// Verify an EIP-712 signature for TransferWithAuthorization
///
/// # Arguments
/// * `domain` - The EIP712 domain
/// * `transfer` - The TransferWithAuthorization message
/// * `signature` - The signature to verify
///
/// # Returns
/// True if the signature is valid and from the expected signer
pub fn verify_authorization(
    domain: &Eip712Domain,
    auth: &Authorization,
    signature: &Signature,
) -> Result<()> {
    let signer: Address = auth.from.parse()?;
    let transfer = TransferWithAuthorization::from(auth)?;
    let signing_hash = transfer.eip712_signing_hash(domain);
    let recover = signature.recover_address_from_prehash(&signing_hash)?;

    if recover == signer {
        Ok(())
    } else {
        Err(anyhow::anyhow!("Invalid recover and signer"))
    }
}

/// Convert a decimal price string to U256 with the specified number of decimals
///
/// # Arguments
/// * `s` - The price as a string (e.g., "1.23", "0.5", "100")
/// * `decimal` - The number of decimal places for the token (e.g., 6 for USDC, 18 for ETH)
///
/// # Examples
/// - price_to_u256("1.0", 18) = 1 * 10^18 = 1000000000000000000
/// - price_to_u256("1.5", 6) = 1.5 * 10^6 = 1500000
/// - price_to_u256("0.123456", 6) = 0.123456 * 10^6 = 123456
/// - price_to_u256("1.23", 18) = 1.23 * 10^18 = 1230000000000000000
fn price_to_u256(s: &str, decimal: u8) -> U256 {
    let parts: Vec<&str> = s.split('.').collect();

    // Parse the integer part
    let int_part = U256::from_str(parts[0]).unwrap_or(U256::ZERO);

    // Parse the fractional part if it exists
    let frac_value = if let Some(frac_str) = parts.get(1) {
        let frac_len = frac_str.len();

        // Determine how many digits to use from the fractional part
        // If frac_str has more digits than decimal, truncate
        // If frac_str has fewer digits, we'll scale appropriately
        let digits_to_use = frac_len.min(decimal as usize);
        let frac_digits = &frac_str[..digits_to_use];

        // Parse the fractional digits as an integer
        let frac_int = U256::from_str(frac_digits).unwrap_or(U256::ZERO);

        // Scale the fractional part correctly
        // If frac has fewer digits than decimal, we need to multiply by 10^(decimal - frac_len)
        // For example: "1.5" with decimal=18
        //   frac_digits = "5", frac_len = 1
        //   frac_int = 5
        //   We need 5 * 10^(18-1) = 5 * 10^17
        if (digits_to_use as u8) < decimal {
            frac_int * U256::from(10).pow(U256::from(decimal - digits_to_use as u8))
        } else {
            // If we used all decimal places, no additional scaling needed
            frac_int
        }
    } else {
        U256::ZERO
    };

    // Combine: int_part * 10^decimal + frac_value
    int_part * U256::from(10).pow(U256::from(decimal)) + frac_value
}
