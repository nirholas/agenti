use x402_networks::svm::SvmAddress;

/// Minimal mint metadata needed for building transactions.
pub struct MintInfo {
    /// The token program that owns this mint (SPL Token or Token-2022).
    pub program_address: SvmAddress,
    /// Number of decimals for the token.
    pub decimals: u8,
}
