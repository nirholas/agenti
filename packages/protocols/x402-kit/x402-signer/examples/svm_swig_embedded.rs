//! SWIG embedded-wallet x402 payment example.
//!
//! This example demonstrates end-to-end SWIG embedded wallet x402 payments:
//!
//! 1. Load a "master" keypair (must hold enough SOL + USDC).
//! 2. Create a new SWIG account with the master as the Ed25519 owner.
//! 3. Transfer USDC from the master wallet into the SWIG embedded wallet ATA.
//! 4. Build a reqwest client with `SwigEmbeddedSigner` middleware.
//! 5. Make a POST request to an x402-protected resource — the middleware
//!    handles the 402 → sign → retry flow automatically.
//!
//! # Prerequisites
//!
//! - A Solana keypair with sufficient SOL (for rent + tx fees) and USDC.
//! - A running x402-protected server (e.g. the `axum_seller` example from
//!   `x402-kit`).
//!
//! # Usage
//!
//! ```sh
//! # Terminal 1: start the example paywall server
//! FACILITATOR_URL=https://facilitator.example.com \
//!   cargo run -p x402-kit --example axum_seller
//!
//! # Terminal 2: run this example
//! SOLANA_PRIVATE_KEY=<base58-64-byte-keypair> \
//! SOLANA_RPC_URL=https://api.devnet.solana.com \
//! RESOURCE_URL=http://localhost:3000/resource/multi_payments \
//!   cargo run -p x402-signer --features swig --example svm_swig_embedded
//! ```

use std::thread;
use std::time::Duration;

use reqwest_middleware::ClientBuilder;
use solana_client::rpc_client::RpcClient;
use solana_instruction::Instruction;
use solana_keypair::{Keypair, Signer};
use solana_pubkey::Pubkey;
use solana_transaction::Transaction;

use bitrouter_swig_sdk::instruction;
use bitrouter_swig_sdk::pda;
use bitrouter_swig_sdk::types::{AuthorityType, Permission};
use spl_associated_token_account::get_associated_token_address;
use spl_token::solana_program::program_pack::Pack as _;

use x402_signer::swig::SwigEmbeddedSigner;
use x402_signer::{X402Client, middleware::X402PaymentMiddleware};

// Devnet USDC mint.
const USDC_MINT: Pubkey = solana_pubkey::pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

/// Send a transaction, confirm it, and print the signature.
fn send(client: &RpcClient, ixs: &[Instruction], signers: &[&Keypair], label: &str) {
    let blockhash = client.get_latest_blockhash().expect("get_latest_blockhash");
    let payer_pk = signers[0].pubkey();
    let mut tx = Transaction::new_with_payer(ixs, Some(&payer_pk));
    tx.sign(signers, blockhash);
    let sig = client
        .send_and_confirm_transaction(&tx)
        .unwrap_or_else(|e| panic!("[{label}] send_and_confirm failed: {e}"));
    println!("  ✓ {label}  sig={sig}");
}

/// Build an SPL Token transfer instruction.
fn spl_transfer_ix(
    source: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
    amount: u64,
) -> Instruction {
    spl_token::instruction::transfer(&spl_token::ID, source, destination, authority, &[], amount)
        .expect("spl_transfer_ix")
}

/// Create an associated token account if it doesn't already exist.
fn ensure_ata(client: &RpcClient, payer: &Keypair, owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    let ata = get_associated_token_address(owner, mint);
    if client.get_account(&ata).is_ok() {
        println!("  ATA already exists: {ata}");
        return ata;
    }
    let ix = spl_associated_token_account::instruction::create_associated_token_account(
        &payer.pubkey(),
        owner,
        mint,
        &spl_token::ID,
    );
    send(client, &[ix], &[payer], "CreateATA");
    println!("  Created ATA: {ata}");
    ata
}

