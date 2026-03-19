/**
 * Solana Agent Kit - Wallet Management
 * Allows AI agents to create, import, and manage Solana wallets
 */

const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');
const bs58 = require('bs58');
const fs = require('fs');
const path = require('path');

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

class Wallet {
  constructor(keypair, rpcUrl = DEFAULT_RPC) {
    this.keypair = keypair;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Create a new random wallet
   */
  static create(rpcUrl = DEFAULT_RPC) {
    const keypair = Keypair.generate();
    return new Wallet(keypair, rpcUrl);
  }

  /**
   * Import wallet from private key (base58 or byte array)
   */
  static fromPrivateKey(privateKey, rpcUrl = DEFAULT_RPC) {
    let keypair;
    if (typeof privateKey === 'string') {
      // Base58 encoded
      keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    } else if (Array.isArray(privateKey)) {
      // Byte array (like from solana-keygen)
      keypair = Keypair.fromSecretKey(Uint8Array.from(privateKey));
    } else {
      throw new Error('Private key must be base58 string or byte array');
    }
    return new Wallet(keypair, rpcUrl);
  }

  /**
   * Import wallet from JSON file (solana-keygen format)
   */
  static fromFile(filePath, rpcUrl = DEFAULT_RPC) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Wallet.fromPrivateKey(data, rpcUrl);
  }

  /**
   * Get public key (address)
   */
  get address() {
    return this.keypair.publicKey.toBase58();
  }

  /**
   * Get private key as base58
   */
  get privateKey() {
    return bs58.encode(this.keypair.secretKey);
  }

  /**
   * Get SOL balance
   */
  async getBalance() {
    const balance = await this.connection.getBalance(this.keypair.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Get token balance for a specific mint
   */
  async getTokenBalance(mintAddress) {
    try {
      const mint = new PublicKey(mintAddress);
      const ata = await getAssociatedTokenAddress(mint, this.keypair.publicKey);
      const account = await getAccount(this.connection, ata);
      return Number(account.amount);
    } catch (e) {
      if (e.name === 'TokenAccountNotFoundError') {
        return 0;
      }
      throw e;
    }
  }

  /**
   * Get all token balances
   */
  async getAllTokenBalances() {
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
      this.keypair.publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    return tokenAccounts.value.map(({ account }) => {
      const info = account.data.parsed.info;
      return {
        mint: info.mint,
        amount: info.tokenAmount.uiAmount,
        decimals: info.tokenAmount.decimals,
        symbol: info.tokenAmount.uiAmountString
      };
    }).filter(t => t.amount > 0);
  }

  /**
   * Save wallet to file
   */
  save(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(Array.from(this.keypair.secretKey)));
    fs.chmodSync(filePath, 0o600);
    return filePath;
  }

  /**
   * Export wallet info (safe to log - no private key)
   */
  toJSON() {
    return {
      address: this.address,
      publicKey: this.keypair.publicKey.toBase58()
    };
  }
}

module.exports = { Wallet, DEFAULT_RPC };
