use crate::{Chain, ChainDeposit, ScannerMessage};
use alloy::{
    network::TransactionBuilder,
    primitives::{Address, B256, U256},
    providers::{Provider, ProviderBuilder},
    rpc::types::TransactionRequest,
    rpc::types::{Filter, Log},
    signers::local::PrivateKeySigner,
    sol,
    sol_types::SolEvent,
    transports::http::reqwest::Url,
};
use anyhow::Result;
use tokio::{
    sync::mpsc::UnboundedSender,
    time::{Duration, sleep},
};

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    EvmToken,
    "ERC20.json"
);

// Scanner state to track progress
#[derive(Debug)]
pub struct Scanner {
    index: usize,
    latency: u64,
    rpc: Url,
    tokens: Vec<Address>,
    event: B256,
    last_scanned_block: u64,
    sender: UnboundedSender<ScannerMessage>,
}

impl Scanner {
    pub async fn new(
        index: usize,
        chain: &Chain,
        sender: UnboundedSender<ScannerMessage>,
    ) -> Result<Self> {
        let event = EvmToken::Transfer::SIGNATURE_HASH;

        let mut scan = Self {
            index,
            latency: chain.latency as u64,
            rpc: chain.rpc.clone(),
            tokens: chain.assets.keys().copied().collect(),
            event,
            last_scanned_block: chain.last_scanned_block as u64,
            sender,
        };

        if scan.last_scanned_block == 0 {
            scan.last_scanned_block = scan.get_latest_block().await?;
        }

        Ok(scan)
    }

    // Get the latest block number from the chain
    async fn get_latest_block(&self) -> Result<u64> {
        let provider = ProviderBuilder::new().connect_http(self.rpc.clone());
        let block_number = provider.get_block_number().await?;
        Ok(block_number)
    }

    // Scan for transfer events in a block range
    async fn scan_range(&self, from_block: u64, to_block: u64) -> Result<()> {
        let provider = ProviderBuilder::new().connect_http(self.rpc.clone());

        // Create filter for Transfer events from our monitored tokens
        let filter = Filter::new()
            .address(self.tokens.clone())
            .event_signature(self.event)
            .from_block(from_block)
            .to_block(to_block);

        let logs = provider.get_logs(&filter).await?;
        for log in logs {
            if let Err(err) = self.handle_transfer_event(log) {
                tracing::error!("Parse event error: {:?}", err);
            }
        }

        Ok(())
    }

    // Parse a log into a TransferEvent
    fn handle_transfer_event(&self, log: Log) -> Result<()> {
        // ERC20 Transfer event signature: Transfer(address,address,uint256)
        let event = EvmToken::Transfer::decode_log(&log.inner)?;
        tracing::debug!("Fetch event: {}-{}:{}", event.from, event.to, event.value);

        // Send deposit message for processing
        let _ = self.sender.send(ScannerMessage::Deposit(
            self.index,
            ChainDeposit::Evm(
                log.address(), // token address
                event.to,
                event.value,
                log.transaction_hash.unwrap_or(B256::ZERO), // tx hash
            ),
        ));

        // block_number: log.block_number.unwrap_or(0),
        // log_index: log.log_index.unwrap_or(0),
        Ok(())
    }

    // Single scan iteration
    async fn scan_iteration(&mut self, max_blocks_per_scan: u64) -> Result<u64> {
        // IMPORTANT: for better finalized, we slower some-block, works for almost blockchain
        let latest_block = self.get_latest_block().await? - self.latency;

        if latest_block <= self.last_scanned_block {
            return Ok(0);
        }

        let from_block = self.last_scanned_block + 1;
        let to_block = std::cmp::min(from_block + max_blocks_per_scan, latest_block);

        self.scan_range(from_block, to_block).await?;
        let _ = self
            .sender
            .send(ScannerMessage::Scanned(self.index, to_block as i64));

        let scanned_blocks = to_block - from_block + 1;
        self.last_scanned_block = to_block;

        Ok(scanned_blocks)
    }

    // start scanning loop
    pub fn run(mut self) {
        tokio::spawn(async move {
            let max_blocks_per_scan = 100u64; // Limit blocks per scan to avoid RPC timeouts

            loop {
                let scan_interval = match self.scan_iteration(max_blocks_per_scan).await {
                    Ok(scanned_blocks) => {
                        if scanned_blocks > 0 {
                            tracing::info!(
                                "Chain {}: Scanned {} blocks, current block: {}",
                                self.index,
                                scanned_blocks,
                                self.last_scanned_block
                            );

                            // If we're catching up, scan faster
                            if scanned_blocks >= max_blocks_per_scan {
                                Duration::from_secs(1)
                            } else {
                                // Normal scanning interval
                                Duration::from_secs(10)
                            }
                        } else {
                            // No new blocks, increase interval slightly
                            Duration::from_secs(15)
                        }
                    }
                    Err(e) => {
                        tracing::error!("Chain {}: Scan error: {}", self.index, e);
                        // On error, wait longer before retrying
                        Duration::from_secs(30)
                    }
                };

                sleep(scan_interval).await;
            }
        });
    }
}

