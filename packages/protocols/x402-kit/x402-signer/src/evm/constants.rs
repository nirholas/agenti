use alloy_primitives::{Address, address};

/// Canonical Permit2 contract address (same on all EVM chains via CREATE2).
pub const PERMIT2_ADDRESS: Address = address!("0x000000000022D473030F116dDEE9F6B43aC78BA3");

/// x402 Exact Permit2 Proxy contract address.
pub const X402_EXACT_PERMIT2_PROXY: Address =
    address!("0x402085c248EeA27D92E8b30b2C58ed07f9E20001");

/// Parse EVM chain ID from CAIP-2 network string (e.g., "eip155:84532" → 84532).
pub fn parse_evm_chain_id(network: &str) -> Option<u64> {
    network.strip_prefix("eip155:").and_then(|s| s.parse().ok())
}
