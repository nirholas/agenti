mod did;
mod event;
mod evm;

pub use did::generate_eth;
pub use event::ScannerEvent;

use alloy::{
    primitives::{Address, B256, U256},
    providers::{Provider, ProviderBuilder},
    signers::local::PrivateKeySigner,
    transports::http::reqwest::Url,
};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};

/// Chain configure
#[derive(Debug, Serialize, Deserialize)]
pub struct ScannerConfig {
    pub chains: Vec<ChainConfig>,
}

/// Chain configure
#[derive(Debug, Serialize, Deserialize)]
pub struct ChainConfig {
    pub chain_type: String,
    pub chain_name: String,
    pub latency: i32,
    pub estimation: i32,
    pub commission: i32,
    pub commission_min: i32,
    pub commission_max: i32,
    pub rpc: String,
    pub admin: Option<String>,
    pub tokens: Vec<String>,
}

/// Main storage interface for Scanner used
pub trait ScannerStorage: Send + Sync + 'static {
    fn get_scanned_block(&self, name: &str) -> impl Future<Output = Result<i64>> + Send;
    fn set_scanned_block(&self, name: &str, block: i64) -> impl Future<Output = Result<()>> + Send;
    fn contains_address(
        &self,
        address: &str,
    ) -> impl Future<Output = Result<(i32, i32, String)>> + Send;
    fn no_transaction(&self, tx: &str) -> impl Future<Output = Result<()>> + Send;
    fn deposited(
        &self,
        identity: String,
        mid: i32,
        cid: i32,
        amount: i32,
        tx: String,
    ) -> impl Future<Output = Result<i32>> + Send;
    fn settled(
        &self,
        identity: String,
        did: i32,
        amount: i32,
        tx: String,
    ) -> impl Future<Output = Result<()>> + Send;
}

#[derive(Clone, Copy, Debug)]
pub enum ChainType {
    Evm,
}

impl ChainType {
    fn from_str(s: &str) -> ChainType {
        match s.to_lowercase().as_str() {
            "evm" => ChainType::Evm,
            _ => ChainType::Evm,
        }
    }
}

struct Chain {
    chain_type: ChainType,
    chain_name: String,
    _chain_id: u64,
    latency: i64,
    commission: i32,
    commission_min: i32,
    commission_max: i32,
    rpc: Url,
    wallet: PrivateKeySigner,
    raw_wallet: String,
    assets: HashMap<Address, ChainAsset>,
    last_scanned_block: i64,
}

/// Chain common asset type
#[derive(Clone, Debug)]
pub struct ChainAsset {
    pub identity: String,
    pub address: String,
    pub name: String,
    pub version: String,
    pub decimal: u8,
}

/// filter the supported x402 protocol network and assets
#[derive(Clone, Debug)]
pub struct X402Asset {
    pub ctype: ChainType,
    pub rpc: String,
    pub network: String,
    pub signer: String,
    pub assets: Vec<ChainAsset>,
}

pub enum ChainDeposit {
    // token_address, to_address, amount, tx_hash
    Evm(Address, Address, U256, B256),
}

/// Scanner service message
pub enum ScannerMessage {
    /// new deposit, chain_id, deposit
    Deposit(usize, ChainDeposit),
    /// scanned block number
    Scanned(usize, i64),
}

pub struct ScannerService<S: ScannerStorage> {
    storage: S,
    mnemonics: String,
    chains: Vec<Chain>,
}

impl<S: ScannerStorage> ScannerService<S> {
    pub async fn new(storage: S, mnemonics: String, config: ScannerConfig) -> Result<Self> {
        // parse the chain configure
        let (default_sk, _addr) = generate_eth(0, 0, &mnemonics)?;
        let default_admin: PrivateKeySigner = default_sk.parse()?;
        let mut chains = vec![];
        for config in config.chains {
            let chain_type = ChainType::from_str(&config.chain_type);
            let (wallet, raw_wallet): (PrivateKeySigner, String) = if let Some(admin) = config.admin
            {
                (admin.parse()?, admin)
            } else {
                (default_admin.clone(), default_sk.clone())
            };
            let rpc: Url = config.rpc.parse()?;
            let provider = ProviderBuilder::new().connect_http(rpc.clone());
            let chain_id = provider.get_chain_id().await?;

            // fetch token decimal and also test the rpc is work
            let mut assets = HashMap::new();
            for t in config.tokens.iter() {
                let mut values = t.split(":");
                let name: String = values.next().unwrap_or_default().to_owned();
                let token: Address = values.next().unwrap_or_default().parse()?;
                let version = values.next().unwrap_or_default().to_owned(); // EIP-3009 x402
                let decimal = evm::get_token_decimal(token, provider.clone()).await?;
                let identity = format!("{}:{}", config.chain_name, name);

                let asset = ChainAsset {
                    identity,
                    address: token.to_checksum(None),
                    name,
                    version,
                    decimal,
                };
                assets.insert(token, asset);
            }

            let last_scanned_block = storage.get_scanned_block(&config.chain_name).await?;

            chains.push(Chain {
                chain_type,
                chain_name: config.chain_name,
                _chain_id: chain_id,
                latency: config.latency as i64,
                commission: config.commission,
                commission_min: config.commission_min,
                commission_max: config.commission_max,
                rpc,
                wallet,
                raw_wallet,
                assets,
                last_scanned_block,
            });
        }

        Ok(Self {
            storage,
            mnemonics,
            chains,
        })
    }

