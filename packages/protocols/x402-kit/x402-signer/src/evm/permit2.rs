use alloy_core::sol_types::{SolStruct, eip712_domain};
use alloy_primitives::{Address, U256};

use x402_core::types::AmountValue;
use x402_networks::evm::EvmAddress;

use super::constants::{PERMIT2_ADDRESS, X402_EXACT_PERMIT2_PROXY};
use super::types::{Permit2Authorization, Permit2Payload, Permit2Witness};
use super::wallet::EvmWalletSigner;

mod sol_types {
    use alloy_core::sol;

    sol! {
        struct PermitWitnessTransferFrom {
            TokenPermissions permitted;
            address spender;
            uint256 nonce;
            uint256 deadline;
            Witness witness;
        }

        struct TokenPermissions {
            address token;
            uint256 amount;
        }

        struct Witness {
            address to;
            uint256 validAfter;
        }
    }
}

/// Parameters for Permit2 signing.
pub struct Permit2Params {
    pub from: EvmAddress,
    pub pay_to: EvmAddress,
    pub amount: u128,
    pub max_timeout_seconds: u64,
    pub chain_id: u64,
    pub asset_address: Address,
}

/// Sign a Permit2 PermitWitnessTransferFrom authorization.
pub async fn sign_permit2<S: EvmWalletSigner>(
    signer: &S,
    params: Permit2Params,
) -> Result<Permit2Payload, S::Error> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock before UNIX epoch")
        .as_secs();

    let valid_after = now.saturating_sub(600);
    let deadline = now + params.max_timeout_seconds;
    let nonce: U256 = U256::from_be_bytes(rand::random::<[u8; 32]>());

    let sol_msg = sol_types::PermitWitnessTransferFrom {
        permitted: sol_types::TokenPermissions {
            token: params.asset_address,
            amount: U256::from(params.amount),
        },
        spender: X402_EXACT_PERMIT2_PROXY,
        nonce,
        deadline: U256::from(deadline),
        witness: sol_types::Witness {
            to: params.pay_to.0,
            validAfter: U256::from(valid_after),
        },
    };

    let domain = eip712_domain!(
        name: "Permit2",
        chain_id: params.chain_id,
        verifying_contract: PERMIT2_ADDRESS,
    );

    let hash = sol_msg.eip712_signing_hash(&domain);
    let signature = signer.sign_hash(&hash).await?;

    let authorization = Permit2Authorization {
        from: params.from,
        permitted: super::types::TokenPermissions {
            token: EvmAddress(params.asset_address),
            amount: AmountValue(params.amount),
        },
        spender: EvmAddress(X402_EXACT_PERMIT2_PROXY),
        nonce: nonce.to_string(),
        deadline: deadline.to_string(),
        witness: Permit2Witness {
            to: params.pay_to,
            valid_after: valid_after.to_string(),
        },
    };

    Ok(Permit2Payload {
        signature,
        permit2_authorization: authorization,
    })
}