#[tokio::main]
async fn main() {
    println!("=== SWIG Embedded Wallet x402 Example ===\n");

    // ── 0. Load env vars ────────────────────────────────────────────
    let private_key_b58 = std::env::var("SOLANA_PRIVATE_KEY")
        .expect("Set SOLANA_PRIVATE_KEY to a base58-encoded Solana keypair");
    let rpc_url = std::env::var("SOLANA_RPC_URL")
        .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());
    let resource_url = std::env::var("RESOURCE_URL")
        .unwrap_or_else(|_| "http://localhost:3000/resource/multi_payments".to_string());
    let usdc_amount: u64 = std::env::var("USDC_AMOUNT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(10_000); // default: 0.01 USDC (6 decimals)

    let master = Keypair::from_base58_string(&private_key_b58);
    let master_pk = master.pubkey();
    let sync_rpc = RpcClient::new(&rpc_url);

    println!("RPC:      {rpc_url}");
    println!("Master:   {master_pk}");
    println!("Resource: {resource_url}");
    println!("USDC amt: {usdc_amount}\n");

    // ── 1. Create SWIG account ──────────────────────────────────────
    println!("1. Creating SWIG account...");
    let swig_id: [u8; 32] = rand::random();
    let (swig_account, bump) = pda::swig_account(&swig_id);
    let (wallet_address, wallet_bump) = pda::swig_wallet_address(&swig_account);
    println!("  SWIG account:  {swig_account}");
    println!("  Wallet PDA:    {wallet_address}");

    let create_ix = instruction::create::create_v1(
        swig_account,
        master_pk,
        wallet_address,
        swig_id,
        bump,
        wallet_bump,
        AuthorityType::Ed25519,
        &master_pk.to_bytes(),
        &[Permission::All],
    );
    send(&sync_rpc, &[create_ix], &[&master], "CreateSwigV1");
    println!();

    // ── 2. Fund the SWIG wallet with USDC ───────────────────────────
    println!("2. Transferring USDC to SWIG wallet...");
    let master_ata = get_associated_token_address(&master_pk, &USDC_MINT);
    let swig_ata = ensure_ata(&sync_rpc, &master, &wallet_address, &USDC_MINT);

    let transfer_ix = spl_transfer_ix(&master_ata, &swig_ata, &master_pk, usdc_amount);
    send(&sync_rpc, &[transfer_ix], &[&master], "TransferUSDC");

    // Verify balance.
    let account_data = sync_rpc
        .get_account_data(&swig_ata)
        .expect("get_account_data");
    let token_account = spl_token::state::Account::unpack(&account_data).expect("unpack");
    println!("  SWIG wallet USDC balance: {}", token_account.amount);
    println!();

    // Small delay to let the cluster settle.
    thread::sleep(Duration::from_secs(2));

    // ── 3. Build x402 client with SwigEmbeddedSigner ────────────────
    println!("3. Building x402 middleware client...");
    let async_rpc = solana_rpc_client::nonblocking::rpc_client::RpcClient::new(rpc_url.to_owned());
    let role_id = 0u32; // owner is always role 0
    let signer = SwigEmbeddedSigner::new(swig_account, master, role_id, async_rpc);
    let x402_client = X402Client::new(signer);
    let middleware = X402PaymentMiddleware::new(x402_client);
    let client = ClientBuilder::new(reqwest::Client::new())
        .with(middleware)
        .build();
    println!("  Client ready.\n");

    // ── 4. Make x402-protected request ──────────────────────────────
    println!("4. Requesting protected resource: {resource_url}");
    let response = client
        .post(&resource_url)
        .send()
        .await
        .expect("Request failed");

    println!("  Status: {}", response.status());
    let body = response.text().await.expect("Failed to read response body");
    println!("  Body:   {body}");

    // ── 5. Transfer remaining USDC back to master ───────────────────
    // (This step uses sign_v2 to reclaim funds from the SWIG wallet.)
    println!("\n5. Cleanup: transferring remaining USDC back to master is left to the user.");
    println!("\n=== Done ===");
}
