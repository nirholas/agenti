use solana_pubkey::{Pubkey, pubkey};

/// SPL Token program address.
pub const TOKEN_PROGRAM: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/// SPL Token-2022 program address.
pub const TOKEN_2022_PROGRAM: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/// Compute Budget program address.
pub const COMPUTE_BUDGET_PROGRAM: Pubkey = pubkey!("ComputeBudget111111111111111111111111111111");

/// Memo program address.
pub const MEMO_PROGRAM: Pubkey = pubkey!("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/// Associated Token Account program address.
#[rustfmt::skip]
pub const ASSOCIATED_TOKEN_PROGRAM: Pubkey = pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/// Default compute unit price in microlamports.
pub const DEFAULT_COMPUTE_UNIT_PRICE: u64 = 1;

/// Default compute unit limit.
pub const DEFAULT_COMPUTE_UNIT_LIMIT: u32 = 20_000;
