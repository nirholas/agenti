/**
 * Solana Agent Kit
 * A lightweight toolkit for AI agents to interact with Solana
 * 
 * @example
 * const { Wallet, Swapper, Transfer } = require('solana-agent-kit');
 * 
 * // Load wallet
 * const wallet = Wallet.fromFile('~/.config/solana/id.json');
 * 
 * // Check balance
 * const balance = await wallet.getBalance();
 * 
 * // Swap tokens
 * const swapper = new Swapper(wallet);
 * const result = await swapper.swap('SOL', 'USDC', 1000000000); // 1 SOL
 * 
 * // Transfer
 * const transfer = new Transfer(wallet);
 * await transfer.sendSol('recipient...', 0.1);
 */

const { Wallet, DEFAULT_RPC } = require('./src/wallet');
const { Swapper, TOKENS } = require('./src/swap');
const { Transfer } = require('./src/transfer');
const { Staking, VALIDATORS } = require('./src/stake');
const { AgentDEXClient } = require('./src/integrations/agentdex');

module.exports = {
  Wallet,
  Swapper,
  Transfer,
  Staking,
  AgentDEXClient,
  TOKENS,
  VALIDATORS,
  DEFAULT_RPC
};
