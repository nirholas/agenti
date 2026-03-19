//! EVM client example using x402-signer reqwest middleware.
//!
//! Reads a hex private key from the `EVM_PRIVATE_KEY` env var (0x-prefixed),
//! then makes a POST request to an x402-protected resource server.
//! The middleware automatically handles the 402 → sign → retry flow.
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
//! EVM_PRIVATE_KEY=0x... RESOURCE_URL=http://localhost:3000/resource/standard cargo run -p x402-signer --example evm_client
//! ```

use alloy::signers::local::PrivateKeySigner;
use reqwest_middleware::ClientBuilder;

use x402_signer::{X402Client, evm::EvmPaymentSigner, middleware::X402PaymentMiddleware};

#[tokio::main]
async fn main() {
    let private_key = std::env::var("EVM_PRIVATE_KEY")
        .expect("Set EVM_PRIVATE_KEY to a 0x-prefixed hex private key");

    let resource_url = std::env::var("RESOURCE_URL")
        .unwrap_or_else(|_| "http://localhost:3000/resource/standard".to_string());

    // Parse the hex private key into an alloy local signer
    let wallet: PrivateKeySigner = private_key.parse().expect("Invalid EVM private key");
    println!("Signer address: {}", wallet.address());

    // Build the x402 signing client with the EVM signer
    let evm_signer = EvmPaymentSigner::new(wallet);
    let x402_client = X402Client::new(evm_signer);
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
