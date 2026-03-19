use alloy::primitives::Address;
use anyhow::Result;
use tdn_did::{Language, generate_eth_account};

pub fn generate_eth(mid: i32, cid: i32, mnemonics: &str) -> Result<(String, String)> {
    let peer = generate_eth_account(Language::English, mnemonics, mid as u32, cid as u32, None)?;
    let sk = format!("0x{}", hex::encode(peer.to_db_bytes()));
    let address: Address = peer.peer_id().0.into();

    Ok((sk, address.to_checksum(None)))
}
