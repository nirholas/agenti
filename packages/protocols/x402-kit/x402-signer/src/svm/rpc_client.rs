use solana_account::Account;
use solana_rpc_client_api::client_error::Error as ClientError;

use x402_networks::svm::SvmAddress;

use super::{
    constants::{TOKEN_2022_PROGRAM, TOKEN_PROGRAM},
    rpc::SvmRpc,
    types::MintInfo,
};

/// Errors from the Solana RPC-backed [`SvmRpc`] implementation.
#[derive(Debug, thiserror::Error)]
pub enum SolanaRpcError {
    #[error("RPC client error: {0}")]
    Client(#[from] ClientError),

    #[error("mint account data too short (expected >= 45 bytes, got {0})")]
    InvalidMintData(usize),

    #[error("mint account owner {0} is not a known SPL Token program")]
    UnknownTokenProgram(String),
}

/// Minimum byte length of an SPL Token Mint account (Mint layout).
const MIN_MINT_DATA_LEN: usize = 82;
/// Byte offset of the `decimals` field inside the SPL Token Mint layout.
const DECIMALS_OFFSET: usize = 44;

impl SvmRpc for solana_rpc_client::nonblocking::rpc_client::RpcClient {
    type Error = SolanaRpcError;

    async fn get_latest_blockhash(&self) -> Result<solana_hash::Hash, Self::Error> {
        Ok(self.get_latest_blockhash().await?)
    }

    async fn fetch_mint_info(&self, mint: SvmAddress) -> Result<MintInfo, Self::Error> {
        let account: Account = self.get_account(&mint.0).await?;

        let program_address = if account.owner == TOKEN_PROGRAM {
            SvmAddress(TOKEN_PROGRAM)
        } else if account.owner == TOKEN_2022_PROGRAM {
            SvmAddress(TOKEN_2022_PROGRAM)
        } else {
            return Err(SolanaRpcError::UnknownTokenProgram(
                account.owner.to_string(),
            ));
        };

        if account.data.len() < MIN_MINT_DATA_LEN {
            return Err(SolanaRpcError::InvalidMintData(account.data.len()));
        }

        let decimals = account.data[DECIMALS_OFFSET];

        Ok(MintInfo {
            program_address,
            decimals,
        })
    }
}

#[cfg(feature = "swig")]
impl crate::swig::SwigRpc for solana_rpc_client::nonblocking::rpc_client::RpcClient {
    async fn send_and_confirm_transaction(
        &self,
        transaction: &solana_transaction::Transaction,
    ) -> Result<solana_signature::Signature, Self::Error> {
        Ok(self.send_and_confirm_transaction(transaction).await?)
    }
}
