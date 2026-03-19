use x402_networks::svm::SvmAddress;

use super::types::MintInfo;

/// Async RPC operations needed for SVM transaction building.
///
/// Users provide their own implementation backed by their preferred RPC client.
pub trait SvmRpc {
    type Error: std::error::Error + Send + Sync;

    /// Fetch the latest blockhash from the cluster.
    fn get_latest_blockhash(
        &self,
    ) -> impl Future<Output = Result<solana_hash::Hash, Self::Error>> + Send;

    /// Fetch mint metadata (program address and decimals) for a given token mint.
    fn fetch_mint_info(
        &self,
        mint: SvmAddress,
    ) -> impl Future<Output = Result<MintInfo, Self::Error>> + Send;
}
