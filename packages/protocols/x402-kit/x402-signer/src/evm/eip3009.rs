use alloy_core::{
    sol,
    sol_types::{SolStruct, eip712_domain},
};
use alloy_primitives::{Address, FixedBytes, U256};

use x402_networks::evm::EvmAddress;
use x402_networks::evm::exact::{ExactEvmAuthorization, ExactEvmPayload, Nonce, TimestampSeconds};

use super::wallet::EvmWalletSigner;

sol! {
    struct TransferWithAuthorization {
        address from;
        address to;
        uint256 value;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
    }
}

impl From<&ExactEvmAuthorization> for TransferWithAuthorization {
    fn from(auth: &ExactEvmAuthorization) -> Self {
        TransferWithAuthorization {
            from: auth.from.0,
            to: auth.to.0,
            value: U256::from(auth.value.0),
            validAfter: U256::from(auth.valid_after.0),
            validBefore: U256::from(auth.valid_before.0),
            nonce: FixedBytes(auth.nonce.0),
        }
    }
}

/// Parameters for EIP-3009 signing.
pub struct Eip3009Params {
    pub from: EvmAddress,
    pub pay_to: EvmAddress,
    pub amount: u128,
    pub max_timeout_seconds: u64,
    pub chain_id: u64,
    pub asset_address: Address,
    pub eip712_name: String,
    pub eip712_version: String,
}

/// Sign an EIP-3009 TransferWithAuthorization.
pub async fn sign_eip3009<S: EvmWalletSigner>(
    signer: &S,
    params: Eip3009Params,
) -> Result<ExactEvmPayload, S::Error> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock before UNIX epoch")
        .as_secs();

    let authorization = ExactEvmAuthorization {
        from: params.from,
        to: params.pay_to,
        value: params.amount.into(),
        valid_after: TimestampSeconds(now.saturating_sub(600)),
        valid_before: TimestampSeconds(now + params.max_timeout_seconds),
        nonce: Nonce(rand::random()),
    };

    let domain = eip712_domain!(
        name: params.eip712_name,
        version: params.eip712_version,
        chain_id: params.chain_id,
        verifying_contract: params.asset_address,
    );

    let sol_auth = TransferWithAuthorization::from(&authorization);
    let hash = sol_auth.eip712_signing_hash(&domain);
    let signature = signer.sign_hash(&hash).await?;

    Ok(ExactEvmPayload {
        signature,
        authorization,
    })
}