    pub async fn run(self) -> Result<(UnboundedSender<ScannerMessage>, Vec<X402Asset>)> {
        let (sender, receiver) = unbounded_channel::<ScannerMessage>();

        // start chain scanners
        let mut x402_assets = vec![];
        for (i, chain) in self.chains.iter().enumerate() {
            match chain.chain_type {
                ChainType::Evm => evm::Scanner::new(i, chain, sender.clone()).await?.run(),
            }
            tracing::info!(
                "{} scanning, main account: {}, tokens: {:?}",
                chain.chain_name,
                chain.wallet.address(),
                chain.assets.keys(),
            );
            let mut assets = vec![];
            for asset in chain.assets.values() {
                if !asset.version.is_empty() {
                    assets.push(asset.clone());
                }
            }
            if !assets.is_empty() {
                x402_assets.push(X402Asset {
                    ctype: chain.chain_type,
                    rpc: chain.rpc.to_string(),
                    network: chain.chain_name.clone(),
                    signer: chain.raw_wallet.clone(),
                    assets,
                })
            }
        }

        tokio::spawn(self.listen(receiver));
        Ok((sender, x402_assets))
    }

    async fn listen(self, mut recv: UnboundedReceiver<ScannerMessage>) {
        loop {
            match recv.recv().await {
                Some(ScannerMessage::Deposit(index, deposit)) => match deposit {
                    ChainDeposit::Evm(token, customer, value, tx) => {
                        let _ = self
                            .handle_evm_deposit(index, token, customer, value, tx)
                            .await;
                    }
                },
                Some(ScannerMessage::Scanned(index, block)) => {
                    let _ = self
                        .storage
                        .set_scanned_block(&self.chains[index].chain_name, block)
                        .await;
                }
                None => break,
            }
        }
    }

    async fn handle_evm_deposit(
        &self,
        index: usize,
        token: Address,
        customer: Address,
        value: U256,
        tx: B256,
    ) -> Result<()> {
        // 1. check address or transaction is exists
        let cs = customer.to_checksum(None);
        let tx = format!("{:?}", tx);
        let (mid, cid, merchant) = self.storage.contains_address(&cs).await?;
        self.storage.no_transaction(&tx).await?;
        let merchant: Address = merchant.parse()?;

        // 2. save the new deposited
        let chain = &self.chains[index];
        let asset = chain
            .assets
            .get(&token)
            .ok_or(anyhow::anyhow!("No token"))?;
        let amount = evm::u256_to_i32(value, &asset.decimal);
        let did = self
            .storage
            .deposited(asset.identity.clone(), mid, cid, amount, tx.clone())
            .await?;

        // 2. generate customer secret key
        let (sk, _addr) = generate_eth(mid, cid, &self.mnemonics)?;
        let customer_wallet: PrivateKeySigner = sk.parse()?;

        // 3. do transfer onchain
        let (settled_amount, settled_tx) = evm::transfer(
            customer,
            merchant,
            token,
            customer_wallet,
            chain.wallet.clone(),
            chain.rpc.clone(),
            chain.commission,
            evm::i32_to_u256(chain.commission_min, &asset.decimal),
            evm::i32_to_u256(chain.commission_max, &asset.decimal),
        )
        .await
        .map_err(|err| {
            tracing::error!("TRANSFER: {tx} failed: {:?}", err);
            err
        })?;

        // 4. save the settled to deposit
        let settled_amount = evm::u256_to_i32(settled_amount, &asset.decimal);
        let settled_tx = format!("{:?}", settled_tx);
        let _ = self
            .storage
            .settled(asset.identity.clone(), did, settled_amount, settled_tx)
            .await;

        Ok(())
    }
}

// pub async fn fetch_gas_token_price() -> Result<i32> {
//     let url = format!("https://api.coingecko.com/api/v3/simple/price?ids=name&vs_currencies=usd", name);
//     let response = reqwest::get(format!("")).await?;
//     let data = response.json()?.await?;
// }