// transfer token from deposit to admin, return real merchant amount
#[allow(clippy::too_many_arguments)]
pub async fn transfer(
    customer: Address,
    merchant: Address,
    token: Address,
    wallet: PrivateKeySigner,
    main: PrivateKeySigner,
    url: Url,
    commission_rate: i32,
    commission_min: U256,
    commission_max: U256,
) -> Result<(U256, B256)> {
    let zero = U256::from(0);
    let maccount = main.address();
    let provider = ProviderBuilder::new()
        .wallet(main)
        .connect_http(url.clone());
    let gas_price = provider.get_gas_price().await? * 105 / 100; // add 5%
    let contract = EvmToken::new(token, provider.clone());

    // 1. check token balance
    let balance: U256 = contract.balanceOf(customer).call().await?;

    if balance == zero {
        return Err(anyhow::anyhow!("No balance"));
    }

    // 3. check approve or not
    let approved: U256 = contract.allowance(customer, maccount).call().await?;
    let need_approve = approved < balance;

    // 2. collect gas used, and do a discount in the amount
    let approve_gas = if need_approve {
        let gas = contract
            .approve(maccount, U256::from(100_000_000_000_000i64))
            .gas_price(gas_price)
            .estimate_gas()
            .await?;
        // add more 5%
        U256::from(gas * 105 / 100) * U256::from(gas_price)
    } else {
        zero
    };
    tracing::debug!("{customer}: approve_gas: {approve_gas}");

    let fee = if commission_rate > 0 {
        let rate = balance * U256::from(commission_rate) / U256::from(100);
        let rate_max = core::cmp::min(rate, commission_max);
        core::cmp::max(rate_max, commission_min)
    } else {
        zero
    };
    let real = balance - fee;
    tracing::info!("{customer}: commission: {fee}, real: {real}");

    if need_approve {
        // 4. if not approve, transfer approve gas to it
        let ttx = TransactionRequest::default()
            .with_to(customer)
            .with_value(approve_gas);
        let pending = provider.send_transaction(ttx).await?;
        tracing::debug!("{customer}: approve gas sent");
        let _receipt = pending.get_receipt().await?;
        tracing::debug!("{customer}: approve gas arrived");

        // 5. approve tokens to max
        let customer_provider = ProviderBuilder::new().wallet(wallet).connect_http(url);
        let customer_contract = EvmToken::new(token, customer_provider);
        let total = customer_contract
            .totalSupply()
            .call()
            .await
            .unwrap_or(U256::from(100_000_000_000_000i64));

        let pending = customer_contract
            .approve(maccount, total)
            .gas_price(gas_price)
            .send()
            .await?;
        tracing::debug!("{customer}: approved sent");
        let _receipt = pending.get_receipt().await?;
        tracing::debug!("{customer}: approved arrived");
    }

    // 6. transfer remain token to merchant
    let pending = contract
        .transferFrom(customer, merchant, real)
        .gas_price(gas_price)
        .send()
        .await?;
    tracing::debug!("{customer}: transfer real sent");
    let receipt = pending.get_receipt().await?;
    tracing::debug!("{customer}: transfer real arrived");

    if fee > zero {
        let pending2 = contract
            .transferFrom(customer, maccount, fee)
            .gas_price(gas_price)
            .send()
            .await?;
        tracing::debug!("{customer}: transfer commission sent");
        let _ = pending2.get_receipt().await?;
        tracing::debug!("{customer}: transfer commission arrived");
    }

    Ok((real, receipt.transaction_hash))
}

pub async fn get_token_decimal(token: Address, provider: impl Provider) -> Result<u8> {
    let contract = EvmToken::new(token, provider);
    Ok(contract.decimals().call().await?)
}

pub fn u256_to_i32(amount: U256, decimal: &u8) -> i32 {
    let res = if *decimal > 2 {
        amount / U256::from(10).pow(U256::from(*decimal - 2))
    } else {
        amount * U256::from(10).pow(U256::from(2 - *decimal))
    };

    res.try_into().unwrap_or(0)
}

pub fn i32_to_u256(amount: i32, decimal: &u8) -> U256 {
    if *decimal > 2 {
        U256::from(amount) * U256::from(10).pow(U256::from(*decimal - 2))
    } else {
        U256::from(amount) / U256::from(10).pow(U256::from(2 - *decimal))
    }
}
