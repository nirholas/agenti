//! SVM client example using x402-signer reqwest middleware.
//!
//! Reads a base58 Solana private key from the `SOLANA_PRIVATE_KEY` env var,
//! then makes a POST request to an x402-protected resource server.
//! The middleware automatically handles the 402 → sign → retry flow.
//!
//! The SVM signer requires an RPC connection to fetch blockhash and mint info.
//! Set `SOLANA_RPC_URL` to a Solana devnet RPC endpoint.
//!
//! # Usage
//!
//! First, start the example seller server from x402-kit:
//! ```sh
//! FACILITATOR_URL=https://facilitator.example.com cargo run -p x402-kit --example axum_seller
//! ```
//!
//! Then run this client:
//! ```sh
//! SOLANA_PRIVATE_KEY=<base58> SOLANA_RPC_URL=https://api.devnet.solana.com RESOURCE_URL=http://localhost:3000/resource/multi_payments cargo run -p x402-signer --example svm_client
//! ```

use reqwest_middleware::ClientBuilder;
use solana_keypair::{Keypair, Signer};
use solana_rpc_client::nonblocking::rpc_client::RpcClient;

use x402_signer::{X402Client, middleware::X402PaymentMiddleware, svm::SvmPaymentSigner};

#[tokio::main]
async fn main() {
    let private_key_b58 = std::env::var("SOLANA_PRIVATE_KEY")
        .expect("Set SOLANA_PRIVATE_KEY to a base58-encoded Solana private key");

    let rpc_url = std::env::var("SOLANA_RPC_URL")
        .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string());

    let resource_url = std::env::var("RESOURCE_URL")
        .unwrap_or_else(|_| "http://localhost:3000/resource/multi_payments".to_string());

    // Parse base58 private key into a Keypair
    let keypair = Keypair::from_base58_string(&private_key_b58);
    println!("Signer pubkey: {}", keypair.pubkey());

    // Create an RPC client for devnet
    let rpc = RpcClient::new(rpc_url.clone());
    println!("Using RPC: {rpc_url}");

    // Build the x402 signing client with the SVM signer
    let svm_signer = SvmPaymentSigner::new(keypair, rpc);
    let x402_client = X402Client::new(svm_signer);
    let middleware = X402PaymentMiddleware::new(x402_client);

    // Build a reqwest client with the x402 middleware
    let client = ClientBuilder::new(reqwest::Client::new())
        .with(middleware)
        .build();

    // Make a request to the protected resource
    println!("Requesting: {resource_url}");
    let response = client
        .post(&resource_url)
        .send()
        .await
        .expect("Request failed");

    println!("Status: {}", response.status());
    let body = response.text().await.expect("Failed to read response body");
    println!("Body: {body}");
}
